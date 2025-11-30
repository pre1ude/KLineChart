import type PartialExcept from '../common/PartialExcept'
import type KLineData from '../common/KLineData'
import type Bounding from '../common/Bounding'
import type VisibleRange from '../common/VisibleRange'
import type BarSpace from '../common/BarSpace'
import type Crosshair from '../common/Crosshair'
import { type IndicatorStyle, type SmoothLineStyle, type RectStyle, type TextStyle, type TooltipIconStyle, type LineStyle, type LineType, type PolygonType, type TooltipLegend } from '../common/Styles'
import { type XAxis } from './XAxis'
import { type YAxis } from './YAxis'
import { isValid, clone, isNumber, isFunction, merge } from '../common/utils/typeChecks'
import { type ArcAttrs } from '../extension/figure/arc'
import { type RectAttrs } from '../extension/figure/rect'
import { type TextAttrs } from '../extension/figure/text'
import { type MouseTouchEvent } from '../common/SyntheticEvent'

// 用于区分使用什么精度
export enum IndicatorSeries {
  Normal = 'normal',
  Price = 'price',
  Volume = 'volume'
}

export type IndicatorFigureStyle = Partial<Omit<SmoothLineStyle, 'style'>> & Partial<Omit<RectStyle, 'style'>> & Partial<TextStyle> & Partial<{ style: LineType[keyof LineType] | PolygonType[keyof PolygonType] }> & Record<string, any>

export type IndicatorFigureAttrs = Partial<ArcAttrs> & Partial<LineStyle> & Partial<RectAttrs> & Partial<TextAttrs> & Record<string, any>

export type IndicatorFigureAttrsCallback<D> = (
  dataIndex: number,
  indicator: Indicator<D>,
  kLineDataList: KLineData[],
  x: number,
  bounding: Bounding,
  barSpace: BarSpace,
  xAxis: XAxis,
  yAxis: YAxis
) => IndicatorFigureAttrs

export type IndicatorFigureStylesCallback<D> = (
  dataIndex: number,
  indicator: Indicator<D>,
  kLineDataList: KLineData[],
  defaultStyles: IndicatorStyle
) => IndicatorFigureStyle

interface InteractionContext<D = any> {
  dataList: KLineData[]
  dataIndex: number
  figure: IndicatorFigure<D>
  indicator: Indicator<D>
}

export interface IndicatorFigure<D = any> {
  key: string
  title?: string
  type?: string
  baseValue?: number

  attrs?: IndicatorFigureAttrsCallback<D>
  styles?: IndicatorFigureStylesCallback<D>

  onClick?: (event: MouseTouchEvent, context: InteractionContext) => void
  onMouseEnter?: (event: MouseTouchEvent, context: InteractionContext) => void
  onMouseLeave?: (event: MouseTouchEvent, context: InteractionContext) => void
}

export type IndicatorRegenerateFiguresCallback<D = any> = (calcParams: any[]) => Array<IndicatorFigure<D>>

export interface IndicatorTooltipData {
  name: string
  calcParamsText: string
  icons: TooltipIconStyle[]
  values: TooltipLegend[]
}

export interface IndicatorCreateTooltipDataSourceParams<D = any> {
  kLineDataList: KLineData[]
  indicator: Indicator<D>
  visibleRange: VisibleRange
  bounding: Bounding
  crosshair: Crosshair
  defaultStyles: IndicatorStyle
  xAxis: XAxis
  yAxis: YAxis
}

export type IndicatorCreateTooltipDataSourceCallback<D = any> = (params: IndicatorCreateTooltipDataSourceParams<D>) => IndicatorTooltipData

export interface IndicatorDrawParams<D = any> {
  ctx: CanvasRenderingContext2D
  kLineDataList: KLineData[]
  indicator: Indicator<D>
  visibleRange: VisibleRange
  bounding: Bounding
  barSpace: BarSpace
  defaultStyles: IndicatorStyle
  xAxis: XAxis
  yAxis: YAxis
}

export type IndicatorDrawCallback<D = any> = (params: IndicatorDrawParams<D>) => boolean
export type IndicatorCalcCallback<D> = (dataList: KLineData[], indicator: Indicator<D>) => Promise<D[]> | D[]

export interface IndicatorApi<D = any> {
  /**
   * Unique id
   */
  id: string

  /**
   * Pane id
   */
  paneId: string

  /**
   * Indicator name
   */
  name: string

  /**
   * Short name, for display
   */
  shortName: string

  /**
   * Precision
   */
  precision: number

  /**
   * Calculation parameters
   */
  calcParams: any[]

