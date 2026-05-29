import type Pane from '@/pane/Pane'
import type DrawWidget from '@/widget/DrawWidget'
import { type CustomApi, FormatDateType } from '../Options'
import type BarSpace from '../common/BarSpace'
import type Bounding from '../common/Bounding'
import type Coordinate from '../common/Coordinate'
import type { IPoint } from '../common/Point'
import { PolygonType, type OverlayStyle } from '../common/Styles'
import { type EventName, type MouseTouchEvent } from '../common/SyntheticEvent'
import { isTransparent } from '../common/utils/color'
import { type DateTimeFormat, getDateTimeFormat } from '../common/utils/dateTimeFormat'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { isNumber, isString } from '../common/utils/typeChecks'
import type { EventOverlayInfo, FigureEventType, Overlay, OverlayFigure, OverlayFigureData, OverlayPrecision } from '../component/Overlay'
import { OVERLAY_FIGURE_KEY_PREFIX } from '../component/Overlay'
import type XAxis from '../component/XAxis'
import type YAxis from '../component/YAxis'
import { createFigure, drawStaticFigure } from '../extension/figure'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'
import type XAxisWidget from '../widget/XAxisWidget'
import type YAxisWidget from '../widget/YAxisWidget'
import { WidgetNameConstants } from '../widget/types'
import View from './View'

type OverlayViewType = 'main' | 'xAxis' | 'yAxis'

interface GetFiguresParams {
  overlay: Overlay
  coordinates: Coordinate[]
  bounding: Bounding
  barSpace: BarSpace
  precision: OverlayPrecision
  thousandsSeparator: string
  decimalFoldThreshold: number
  dateTimeFormat: DateTimeFormat
  defaultStyles: OverlayStyle
  xAxis?: XAxis
  yAxis?: YAxis
}

const PROGRESS_OVERLAY_IGNORE_EVENTS: FigureEventType[] = ['contextMenuEvent']
const ACTIVE_POINT_OUTER_RING_SIZE = 3
const ACTIVE_POINT_OUTER_RING_COLOR = 'rgba(255, 198, 43, 0.2)'
const themeBgMap = {
  light: '#FFFFFF',
  dark: '#0F1E33'
}

export default class OverlayView extends View {
  private readonly _type: OverlayViewType
  private _hoverInstanceInfo?: EventOverlayInfo
  private _pressedInstanceInfo?: EventOverlayInfo

  constructor(widget: DrawWidget<Pane>, type: OverlayViewType = 'main') {
    super(widget)
    this._type = type
  }

  setHoverInstanceInfo(info?: EventOverlayInfo): void {
    this._hoverInstanceInfo = info
  }

  setPressedInstanceInfo(info?: EventOverlayInfo): void {
    this._pressedInstanceInfo = info
  }

  getHoverInstanceInfo(): EventOverlayInfo | undefined {
    return this._hoverInstanceInfo
  }

  getPressedInstanceInfo(): EventOverlayInfo | undefined {
    return this._pressedInstanceInfo
  }

  // 返回 true 表示整体 overlayview 总是响应事件, 用来触发点击空白区域的
  override checkEventOn(event: MouseTouchEvent, name: EventName, other?: unknown): boolean {
    const overlayStore = this.getWidget().getPane().getChart().getChartStore().getOverlayStore()
    if (overlayStore.getProgressOverlay()) return true // 还在画
    if (this._pressedInstanceInfo?.overlay != null) return true
    if (name === 'mouseMoveEvent' && this._hoverInstanceInfo) return true // 支持取消hover
    return super.checkEventOn(event, name, other)
  }

