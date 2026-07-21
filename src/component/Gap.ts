import type KLineData from '../common/KLineData'
import { clone, isBoolean, isNumber, merge } from '../common/utils/typeChecks'
import type { GapOptions } from '../Options'

export const GAP_AVERAGE_RANGE_PERIOD = 14

export interface RequiredGapOptions {
  closeGapsPartially: boolean
  maxGapCount: number
  minimalDeviationPercent: number
  limitMaxTrailLength: boolean
  maxTrailLength: number
}

export const defaultGapOptions: RequiredGapOptions = {
  closeGapsPartially: false,
  maxGapCount: 15,
  minimalDeviationPercent: 30,
  limitMaxTrailLength: false,
  maxTrailLength: 300
}

export type GapDirection = 'up' | 'down'
export type GapStatus = 'active' | 'closed' | 'truncated'
export type GapCloseReason = 'entered' | 'filled'
export type GapDataChangeKind = 'init' | 'prepend' | 'append' | 'update-latest' | 'update-history' | 'replace' | 'options'

export interface GapDataChangeContext {
  kind: GapDataChangeKind
  fromIndex: number
}

export interface GapSegment {
  fromIndex: number
  toIndex?: number
  top: number
  bottom: number
}

export interface GapRecord {
  id: string
  direction: GapDirection
  openIndex: number
  openTimestamp: number
  originalTop: number
  originalBottom: number
  status: GapStatus
  closeReason?: GapCloseReason
  closeIndex?: number
  closeTimestamp?: number
  segments: GapSegment[]
}

export interface GapEvent {
  type: 'opened' | 'closed'
  key: string
  gapId: string
  direction: GapDirection
  index: number
  timestamp: number
  openTimestamp: number
  top: number
  bottom: number
  size: number
  closeReason?: GapCloseReason
}

export interface GapCalculationResult {
  gaps: GapRecord[]
  events: GapEvent[]
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number, integer: boolean): number {
  if (!isNumber(value) || !Number.isFinite(value)) {
    return fallback
  }
  const normalized = integer ? Math.round(value) : value
  return Math.min(Math.max(normalized, min), max)
}

export function normalizeGapOptions(
  current: RequiredGapOptions = defaultGapOptions,
  value: true | GapOptions = true
): RequiredGapOptions {
  const next = clone(current)
  if (value !== true) {
    merge(next, value)
  }

  return {
    closeGapsPartially: isBoolean(next.closeGapsPartially) ? next.closeGapsPartially : current.closeGapsPartially,
    maxGapCount: normalizeNumber(next.maxGapCount, current.maxGapCount, 1, 500, true),
    minimalDeviationPercent: normalizeNumber(next.minimalDeviationPercent, current.minimalDeviationPercent, 1, 100, false),
    limitMaxTrailLength: isBoolean(next.limitMaxTrailLength) ? next.limitMaxTrailLength : current.limitMaxTrailLength,
    maxTrailLength: normalizeNumber(next.maxTrailLength, current.maxTrailLength, 1, Number.MAX_SAFE_INTEGER, true)
  }
}

export function getGapCalculationSignature(options: RequiredGapOptions): string {
  return JSON.stringify({
    closeGapsPartially: options.closeGapsPartially,
    maxGapCount: options.maxGapCount,
    minimalDeviationPercent: options.minimalDeviationPercent,
    limitMaxTrailLength: options.limitMaxTrailLength,
    maxTrailLength: options.maxTrailLength
  })
}

function createGapEvent(type: 'opened' | 'closed', gap: GapRecord, index: number, timestamp: number): GapEvent {
  const closeKey = type === 'closed' ? `:${timestamp}` : ''
  return {
    type,
    key: `${type}:${gap.id}${closeKey}`,
    gapId: gap.id,
    direction: gap.direction,
    index,
    timestamp,
    openTimestamp: gap.openTimestamp,
    top: gap.originalTop,
    bottom: gap.originalBottom,
    size: gap.originalTop - gap.originalBottom,
    closeReason: type === 'closed' ? gap.closeReason : undefined
  }
}

function closeGap(
  gap: GapRecord,
  reason: GapCloseReason,
  dataIndex: number,
  data: KLineData,
  events: GapEvent[]
): void {
  const activeSegment = gap.segments[gap.segments.length - 1]
  activeSegment.toIndex = dataIndex
  gap.status = 'closed'
  gap.closeReason = reason
  gap.closeIndex = dataIndex
  gap.closeTimestamp = data.timestamp
  events.push(createGapEvent('closed', gap, dataIndex, data.timestamp))
}

