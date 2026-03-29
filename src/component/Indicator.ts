import type BarSpace from '../common/BarSpace'
import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import type KLineData from '../common/KLineData'
import type PartialExcept from '../common/PartialExcept'
import { type IndicatorStyle, type LineStyle, type LineType, type PolygonType, type RectStyle, type SmoothLineStyle, type TextStyle, type TooltipIconStyle, type TooltipLegend } from '../common/Styles'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { clone, isFunction, isNumber, isValid, merge } from '../common/utils/typeChecks'
import type VisibleRange from '../common/VisibleRange'
import { type ArcAttrs } from '../extension/figure/arc'
import { type RectAttrs } from '../extension/figure/rect'
import { type TextAttrs } from '../extension/figure/text'
import { type XAxis } from './XAxis'
import { type YAxis } from './YAxis'

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
  drawOrder?: number

  /**
   * 控制 figure 的可见性
   * - boolean: 静态控制，true 显示，false 隐藏
   * - undefined: 默认显示（等同于 true）
   */
  visible?: boolean

  attrs?: IndicatorFigureAttrsCallback<D>
  styles?: IndicatorFigureStylesCallback<D>

  onClick?: (event: MouseTouchEvent, context: InteractionContext) => void
  onMouseEnter?: (event: MouseTouchEvent, context: InteractionContext) => void
  onMouseLeave?: (event: MouseTouchEvent, context: InteractionContext) => void
}

export type IndicatorRegenerateFiguresCallback<D = any> = (calcParams: number[]) => Array<IndicatorFigure<D>>

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

export type IndicatorCreateTooltipDataSourceCallback<D = any> = (params: IndicatorCreateTooltipDataSourceParams<D>) => Partial<IndicatorTooltipData>

export interface IndicatorDrawParams<D = unknown> {
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

export type IndicatorDrawCallback<D = unknown> = (params: IndicatorDrawParams<D>) => boolean
export type IndicatorCalcCallback<D> = (dataList: KLineData[], indicator: Indicator<D>) => Promise<D[]> | D[]

export interface IndicatorApi<D = unknown> {
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
   * Calculation parameters (e.g., periods, thresholds)
   */
  calcParams: number[]

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
  extendData: unknown

  /**
   * Indicator series
   */
  series: IndicatorSeries

  /**
   * Figure configuration information
   */
  figures: Array<IndicatorFigure<D>>

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

export type IndicatorTemplate<D = unknown> = PartialExcept<Omit<IndicatorApi<D>, 'result' | 'id' | 'paneId'>, 'name' | 'calc'>

export type IndicatorCreate<D = unknown> = PartialExcept<Omit<IndicatorApi<D>, 'result'>, 'name'> & {
  yAxisPosition?: 'left' | 'right'
}

export type IndicatorOverride<D = unknown> = Partial<Omit<IndicatorApi<D>, 'result' | 'id' | 'name'>> & {
  yAxisPosition?: 'left' | 'right'
} & ({ id: string, name?: string } | { name: string })

export interface IndicatorFilter {
  id?: string
  name?: string
  paneId?: string
}

export class Indicator<D = unknown> implements IndicatorApi<D> {
  id: string
  paneId: string
  name: string
  shortName: string
  precision: number
  calcParams: number[]
  shouldOhlc: boolean
  shouldFormatBigNumber: boolean
  visible: boolean
  zLevel: number
  extendData: unknown
  series: IndicatorSeries
  figures: Array<IndicatorFigure<D>>
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

  constructor(template: IndicatorTemplate<D>, initOptions?: Partial<Pick<IndicatorApi<D>, 'id' | 'paneId'>>) {
    this.id = initOptions?.id ?? ''
    this.paneId = initOptions?.paneId ?? ''

    this.name = template.name
    this.shortName = template.shortName ?? template.name
    this.series = template.series ?? IndicatorSeries.Normal
    this.precision = template.precision ?? 4
    this.calcParams = template.calcParams ?? []
    this.figures = template.figures ?? []
    this.shouldOhlc = template.shouldOhlc ?? false
    this.shouldFormatBigNumber = template.shouldFormatBigNumber ?? false
    this.visible = template.visible ?? true
    this.zLevel = template.zLevel ?? 0
    this.styles = clone(template.styles ?? {})
    this.extendData = template.extendData
    this.regenerateFigures = template.regenerateFigures
    this.createTooltipDataSource = template.createTooltipDataSource
    this.draw = template.draw
    this.calc = template.calc
    this.onClick = template.onClick
    this.onMouseEnter = template.onMouseEnter
    this.onMouseLeave = template.onMouseLeave

    this.result = []
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
      this._prevIndicator.precision !== this.precision ||
      this._prevIndicator.shouldOhlc !== this.shouldOhlc ||
      this._prevIndicator.shouldFormatBigNumber !== this.shouldFormatBigNumber ||
      this._prevIndicator.visible !== this.visible ||
      this._prevIndicator.regenerateFigures !== this.regenerateFigures ||
      this._prevIndicator.createTooltipDataSource !== this.createTooltipDataSource ||
      this._prevIndicator.draw !== this.draw

    return { draw, calc, sort }
  }

  override(next: Partial<Indicator<D>>): void {
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
      // 对于 figures，直接覆盖而不是合并，方便 reset
      if (styles.figures !== undefined) {
        const { figures: newFigures, ...otherStyles } = styles
        this.styles ??= {}
        merge(this.styles, otherStyles)
        this.styles.figures = newFigures
      } else {
        this.styles ??= {}
        merge(this.styles, styles)
      }
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

  // 合并样式数组的辅助函数
  function mergeStyleArray<T>(defaultArr: T[], userArr?: T[]): T[] {
    if (!userArr || userArr.length === 0) {
      return defaultArr
    }
    const maxLen = Math.max(defaultArr.length, userArr.length)
    const result: T[] = []
    for (let i = 0; i < maxLen; i++) {
      const defaultStyle = defaultArr[i % defaultArr.length]
      const userStyle = userArr[i]
      result.push(userStyle ? { ...defaultStyle, ...userStyle } : defaultStyle)
    }
    return result
  }

  // 合并样式数组
  if (styles) {
    if (styles.circles) {
      merged.circles = mergeStyleArray(defaultStyles.circles, styles.circles)
    }

    if (styles.bars) {
      merged.bars = mergeStyleArray(defaultStyles.bars, styles.bars)
    }

    if (styles.lines) {
      merged.lines = mergeStyleArray(defaultStyles.lines, styles.lines)
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

export function isIndicatorFigureVisible(
  indicator: Indicator,
  figure: IndicatorFigure
): boolean {
  if (figure.visible === false) {
    return false
  }
  return indicator.styles?.figures?.[figure.key]?.visible !== false
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
