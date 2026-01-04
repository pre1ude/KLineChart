import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import type { MouseTouchEvent, OverlayEventData } from '../../common/SyntheticEvent'
import type { EventOverlayInfo, OverlayFigureData, OverlayMouseTouchEvent, Overlay } from '../../component/Overlay'
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
    this._initEvent(widget)
    widget.addChild(this._overlayView)
  }

  /** 从 event.target 提取 overlay 信息 */
  private _extractEventOverlayInfo(target: unknown, paneId: string): EventOverlayInfo | undefined {
    const figure = target as Figure<unknown, unknown, OverlayFigureData>
    if (!figure?.data) return undefined
    return { ...figure.data, paneId }
  }

  private _isSameOverlay(a?: EventOverlayInfo, b?: EventOverlayInfo): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    return a.overlay.id === b.overlay.id
  }

  private _isSameFigure(a?: EventOverlayInfo, b?: EventOverlayInfo): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    return a.overlay.id === b.overlay.id && a.interactType === b.interactType && a.figureIndex === b.figureIndex
  }

  /** 创建带 overlayData 的事件对象 */
  private _createOverlayEvent<E>(
    event: MouseTouchEvent,
    overlay: Overlay<E>,
    paneId: string,
    extra?: Partial<Pick<OverlayEventData, 'interactType' | 'figureKey' | 'figureIndex' | 'attrsIndex' | 'pointIndex'>>
  ): OverlayMouseTouchEvent<E> {
    const overlayEvent = event as OverlayMouseTouchEvent<E>
    overlayEvent.overlayData = {
      overlay,
      paneId,
      interactType: extra?.interactType ?? 'body',
      figureKey: extra?.figureKey ?? '',
      figureIndex: extra?.figureIndex ?? 0,
      attrsIndex: extra?.attrsIndex ?? 0,
      pointIndex: extra?.pointIndex
    }
    return overlayEvent
  }

  /** 从 EventOverlayInfo 创建带 overlayData 的事件对象 */
  private _createOverlayEventFromInfo<E>(event: MouseTouchEvent, info: EventOverlayInfo): OverlayMouseTouchEvent<E> {
    return this._createOverlayEvent(event, info.overlay as Overlay<E>, info.paneId, {
      interactType: info.interactType,
      figureKey: info.figureKey,
      figureIndex: info.figureIndex,
      attrsIndex: info.attrsIndex
    })
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

        if (!progressOverlay.isCompleted() && progressOverlay.paneId === paneId) {
          const pointIndex = progressOverlay.points.length - 1
          const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
          progressOverlay.updateDrawPoint(this._overlayView.coordinateToPoint(progressOverlay, event))
          progressOverlay.onDrawing?.(this._createOverlayEvent(event, progressOverlay, paneId, { figureKey, pointIndex }))
        }
        return false
      }

      const hoverInfo = this._extractEventOverlayInfo(event.target, paneId)
      const lastHoverInfo = this._overlayView.getHoverInstanceInfo()

      if (!this._isSameOverlay(lastHoverInfo, hoverInfo)) {
        let needUpdate = false

        if (lastHoverInfo?.overlay != null) {
          const hasCallback = lastHoverInfo.overlay.onMouseLeave?.(this._createOverlayEventFromInfo(event, lastHoverInfo))
          if (!hasCallback) needUpdate = true // hasCallback false 表示默认触发更新
        }

        if (hoverInfo?.overlay != null) {
          const hasCallback = hoverInfo.overlay.onMouseEnter?.(this._createOverlayEventFromInfo(event, hoverInfo))
          if (!hasCallback) needUpdate = true // hasCallback false 表示默认触发更新
        }

        if (needUpdate) {
          chart.updatePane(UpdateLevel.Overlay, paneId)
        }
      }

      // 始终更新 hoverInfo（用于其他用途，如高亮当前 figure）
      if (!this._isSameFigure(lastHoverInfo, hoverInfo)) {
        this._overlayView.setHoverInstanceInfo(hoverInfo)
      }

      return false
    })

    // 鼠标点击事件 - 处理 onClick、onSelected 和 onDeselected
    this._overlayView.addEventListener('mouseClickEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay) {
        if (!progressOverlay.isCompleted() && progressOverlay.paneId === paneId) {
          const pointIndex = progressOverlay.points.length - 1
          const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
          progressOverlay.updateDrawPoint(this._overlayView.coordinateToPoint(progressOverlay, event))

          if (progressOverlay.isCreated()) {
            progressOverlay.onDrawStart?.(this._createOverlayEvent(event, progressOverlay, paneId, { figureKey, pointIndex }))
            const overlayInfo: EventOverlayInfo = {
              overlay: progressOverlay,
              interactType: 'body',
              figureKey: '',
              figureIndex: 0,
              attrsIndex: 0,
              paneId
            }
            overlayStore.setSelectedInfo(overlayInfo)
            this._overlayView.setClickInstanceInfo(overlayInfo)
          }
          progressOverlay.nextStep()
          progressOverlay.onDrawing?.(this._createOverlayEvent(event, progressOverlay, paneId, { figureKey, pointIndex }))

          if (progressOverlay.isCompleted()) {
            overlayStore.progressOverlayComplete()
            progressOverlay.onDrawEnd?.(this._createOverlayEvent(event, progressOverlay, paneId, { figureKey, pointIndex }))
          }
        }
        return false
      }

      const clickInfo = this._extractEventOverlayInfo(event.target, paneId)

      if (clickInfo?.overlay?.isCompleted()) {
        clickInfo.overlay.onClick?.(this._createOverlayEventFromInfo(event, clickInfo))
      }

      const lastClickInfo = this._overlayView.getClickInstanceInfo()

      if (!this._isSameOverlay(lastClickInfo, clickInfo)) {
        if (lastClickInfo?.overlay != null) {
          lastClickInfo.overlay.onDeselected?.(this._createOverlayEventFromInfo(event, lastClickInfo))
        }

        if (clickInfo?.overlay != null) {
          clickInfo.overlay.onSelected?.(this._createOverlayEventFromInfo(event, clickInfo))
        }

        overlayStore.setSelectedInfo(clickInfo)

        chart.updatePane(UpdateLevel.Overlay, paneId)
        if (lastClickInfo != null && lastClickInfo.paneId !== paneId) {
          chart.updatePane(UpdateLevel.Overlay, lastClickInfo.paneId)
        }
        chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
      }

      // 始终更新 clickInfo（记录最后点击的 figure）
      if (!this._isSameFigure(lastClickInfo, clickInfo)) {
        this._overlayView.setClickInstanceInfo(clickInfo)
      }

      return false
    })

    // 鼠标按下事件
    let hasMoved = false
    this._overlayView.addEventListener('mouseDownEvent', (event: MouseTouchEvent) => {
      // 绘制中不允许拖动已绘制的 overlay
      if (overlayStore.getProgressOverlay()) return false

      const pressedInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (pressedInfo?.overlay != null) {
        const { overlay } = pressedInfo
        overlay.startPressedMove(this._overlayView.coordinateToPoint(overlay, event), chart.getChartStore())
        this._overlayView.setPressedInstanceInfo(pressedInfo)
        hasMoved = false
      }
      return false
    })

    // 鼠标双击事件 - 处理 onDoubleClick
    this._overlayView.addEventListener('mouseDoubleClickEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay) {
        if (!progressOverlay.isCompleted() && progressOverlay.paneId === paneId) {
          const completed = progressOverlay.smartComplete()
          if (completed) {
            overlayStore.progressOverlayComplete()
            const pointIndex = progressOverlay.points.length - 1
            const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
            progressOverlay.onDrawEnd?.(this._createOverlayEvent(event, progressOverlay, paneId, { figureKey, pointIndex }))
            const completedInfo: EventOverlayInfo = {
              overlay: progressOverlay,
              interactType: 'body',
              figureKey: '',
              figureIndex: 0,
              attrsIndex: 0,
              paneId
            }
            overlayStore.setSelectedInfo(completedInfo)
            this._overlayView.setClickInstanceInfo(completedInfo)
          }
        }
        return false
      }

      const doubleClickInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (doubleClickInfo?.overlay != null) {
        doubleClickInfo.overlay.onDoubleClick?.(this._createOverlayEventFromInfo(event, doubleClickInfo))
      }
      return false
    })

    // 鼠标右键事件 - 处理 onRightClick
    this._overlayView.addEventListener('contextMenuEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()

      const rightClickInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (rightClickInfo?.overlay != null) {
        if (progressOverlay) {
          if (rightClickInfo.interactType === 'control-point') return false
          if (progressOverlay === rightClickInfo.overlay) return false
        }
        const { overlay } = rightClickInfo
        if (!(overlay.onRightClick?.(this._createOverlayEventFromInfo(event, rightClickInfo)) ?? false)) {
          overlayStore.removeInstance(overlay)
        }
      }
      return false
    })

    // 鼠标抬起事件
    this._overlayView.addEventListener('mouseUpEvent', (event: MouseTouchEvent) => {
      const pressedInfo = this._overlayView.getPressedInstanceInfo()
      if (pressedInfo?.overlay != null && hasMoved) {
        pressedInfo.overlay.onPressedMoveEnd?.(this._createOverlayEventFromInfo(event, pressedInfo))
      }
      this._overlayView.setPressedInstanceInfo()
      hasMoved = false
      return false
    })

    // 按住拖动事件 - 处理 onPressedMoving
    this._overlayView.addEventListener('pressedMouseMoveEvent', (event: MouseTouchEvent) => {
      const pressedInfo = this._overlayView.getPressedInstanceInfo()
      if (pressedInfo?.overlay != null) {
        const overlay = pressedInfo.overlay
        if (!overlay.lock) {
          if (!hasMoved) {
            hasMoved = true
            overlay.onPressedMoveStart?.(this._createOverlayEventFromInfo(event, pressedInfo))
          }
          const defaultPrevented = overlay.onPressedMoving?.(this._createOverlayEventFromInfo(event, pressedInfo)) ?? false
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