  /**
   * Whether ohlc column is required
   */
  shouldOhlc: boolean

  /**
   * Whether large data values need to be formatted, starting from 1000, for example, whether 100000 needs to be formatted with 100K
   */
  shouldFormatBigNumber: boolean

  /**
   * Whether the indicator is visible
   */
  visible: boolean

  /**
   * Z index
   */
  zLevel: number

  /**
   * Extend data
   */
  extendData: any

  /**
   * Indicator series
   */
  series: IndicatorSeries

  /**
   * Figure configuration information
   */
  figures: Array<IndicatorFigure<D>>

  /**
   * Specified minimum value
   */
  minValue?: number

  /**
   * Specified maximum value
   */
  maxValue?: number

  /**
   * Style configuration
   */
  styles?: Partial<IndicatorStyle>

  /**
   * Indicator calculation
   */
  calc: IndicatorCalcCallback<D>

  /**
   * Regenerate figure configuration
   */
  regenerateFigures?: IndicatorRegenerateFiguresCallback<D>

  /**
   * Create custom tooltip text
   */
  createTooltipDataSource?: IndicatorCreateTooltipDataSourceCallback

  /**
   * Custom draw
   */
  draw?: IndicatorDrawCallback<D>

  /**
   * Calculation result
   */
  result: D[]

  onClick?: (event: MouseTouchEvent, context: InteractionContext<D>) => void
  onMouseEnter?: (event: MouseTouchEvent, context: InteractionContext<D>) => void
  onMouseLeave?: (event: MouseTouchEvent, context: InteractionContext<D>) => void
}

export type IndicatorTemplate<D = any> = PartialExcept<Omit<IndicatorApi<D>, 'result'>, 'id' | 'paneId' | 'name' | 'calc'>

export type IndicatorCreate<D = any> = PartialExcept<Omit<IndicatorApi<D>, 'result'>, 'name'> & {
  yAxisPosition?: 'left' | 'right'
}

export interface IndicatorFilter {
  id?: string
  name?: string
  paneId?: string
}

export class Indicator<D = any> implements IndicatorApi<D> {
  id: string
  paneId: string
  name: string
  shortName: string
  precision: number
  calcParams: unknown[]
  shouldOhlc: boolean
  shouldFormatBigNumber: boolean
  visible: boolean
  zLevel: number
  extendData: unknown
  series: IndicatorSeries
  figures: Array<IndicatorFigure<D>>
  minValue?: number
  maxValue?: number
  styles?: Partial<IndicatorStyle>
  regenerateFigures?: IndicatorRegenerateFiguresCallback<D>
  createTooltipDataSource?: IndicatorCreateTooltipDataSourceCallback
  draw?: IndicatorDrawCallback<D>
  calc: IndicatorCalcCallback<D>

  result: D[] = []

  private _lockSeriesPrecision: boolean = false
  private _prevIndicator?: Indicator<D>

  onClick?: (event: MouseTouchEvent, context: InteractionContext<D>) => void
  onMouseEnter?: (event: MouseTouchEvent, context: InteractionContext<D>) => void
  onMouseLeave?: (event: MouseTouchEvent, context: InteractionContext<D>) => void

  constructor(indicator: IndicatorTemplate) {
    const {
      id, paneId, name, shortName, series, calcParams, figures, precision,
      shouldOhlc, shouldFormatBigNumber, visible, zLevel,
      minValue, maxValue, styles, extendData,
      regenerateFigures, createTooltipDataSource, draw, calc, onClick, onMouseEnter, onMouseLeave
    } = indicator
    this.id = id
    this.paneId = paneId
    this.name = name
    this.shortName = shortName ?? name
    this.series = series ?? IndicatorSeries.Normal
    this.precision = precision ?? 4
    this.calcParams = calcParams ?? []
    this.figures = figures ?? []
    this.shouldOhlc = shouldOhlc ?? false
    this.shouldFormatBigNumber = shouldFormatBigNumber ?? false
    this.visible = visible ?? true
    this.zLevel = zLevel ?? 0
    this.minValue = minValue
    this.maxValue = maxValue
    this.styles = clone(styles ?? {})
    this.extendData = extendData
    this.regenerateFigures = regenerateFigures
    this.createTooltipDataSource = createTooltipDataSource
    this.draw = draw
    this.calc = calc
    this.onClick = onClick
    this.onMouseEnter = onMouseEnter
    this.onMouseLeave = onMouseLeave
  }

