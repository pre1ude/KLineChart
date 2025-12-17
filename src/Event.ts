import SyntheticEvent, { type EventHandler, type MouseTouchEvent, TOUCH_MIN_RADIUS } from './common/SyntheticEvent'
import type Coordinate from './common/Coordinate'
import { UpdateLevel } from './common/Updater'
import type Crosshair from './common/Crosshair'
import { requestAnimationFrame, cancelAnimationFrame } from './common/utils/compatible'
import type Chart from './Chart'
import type Pane from './pane/Pane'
import { PaneIdConstants } from './pane/types'
import type Widget from './widget/Widget'
import { WidgetNameConstants, REAL_SEPARATOR_HEIGHT } from './widget/types'
import type DualYPane from './pane/DualYPane'
import type YAxisWidget from './widget/YAxisWidget'
import type XAxisWidget from './widget/XAxisWidget'
import { isPointInBounding } from './common/Bounding'
import type VisibleRange from './common/VisibleRange'
import { setCursor } from './common/utils/cursor'

interface EventTriggerWidgetInfo {
  pane?: Pane
  widget?: Widget
}

export default class Event implements EventHandler {
  private readonly _container: HTMLElement
  private readonly _chart: Chart
  private readonly _event: SyntheticEvent

  // 惯性滚动开始时间
  private _flingStartTime = new Date().getTime()
  // 惯性滚动定时器
  private _flingScrollRequestId?: number
  // 开始滚动时坐标点
  private _startScrollCoordinate?: Coordinate
  // 开始触摸时坐标
  private _touchCoordinate?: Coordinate
  // 是否是取消了十字光标
  private _touchCancelCrosshair = false
  // 是否缩放过
  private _touchZoomed = false
  // 用来记录捏合缩放的尺寸
  private _pinchScale = 1

  private _mouseDownWidget?: Widget

  private _prevYAxisRange?: VisibleRange
  private _prevOtherYAxisRange?: VisibleRange

  private _xAxisStartScaleCoordinate?: Coordinate
  private _xAxisStartScaleDistance = 0
  private _xAxisScale = 1

  private _yAxisStartScaleDistance = 0

  private _mouseMoveTriggerWidgetInfo: EventTriggerWidgetInfo = {}

  constructor(container: HTMLElement, chart: Chart) {
    this._container = container
    this._chart = chart
    this._event = new SyntheticEvent(container, this, {
      treatVertDragAsPageScroll: () => false,
      treatHorzDragAsPageScroll: () => false
    })
  }

  pinchStartEvent(): boolean {
    this._touchZoomed = true
    this._pinchScale = 1
    return true
  }

