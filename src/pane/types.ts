
import { type YAxisPosition, type YAxisType } from '../common/Styles'
import type CandlePane from './CandlePane'
import type IndicatorPane from './IndicatorPane'
import type XAxisPane from './XAxisPane'

export interface PaneGap {
  top?: number
  bottom?: number
}

export interface PaneReservedSpace {
  top?: number
  bottom?: number
}

export interface PaneAxisOptionItem {
  type?: YAxisType
  formatter?: (v: number) => string
  axisStyle?: {
    tickTextColor?: string
  }
  axisTitle?: string
}

export interface PaneAxisOptions {
  name?: string
  scrollZoomEnabled?: boolean
  YAxis?: {
    [key in Exclude<YAxisPosition, 'both'>]: PaneAxisOptionItem
  }
}

export const enum PanePosition {
  Top = 'top',
  Bottom = 'bottom'
}

export interface PaneOptions {
  id?: string
  height?: number
  minHeight?: number
  dragEnabled?: boolean
  position?: PanePosition
  gap?: PaneGap
  reservedSpace?: PaneReservedSpace
  axisOptions?: PaneAxisOptions
}

export const PANE_MIN_HEIGHT = 30

export const PANE_DEFAULT_HEIGHT = 100

export const PaneIdConstants = {
  CANDLE: 'candle_pane',
  INDICATOR: 'indicator_pane_',
  X_AXIS: 'x_axis_pane'
}

export type DrawPane = CandlePane | IndicatorPane | XAxisPane