  shouldUpdate(): { draw: boolean, calc: boolean, sort: boolean } {
    if (!this._prevIndicator) {
      return { draw: true, calc: false, sort: false }
    }

    const sort = this._prevIndicator.zLevel !== this.zLevel

    const calc = this._prevIndicator.calc !== this.calc ||
      JSON.stringify(this._prevIndicator.calcParams) !== JSON.stringify(this.calcParams) ||
      JSON.stringify(this._prevIndicator.extendData) !== JSON.stringify(this.extendData) ||
      this._prevIndicator.figures !== this.figures

    const draw = sort || calc ||
      this._prevIndicator.styles !== this.styles ||
      this._prevIndicator.shortName !== this.shortName ||
      this._prevIndicator.series !== this.series ||
      this._prevIndicator.minValue !== this.minValue ||
      this._prevIndicator.maxValue !== this.maxValue ||
      this._prevIndicator.precision !== this.precision ||
      this._prevIndicator.shouldOhlc !== this.shouldOhlc ||
      this._prevIndicator.shouldFormatBigNumber !== this.shouldFormatBigNumber ||
      this._prevIndicator.visible !== this.visible ||
      this._prevIndicator.regenerateFigures !== this.regenerateFigures ||
      this._prevIndicator.createTooltipDataSource !== this.createTooltipDataSource ||
      this._prevIndicator.draw !== this.draw

    return { draw, calc, sort }
  }

  override(next: Partial<Indicator>): void {
    // Save previous state for change detection
    this._prevIndicator = clone({ ...this, _prevIndicator: null })

    const {
      shortName, calcParams, precision, figures, styles, ...others
    } = next

    this.shortName = shortName ?? this.shortName ?? this.name

    if (isNumber(precision)) {
      this._lockSeriesPrecision = true
      this.precision = precision
    }

    if (isValid(styles)) {
      merge(this.styles, styles)
    }

    merge(this, others)

    this.figures = figures ?? this.figures
    if (isValid(calcParams)) {
      this.calcParams = calcParams
      if (isFunction(this.regenerateFigures)) {
        this.figures = this.regenerateFigures(calcParams) ?? this.figures
      }
    }
  }

  setSeriesPrecision(precision: number): void {
    if (!this._lockSeriesPrecision) {
      this.precision = precision
    }
  }

  async calcIndicator(dataList: KLineData[]): Promise<boolean> {
    try {
      const result = await this.calc(dataList, this)
      this.result = result
      return true
    } catch (_e) {
      return false
    }
  }
}

export function getMergedDefaultStyles(indicator: Indicator, defaultStyles: IndicatorStyle): IndicatorStyle {
  const styles = indicator.styles

  const merged: IndicatorStyle = {
    ...defaultStyles
  }

  // 合并样式数组
  if (styles) {
    if (styles.circles) {
      merged.circles = defaultStyles.circles.map((defaultStyle, index) => {
        const userStyle = styles.circles?.[index]
        return userStyle ? { ...defaultStyle, ...userStyle } : defaultStyle
      })
    }

    if (styles.bars) {
      merged.bars = defaultStyles.bars.map((defaultStyle, index) => {
        const userStyle = styles.bars?.[index]
        return userStyle ? { ...defaultStyle, ...userStyle } : defaultStyle
      })
    }

    if (styles.lines) {
      merged.lines = defaultStyles.lines.map((defaultStyle, index) => {
        const userStyle = styles.lines?.[index]
        return userStyle ? { ...defaultStyle, ...userStyle } : defaultStyle
      })
    }

    if (styles.ohlc) {
      merged.ohlc = { ...defaultStyles.ohlc, ...styles.ohlc }
    }
    if (styles.tooltip) {
      merged.tooltip = { ...defaultStyles.tooltip, ...styles.tooltip }
    }
    if (styles.lastValueMark) {
      merged.lastValueMark = { ...defaultStyles.lastValueMark, ...styles.lastValueMark }
    }
  }

  return merged
}

export function getFigureBaseStyles(type: string, index: number, styles: IndicatorStyle): IndicatorFigureStyle {
  switch (type) {
    case 'circle': {
      const style = styles.circles[index % styles.circles.length]
      const merged: IndicatorFigureStyle = { ...style }
      merged.color = merged.noChangeColor
      return merged
    }

    case 'bar':
    case 'rect': {
      const style = styles.bars[index % styles.bars.length]
      const merged: IndicatorFigureStyle = { ...style }
      merged.color = merged.noChangeColor
      return merged
    }

    case 'line': {
      const style = styles.lines[index % styles.lines.length]
      return { ...style } as unknown as IndicatorFigureStyle
    }

    default:
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return {} as IndicatorFigureStyle
  }
}
