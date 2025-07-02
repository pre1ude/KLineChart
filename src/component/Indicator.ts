/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type Nullable from '../common/Nullable'
import type ExcludePickPartial from '../common/ExcludePickPartial'
import type KLineData from '../common/KLineData'
import type Bounding from '../common/Bounding'
import type VisibleRange from '../common/VisibleRange'
import type BarSpace from '../common/BarSpace'
import type Crosshair from '../common/Crosshair'
import { type IndicatorStyle, type IndicatorPolygonStyle, type SmoothLineStyle, type RectStyle, type TextStyle, type TooltipIconStyle, type LineStyle, type LineType, type PolygonType, type TooltipLegend } from '../common/Styles'
import { type XAxis } from './XAxis'
import { type YAxis } from './YAxis'
import { formatValue } from '../common/utils/format'
import { isValid, clone, isNumber, isFunction, isString, isBoolean, isArray, merge } from '../common/utils/typeChecks'
import { type ArcAttrs } from '../extension/figure/arc'
import { type RectAttrs } from '../extension/figure/rect'
import { type TextAttrs } from '../extension/figure/text'

// 用于区分使用什么精度
export enum IndicatorSeries {
  Normal = 'normal',
  Price = 'price',
  Volume = 'volume'
}

export type IndicatorFigureStyle = Partial<Omit<SmoothLineStyle, 'style'>> & Partial<Omit<RectStyle, 'style'>> & Partial<TextStyle> & Partial<{ style: LineType[keyof LineType] | PolygonType[keyof PolygonType] }> & Record<string, any>

export type IndicatorFigureAttrs = Partial<ArcAttrs> & Partial<LineStyle> & Partial<RectAttrs> & Partial<TextAttrs> & Record<string, any>

export interface IndicatorFigureCallbackBrother<PCN> {
  prev: PCN
  current: PCN
  next: PCN
}

export type IndicatorFigureAttrsCallbackCoordinate<D> = IndicatorFigureCallbackBrother<Record<keyof D, number> & { x: number }>

export type IndicatorFigureAttrsCallbackData<D> = IndicatorFigureCallbackBrother<D>

export interface IndicatorFigureAttrsCallbackParams<D> {
  data: IndicatorFigureAttrsCallbackData<Nullable<D>>
  coordinate: IndicatorFigureAttrsCallbackCoordinate<D>
  bounding: Bounding
  barSpace: BarSpace
  xAxis: XAxis
  yAxis: YAxis
}

export interface IndicatorFigureStylesCallbackDataChild<D> {
  kLineData?: KLineData
  indicatorData?: D
}

export type IndicatorFigureStylesCallbackData<D> = IndicatorFigureCallbackBrother<IndicatorFigureStylesCallbackDataChild<D>>

export type IndicatorFigureAttrsCallback<D> = (params: IndicatorFigureAttrsCallbackParams<D>) => IndicatorFigureAttrs
export type IndicatorFigureStylesCallback<D> = (data: IndicatorFigureStylesCallbackData<D>, indicator: Indicator<D>, defaultStyles: IndicatorStyle) => IndicatorFigureStyle

export interface IndicatorFigure<D = any> {
  key: string
  title?: string
  type?: string
  baseValue?: number
  attrs?: IndicatorFigureAttrsCallback<D>
  styles?: IndicatorFigureStylesCallback<D>
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
  minValue: Nullable<number>

  /**
   * Specified maximum value
   */
  maxValue: Nullable<number>

  /**
   * Style configuration
   */
  styles: Nullable<Partial<IndicatorStyle>>

  /**
   * Indicator calculation
   */
  calc: IndicatorCalcCallback<D>

  /**
   * Regenerate figure configuration
   */
  regenerateFigures: Nullable<IndicatorRegenerateFiguresCallback<D>>

  /**
   * Create custom tooltip text
   */
  createTooltipDataSource: Nullable<IndicatorCreateTooltipDataSourceCallback>

  /**
   * Custom draw
   */
  draw: Nullable<IndicatorDrawCallback<D>>

  /**
   * Calculation result
   */
  result: D[]
}

export type IndicatorTemplate<D = any> = ExcludePickPartial<Omit<IndicatorApi<D>, 'result'>, 'name' | 'calc'>

export type IndicatorCreate<D = any> = ExcludePickPartial<Omit<IndicatorApi<D>, 'result'>, 'name'>

export type EachFigureCallback = (figure: IndicatorFigure, figureStyles: IndicatorFigureStyle, index: number) => void

