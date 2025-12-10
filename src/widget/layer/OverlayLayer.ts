import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import type { EventOverlayInfo, OverlayFigureData } from '../../component/Overlay'
import { OVERLAY_FIGURE_KEY_PREFIX } from '../../component/Overlay'
import type { Figure } from '../../component/Figure'
import { UpdateLevel } from '../../common/Updater'
import { PaneIdConstants } from '../../pane/types'
import OverlayView from '../../view/OverlayView'

/**
 * 覆盖物图层
 * 负责绘制用户绘制的覆盖物（画线工具等）
 */
export class OverlayLayer implements Layer {
  readonly name = 'overlay'
  private _overlayView: OverlayView

  constructor(widget: DrawWidget<DualYPane>) {
    this._overlayView = new OverlayView(widget)

    // 初始化事件处理
    this._initEvent(widget)

    // OverlayView 需要添加到 widget 的 children 中以接收事件
    widget.addChild(this._overlayView)
  }

  private _extractEventOverlayInfo(target: unknown, paneId: string): EventOverlayInfo | undefined {
    const figure = target as Figure<unknown, unknown, OverlayFigureData>
    if (!figure?.data) return undefined
    return { ...figure.data, paneId }
  }

  private _isSameEventOverlayInfo(a?: EventOverlayInfo, b?: EventOverlayInfo): boolean {
    return a?.overlay.id === b?.overlay.id && a?.interactType === b?.interactType && a?.figureIndex === b?.figureIndex
  }

  private _initEvent(widget: DrawWidget<DualYPane>): void {
    const pane = widget.getPane()
    const paneId = pane.getId()
    const chart = pane.getChart()
    const overlayStore = chart.getChartStore().getOverlayStore()

    // 鼠标移动事件 - 处理 onMouseEnter 和 onMouseLeave
    this._overlayView.addEventListener('mouseMoveEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()

      // 处理绘制中的 overlay
      if (progressOverlay) {
        // 如果还在 CREATED 状态，允许切换 pane
        if (progressOverlay.isCreated()) {
          overlayStore.updateProgressOverlayPane(paneId)
        }

        const pointIndex = progressOverlay.points.length - 1
        const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
        if (!progressOverlay.isCompleted() && progressOverlay.paneId === paneId) {
          progressOverlay.updateDrawPoint(this._overlayView.coordinateToPoint(progressOverlay, event))
          progressOverlay.onDrawing?.(event, { figureKey, pointIndex })
        }
        return false
      }

      // 获取当前 hover 的 figure 信息（从 event.target 获取）
      const hoverInfo = this._extractEventOverlayInfo(event.target, paneId)

      // 获取上一次 hover 的信息
      const lastHoverInfo = this._overlayView.getHoverInstanceInfo()

      // 检查是否切换了 overlay 或 figure
      if (!this._isSameEventOverlayInfo(lastHoverInfo, hoverInfo)) {
        let needUpdate = false

        // 触发 onMouseLeave（当从一个 figure 切换到另一个，或者移出所有 figure）
        if (lastHoverInfo?.overlay != null) {
          const overlay = lastHoverInfo.overlay

          // 触发 onMouseLeave
          const hasCallback = overlay.onMouseLeave?.(event, lastHoverInfo)

          if (!hasCallback) {
            needUpdate = true
          }
        }

        // 触发 onMouseEnter（仅当移入一个新的 figure）
        if (hoverInfo?.overlay != null) {
          const overlay = hoverInfo.overlay

          // 触发 onMouseEnter
          const hasCallback = overlay.onMouseEnter?.(event, hoverInfo)

          if (!hasCallback) {
            needUpdate = true
          }
        }

        // 更新 pane（如果需要）
        if (needUpdate) {
          chart.updatePane(UpdateLevel.Overlay, paneId)
        }

        this._overlayView.setHoverInstanceInfo(hoverInfo)
      }

      return false
    })

    // 鼠标点击事件 - 处理 onClick、onSelected 和 onDeselected
    this._overlayView.addEventListener('mouseClickEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay) {
        const pointIndex = progressOverlay.points.length - 1
        const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
        if (!progressOverlay.isCompleted() && progressOverlay.paneId === paneId) {
          progressOverlay.updateDrawPoint(this._overlayView.coordinateToPoint(progressOverlay, event))
          if (progressOverlay.isCreated()) {
            progressOverlay.onDrawStart?.(event, { figureKey, pointIndex })
          }
          progressOverlay.nextStep()
          progressOverlay.onDrawing?.(event, { figureKey, pointIndex })
          if (progressOverlay.isCompleted()) {
            overlayStore.progressOverlayComplete()
            progressOverlay.onDrawEnd?.(event, { figureKey, pointIndex })
          }
        }
        return false
      }

