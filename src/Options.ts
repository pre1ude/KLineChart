
import type { DeepPartialStyles } from './common/Styles'
import type { DateTimeFormat } from './common/utils/dateTimeFormat'
import { formatDate, formatBigNumber } from './common/utils/format'

import { type IndicatorCreate } from './component/Indicator'
import { type PaneOptions, type PaneResizeMode } from './pane/types'

export enum FormatDateType {
  Tooltip,
  Crosshair,
  XAxis
}

export type FormatDate = (dateTimeFormat: DateTimeFormat, timestamp: number, format: string, type: FormatDateType) => string

export type FormatBigNumber = (value: string | number) => string

export interface CustomApi {
  formatDate: FormatDate
  formatBigNumber: FormatBigNumber
}

export type TooltipRenderType = 'canvas' | 'dom'

export interface TooltipOptions {
  /** Selected when the chart is created and ignored by later Chart.setOptions calls. */
  renderType?: TooltipRenderType
  /** Whether indicator tooltip values show their direction arrows. */
  showValueDirection?: boolean
}

export function getDefaultCustomApi(): CustomApi {
  return {
    formatDate,
    formatBigNumber
  }
}

export const defaultLocale = 'en-US'

export interface Locales {
  time: string
  open: string
  high: string
  low: string
  close: string
  volume: string
  change: string
  turnover: string
  [key: string]: string
}

export const enum LayoutChildType {
  Candle = 'candle',
  Indicator = 'indicator',
  XAxis = 'xAxis'
}

export interface LayoutChild {
  type: LayoutChildType
  content?: Array<string | IndicatorCreate>
  options?: PaneOptions
}

export type DataZoomSliderTheme = 'auto' | 'dark' | 'light'

export interface DataZoomSliderOptions {
  show?: boolean
  height?: number
  brushSelect?: boolean
  showDataShadow?: boolean
  theme?: DataZoomSliderTheme
}

export interface DataZoomOptions {
  start?: number
  end?: number
  minSpan?: number
  maxSpan?: number
  slider?: boolean | DataZoomSliderOptions
}

export interface GapOptions {
  closeGapsPartially?: boolean
  maxGapCount?: number
  minimalDeviationPercent?: number
  limitMaxTrailLength?: boolean
  maxTrailLength?: number
}

export interface Gap1ValueText {
  priceText: string
  percentageText: string
  widthText: string
}

export interface Gap1ValueFormatterParams extends Gap1ValueText {
  direction: 'up' | 'down'
  start: number
  end: number
  change: number
  percentage: number
  pricePrecision: number
}

export type Gap1ValueFormatter = (params: Gap1ValueFormatterParams) => Partial<Gap1ValueText> | undefined

export interface Gap1Options {
  maxGapCount?: number
  showValue?: boolean
  /**
   * Synchronously formats Gap1 value text during drawing. Keep this callback lightweight.
   * External state changes require a chart redraw. Set to `null` to restore default formatting.
   */
  valueFormatter?: Gap1ValueFormatter | null
}

export interface Options {
  tooltip?: TooltipOptions
  layout?: LayoutChild[]
  paneResizeMode?: PaneResizeMode
  indicatorPaneDefaultHeight?: number
  minIndicatorPaneHeight?: number
  locale?: string
  timezone?: string
  styles?: string | DeepPartialStyles
  customApi?: Partial<CustomApi>
  thousandsSeparator?: string
  decimalFoldThreshold?: number
  isTimeShare?: boolean
  timeShareDays?: number
  timeShareTicks?: string[]
  // 多日分时图是否跨天断开连接
  timeShareBreakOnCrossDays?: boolean
  // 分时图是否强调日内 session 间隔
  timeShareShowSessionGap?: boolean
  // 分时图日内 session 间隔最多在 N 日分时图内展示
  timeShareSessionGapForN?: number
  preferXTicks?: string[]
  dataZoom?: boolean | DataZoomOptions
  /** TradingView-style full candlestick gap behavior configuration. */
  gaps?: GapOptions
  /** Whether TradingView-style full candlestick gap regions are visible. */
  gapShow?: boolean
  /** Visible-range domestic-style unfilled gap behavior configuration. */
  gap1?: Gap1Options
  /** Whether visible-range domestic-style unfilled gap regions are visible. */
  gap1Show?: boolean
}
