
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
  nice?: boolean
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
    [key in Exclude<YAxisPosition, 'both'>]?: PaneAxisOptionItem
  }
}

export const enum PanePosition {
  Top = 'top',
  Bottom = 'bottom'
}

export interface PaneHeightSpec {
  unit: 'pixel' | 'percent'
  value: number
}

export type PaneResizeMode = 'adjacent' | 'main-flex'

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

export const PANE_DEFAULT_HEIGHT = 0.15

export function parsePaneHeight(height: number): PaneHeightSpec | null {
  if (!Number.isFinite(height) || height <= 0) {
    return null
  }
  if (height < 1) {
    return { unit: 'percent', value: height }
  }
  return { unit: 'pixel', value: Math.round(height) }
}

export const PANE_DEFAULT_HEIGHT_SPEC: PaneHeightSpec = { unit: 'percent', value: PANE_DEFAULT_HEIGHT }

export function resolvePaneHeight(spec: PaneHeightSpec, availableHeight: number): number {
  return spec.unit === 'percent' ? spec.value * availableHeight : spec.value
}

export function updatePaneHeightSpecFromDrag(
  spec: PaneHeightSpec,
  height: number,
  availableHeight: number
): PaneHeightSpec {
  if (spec.unit === 'percent' && availableHeight <= 0) {
    return { ...spec }
  }
  return {
    unit: spec.unit,
    value: spec.unit === 'percent' ? height / availableHeight : height
  }
}

export function calculatePaneHeights(
  specs: Array<{ height: PaneHeightSpec, minHeight: number }>,
  availableHeight: number
): { heights: number[], remainingHeight: number } {
  const drawableHeight = Math.max(Math.round(availableHeight), 0)
  let remainingHeight = drawableHeight
  const heights = specs.map(spec => {
    const desiredHeight = Math.round(Math.max(resolvePaneHeight(spec.height, drawableHeight), spec.minHeight))
    const height = Math.min(desiredHeight, remainingHeight)
    remainingHeight -= height
    return height
  })
  return { heights, remainingHeight }
}

export const PaneIdConstants = {
  CANDLE: 'candle_pane',
  INDICATOR: 'indicator_pane_',
  X_AXIS: 'x_axis_pane'
}

export type DrawPane = CandlePane | IndicatorPane | XAxisPane
