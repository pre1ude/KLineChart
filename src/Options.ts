
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

export interface Options {
  layout?: LayoutChild[]
  paneResizeMode?: PaneResizeMode
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
}