export function eachFigures<D> (
  kLineDataList: KLineData[],
  indicator: Indicator<D>,
  dataIndex: number,
  defaultStyles: IndicatorStyle,
  eachFigureCallback: EachFigureCallback
): void {
  const result = indicator.result
  const figures = indicator.figures
  const styles = indicator.styles

  const circleStyles = formatValue(styles, 'circles', defaultStyles.circles) as IndicatorPolygonStyle[]
  const circleStyleCount = circleStyles.length

  const barStyles = formatValue(styles, 'bars', defaultStyles.bars) as IndicatorPolygonStyle[]
  const barStyleCount = barStyles.length

  const lineStyles = formatValue(styles, 'lines', defaultStyles.lines) as SmoothLineStyle[]
  const lineStyleCount = lineStyles.length

  let circleCount = 0
  let barCount = 0
  let lineCount = 0

  let defaultFigureStyles
  let figureIndex = 0
  figures.forEach(figure => {
    switch (figure.type) {
      case 'circle': {
        figureIndex = circleCount
        const styles = circleStyles[circleCount % circleStyleCount]
        defaultFigureStyles = { ...styles, color: styles.noChangeColor }
        circleCount++
        break
      }
      case 'bar': {
        figureIndex = barCount
        const styles = barStyles[barCount % barStyleCount]
        defaultFigureStyles = { ...styles, color: styles.noChangeColor }
        barCount++
        break
      }
      case 'line': {
        figureIndex = lineCount
        defaultFigureStyles = lineStyles[lineCount % lineStyleCount]
        lineCount++
        break
      }
      default: { break }
    }
    if (isValid(defaultFigureStyles)) {
      const cbData = {
        prev: { kLineData: kLineDataList[dataIndex - 1], indicatorData: result[dataIndex - 1] },
        current: { kLineData: kLineDataList[dataIndex], indicatorData: result[dataIndex] },
        next: { kLineData: kLineDataList[dataIndex + 1], indicatorData: result[dataIndex + 1] }
      }
      const ss = figure.styles?.(cbData, indicator, defaultStyles)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      eachFigureCallback(figure, { ...defaultFigureStyles, ...ss }, figureIndex)
    }
  })
}

export class Indicator<D = any> implements IndicatorApi<D> {
  name: string
  shortName: string
  precision: number
  calcParams: any[]
  shouldOhlc: boolean
  shouldFormatBigNumber: boolean
  visible: boolean
  zLevel: number
  extendData: any
  series: IndicatorSeries
  figures: Array<IndicatorFigure<D>>
  minValue: Nullable<number>
  maxValue: Nullable<number>
  styles: Nullable<Partial<IndicatorStyle>>
  regenerateFigures: Nullable<IndicatorRegenerateFiguresCallback<D>>
  createTooltipDataSource: Nullable<IndicatorCreateTooltipDataSourceCallback>
  draw: Nullable<IndicatorDrawCallback<D>>
  calc: IndicatorCalcCallback<D>

  result: D[] = []

  private _lockSeriesPrecision: boolean = false

  constructor (indicator: IndicatorTemplate) {
    const {
      name, shortName, series, calcParams, figures, precision,
      shouldOhlc, shouldFormatBigNumber, visible, zLevel,
      minValue, maxValue, styles, extendData,
      regenerateFigures, createTooltipDataSource, draw, calc
    } = indicator
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
    this.minValue = minValue ?? null
    this.maxValue = maxValue ?? null
    this.styles = clone(styles ?? {})
    this.extendData = extendData
    this.regenerateFigures = regenerateFigures ?? null
    this.createTooltipDataSource = createTooltipDataSource ?? null
    this.draw = draw ?? null
    this.calc = calc
  }

  shouldUpdate (next: Partial<Indicator>): [boolean, boolean, boolean] {
    const needCalc = shouldCalc(next)
    const needSort = shouldSort(next)
    const needUpdate = shouldUpdate(next)

    function shouldUpdate (next: Partial<Indicator>): boolean {
      return (
        needCalc || needSort ||
        isValid(next.styles) ||
        (isString(next.shortName) && this.shortName !== next.shortName) ||
        (isValid(next.series) && this.series !== next.series) ||
        (isNumber(next.minValue) && this.minValue !== next.minValue) ||
        (isNumber(next.maxValue) && this.maxValue !== next.maxValue) ||
        (isNumber(next.precision) && this.precision !== next.precision) ||
        (isBoolean(next.shouldOhlc) && this.shouldOhlc !== next.shouldOhlc) ||
        (isBoolean(next.shouldFormatBigNumber) && this.shouldFormatBigNumber !== next.shouldFormatBigNumber) ||
        (isBoolean(next.visible) && this.visible !== next.visible) ||
        (isFunction(next.regenerateFigures) && this.regenerateFigures !== next.regenerateFigures) ||
        (isFunction(next.createTooltipDataSource) && this.createTooltipDataSource !== next.createTooltipDataSource) ||
        (isValid(next.draw) && this.draw !== next.draw)
      )
    }
    function shouldSort (next: Partial<Indicator>): boolean {
      return (
        (isNumber(next.zLevel) && this.zLevel !== next.zLevel)
      )
    }
    // todo should we calc after extendData change?
    // todo should we calc after figures change?
    function shouldCalc (next: Partial<Indicator>): boolean {
      return (
        (isFunction(next.calc) && this.calc !== next.calc) ||
        (isArray(next.calcParams) && JSON.stringify(this.calcParams) !== JSON.stringify(next.calcParams)) ||
        (isValid(next.extendData) && JSON.stringify(this.extendData) !== JSON.stringify(next.extendData)) ||
        (isValid(next.figures) && this.figures !== next.figures)
      )
    }

    return [needUpdate, needCalc, needSort]
  }

  overrideIndicator (next: Partial<Indicator>): void {
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

  setSeriesPrecision (precision: number): void {
    if (!this._lockSeriesPrecision) {
      this.precision = precision
    }
  }

  async calcIndicator (dataList: KLineData[]): Promise<boolean> {
    try {
      const result = await this.calc(dataList, this)
      this.result = result
      return true
    } catch (e) {
      return false
    }
  }
}