  pinchEvent(e: MouseTouchEvent, scale: number): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    if (pane?.getId() !== PaneIdConstants.X_AXIS && widget?.getName() === WidgetNameConstants.MAIN) {
      const event = this._makeWidgetEvent(e, widget)
      const zoomScale = (scale - this._pinchScale) * 0.5
      this._pinchScale = scale
      this._chart.getChartStore().getTimeScaleStore().zoom(zoomScale, event.x)
      return true
    }
    return false
  }

  mouseWheelHortEvent(_: MouseTouchEvent, distance: number): boolean {
    const timeScaleStore = this._chart.getChartStore().getTimeScaleStore()
    timeScaleStore.scroll(distance)
    return true
  }

  mouseWheelVertEvent(e: MouseTouchEvent, normDeltaY: number): boolean {
    const { widget } = this._findWidgetByEvent(e)
    const event = this._makeWidgetEvent(e, widget)
    const name = widget?.getName()
    if (name === WidgetNameConstants.MAIN) {
      const scale = normDeltaY * 0.1
      this._chart.getChartStore().getTimeScaleStore().zoom(scale, event.x)
      return true
    }
    return false
  }

  mouseDownEvent(e: MouseTouchEvent): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    this._mouseDownWidget = widget
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.SEPARATOR: {
          return widget.dispatchEvent('mouseDownEvent', event)
        }
        case WidgetNameConstants.MAIN: {
          // 不再需要保存特定的Y轴范围，因为我们会在拖拽时实时获取每个轴的当前范围
          this._startScrollCoordinate = { x: event.x, y: event.y }
          return widget.dispatchEvent('mouseDownEvent', event)
        }
        case WidgetNameConstants.X_AXIS: {
          const consumed = widget.dispatchEvent('mouseDownEvent', event)
          if (consumed) {
            this._chart.updatePane(UpdateLevel.Overlay)
          }
          this._xAxisStartScaleCoordinate = { x: event.x, y: event.y }
          this._xAxisStartScaleDistance = event.pageX
          return consumed
        }
        case WidgetNameConstants.Y_AXIS: {
          const consumed = widget.dispatchEvent('mouseDownEvent', event)
          if (consumed) {
            this._chart.updatePane(UpdateLevel.Overlay)
          }
          const currentYAxis = (widget as YAxisWidget).getAxisComponent()
          const range = currentYAxis.getRange()
          this._prevYAxisRange = range ? { ...range } : undefined

          // 保存另一个Y轴的初始范围
          const yLeftAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
          const yRightAxis = (pane as DualYPane).getYRightAxisWidget().getAxisComponent()
          const otherYAxis = currentYAxis === yLeftAxis ? yRightAxis : yLeftAxis
          const otherRange = otherYAxis.getRange()
          this._prevOtherYAxisRange = otherRange ? { ...otherRange } : undefined

          this._yAxisStartScaleDistance = event.pageY
          return consumed
        }
      }
    }
    return false
  }

  mouseMoveEvent(e: MouseTouchEvent): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    const event = this._makeWidgetEvent(e, widget)
    if (
      this._mouseMoveTriggerWidgetInfo.pane?.getId() !== pane?.getId() ||
      this._mouseMoveTriggerWidgetInfo.widget?.getName() !== widget?.getName()
    ) {
      widget?.dispatchEvent('mouseEnterEvent', event)
      this._mouseMoveTriggerWidgetInfo.widget?.dispatchEvent('mouseLeaveEvent', event)
      this._mouseMoveTriggerWidgetInfo = { pane, widget }
    }
    if (widget) {
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN: {
          const consumed = widget.dispatchEvent('mouseMoveEvent', event)
          const chartStore = this._chart.getChartStore()
          let crosshair: Crosshair | undefined = { x: event.x, y: event.y, paneId: pane?.getId() }
          if (consumed && chartStore.getTooltipStore().getActiveIcon()) {
            crosshair = undefined
            if (widget) {
              setCursor(widget.getContainer(), 'pointer')
            }
          }
          this._chart.getChartStore().getTooltipStore().setCrosshair(crosshair)
          return consumed
        }
        case WidgetNameConstants.SEPARATOR:
        case WidgetNameConstants.X_AXIS:
        case WidgetNameConstants.Y_AXIS: {
          const consumed = widget.dispatchEvent('mouseMoveEvent', event)
          this._chart.getChartStore().getTooltipStore().setCrosshair()
          return consumed
        }
      }
    }
    return false
  }

  pressedMouseMoveEvent(e: MouseTouchEvent): boolean {
    if (this._mouseDownWidget && this._mouseDownWidget.getName() === WidgetNameConstants.SEPARATOR) {
      return this._mouseDownWidget.dispatchEvent('pressedMouseMoveEvent', e)
    }
    const { pane, widget } = this._findWidgetByEvent(e)
    if (
      widget &&
      this._mouseDownWidget?.getPane().getId() === pane?.getId() &&
      this._mouseDownWidget?.getName() === widget.getName()
    ) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN: {
          const bounding = widget.getBounding()
          const height = bounding.height
          const consumed = widget.dispatchEvent('pressedMouseMoveEvent', event)
          if (!consumed && this._startScrollCoordinate) {
            const yLeftAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
            const yRightAxis = (pane as DualYPane).getYRightAxisWidget().getAxisComponent()

            // 计算像素移动距离
            let pixelDistance: number
            const isReverse = yLeftAxis?.isReverse() ?? false
            if (isReverse) {
              pixelDistance = this._startScrollCoordinate.y - event.y
            } else {
              pixelDistance = event.y - this._startScrollCoordinate.y
            }

            // 使用像素偏移量直接更新每个轴的范围
            // 这样每个轴都会根据自己的内部范围进行等比例偏移
            yLeftAxis.offsetByPixel(pixelDistance, height)
            yRightAxis.offsetByPixel(pixelDistance, height)

            const distance = event.x - this._startScrollCoordinate.x
            this._startScrollCoordinate = { x: event.x, y: event.y }
            this._chart.getChartStore().getTimeScaleStore().scroll(distance)
          }
          this._chart.getChartStore().getTooltipStore().setCrosshair({ x: event.x, y: event.y, paneId: pane?.getId() })
          return consumed
        }
        case WidgetNameConstants.X_AXIS: {
          const consumed = widget.dispatchEvent('pressedMouseMoveEvent', event)
          if (!consumed) {
            const xAxis = (widget as XAxisWidget).getAxisComponent()
            if ((xAxis?.getScrollZoomEnabled() ?? true)) {
              const scale = this._xAxisStartScaleDistance / event.pageX
              if (Number.isFinite(scale)) {
                const zoomScale = scale - this._xAxisScale
                this._xAxisScale = scale
                this._chart.getChartStore().getTimeScaleStore().zoom(zoomScale, this._xAxisStartScaleCoordinate?.x)
              }
            }
          } else {
            this._chart.updatePane(UpdateLevel.Overlay)
          }
          return consumed
        }
        case WidgetNameConstants.Y_AXIS: {
          const consumed = widget.dispatchEvent('pressedMouseMoveEvent', event)
          if (!consumed) {
            const currentYAxis = (widget as YAxisWidget).getAxisComponent()
            if (this._prevYAxisRange && currentYAxis.getScrollZoomEnabled()) {
              const { from, to } = this._prevYAxisRange
              const range = to - from
              const scale = event.pageY / this._yAxisStartScaleDistance
              const newRange = range * scale
              const difRange = (newRange - range) / 2
              const newFrom = from - difRange
              const newTo = to + difRange
              const newRealFrom = currentYAxis.convertToRealValue(newFrom)
              const newRealTo = currentYAxis.convertToRealValue(newTo)

              // 更新当前拖拽的Y轴
              currentYAxis.setRange({
                from: newFrom,
                to: newTo,
                domainFrom: newRealFrom,
                domainTo: newRealTo
              })

              // 同步其他Y轴 - 使用保存的初始范围和相同的缩放比例
              const yLeftAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
              const yRightAxis = (pane as DualYPane).getYRightAxisWidget().getAxisComponent()
              const otherYAxis = currentYAxis === yLeftAxis ? yRightAxis : yLeftAxis

              if (otherYAxis.getScrollZoomEnabled() && this._prevOtherYAxisRange) {
                const otherRange = this._prevOtherYAxisRange
                const otherRangeSize = otherRange.to - otherRange.from
                const otherNewRange = otherRangeSize * scale
                const otherDifRange = (otherNewRange - otherRangeSize) / 2
                const otherNewFrom = otherRange.from - otherDifRange
                const otherNewTo = otherRange.to + otherDifRange
                const otherNewRealFrom = otherYAxis.convertToRealValue(otherNewFrom)
                const otherNewRealTo = otherYAxis.convertToRealValue(otherNewTo)
                otherYAxis.setRange({
                  from: otherNewFrom,
                  to: otherNewTo,
                  domainFrom: otherNewRealFrom,
                  domainTo: otherNewRealTo
                })
              }

              this._chart.adjustPaneViewport(false, true, true, true)
            }
          } else {
            this._chart.updatePane(UpdateLevel.Overlay)
          }
          return consumed
        }
      }
    }
    return false
  }

  mouseUpEvent(e: MouseTouchEvent): boolean {
    const { widget } = this._findWidgetByEvent(e)
    let consumed: boolean = false
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN:
        case WidgetNameConstants.SEPARATOR:
        case WidgetNameConstants.X_AXIS:
        case WidgetNameConstants.Y_AXIS: {
          consumed = widget.dispatchEvent('mouseUpEvent', event)
          break
        }
      }
      if (consumed) {
        this._chart.updatePane(UpdateLevel.Overlay)
      }
    }
    this._mouseDownWidget = undefined
    this._startScrollCoordinate = undefined
    this._prevYAxisRange = undefined
    this._prevOtherYAxisRange = undefined
    this._xAxisStartScaleCoordinate = undefined
    this._xAxisStartScaleDistance = 0
    this._xAxisScale = 1
    this._yAxisStartScaleDistance = 0
    return consumed
  }

  mouseClickEvent(e: MouseTouchEvent): boolean {
    const { widget } = this._findWidgetByEvent(e)
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      return widget.dispatchEvent('mouseClickEvent', event)
    }
    return false
  }

  mouseRightClickEvent(e: MouseTouchEvent): boolean {
    const { widget } = this._findWidgetByEvent(e)
    let consumed: boolean = false
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN:
        case WidgetNameConstants.X_AXIS:
        case WidgetNameConstants.Y_AXIS: {
          consumed = widget.dispatchEvent('mouseRightClickEvent', event)
          break
        }
      }
      if (consumed) {
        this._chart.updatePane(UpdateLevel.Overlay)
      }
    }
    return false
  }

  contextMenuEvent(e: MouseTouchEvent): boolean {
    const { widget } = this._findWidgetByEvent(e)
    let consumed: boolean = false
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN:
        case WidgetNameConstants.X_AXIS:
        case WidgetNameConstants.Y_AXIS: {
          consumed = widget.dispatchEvent('contextMenuEvent', event)
          break
        }
      }
      if (consumed) {
        this._chart.updatePane(UpdateLevel.Overlay)
      }
    }
    return false
  }

  mouseDoubleClickEvent(e: MouseTouchEvent): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    if (widget) {
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN: {
          const event = this._makeWidgetEvent(e, widget)
          return widget.dispatchEvent('mouseDoubleClickEvent', event)
        }
        case WidgetNameConstants.Y_AXIS: {
          const yLeftAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
          const yRightAxis = (pane as DualYPane).getYRightAxisWidget().getAxisComponent()

          yLeftAxis.setAutoCalcTickFlag(true)
          yRightAxis.setAutoCalcTickFlag(true)
          this._chart.adjustPaneViewport(false, true, true, true)
          return true
        }
      }
    }
    return false
  }

  mouseLeaveEvent(): boolean {
    this._chart.getChartStore().getTooltipStore().setCrosshair()
    return true
  }

  touchStartEvent(e: MouseTouchEvent): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN: {
          const chartStore = this._chart.getChartStore()
          const tooltipStore = chartStore.getTooltipStore()
          if (widget.dispatchEvent('mouseDownEvent', event)) {
            this._touchCancelCrosshair = true
            this._touchCoordinate = undefined
            tooltipStore.setCrosshair(undefined, { notInvalidate: true })
            this._chart.updatePane(UpdateLevel.Overlay)
            return true
          }
          if (this._flingScrollRequestId) {
            cancelAnimationFrame(this._flingScrollRequestId)
            this._flingScrollRequestId = undefined
          }
          this._flingStartTime = new Date().getTime()
          this._startScrollCoordinate = { x: event.x, y: event.y }
          this._touchZoomed = false
          if (this._touchCoordinate) {
            const xDif = event.x - this._touchCoordinate.x
            const yDif = event.y - this._touchCoordinate.y
            const radius = Math.sqrt(xDif * xDif + yDif * yDif)
            if (radius < TOUCH_MIN_RADIUS) {
              this._touchCoordinate = { x: event.x, y: event.y }
              tooltipStore.setCrosshair({ x: event.x, y: event.y, paneId: pane?.getId() })
            } else {
              this._touchCoordinate = undefined
              this._touchCancelCrosshair = true
              tooltipStore.setCrosshair()
            }
          }
          return true
        }
        case WidgetNameConstants.X_AXIS:
        case WidgetNameConstants.Y_AXIS: {
          const consumed = widget.dispatchEvent('mouseDownEvent', event)
          if (consumed) {
            this._chart.updatePane(UpdateLevel.Overlay)
          }
          return consumed
        }
      }
    }
    return false
  }

  touchMoveEvent(e: MouseTouchEvent): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      const chartStore = this._chart.getChartStore()
      const tooltipStore = chartStore.getTooltipStore()
      switch (name) {
        case WidgetNameConstants.MAIN: {
          if (widget.dispatchEvent('pressedMouseMoveEvent', event)) {
            event.preventDefault?.()
            tooltipStore.setCrosshair(undefined, { notInvalidate: true })
            this._chart.updatePane(UpdateLevel.Overlay)
            return true
          }
          if (this._touchCoordinate) {
            event.preventDefault?.()
            tooltipStore.setCrosshair({ x: event.x, y: event.y, paneId: pane?.getId() })
          } else if (
            this._startScrollCoordinate &&
              Math.abs(this._startScrollCoordinate.x - event.x) > this._startScrollCoordinate.y - event.y
          ) {
            const distance = event.x - this._startScrollCoordinate.x
            chartStore.getTimeScaleStore().scroll(distance)
          }
          return true
        }
        case WidgetNameConstants.X_AXIS:
        case WidgetNameConstants.Y_AXIS: {
          const consumed = widget.dispatchEvent('pressedMouseMoveEvent', event)
          if (consumed) {
            event.preventDefault?.()
            this._chart.updatePane(UpdateLevel.Overlay)
          }
          return consumed
        }
      }
    }
    return false
  }

  touchEndEvent(e: MouseTouchEvent): boolean {
    const { widget } = this._findWidgetByEvent(e)
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const name = widget.getName()
      switch (name) {
        case WidgetNameConstants.MAIN: {
          widget.dispatchEvent('mouseUpEvent', event)
          if (this._startScrollCoordinate) {
            const time = new Date().getTime() - this._flingStartTime
            const distance = event.x - this._startScrollCoordinate.x
            let v = distance / (time > 0 ? time : 1) * 20
            if (time < 200 && Math.abs(v) > 0) {
              const timeScaleStore = this._chart.getChartStore().getTimeScaleStore()
              const flingScroll: (() => void) = () => {
                this._flingScrollRequestId = requestAnimationFrame(() => {
                  timeScaleStore.scroll(v)
                  v = v * (1 - 0.025)
                  if (Math.abs(v) < 1) {
                    if (this._flingScrollRequestId) {
                      cancelAnimationFrame(this._flingScrollRequestId)
                      this._flingScrollRequestId = undefined
                    }
                  } else {
                    flingScroll()
                  }
                })
              }
              flingScroll()
            }
          }
          return true
        }
        case WidgetNameConstants.X_AXIS:
        case WidgetNameConstants.Y_AXIS: {
          const consumed = widget.dispatchEvent('mouseUpEvent', event)
          if (consumed) {
            this._chart.updatePane(UpdateLevel.Overlay)
          }
        }
      }
    }
    return false
  }

  tapEvent(e: MouseTouchEvent): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    let consumed = false
    if (widget) {
      const event = this._makeWidgetEvent(e, widget)
      const result = widget.dispatchEvent('mouseClickEvent', event)
      if (widget.getName() === WidgetNameConstants.MAIN) {
        const event = this._makeWidgetEvent(e, widget)
        const chartStore = this._chart.getChartStore()
        const tooltipStore = chartStore.getTooltipStore()
        if (result) {
          this._touchCancelCrosshair = true
          this._touchCoordinate = undefined
          tooltipStore.setCrosshair(undefined, { notInvalidate: true })
          consumed = true
        } else {
          if (!this._touchCancelCrosshair && !this._touchZoomed) {
            this._touchCoordinate = { x: event.x, y: event.y }
            tooltipStore.setCrosshair({ x: event.x, y: event.y, paneId: pane?.getId() }, { notInvalidate: true })
            consumed = true
          }
          this._touchCancelCrosshair = false
        }
      }
      if (consumed || result) {
        this._chart.updatePane(UpdateLevel.Overlay)
      }
    }
    return consumed
  }

  doubleTapEvent(e: MouseTouchEvent): boolean {
    return this.mouseDoubleClickEvent(e)
  }

  longTapEvent(e: MouseTouchEvent): boolean {
    const { pane, widget } = this._findWidgetByEvent(e)
    if (widget && widget.getName() === WidgetNameConstants.MAIN) {
      const event = this._makeWidgetEvent(e, widget)
      this._touchCoordinate = { x: event.x, y: event.y }
      this._chart.getChartStore().getTooltipStore().setCrosshair({ x: event.x, y: event.y, paneId: pane?.getId() })
      return true
    }
    return false
  }

  private _findWidgetByEvent(e: MouseTouchEvent): EventTriggerWidgetInfo {
    const separatorPanes = this._chart.getAllSeparatorPanes()
    const separatorSize = this._chart.getChartStore().getStyles().separator.size
    for (const [, pane] of separatorPanes) {
      const bounding = pane.getBounding()
      const separatorBounding = {
        left: bounding.left,
        top: bounding.top - Math.round((REAL_SEPARATOR_HEIGHT - separatorSize) / 2),
        width: bounding.width,
        height: REAL_SEPARATOR_HEIGHT
      }
      if (
        isPointInBounding(separatorBounding, e)
      ) {
        return { pane, widget: pane.getWidget() }
      }
    }

    const drawPanes = this._chart.getAllDrawPanes()
    const targetPane = drawPanes.find(pane => isPointInBounding(pane.getBounding(), e))

    if (!targetPane) {
      return {}
    }
    const mainWidget = targetPane.getMainWidget()
    if (isPointInBounding(mainWidget.getBounding(), e)) {
      return { pane: targetPane, widget: mainWidget }
    }

    if (targetPane.getId() !== PaneIdConstants.X_AXIS) {
      const dualPane = targetPane as DualYPane

      const yLeftAxisWidget = dualPane.getYLeftAxisWidget()
      if (yLeftAxisWidget && isPointInBounding(yLeftAxisWidget.getBounding(), e)) {
        return { pane: targetPane, widget: yLeftAxisWidget }
      }

      const yRightAxisWidget = dualPane.getYRightAxisWidget()
      if (yRightAxisWidget && isPointInBounding(yRightAxisWidget.getBounding(), e)) {
        return { pane: targetPane, widget: yRightAxisWidget }
      }
    }

    return { pane: targetPane }
  }

  private _makeWidgetEvent(event: MouseTouchEvent, widget?: Widget): MouseTouchEvent {
    const bounding = widget?.getBounding()
    // 直接修改原始 event 对象，不要创建拷贝
    // 因为 stopPropagation 函数引用的是原始对象
    event.x = event.x - (bounding?.left ?? 0)
    event.y = event.y - (bounding?.top ?? 0)
    return event
  }

  destroy(): void {
    this._event.destroy()
  }
}
