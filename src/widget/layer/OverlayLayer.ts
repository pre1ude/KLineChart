import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import type { EventOverlayInfo, Overlay, OverlayFigureData } from '../../component/Overlay'
import { OVERLAY_FIGURE_KEY_PREFIX } from '../../component/Overlay'
import type { Figure } from '../../component/Figure'
import { UpdateLevel } from '../../common/Updater'
import { PaneIdConstants } from '../../pane/types'
import OverlayView from '../../view/OverlayView'
import { createOverlayEvent, createOverlayEventFromInfo } from '../../common/utils/overlayEvent'
import { type IPoint, type Point } from '@/common/Point'
import { isNumber } from '../../common/utils/typeChecks'

interface OverlayDragState {
  overlayId: string
  point: Point
  points: Point[]
  dataVersion: number
  pointerIndex?: number
  projectedPoints?: IPoint[]
}

/**
 * 覆盖物图层
 * 负责绘制用户绘制的覆盖物（画线工具等）
 */
export class OverlayLayer implements Layer {
  readonly name = 'overlay'
  private _overlayView: OverlayView
  private readonly _widget: DrawWidget<DualYPane>
  private _dragState?: OverlayDragState

  constructor(widget: DrawWidget<DualYPane>) {
    this._widget = widget
    this._overlayView = new OverlayView(widget)
    this._initEvent(widget)
    widget.addChild(this._overlayView)
  }

