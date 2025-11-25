import type Coordinate from '../common/Coordinate'
import type Point from '../common/Point'
import type Bounding from '../common/Bounding'
import type BarSpace from '../common/BarSpace'
import { type OverlayStyle } from '../common/Styles'
import { type EventName, type MouseTouchEvent } from '../common/SyntheticEvent'
import { isNumber } from '../common/utils/typeChecks'
import { type CustomApi, FormatDateType } from '../Options'
import type XAxis from '../component/XAxis'
import type YAxis from '../component/YAxis'
import type { Overlay, OverlayPrecision, OverlayFigure, OverlayFigureData, EventOverlayInfo } from '../component/Overlay'
import { OVERLAY_FIGURE_KEY_PREFIX } from '../component/Overlay'
import { PaneIdConstants } from '../pane/types'
import View from './View'
import type XAxisWidget from '../widget/XAxisWidget'
import type YAxisWidget from '../widget/YAxisWidget'
import { WidgetNameConstants } from '../widget/types'
import { createFigure, drawStaticFigure } from '../extension/figure'
import { getDateTimeFormat } from '../common/utils/dateTimeFormat'
import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import type ChartStore from '../store/ChartStore'
import type DualYPane from '../pane/DualYPane'
import type DrawWidget from '@/widget/DrawWidget'
import type Pane from '@/pane/Pane'

type OverlayViewType = 'main' | 'xAxis' | 'yAxis'

interface GetFiguresParams {
  overlay: Overlay
  coordinates: Coordinate[]
  bounding: Bounding
  barSpace: BarSpace
  precision: OverlayPrecision
  thousandsSeparator: string
  decimalFoldThreshold: number
  dateTimeFormat: Intl.DateTimeFormat
  defaultStyles: OverlayStyle
  xAxis: XAxis | null
  yAxis: YAxis | null
}

export default class OverlayView extends View {
  private readonly _type: OverlayViewType
  private _hoverInstanceInfo: EventOverlayInfo | null = null
  private _clickInstanceInfo: EventOverlayInfo | null = null
  private _pressedInstanceInfo: EventOverlayInfo | null = null

  constructor(widget: DrawWidget<Pane>, type: OverlayViewType = 'main') {
    super(widget)
    this._type = type
  }

  setHoverInstanceInfo(info: EventOverlayInfo | null): void {
    this._hoverInstanceInfo = info
  }

  setClickInstanceInfo(info: EventOverlayInfo | null): void {
    this._clickInstanceInfo = info
  }

  setPressedInstanceInfo(info: EventOverlayInfo | null): void {
    this._pressedInstanceInfo = info
  }

  getHoverInstanceInfo(): EventOverlayInfo | null {
    return this._hoverInstanceInfo
  }

  getClickInstanceInfo(): EventOverlayInfo | null {
    return this._clickInstanceInfo
  }

  getPressedInstanceInfo(): EventOverlayInfo | null {
    return this._pressedInstanceInfo
  }

  // 返回 true 表示整体 overlayview 总是响应事件, 用来触发点击空白区域的
  override checkEventOn(event: MouseTouchEvent, name: EventName, other?: unknown): boolean {
    const overlayStore = this.getWidget().getPane().getChart().getChartStore().getOverlayStore()
    if (overlayStore.isDrawing()) return true
    if (this._pressedInstanceInfo?.overlay != null) return true
    if (name === 'mouseMoveEvent' && this._hoverInstanceInfo !== null) return true // 支持取消hover
    if (name === 'mouseClickEvent' && this._clickInstanceInfo !== null) return true // 支持取消选中
    return super.checkEventOn(event, name, other)
  }