  coordinateToPoint(overlay: Overlay, coordinate: Coordinate): Partial<IPoint> {
    const point: Partial<IPoint> = {}
    const widget = this.getWidget()
    const pane = widget.getPane()
    const chart = pane.getChart()
    const paneId = pane.getId()
    const chartStore = chart.getChartStore()

    if (this._type !== 'yAxis') {
      const xAxisWidget = chart.getXAxisPane().getMainWidget() as XAxisWidget
      const xAxis = xAxisWidget.getAxisComponent()
      // 内部直接使用 dataIndex
      point.dataIndex = xAxis.convertFromPixel(coordinate.x)
    }

    if (this._type !== 'xAxis') {
      const mainAxisWidget = (pane as DualYPane).getMainAxisWidget()
      const yAxis = mainAxisWidget.getAxisComponent()
      let value = yAxis.convertFromPixel(coordinate.y)
      const dataList = chartStore.getDataList()
      const dataIndex = point.dataIndex ?? -1
      if (overlay.mode !== 'normal' && paneId === PaneIdConstants.CANDLE && dataIndex >= 0 && dataIndex < dataList.length) {
        const kLineData = chartStore.getDataByDataIndex(dataIndex)
        if (kLineData) {
          const modeSensitivity = overlay.modeSensitivity
          if (value > kLineData.high) {
            if (overlay.mode === 'weak_magnet') {
              const highY = yAxis.convertToPixel(kLineData.high)
              if (Math.abs(coordinate.y - highY) <= modeSensitivity) value = kLineData.high
            } else {
              value = kLineData.high
            }
          } else if (value < kLineData.low) {
            if (overlay.mode === 'weak_magnet') {
              const lowY = yAxis.convertToPixel(kLineData.low)
              if (Math.abs(coordinate.y - lowY) <= modeSensitivity) value = kLineData.low
            } else {
              value = kLineData.low
            }
          } else {
            const max = Math.max(kLineData.open, kLineData.close)
            const min = Math.min(kLineData.open, kLineData.close)
            if (value > max) {
              value = value - max < kLineData.high - value ? max : kLineData.high
            } else if (value < min) {
              value = value - kLineData.low < min - value ? kLineData.low : min
            } else {
              value = max - value < value - min ? max : min
            }
          }
        }
      }
      point.value = value
    }
    return point
  }

  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget() as YAxisWidget
    const pane = widget.getPane()
    const paneId = pane.getId()
    const chart = pane.getChart()
    const widgetName = widget.getName()
    let yAxis: YAxis | undefined
    if (widgetName === WidgetNameConstants.MAIN) {
      yAxis = pane.getYLeftAxisWidget().getAxisComponent()
    } else if (widgetName === WidgetNameConstants.Y_AXIS) {
      yAxis = widget.getAxisComponent()
    }
    const xAxisWidget = chart.getXAxisPane().getMainWidget() as XAxisWidget
    const xAxis = xAxisWidget.getAxisComponent()
    const bounding = widget.getBounding()
    const chartStore = chart.getChartStore()
    const customApi = chartStore.getCustomApi()
    const thousandsSeparator = chartStore.getThousandsSeparator()
    const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const dateTimeFormat = getDateTimeFormat()
    const barSpace = timeScaleStore.getBarSpace()
    const precision = chartStore.getPrecision()
    const defaultStyles = chartStore.getStyles().overlay
    const overlayStore = chartStore.getOverlayStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    const hoverInfo = this._hoverInstanceInfo
    // 统一使用全局选中状态
    const clickInfo = overlayStore.getSelectedInfo()
    const overlays = this._type === 'xAxis' ? overlayStore.getInstances() : overlayStore.getInstances(paneId)
    const paneIndicators = chartStore.getIndicatorStore().getInstances(paneId)
    const overlayPrecision: OverlayPrecision = {
      ...precision,
      max: Math.max(precision.price, precision.volume),
      min: Math.min(precision.price, precision.volume),
      excludePriceVolumeMax: Number.MIN_SAFE_INTEGER,
      excludePriceVolumeMin: Number.MAX_SAFE_INTEGER
    }
    paneIndicators.forEach((indicator) => {
      const p = indicator.precision;
      (overlayPrecision as Record<string, number>)[indicator.name] = p
      overlayPrecision.max = Math.max(overlayPrecision.max, p)
      overlayPrecision.min = Math.min(overlayPrecision.min, p)
      overlayPrecision.excludePriceVolumeMax = Math.max(overlayPrecision.excludePriceVolumeMax, p)
      overlayPrecision.excludePriceVolumeMin = Math.min(overlayPrecision.excludePriceVolumeMin, p)
    })

    overlays.forEach((overlay) => {
      if (overlay.visible) {
        this._drawOverlay(
          ctx, overlay, bounding, barSpace, overlayPrecision,
          dateTimeFormat, customApi, thousandsSeparator, decimalFoldThreshold,
          defaultStyles, hoverInfo, clickInfo, xAxis, yAxis,
          true // bindEvent = true
        )
      }
    })

    const hoveredOverlay = hoverInfo?.overlay

    if (hoveredOverlay) {
      const shouldDrawHoveredAgain = this._type === 'main' &&
        hoveredOverlay.visible &&
        overlays.includes(hoveredOverlay)
      if (shouldDrawHoveredAgain) {
        this._drawOverlay(
          ctx, hoveredOverlay, bounding, barSpace, overlayPrecision,
          dateTimeFormat, customApi, thousandsSeparator, decimalFoldThreshold,
          defaultStyles, hoverInfo, clickInfo, xAxis, yAxis,
          false // bindEvent = false，不添加到事件树
        )
      }
    }

