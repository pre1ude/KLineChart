import type DualYPane from '../pane/DualYPane'
import { WidgetNameConstants } from './types'
import DrawWidget from './DrawWidget'
import type YAxis from '../component/YAxis'
import YAxisView from '../view/YAxisView'
import CandleLastPriceLabelView from '../view/CandleLastPriceLabelView'
import IndicatorLastValueView from '../view/IndicatorLastValueView'
import OverlayView from '../view/OverlayView'
import CrosshairHorizontalLabelView from '../view/CrosshairHorizontalLabelView'
import { YAxisPosition, YAxisType } from '../common/Styles'
import { PaneIdConstants, type PaneOptions } from '../pane/types'
import { isString, isValid } from '../common/utils/typeChecks'
import { getYAxisClass } from '../extension/y-axis'
import { setCursor } from '../common/utils/cursor'

export interface YAxisOptions {
  name?: string
  scrollZoomEnabled?: boolean
  position: Exclude<YAxisPosition, 'both'>
  type: YAxisType
  nice: boolean
  axisTitle: string
}

export default class YAxisWidget extends DrawWidget<DualYPane> {
  private _axis!: YAxis
  private _axisOptions: YAxisOptions = {
    name: 'default',
    scrollZoomEnabled: true,
    position: YAxisPosition.Left,
    type: YAxisType.Normal,
    nice: true,
    axisTitle: ''
  }

  private readonly _yAxisView = new YAxisView(this)
  private readonly _candleLastPriceLabelView = new CandleLastPriceLabelView(this)
  private readonly _indicatorLastValueView = new IndicatorLastValueView(this)
  private readonly _overlayYAxisView = new OverlayView(this, 'yAxis')
  private readonly _crosshairHorizontalLabelView = new CrosshairHorizontalLabelView(this)

  constructor(rootContainer: HTMLElement, pane: DualYPane, options: PaneOptions, position: Exclude<YAxisPosition, 'both'>) {
    super(rootContainer, pane)
    setCursor(this.getContainer(), 'ns-resize')

    const axisType = options.axisOptions?.YAxis?.[position]?.type ?? YAxisType.Normal
    const nice = options.axisOptions?.YAxis?.[position]?.nice ?? true
    const axisTitle = options.axisOptions?.YAxis?.[position]?.axisTitle ?? ''
    this.setOptions({
      name: options.axisOptions?.name,
      scrollZoomEnabled: options.axisOptions?.scrollZoomEnabled,
      position,
      type: axisType,
      nice,
      axisTitle
    })
  }

  getOptions(): YAxisOptions {
    return this._axisOptions
  }

  setOptions(options: YAxisOptions): void {
    const name = options?.name
    if (
      (this._axisOptions.name !== name && isString(name)) ||
      !isValid(this._axis)
    ) {
      this._axis = this.createAxisComponent(name ?? 'default')
    }
    this._axisOptions = options
  }

  createAxisComponent(name: string): YAxis {
    const YAxisClass = getYAxisClass(name)
    return new YAxisClass(this)
  }

  isInCandle(): boolean {
    return this.getPane().getId() === PaneIdConstants.CANDLE
  }

  isAlignLeft(): boolean {
    const position = this._axisOptions.position
    const yAxisStyles = this.getPane().getChart().getStyles().yAxis
    const inside = yAxisStyles.inside
    return (
      (position === YAxisPosition.Left && inside) ||
      (position === YAxisPosition.Right && !inside)
    )
  }

  getAxisType(): YAxisType {
    return this._axisOptions.type
  }

  getAxisComponent(): YAxis {
    return this._axis
  }

  override getName(): string {
    return WidgetNameConstants.Y_AXIS
  }

  override updateMain(ctx: CanvasRenderingContext2D): void {
    const chart = this.getPane().getChart()
    const chartStore = chart.getChartStore()
    this._yAxisView.draw(ctx)
    if (this.getAxisComponent().isInCandle()) {
      if (!chartStore.getIsTimeShare()) {
        // 非分时图才展示最新价标签
        this._candleLastPriceLabelView.draw(ctx)
      }
    }
    this._indicatorLastValueView.draw(ctx)
  }

  override updateOverlay(ctx: CanvasRenderingContext2D): void {
    this._overlayYAxisView.draw(ctx)
    this._crosshairHorizontalLabelView.draw(ctx)
  }
}