  /** 从 event.target 提取 overlay 信息 */
  private _extractEventOverlayInfo(target: unknown, paneId: string): EventOverlayInfo | undefined {
    const figure = target as Figure<unknown, unknown, OverlayFigureData>
    if (!figure?.data) return undefined

    const figureData = figure.data
    const overlay = this._widget.getPane().getChart().getChartStore().getOverlayStore().getInstanceById(figureData.overlayId)

    if (!overlay) return undefined

    return {
      overlay,
      paneId,
      interactType: figureData.interactType,
      figureKey: figureData.figureKey,
      figureIndex: figureData.figureIndex,
      attrsIndex: figureData.attrsIndex
    }
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

  private _startDrag(overlay: Overlay, point: Point): void {
    const chartStore = this._widget.getPane().getChart().getChartStore()
    this._dragState = {
      overlayId: overlay.id,
      point: { ...point },
      points: overlay.points.map(p => ({ ...p })),
      dataVersion: chartStore.getDataVersion(),
      pointerIndex: chartStore.externalToInternal(point).dataIndex,
      projectedPoints: chartStore.getOverlayStore().getProjectedPoints(overlay)
    }
  }

  private _moveBody(overlay: Overlay, point: Point): void {
    const drag = this._dragState
    if (drag?.overlayId !== overlay.id) return
    const chartStore = this._widget.getPane().getChart().getChartStore()
    const version = chartStore.getDataVersion()
    if (version !== drag.dataVersion) {
      // Reproject the original time points if loading moves the index origin.
      drag.pointerIndex = chartStore.externalToInternal(drag.point).dataIndex
      drag.projectedPoints = chartStore.getOverlayStore().getProjectedPoints(drag)
      drag.dataVersion = version
    }
    const dataIndex = chartStore.externalToInternal(point).dataIndex
    if (!drag.projectedPoints || !isNumber(dataIndex) || !isNumber(drag.pointerIndex)) return

    const deltaIndex = dataIndex - drag.pointerIndex
    const deltaValue = point.value - drag.point.value
    const movedPoints: Point[] = []
    for (let i = 0; i < drag.points.length; i++) {
      const original = drag.points[i]
      if (deltaIndex === 0) {
        movedPoints.push({ ...original, value: original.value + deltaValue })
      } else {
        const moved = chartStore.internalToExternal({
          dataIndex: drag.projectedPoints[i].dataIndex + deltaIndex,
          value: original.value + deltaValue
        })
        if (!isNumber(moved.timestamp) || !isNumber(moved.value)) return
        movedPoints.push(moved as Point)
      }
    }
    overlay.onDragMoveBody({ point, prevPoint: drag.point, prevPoints: drag.points, movedPoints })
  }

  private _moveControlPoint(overlay: Overlay, point: Point, pointIndex: number, controlPointKey: string): void {
    const chartStore = this._widget.getPane().getChart().getChartStore()
    const previous = overlay.points.map(p => ({ ...p }))
    const projected = chartStore.getOverlayStore().getProjectedPoints(overlay)
    overlay.onDragMoveControlPoint(point, pointIndex, controlPointKey)

    // Preserve every anchor whose displayed X did not change, including linked
    // anchors updated by a template and virtual rectangle controls.
    if (projected) {
      overlay.points.forEach((current, index) => {
        const original = previous[index]
        if (!original || !projected[index]) return
        if (current.timestamp === original.timestamp && current.offset === original.offset) return
        const dataIndex = chartStore.externalToInternal(current).dataIndex
        if (isNumber(dataIndex) && dataIndex === projected[index].dataIndex) {
          overlay.points[index] = { ...original, value: current.value }
        }
      })
    }
  }

  private _initEvent(widget: DrawWidget<DualYPane>): void {
    const pane = widget.getPane()
    const paneId = pane.getId()
    const chart = pane.getChart()
    const chartStore = chart.getChartStore()
    const overlayStore = chartStore.getOverlayStore()
    const selectOverlay = (nextSelectedInfo: EventOverlayInfo, event: MouseTouchEvent): void => {
      const lastSelectedInfo = overlayStore.getSelectedInfo()

      if (this._isSameOverlay(lastSelectedInfo, nextSelectedInfo)) return

      if (lastSelectedInfo?.overlay != null) {
        lastSelectedInfo.overlay.onDeselected?.(createOverlayEventFromInfo(event, lastSelectedInfo, chartStore))
      }

      nextSelectedInfo.overlay.onSelected?.(createOverlayEventFromInfo(event, nextSelectedInfo, chartStore))

      overlayStore.setSelectedInfo(nextSelectedInfo)

      chart.updatePane(UpdateLevel.Overlay, nextSelectedInfo.paneId)
      if (lastSelectedInfo != null && lastSelectedInfo.paneId !== nextSelectedInfo.paneId) {
        chart.updatePane(UpdateLevel.Overlay, lastSelectedInfo.paneId)
      }
      chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
    }

    const updateHoverPanes = (lastHoverInfo?: EventOverlayInfo, hoverInfo?: EventOverlayInfo): void => {
      if (lastHoverInfo?.paneId != null) {
        chart.updatePane(UpdateLevel.Overlay, lastHoverInfo.paneId)
      }
      if (hoverInfo?.paneId != null && hoverInfo.paneId !== lastHoverInfo?.paneId) {
        chart.updatePane(UpdateLevel.Overlay, hoverInfo.paneId)
      }
    }

    const clearHover = (event: MouseTouchEvent): void => {
      const lastHoverInfo = overlayStore.clearHoverInfo()
      if (lastHoverInfo?.overlay != null) {
        lastHoverInfo.overlay.onMouseLeave?.(createOverlayEventFromInfo(event, lastHoverInfo, chartStore))
        chart.updatePane(UpdateLevel.Overlay, lastHoverInfo.paneId)
      }
    }

    // 鼠标移动事件 - 处理 onMouseEnter 和 onMouseLeave
    this._overlayView.addEventListener('mouseMoveEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()

      // 处理绘制中的 overlay
      if (progressOverlay) {
        const progressPaneId = overlayStore.getProgressOverlayPaneId()
        const isProgressPaneMatched = progressPaneId.length === 0 || progressPaneId === paneId
        if (!progressOverlay.isCompleted() && isProgressPaneMatched) {
          const pointIndex = progressOverlay.points.length - 1
          const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
          const point = this._overlayView.coordinateToPoint(progressOverlay, event)
          if (!point) return
          progressOverlay.updateDrawPoint(point)
          progressOverlay.onDrawing?.(createOverlayEvent(event, progressOverlay, paneId, chartStore, { figureKey, pointIndex }))
        }
        return
      }

      const hoverInfo = this._extractEventOverlayInfo(event.target, paneId)
      const lastHoverInfo = overlayStore.getHoverInfo()
      const isSameOverlay = this._isSameOverlay(lastHoverInfo, hoverInfo)
      const isSameFigure = this._isSameFigure(lastHoverInfo, hoverInfo)

      if (!isSameOverlay) {
        if (lastHoverInfo?.overlay != null) {
          lastHoverInfo.overlay.onMouseLeave?.(createOverlayEventFromInfo(event, lastHoverInfo, chartStore))
        }

        if (hoverInfo?.overlay != null) {
          hoverInfo.overlay.onMouseEnter?.(createOverlayEventFromInfo(event, hoverInfo, chartStore))
        }

        updateHoverPanes(lastHoverInfo, hoverInfo)
      }

      // 始终更新 hoverInfo（用于其他用途，如高亮当前 figure）
      if (!isSameFigure) {
        overlayStore.setHoverInfo(hoverInfo)
        if (isSameOverlay) {
          updateHoverPanes(lastHoverInfo, hoverInfo)
        }
      }
    })

    this._overlayView.addEventListener('mouseLeaveEvent', (event: MouseTouchEvent) => {
      if (overlayStore.getHoverInfo()?.paneId === paneId) {
        clearHover(event)
      }
    })

    // 鼠标点击事件 - 处理 onClick
    this._overlayView.addEventListener('mouseClickEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay) {
        overlayStore.updateProgressOverlayPane(paneId)
        const progressPaneId = overlayStore.getProgressOverlayPaneId()
        const isProgressPaneMatched = progressPaneId.length === 0 || progressPaneId === paneId
        if (!progressOverlay.isCompleted() && isProgressPaneMatched) {
          const pointIndex = progressOverlay.points.length - 1
          const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
          const point = this._overlayView.coordinateToPoint(progressOverlay, event)
          if (!point) return
          progressOverlay.updateDrawPoint(point)
          const overlayEvent = createOverlayEvent(event, progressOverlay, paneId, chartStore, { figureKey, pointIndex })

          if (progressOverlay.isCreated()) {
            progressOverlay.onDrawStart?.(overlayEvent)
            const overlayInfo: EventOverlayInfo = {
              overlay: progressOverlay,
              interactType: 'body',
              figureKey: '',
              figureIndex: 0,
              attrsIndex: 0,
              paneId
            }
            overlayStore.setSelectedInfo(overlayInfo)
          }
          progressOverlay.nextStep()
          progressOverlay.onDrawing?.(overlayEvent)

          if (progressOverlay.isCompleted()) {
            overlayStore.progressOverlayComplete()
            progressOverlay.onDrawEnd?.(overlayEvent)
          }
        }
        return
      }

      const clickInfo = this._extractEventOverlayInfo(event.target, paneId)

      if (clickInfo?.overlay?.isCompleted()) {
        clickInfo.overlay.onClick?.(createOverlayEventFromInfo(event, clickInfo, chartStore))
      }
    })

    // 鼠标按下事件
    let hasMoved = false
    let pressedInfo: EventOverlayInfo | undefined
    let progressPressedOverlayId: string | undefined
    let progressPressedPoint: Point | undefined
    let progressPressedEvent: MouseTouchEvent | undefined
    this._overlayView.addEventListener('mouseDownEvent', (event: MouseTouchEvent) => {
      this._dragState = undefined
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay) {
        overlayStore.updateProgressOverlayPane(paneId)
        const progressPaneId = overlayStore.getProgressOverlayPaneId()
        const isProgressPaneMatched = progressPaneId.length === 0 || progressPaneId === paneId
        if (!progressOverlay.isCompleted() && isProgressPaneMatched) {
          progressPressedOverlayId = progressOverlay.id
          progressPressedEvent = event
          progressPressedPoint = progressOverlay.isCreated()
            ? this._overlayView.coordinateToPoint(progressOverlay, event)
            : undefined
          overlayStore.setPressed(true)
          overlayStore.setDragging(false)
        }
        // 绘制中的 overlay 不允许拖动已绘制的 overlay
        return
      }

      const nextPressedInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (nextPressedInfo?.overlay != null) {
        const { overlay } = nextPressedInfo
        if (overlay.isCompleted()) {
          selectOverlay(nextPressedInfo, event)
        }
        if (overlay.lock) return
        const point = this._overlayView.coordinateToPoint(overlay, event)
        if (!point) return
        this._startDrag(overlay, point)
        pressedInfo = nextPressedInfo
        overlayStore.setPressed(true)
        overlayStore.setDragging(false)
        hasMoved = false
      }
    })

    // 鼠标双击事件 - 处理 onDoubleClick
    this._overlayView.addEventListener('mouseDoubleClickEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay) {
        const progressPaneId = overlayStore.getProgressOverlayPaneId()
        const isProgressPaneMatched = progressPaneId.length === 0 || progressPaneId === paneId
        if (!progressOverlay.isCompleted() && isProgressPaneMatched) {
          const completed = progressOverlay.smartComplete()
          if (completed) {
            overlayStore.progressOverlayComplete()
            const pointIndex = progressOverlay.points.length - 1
            const figureKey = `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`
            progressOverlay.onDrawEnd?.(createOverlayEvent(event, progressOverlay, paneId, chartStore, { figureKey, pointIndex }))
            const completedInfo: EventOverlayInfo = {
              overlay: progressOverlay,
              interactType: 'body',
              figureKey: '',
              figureIndex: 0,
              attrsIndex: 0,
              paneId
            }
            overlayStore.setSelectedInfo(completedInfo)
          }
        }
        return
      }

      const doubleClickInfo = this._extractEventOverlayInfo(event.target, paneId)
      if (doubleClickInfo?.overlay != null) {
        doubleClickInfo.overlay.onDoubleClick?.(createOverlayEventFromInfo(event, doubleClickInfo, chartStore))
      }
    })

    // 鼠标右键事件 - 处理 onRightClick
    this._overlayView.addEventListener('contextMenuEvent', (event: MouseTouchEvent) => {
      const rightClickInfo = this._extractEventOverlayInfo(event.target, paneId)

      // 直接在事件对象上设置 overlay 信息，这样冒泡到上层时可以直接读取
      if (rightClickInfo?.overlay != null) {
        event.overlayData = {
          overlay: rightClickInfo.overlay,
          paneId: rightClickInfo.paneId,
          interactType: rightClickInfo.interactType,
          figureKey: rightClickInfo.figureKey,
          figureIndex: rightClickInfo.figureIndex,
          attrsIndex: rightClickInfo.attrsIndex,
          internalToExternal: (point: IPoint) => chartStore.internalToExternal(point)
        }

        const { overlay } = rightClickInfo
        const overlayEvent = createOverlayEventFromInfo(event, rightClickInfo, chartStore)
        // 调用 overlay 的 onRightClick 回调
        overlay.onRightClick?.(overlayEvent)
      }
    })

    // 鼠标抬起事件
    this._overlayView.addEventListener('mouseUpEvent', (event: MouseTouchEvent) => {
      this._dragState = undefined
      if (progressPressedOverlayId != null) {
        progressPressedOverlayId = undefined
        progressPressedPoint = undefined
        progressPressedEvent = undefined
        overlayStore.setPressed(false)
        overlayStore.setDragging(false)
        return
      }

      if (pressedInfo?.overlay != null && hasMoved) {
        pressedInfo.overlay.onPressedMoveEnd?.(createOverlayEventFromInfo(event, pressedInfo, chartStore))
      }
      pressedInfo = undefined
      overlayStore.setPressed(false)
      overlayStore.setDragging(false)
      hasMoved = false
    })

    // 按住拖动事件 - 处理 onPressedMoving
    this._overlayView.addEventListener('pressedMouseMoveEvent', (event: MouseTouchEvent) => {
      const progressOverlay = overlayStore.getProgressOverlay()
      if (progressOverlay && progressOverlay.id === progressPressedOverlayId) {
        const progressPaneId = overlayStore.getProgressOverlayPaneId()
        const isProgressPaneMatched = progressPaneId.length === 0 || progressPaneId === paneId
        if (!progressOverlay.isCompleted() && isProgressPaneMatched) {
          // 鼠标按住时 SyntheticEvent 不会派发普通 mouseMoveEvent，第一次拖动到阈值后才在这里提交起点并更新预览终点。
          if (progressOverlay.isCreated() && progressPressedPoint != null) {
            progressOverlay.updateDrawPoint(progressPressedPoint)
            const startEvent = progressPressedEvent ?? event
            const startPointIndex = progressOverlay.currentStep
            const startOverlayEvent = createOverlayEvent(startEvent, progressOverlay, paneId, chartStore, {
              figureKey: `${OVERLAY_FIGURE_KEY_PREFIX}point_${startPointIndex}`,
              pointIndex: startPointIndex
            })
            progressOverlay.onDrawStart?.(startOverlayEvent)
            const overlayInfo: EventOverlayInfo = {
              overlay: progressOverlay,
              interactType: 'body',
              figureKey: '',
              figureIndex: 0,
              attrsIndex: 0,
              paneId
            }
            overlayStore.setSelectedInfo(overlayInfo)
            progressOverlay.nextStep()

            if (progressOverlay.isCompleted()) {
              overlayStore.progressOverlayComplete()
              progressOverlay.onDrawEnd?.(startOverlayEvent)
              chart.updatePane(UpdateLevel.Overlay, paneId)
              return
            }
          }

          const pointIndex = progressOverlay.currentStep
          const point = this._overlayView.coordinateToPoint(progressOverlay, event)
          if (!point) return
          progressOverlay.updateDrawPoint(point)
          progressOverlay.onDrawing?.(createOverlayEvent(event, progressOverlay, paneId, chartStore, {
            figureKey: `${OVERLAY_FIGURE_KEY_PREFIX}point_${pointIndex}`,
            pointIndex
          }))
          overlayStore.setDragging(true)
          chart.updatePane(UpdateLevel.Overlay, paneId)
        }
        return
      }

      if (pressedInfo?.overlay != null) {
        const overlay = pressedInfo.overlay
        const overlayEvent = createOverlayEventFromInfo(event, pressedInfo, chartStore)

        if (!hasMoved) {
          hasMoved = true
          overlayStore.setDragging(true)
          overlay.onPressedMoveStart?.(overlayEvent)
        }
        overlay.onPressedMoving?.(overlayEvent)

        if (!overlayEvent.defaultPrevented) {
          const point = this._overlayView.coordinateToPoint(overlay, event)
          if (!point) return
          if (pressedInfo.interactType === 'control-point') {
            this._moveControlPoint(overlay, point, pressedInfo.figureIndex, pressedInfo.figureKey)
          } else {
            this._moveBody(overlay, point)
          }
        }
      }
    })
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._overlayView.draw(ctx)
  }
}
