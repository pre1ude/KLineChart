import type DualYPane from '../pane/DualYPane'
import { WidgetNameConstants } from './types'
import DrawWidget from './DrawWidget'
import type { YScale, YScaleType } from '../component/YScale'
import { type AxisTick } from '../component/Axis'
import YAxisView from '../view/YAxisView'
import CandleLastPriceLabelView from '../view/CandleLastPriceLabelView'
import IndicatorLastValueView from '../view/IndicatorLastValueView'
import OverlayView from '../view/OverlayView'
import CrosshairHorizontalLabelView from '../view/CrosshairHorizontalLabelView'
import { YAxisPosition } from '../common/Styles'
import { PaneIdConstants } from '../pane/types'
import { setCursor } from '../common/utils/cursor'
import type YScaleHost from '../component/YScaleHost'
import { formatFoldDecimal, formatThousands } from '../common/utils/format'

export enum YAxisLabelDisplay {
  Value = 'value',
  Percentage = 'percentage',
  MinutePercentage = 'minute-percentage'
}

export interface YAxisOptions {
  id: string
  paneId: string
  yScaleId: string
  needWidget: boolean
  position: 'left' | 'right'
  order: number
  labelDisplay: YAxisLabelDisplay
}

export type YAxisCreate = Partial<Omit<YAxisOptions, 'id' | 'paneId' | 'yScaleId'>> & { id?: string, paneId: string, yScaleId: string }
export type YAxisOverride = Partial<Omit<YAxisOptions, 'id' | 'paneId'>> & { id: string, paneId?: string }

export interface YAxisFilter {
  id?: string
  paneId?: string
  yScaleId?: string
}

export default class YAxisWidget extends DrawWidget<DualYPane> {
  private _axisOptions: YAxisOptions = {
    id: '',
    paneId: '',
    yScaleId: '',
    needWidget: true,
    position: YAxisPosition.Left,
    order: 0,
    labelDisplay: YAxisLabelDisplay.Value
  }

  private readonly _yAxisView = new YAxisView(this)
  private readonly _candleLastPriceLabelView = new CandleLastPriceLabelView(this)
  private readonly _indicatorLastValueView = new IndicatorLastValueView(this)
  private readonly _overlayYAxisView = new OverlayView(this, 'yAxis')
  private readonly _crosshairHorizontalLabelView = new CrosshairHorizontalLabelView(this)

  constructor(rootContainer: HTMLElement, pane: DualYPane, yAxisOptions: YAxisOptions) {
    super(rootContainer, pane)
    setCursor(this.getContainer(), 'ns-resize')
    this.setOptions(yAxisOptions)
  }

  override destroy(): void {
    this._overlayYAxisView.clear()
    super.destroy()
  }

  getOptions(): YAxisOptions {
    return this._axisOptions
  }

  setOptions(options: Partial<YAxisOptions>): void {
    this._axisOptions = { ...this._axisOptions, ...options }
  }

  getScale(): YScaleHost { return this.getPane().getYScaleById(this._axisOptions.yScaleId)! }

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

  getScaleType(): YScaleType {
    return this.getScale().getOptions().type
  }

  getScaleComponent(): YScale {
    return this.getScale().getComponent()
  }

  getTicks(): AxisTick[] {
    const scale = this.getScaleComponent()
    return scale.getTicks().map(tick => ({
      ...tick,
      text: this.formatLabel(scale.convertToRealValue(+tick.value), tick.text)
    }))
  }

  getAutoSize(): number {
    return this.getScaleComponent().getAutoSize(this.getTicks(), (value, text) => this.formatLabel(value, text))
  }

  formatLabel(value: number, fallback: string): string {
    const chartStore = this.getPane().getChart().getChartStore()
    const display = this._axisOptions.labelDisplay ?? YAxisLabelDisplay.Value
    let basis: number | undefined
    if (display === YAxisLabelDisplay.Percentage) {
      if (!this.isInCandle() || !this.getPane().isDefaultYScale(this._axisOptions.yScaleId)) {
        return '--'
      }
      basis = chartStore.getVisibleFirstData()?.close
    } else if (display === YAxisLabelDisplay.MinutePercentage) {
      basis = chartStore.getMinutePercentageBasis()
    } else {
      return fallback
    }

    if (basis == null || basis <= 0) {
      return '--'
    }
    const text = `${((value - basis) / basis * 100).toFixed(2)}%`
    return formatFoldDecimal(
      formatThousands(text, chartStore.getThousandsSeparator()),
      chartStore.getDecimalFoldThreshold()
    )
  }

  override getName(): string {
    return WidgetNameConstants.Y_AXIS
  }

  override updateMain(ctx: CanvasRenderingContext2D): void {
    const chart = this.getPane().getChart()
    const chartStore = chart.getChartStore()
    this._yAxisView.draw(ctx)
    if (this.getScaleComponent().isInCandle() && this.getPane().isDefaultYScale(this._axisOptions.yScaleId)) {
      if (!chartStore.getIsTimeShare()) {
        // 非分时图才展示最新价标签
        this._candleLastPriceLabelView.draw(ctx)
      }
    }
    this._indicatorLastValueView.draw(ctx)
  }

  override updateOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.getPane().isDefaultYScale(this._axisOptions.yScaleId)) {
      this._overlayYAxisView.draw(ctx)
    }
    this._crosshairHorizontalLabelView.draw(ctx)
  }
}