      // 获取当前点击的 figure 信息
      const clickInfo = this._extractEventOverlayInfo(event.target, paneId)

      // 触发 onClick
      if (clickInfo?.overlay?.isCompleted()) {
        clickInfo.overlay.onClick?.(event, clickInfo)
      }

      // 获取上一次 click 的信息
      const lastClickInfo = this._overlayView.getClickInstanceInfo()

      // 检查是否切换了选中的 overlay
      if (!this._isSameEventOverlayInfo(lastClickInfo, clickInfo)) {
        // 触发 onDeselected（取消选中上一个 overlay）
        if (lastClickInfo?.overlay != null) {
          lastClickInfo.overlay.onDeselected?.(event, lastClickInfo)
        }

        // 触发 onSelected（选中新的 overlay）
        if (clickInfo?.overlay != null) {
          clickInfo.overlay.onSelected?.(event, clickInfo)
        }

        // 更新全局选中状态（用于跨 pane 共享）
        overlayStore.setSelectedInfo(clickInfo)

        // 更新 pane
        if (lastClickInfo?.overlay?.id !== clickInfo?.overlay?.id) {
          chart.updatePane(UpdateLevel.Overlay, paneId)
          if (lastClickInfo != null && lastClickInfo.paneId !== paneId) {
            chart.updatePane(UpdateLevel.Overlay, lastClickInfo.paneId)
          }
          chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
        }

        this._overlayView.setClickInstanceInfo(clickInfo)
      }

      return false
    })

    // 鼠标按下事件 - 处理 onPressedMoveStart
    this._overlayView.addEventListener('mouseDownEvent', (event: MouseTouchEvent) => {
      const pressedInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (pressedInfo?.overlay != null) {
        const { overlay } = pressedInfo
        const chartStore = chart.getChartStore()
        overlay.startPressedMove(this._overlayView.coordinateToPoint(overlay, event), chartStore)
        overlay.onPressedMoveStart?.(event, pressedInfo)
        this._overlayView.setPressedInstanceInfo(pressedInfo)
      }
      return false
    })

    // 鼠标双击事件 - 处理 onDoubleClick
    this._overlayView.addEventListener('mouseDoubleClickEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay) {
        if (!progressOverlay.isCompleted() && progressOverlay.paneId === paneId) {
          // 使用智能完成：只有满足最小步骤要求时才完成
          const completed = progressOverlay.smartComplete()
          if (completed) {
            overlayStore.progressOverlayComplete()
            const pointIndex = progressOverlay.points.length - 1
            const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
            progressOverlay.onDrawEnd?.(event, { figureKey, pointIndex })
          }
          // 如果不满足完成条件，双击事件被忽略，继续绘制
        }
        return false
      }

      // 处理完成的 overlay 的双击事件
      const doubleClickInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (doubleClickInfo?.overlay != null) {
        const { overlay } = doubleClickInfo
        overlay.onDoubleClick?.(event, doubleClickInfo)
      }
      return false
    })

    // 鼠标右键事件 - 处理 onRightClick
    this._overlayView.addEventListener('contextMenuEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      // 绘制中不触发右键
      if (progressOverlay) {
        return false
      }

      // 处理完成的 overlay 的右键事件
      const rightClickInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (rightClickInfo?.overlay != null) {
        const { overlay } = rightClickInfo
        if (!(overlay.onRightClick?.(event, rightClickInfo) ?? false)) {
          overlayStore.removeInstance(overlay)
        }
      }
      return false
    })

    // 鼠标抬起事件 - 处理 onPressedMoveEnd
    this._overlayView.addEventListener('mouseUpEvent', (event: MouseTouchEvent) => {
      const pressedInfo = this._overlayView.getPressedInstanceInfo()
      if (pressedInfo?.overlay != null) {
        pressedInfo.overlay.onPressedMoveEnd?.(event, pressedInfo)
      }
      this._overlayView.setPressedInstanceInfo()
      return false
    })

    // 按住拖动事件 - 处理 onPressedMoving
    this._overlayView.addEventListener('pressedMouseMoveEvent', (event: MouseTouchEvent) => {
      const pressedInfo = this._overlayView.getPressedInstanceInfo()
      if (pressedInfo?.overlay != null) {
        const overlay = pressedInfo.overlay
        if (!overlay.lock) {
          const defaultPrevented = overlay.onPressedMoving?.(event, pressedInfo) ?? false
          if (!defaultPrevented) {
            const point = this._overlayView.coordinateToPoint(overlay, event)
            if (pressedInfo.interactType === 'control-point') {
              overlay.onDragMoveControlPoint(point, pressedInfo.figureIndex)
            } else {
              overlay.onDragMoveBody(point, pane.getChart().getChartStore())
            }
          }
        }
        return true
      }
      return false
    })
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._overlayView.draw(ctx)
  }
}