    const progressOverlay = overlayStore.getProgressOverlay()
    if (progressOverlay?.visible === true) {
      const progressPaneId = overlayStore.getProgressOverlayPaneId()
      const isUnboundProgressPane = progressPaneId.length === 0
      const isHoveredPane = isString(crosshair.paneId) && crosshair.paneId === paneId
      const shouldDrawProgressOnPane = progressPaneId === paneId || (isUnboundProgressPane && isHoveredPane)
      // 只在 xAxis 或当前 pane 上绘制
      if (this._type === 'xAxis' || shouldDrawProgressOnPane) {
        const shouldDrawProgressDefaultFigures = (
          isString(crosshair.paneId) &&
          (isUnboundProgressPane ? crosshair.paneId === paneId : crosshair.paneId === progressPaneId)
        )
        this._drawOverlay(
          ctx, progressOverlay, bounding, barSpace,
          overlayPrecision, dateTimeFormat, customApi, thousandsSeparator, decimalFoldThreshold, defaultStyles, hoverInfo, clickInfo, xAxis, yAxis,
          true, // bindEvent = true
          shouldDrawProgressDefaultFigures,
          PROGRESS_OVERLAY_IGNORE_EVENTS
        )
      }
    }
  }

  private pointToCoordinate(
    point: IPoint,
    xAxis?: XAxis,
    yAxis?: YAxis
  ): Coordinate {
    return {
      x: xAxis?.convertToPixel(point.dataIndex) ?? 0,
      y: yAxis?.convertToPixel(point.value) ?? 0
    }
  }

  private _drawOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: Overlay,
    bounding: Bounding,
    barSpace: BarSpace,
    precision: OverlayPrecision,
    dateTimeFormat: DateTimeFormat,
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    defaultStyles: OverlayStyle,
    hoverInfo?: EventOverlayInfo,
    clickInfo?: EventOverlayInfo,
    xAxis?: XAxis,
    yAxis?: YAxis,
    bindEvent: boolean = true,
    drawDefaultFigures: boolean = true,
    ignoreEvents?: FigureEventType[]
  ): void {
    if (overlay.getSkipDraw()) return

    const { points } = overlay
    const coordinates = points.map(point =>
      this.pointToCoordinate(point, xAxis, yAxis)
    )

    if (coordinates.length > 0) {
      const _figures = this.getFigures({ overlay, coordinates, bounding, barSpace, precision, thousandsSeparator, decimalFoldThreshold, dateTimeFormat, defaultStyles, xAxis, yAxis })
      const figures = Array.isArray(_figures) ? _figures : [_figures]
      this.drawFigures(ctx, overlay, figures, defaultStyles, bindEvent, ignoreEvents)
    }
    if (drawDefaultFigures) {
      this.drawDefaultFigures(ctx, overlay, coordinates, bounding, precision, dateTimeFormat, customApi, thousandsSeparator, decimalFoldThreshold, defaultStyles, hoverInfo, clickInfo, xAxis, yAxis, ignoreEvents)
    }
  }

  private _mergeIgnoreEvents(ignoreEvent?: OverlayFigure['ignoreEvent'], extraIgnoreEvents?: FigureEventType[]): OverlayFigure['ignoreEvent'] {
    if (ignoreEvent === true || extraIgnoreEvents == null) return ignoreEvent
    if (ignoreEvent == null || ignoreEvent === false) return extraIgnoreEvents
    return [
      ...ignoreEvent,
      ...extraIgnoreEvents.filter(eventName => !ignoreEvent.includes(eventName))
    ]
  }

  protected drawFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, figures: OverlayFigure[], defaultStyles: OverlayStyle, bindEvent: boolean = true, ignoreEvents?: FigureEventType[]): void {
    for (let i = 0; i < figures.length; i++) {
      const figure = figures[i]
      const { type, styles, attrs, ignoreEvent, key } = figure

      // 检查 figure 是否被隐藏
      const figureConfig = key ? overlay.styles?.figures?.[key] : undefined
      if (figureConfig?.visible === false) {
        continue
      }

      // 样式合并：defaultStyles[type] → overlay.styles[type] → figure.styles → figures[key]
      const finalStyles = {
        ...defaultStyles[type],
        ...overlay.styles?.[type],
        ...styles,
        ...figureConfig,
      }
      const attrsArray = Array.isArray(attrs) ? attrs : [attrs]

      for (let j = 0; j < attrsArray.length; j++) {
        // 不绑定事件 或 完全忽略事件的图形不添加到事件树
        if (!bindEvent || ignoreEvent === true) {
          drawStaticFigure(ctx, type, {
            attrs: attrsArray[j],
            styles: finalStyles
          })
          continue
        }
        const fig = createFigure<object[], object, OverlayFigureData>(type)
        fig.setAttrs(attrsArray[j])
          .setStyles(finalStyles)
          .setData({
            overlayId: overlay.id,
            interactType: 'body',
            figureKey: figure.key ?? '',
            figureIndex: i,
            attrsIndex: j
          })
          .draw(ctx)

        // 部分忽略或不忽略的图形添加到事件树
        fig.setIgnoreEvent(this._mergeIgnoreEvents(ignoreEvent, ignoreEvents))
        this.addChild(fig)
      }
    }
  }

  protected getFigures(params: GetFiguresParams): OverlayFigure | OverlayFigure[] {
    switch (this._type) {
      case 'xAxis':
        return params.overlay.createXAxisFigures?.(params) ?? []
      case 'yAxis': {
        const widget = this.getWidget() as YAxisWidget
        return params.overlay.createYAxisFigures?.({
          ...params, isAlignLeft: widget.isAlignLeft()
        }) ?? []
      }
      default:
        return params.overlay.createFigures?.(params) ?? []
    }
  }

  protected drawDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], bounding: Bounding, precision: OverlayPrecision, dateTimeFormat: DateTimeFormat, customApi: CustomApi, thousandsSeparator: string, decimalFoldThreshold: number, defaultStyles: OverlayStyle, hoverInfo?: EventOverlayInfo, clickInfo?: EventOverlayInfo, _xAxis?: XAxis, _yAxis?: YAxis, ignoreEvents?: FigureEventType[]): void {
    switch (this._type) {
      case 'xAxis':
        this._drawXAxisDefaultFigures(ctx, overlay, coordinates, bounding, dateTimeFormat, customApi, defaultStyles, clickInfo)
        break
      case 'yAxis':
        this._drawYAxisDefaultFigures(ctx, overlay, coordinates, bounding, precision, thousandsSeparator, decimalFoldThreshold, defaultStyles, clickInfo)
        break
      default:
        this._drawMainDefaultFigures(ctx, overlay, coordinates, defaultStyles, hoverInfo, clickInfo, ignoreEvents)
    }
  }

  private _getControlPointFillColor(): string {
    const chartStore = this.getWidget().getPane().getChart().getChartStore()
    return themeBgMap[chartStore.getStyleTheme()]
  }

  private _drawMainDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], defaultStyles: OverlayStyle, hoverInfo?: EventOverlayInfo, clickInfo?: EventOverlayInfo, ignoreEvents?: FigureEventType[]): void {
    if (!overlay.needDefaultPointFigure) return

    // 正在绘制的 overlay 始终显示控制点
    const isDrawing = !overlay.isCompleted()

    // 已完成的 overlay 只有在 hover 或 click 时才显示控制点
    const isHovered = hoverInfo?.overlay?.id === overlay.id
    const isSelected = clickInfo?.overlay?.id === overlay.id

    if (!isDrawing && !isHovered && !isSelected) return

    const isHoveredControlPoint = isHovered && hoverInfo.interactType === 'control-point'

    const pointStyles = { ...defaultStyles.point, ...overlay.styles?.point }
    const pointFillColor = this._getControlPointFillColor()

    coordinates.forEach(({ x, y }, index) => {
      // 绘制中的最后一个点是预览点，不响应事件
      const isPreviewPoint = isDrawing && index === coordinates.length - 1
      const isHoveredPoint = isHoveredControlPoint && hoverInfo.figureIndex === index
      const style = isSelected ? {
        radius: pointStyles.activeRadius,
        color: pointStyles.activeColor,
        borderColor: pointStyles.activeBorderColor,
        borderSize: pointStyles.activeBorderSize,
      } : {
        radius: pointStyles.radius,
        color: pointStyles.color,
        borderColor: pointStyles.borderColor,
        borderSize: pointStyles.borderSize,
      }

      if (isHoveredPoint) {
        drawStaticFigure(ctx, 'circle', {
          attrs: { x, y, r: style.radius + style.borderSize + ACTIVE_POINT_OUTER_RING_SIZE / 2 },
          styles: {
            style: PolygonType.Stroke,
            borderColor: ACTIVE_POINT_OUTER_RING_COLOR,
            borderSize: ACTIVE_POINT_OUTER_RING_SIZE
          }
        })
      }

      drawStaticFigure(ctx, 'circle', {
        attrs: { x, y, r: style.radius + style.borderSize },
        styles: { color: style.borderColor }
      })

      drawStaticFigure(ctx, 'circle', {
        attrs: { x, y, r: style.radius },
        styles: { color: isTransparent(style.color) ? pointFillColor : style.color }
      })

      const hitRadius = style.radius + style.borderSize + (isHoveredPoint ? ACTIVE_POINT_OUTER_RING_SIZE : 0)
      const dot = createFigure('circle')
      dot.setAttrs({ x, y, r: hitRadius })
        .setStyles({ color: 'transparent' })
        .setData({
          overlayId: overlay.id,
          interactType: 'control-point',
          figureKey: `${OVERLAY_FIGURE_KEY_PREFIX}point_${index}`,
          figureIndex: index,
          attrsIndex: 0
        })
        .draw(ctx)
      // 预览点只绘制不响应事件
      if (!isPreviewPoint) {
        dot.setIgnoreEvent(ignoreEvents)
        this.addChild(dot)
      }
    })
  }

  private _drawXAxisDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], bounding: Bounding, dateTimeFormat: DateTimeFormat, customApi: CustomApi, defaultStyles: OverlayStyle, clickInfo?: EventOverlayInfo): void {
    if (!overlay.needDefaultXAxisFigure) return
    if (overlay.id !== clickInfo?.overlay?.id) return
    if (coordinates.length === 0) return

    const figures: OverlayFigure[] = []

    // 初始化边界值
    let leftX = coordinates[0].x
    let rightX = coordinates[0].x

    coordinates.forEach(coordinate => {
      leftX = Math.min(leftX, coordinate.x)
      rightX = Math.max(rightX, coordinate.x)
    })

    if (coordinates.length > 1) {
      figures.push({
        type: 'rect',
        attrs: { x: leftX, y: 0, width: rightX - leftX, height: bounding.height },
        ignoreEvent: true
      })
    }

    // 遍历坐标，收集文本
    const chartStore = this.getWidget().getPane().getChart().getChartStore()
    coordinates.forEach((coordinate, index) => {
      const point = overlay.points[index]
      if (point && isNumber(point.dataIndex)) {
        // 从 dataIndex 获取 timestamp
        const timestamp = chartStore.dataIndexToTimestamp(point.dataIndex)
        if (isNumber(timestamp)) {
          const text = customApi.formatDate(
            dateTimeFormat,
            timestamp,
            'YYYY-MM-DD HH:mm',
            FormatDateType.Crosshair
          )
          figures.push({
            type: 'text',
            attrs: { x: coordinate.x, y: 0, text, align: 'center' },
            ignoreEvent: true
          })
        }
      }
    })

    this.drawFigures(ctx, overlay, figures, defaultStyles, false)
  }

  private _drawYAxisDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], bounding: Bounding, precision: OverlayPrecision, thousandsSeparator: string, decimalFoldThreshold: number, defaultStyles: OverlayStyle, clickInfo?: EventOverlayInfo): void {
    if (!overlay.needDefaultYAxisFigure) return
    if (overlay.id !== clickInfo?.overlay?.id) return
    if (coordinates.length === 0) return

    const widget = this.getWidget()
    if (widget.getName() !== WidgetNameConstants.Y_AXIS &&
      widget.getName() !== WidgetNameConstants.MAIN) {
      return
    }

    const yAxisWidget = widget as YAxisWidget
    if (clickInfo.paneId !== yAxisWidget.getPane().getId()) return

    const figures: OverlayFigure[] = []

    // 初始化边界值
    let topY = coordinates[0].y
    let bottomY = coordinates[0].y

    coordinates.forEach(coordinate => {
      topY = Math.min(topY, coordinate.y)
      bottomY = Math.max(bottomY, coordinate.y)
    })

    // 计算对齐方式
    const isAlignLeft = yAxisWidget.isAlignLeft() ?? false
    const align = isAlignLeft ? 'left' : 'right'
    const x = isAlignLeft ? 0 : bounding.width

    if (coordinates.length > 1) {
      figures.push({
        type: 'rect',
        attrs: { x: 0, y: topY, width: bounding.width, height: bottomY - topY },
        ignoreEvent: true
      })
    }

    coordinates.forEach((coordinate, index) => {
      const point = overlay.points[index]
      if (point && isNumber(point.value)) {
        // 格式化价格文本
        let text = formatPrecision(point.value, precision.price)
        text = formatThousands(text, thousandsSeparator)
        text = formatFoldDecimal(text, decimalFoldThreshold)

        figures.push({
          type: 'text',
          attrs: { x, y: coordinate.y, text, align, baseline: 'middle' },
          ignoreEvent: true
        })
      }
    })

    this.drawFigures(ctx, overlay, figures, defaultStyles, false)
  }
}