  coordinateToPoint(overlay: Overlay, coordinate: Coordinate): Partial<Point> {
    const point: Partial<Point> = {}
    const widget = this.getWidget()
    const pane = widget.getPane()
    const chart = pane.getChart()
    const paneId = pane.getId()
    const chartStore = chart.getChartStore()

    if (this._type !== 'yAxis') {
      const xAxisWidget = chart.getXAxisPane().getMainWidget() as XAxisWidget
      const xAxis = xAxisWidget.getAxisComponent()
      const dataIndex = xAxis.convertFromPixel(coordinate.x)
      const timestamp = chartStore.dataIndexToTimestamp(dataIndex) ?? undefined
      point.dataIndex = dataIndex
      point.timestamp = timestamp
    }

    if (this._type !== 'xAxis') {
      const mainAxisWidget = (pane as DualYPane).getMainAxisWidget()
      const yAxis = mainAxisWidget.getAxisComponent()
      let value = yAxis.convertFromPixel(coordinate.y)
      if (overlay.mode !== 'normal' && paneId === PaneIdConstants.CANDLE && isNumber(point.dataIndex)) {
        const kLineData = chartStore.getDataByDataIndex(point.dataIndex)
        if (kLineData !== null) {
          const modeSensitivity = overlay.modeSensitivity
          if (value > kLineData.high) {
            if (overlay.mode === 'weak_magnet') {
              const highY = yAxis.convertToPixel(kLineData.high)
              const buffValue = yAxis.convertFromPixel(highY - modeSensitivity)
              if (value < buffValue) value = kLineData.high
            } else {
              value = kLineData.high
            }
          } else if (value < kLineData.low) {
            if (overlay.mode === 'weak_magnet') {
              const lowY = yAxis.convertToPixel(kLineData.low)
              const buffValue = yAxis.convertFromPixel(lowY - modeSensitivity)
              if (value > buffValue) value = kLineData.low
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
    let yAxis: YAxis | null
    if (widgetName === WidgetNameConstants.MAIN) {
      yAxis = pane.getYLeftAxisWidget().getAxisComponent()
    } else if (widgetName === WidgetNameConstants.Y_AXIS) {
      yAxis = widget.getAxisComponent()
    } else {
      yAxis = null
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
    const hoverInfo = this._hoverInstanceInfo
    const clickInfo = this._clickInstanceInfo
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
          defaultStyles, xAxis, yAxis,
          hoverInfo, clickInfo, chartStore
        )
      }
    })
    const progressOverlay = overlayStore.getProgressOverlay()
    if (progressOverlay?.visible === true) {
      // 只在 xAxis 或当前 pane 上绘制
      if (this._type === 'xAxis' || progressOverlay.paneId === paneId) {
        this._drawOverlay(
          ctx, progressOverlay, bounding, barSpace,
          overlayPrecision, dateTimeFormat, customApi, thousandsSeparator, decimalFoldThreshold,
          defaultStyles, xAxis, yAxis,
          hoverInfo, clickInfo, chartStore
        )
      }
    }
  }

  private _drawOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: Overlay,
    bounding: Bounding,
    barSpace: BarSpace,
    precision: OverlayPrecision,
    dateTimeFormat: Intl.DateTimeFormat,
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    defaultStyles: OverlayStyle,
    xAxis: XAxis | null,
    yAxis: YAxis | null,
    hoverInfo: EventOverlayInfo | null,
    clickInfo: EventOverlayInfo | null,
    chartStore: ChartStore
  ): void {
    const { points } = overlay
    const coordinates = points.map((point) => {
      let dataIndex = point.dataIndex
      if (dataIndex == null && isNumber(point.timestamp)) {
        dataIndex = chartStore.timestampToDataIndex(point.timestamp)
      }
      const coordinate = { x: 0, y: 0 }
      if (isNumber(dataIndex)) {
        coordinate.x = xAxis?.convertToPixel(dataIndex) ?? 0
        if (typeof point.dataKey === 'string' && point.dataKey !== '') {
          const data = chartStore.getDataByDataIndex(dataIndex)
          if (data !== null && point.dataKey in data) {
            const v = Number(data[point.dataKey])
            if (isNumber(v)) coordinate.y = yAxis?.convertToPixel(v) ?? 0
          }
        } else if (isNumber(point.value)) {
          coordinate.y = yAxis?.convertToPixel(point.value) ?? 0
        }
      }
      return coordinate
    })
    if (coordinates.length > 0) {
      const _figures = this.getFigures({ overlay, coordinates, bounding, barSpace, precision, thousandsSeparator, decimalFoldThreshold, dateTimeFormat, defaultStyles, xAxis, yAxis })
      const figures = Array.isArray(_figures) ? _figures : [_figures]
      this.drawFigures(ctx, overlay, figures, defaultStyles)
    }
    this.drawDefaultFigures(ctx, overlay, coordinates, bounding, precision, dateTimeFormat, customApi, thousandsSeparator, decimalFoldThreshold, defaultStyles, xAxis, yAxis, hoverInfo, clickInfo)
  }

  protected drawFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, figures: OverlayFigure[], defaultStyles: OverlayStyle): void {
    for (let i = 0; i < figures.length; i++) {
      const figure = figures[i]
      const { type, styles, attrs } = figure
      const finalStyles = { ...defaultStyles[type], ...overlay.styles?.[type], ...styles }
      const attrsArray = Array.isArray(attrs) ? attrs : [attrs]
      for (let j = 0; j < attrsArray.length; j++) {
        const fig = createFigure<object[], object, OverlayFigureData>(type)
        fig.setAttrs(attrsArray[j])
          .setStyles(finalStyles)
          .setData({
            overlay,
            interactType: 'body',
            figureKey: figure.key ?? '',
            figureIndex: i,
            attrsIndex: j
          })
          .draw(ctx)
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

  protected drawDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], bounding: Bounding, precision: OverlayPrecision, dateTimeFormat: Intl.DateTimeFormat, customApi: CustomApi, thousandsSeparator: string, decimalFoldThreshold: number, defaultStyles: OverlayStyle, _xAxis: XAxis | null, _yAxis: YAxis | null, hoverInfo: EventOverlayInfo | null, clickInfo: EventOverlayInfo | null): void {
    switch (this._type) {
      case 'xAxis':
        this._drawXAxisDefaultFigures(ctx, overlay, coordinates, bounding, dateTimeFormat, customApi, defaultStyles, clickInfo)
        break
      case 'yAxis':
        this._drawYAxisDefaultFigures(ctx, overlay, coordinates, bounding, precision, thousandsSeparator, decimalFoldThreshold, defaultStyles, clickInfo)
        break
      default:
        this._drawMainDefaultFigures(ctx, overlay, coordinates, defaultStyles, hoverInfo, clickInfo)
    }
  }

  private _drawMainDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], defaultStyles: OverlayStyle, hoverInfo: EventOverlayInfo | null, clickInfo: EventOverlayInfo | null): void {
    if (!overlay.needDefaultPointFigure) return

    // 正在绘制的 overlay 始终显示控制点
    const isDrawing = overlay.isDrawing()

    // 已完成的 overlay 只有在 hover 或 click 时才显示控制点
    const isHovered = hoverInfo?.overlay?.id === overlay.id
    const isClicked = clickInfo?.overlay?.id === overlay.id

    if (!isDrawing && !isHovered && !isClicked) return

    const isControlPointHovered = isHovered && hoverInfo.interactType === 'control-point'

    const pointStyles = { ...defaultStyles.point, ...overlay.styles?.point }

    coordinates.forEach(({ x, y }, index) => {
      const isActive = isControlPointHovered && hoverInfo.figureIndex === index
      const style = isActive ? {
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

      // render control point
      const dot = createFigure('circle')
      dot.setAttrs({ x, y, r: style.radius + style.borderSize })
        .setStyles({ color: style.borderColor })
        .setData({
          overlay,
          interactType: 'control-point',
          figureKey: `${OVERLAY_FIGURE_KEY_PREFIX}point_${index}`,
          figureIndex: index,
          attrsIndex: 0
        })
        .draw(ctx)
      drawStaticFigure(ctx, 'circle', {
        attrs: { x, y, r: style.radius },
        styles: { color: style.color }
      })
      // make it interactive
      this.addChild(dot)
    })
  }

  private _drawXAxisDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], bounding: Bounding, dateTimeFormat: Intl.DateTimeFormat, customApi: CustomApi, defaultStyles: OverlayStyle, clickInfo: EventOverlayInfo | null): void {
    if (!overlay.needDefaultXAxisFigure) return
    if (overlay.id !== clickInfo?.overlay?.id) return
    if (coordinates.length === 0) return

    const figures: OverlayFigure[] = []

    // 初始化边界值
    let leftX = coordinates[0].x
    let rightX = coordinates[0].x

    if (coordinates.length > 1) {
      figures.push({
        type: 'rect',
        attrs: { x: leftX, y: 0, width: rightX - leftX, height: bounding.height },
        ignoreEvent: true
      })
    }
    // 遍历坐标，收集文本和计算边界
    coordinates.forEach((coordinate, index) => {
      leftX = Math.min(leftX, coordinate.x)
      rightX = Math.max(rightX, coordinate.x)

      const point = overlay.points[index]
      if (point && isNumber(point.timestamp)) {
        const text = customApi.formatDate(
          dateTimeFormat,
          point.timestamp,
          'YYYY-MM-DD HH:mm',
          FormatDateType.Crosshair
        )
        figures.push({
          type: 'text',
          attrs: { x: coordinate.x, y: 0, text, align: 'center' },
          ignoreEvent: true
        })
      }
    })

    this.drawFigures(ctx, overlay, figures, defaultStyles)
  }

  private _drawYAxisDefaultFigures(ctx: CanvasRenderingContext2D, overlay: Overlay, coordinates: Coordinate[], bounding: Bounding, precision: OverlayPrecision, thousandsSeparator: string, decimalFoldThreshold: number, defaultStyles: OverlayStyle, clickInfo: EventOverlayInfo | null): void {
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
        topY = Math.min(topY, coordinate.y)
        bottomY = Math.max(bottomY, coordinate.y)

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

    this.drawFigures(ctx, overlay, figures, defaultStyles)
  }
}