function updateActiveGap(
  gap: GapRecord,
  dataIndex: number,
  data: KLineData,
  options: RequiredGapOptions,
  events: GapEvent[]
): boolean {
  const activeSegment = gap.segments[gap.segments.length - 1]

  if (gap.direction === 'up') {
    if (options.closeGapsPartially) {
      if (data.low <= gap.originalBottom) {
        closeGap(gap, 'filled', dataIndex, data, events)
        return false
      }
      if (data.low < activeSegment.top) {
        activeSegment.toIndex = dataIndex
        gap.segments.push({
          fromIndex: dataIndex,
          top: data.low,
          bottom: gap.originalBottom
        })
      }
    } else if (data.low < activeSegment.top) {
      closeGap(gap, 'entered', dataIndex, data, events)
      return false
    }
  } else if (options.closeGapsPartially) {
    if (data.high >= gap.originalTop) {
      closeGap(gap, 'filled', dataIndex, data, events)
      return false
    }
    if (data.high > activeSegment.bottom) {
      activeSegment.toIndex = dataIndex
      gap.segments.push({
        fromIndex: dataIndex,
        top: gap.originalTop,
        bottom: data.high
      })
    }
  } else if (data.high > activeSegment.bottom) {
    closeGap(gap, 'entered', dataIndex, data, events)
    return false
  }

  if (options.limitMaxTrailLength && dataIndex - gap.openIndex >= options.maxTrailLength) {
    gap.segments[gap.segments.length - 1].toIndex = dataIndex
    gap.status = 'truncated'
    return false
  }

  return true
}

function createGap(direction: GapDirection, dataIndex: number, previous: KLineData, current: KLineData): GapRecord {
  const isUp = direction === 'up'
  const top = isUp ? current.low : previous.low
  const bottom = isUp ? previous.high : current.high
  return {
    id: `gap:${direction}:${current.timestamp}`,
    direction,
    openIndex: dataIndex,
    openTimestamp: current.timestamp,
    originalTop: top,
    originalBottom: bottom,
    status: 'active',
    segments: [{
      fromIndex: dataIndex - 1,
      top,
      bottom
    }]
  }
}

export function calculateGaps(dataList: KLineData[], options: RequiredGapOptions): GapCalculationResult {
  const gaps: GapRecord[] = []
  const activeGaps: GapRecord[] = []
  const events: GapEvent[] = []
  const ranges: number[] = []
  let rangeSum = 0

  for (let dataIndex = 0; dataIndex < dataList.length; dataIndex++) {
    const current = dataList[dataIndex]
    const range = Number.isFinite(current.high) && Number.isFinite(current.low)
      ? Math.max(0, current.high - current.low)
      : 0
    ranges.push(range)
    rangeSum += range
    if (dataIndex >= GAP_AVERAGE_RANGE_PERIOD) {
      rangeSum -= ranges[dataIndex - GAP_AVERAGE_RANGE_PERIOD]
    }

    for (let activeIndex = 0; activeIndex < activeGaps.length;) {
      if (updateActiveGap(activeGaps[activeIndex], dataIndex, current, options, events)) {
        activeIndex++
      } else {
        activeGaps.splice(activeIndex, 1)
      }
    }

    if (dataIndex === 0) {
      continue
    }

    const previous = dataList[dataIndex - 1]
    const averageRange = dataIndex >= GAP_AVERAGE_RANGE_PERIOD - 1
      ? rangeSum / GAP_AVERAGE_RANGE_PERIOD
      : 0
    const minimumGapSize = averageRange * options.minimalDeviationPercent / 100
    let direction: GapDirection | undefined

    if (current.low > previous.high && current.low - previous.high >= minimumGapSize) {
      direction = 'up'
    } else if (current.high < previous.low && previous.low - current.high >= minimumGapSize) {
      direction = 'down'
    }

    if (direction) {
      const gap = createGap(direction, dataIndex, previous, current)
      gaps.push(gap)
      activeGaps.push(gap)
      events.push(createGapEvent('opened', gap, dataIndex, current.timestamp))

      if (gaps.length > options.maxGapCount) {
        const evicted = gaps.shift()
        if (evicted) {
          const activeIndex = activeGaps.indexOf(evicted)
          if (activeIndex >= 0) {
            activeGaps.splice(activeIndex, 1)
          }
        }
      }
    }
  }

  return { gaps, events }
}
