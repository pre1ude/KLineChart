import type KLineData from '../common/KLineData'
import type VisibleRange from '../common/VisibleRange'
import { clone, isBoolean, isFunction, isNumber, merge } from '../common/utils/typeChecks'
import type { Gap1Options, Gap1ValueFormatter } from '../Options'

const GAP1_MIN_ORIGINAL_CHANGE_PERCENT = 0.02

export interface RequiredGap1Options {
  maxGapCount: number
  showValue: boolean
  valueFormatter?: Gap1ValueFormatter
}

export const defaultGap1Options: RequiredGap1Options = {
  maxGapCount: 15,
  showValue: false
}

export type Gap1Direction = 'up' | 'down'

export interface Gap1Record {
  id: string
  direction: Gap1Direction
  fromIndex: number
  openIndex: number
  openTimestamp: number
  originalTop: number
  originalBottom: number
  top: number
  bottom: number
}

function normalizeMaxGapCount(value: unknown, fallback: number): number {
  if (!isNumber(value) || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(Math.max(Math.round(value), 1), 500)
}

export function normalizeGap1Options(
  current: RequiredGap1Options = defaultGap1Options,
  value: true | Gap1Options = true
): RequiredGap1Options {
  const next = clone(current)
  if (value !== true) {
    merge(next, value)
  }

  const normalized: RequiredGap1Options = {
    maxGapCount: normalizeMaxGapCount(next.maxGapCount, current.maxGapCount),
    showValue: isBoolean(next.showValue) ? next.showValue : current.showValue
  }
  const hasValueFormatter = value !== true && Object.prototype.hasOwnProperty.call(value, 'valueFormatter')
  let valueFormatter = current.valueFormatter
  if (hasValueFormatter) {
    if (value.valueFormatter === null) {
      valueFormatter = undefined
    } else if (isFunction(value.valueFormatter)) {
      valueFormatter = value.valueFormatter
    }
  }
  if (isFunction(valueFormatter)) {
    normalized.valueFormatter = valueFormatter
  }
  return normalized
}

function normalizeVisibleIndex(value: number, fallback: number, dataLength: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), 0), dataLength)
}

function updateGap(gap: Gap1Record, data: KLineData): boolean {
  if (gap.direction === 'up') {
    if (!Number.isFinite(data.low)) return true
    if (data.low <= gap.originalBottom) return false
    if (data.low < gap.top) {
      gap.top = data.low
    }
  } else {
    if (!Number.isFinite(data.high)) return true
    if (data.high >= gap.originalTop) return false
    if (data.high > gap.bottom) {
      gap.bottom = data.high
    }
  }
  return gap.top > gap.bottom
}

function createGap(
  direction: Gap1Direction,
  dataIndex: number,
  previous: KLineData,
  current: KLineData
): Gap1Record {
  const isUp = direction === 'up'
  const top = isUp ? current.low : previous.low
  const bottom = isUp ? previous.high : current.high
  return {
    id: `gap1:${direction}:${current.timestamp}`,
    direction,
    fromIndex: dataIndex - 1,
    openIndex: dataIndex,
    openTimestamp: current.timestamp,
    originalTop: top,
    originalBottom: bottom,
    top,
    bottom
  }
}

function exceedsOriginalChangeThreshold(
  direction: Gap1Direction,
  previous: KLineData,
  current: KLineData
): boolean {
  const start = direction === 'up' ? previous.high : previous.low
  const end = direction === 'up' ? current.low : current.high
  const change = Math.abs(end - start)
  if (start === 0) return change > 0
  const changePercent = change / Math.abs(start) * 100
  return changePercent > GAP1_MIN_ORIGINAL_CHANGE_PERCENT + Number.EPSILON
}

export function calculateGap1(
  dataList: KLineData[],
  visibleRange: VisibleRange,
  maxGapCount: number = defaultGap1Options.maxGapCount
): Gap1Record[] {
  const dataLength = dataList.length
  const from = normalizeVisibleIndex(visibleRange.from, 0, dataLength)
  const to = normalizeVisibleIndex(visibleRange.to, dataLength, dataLength)
  if (to <= from) return []

  const activeGaps: Gap1Record[] = []

  for (let dataIndex = from; dataIndex < to; dataIndex++) {
    const current = dataList[dataIndex]

    for (let activeIndex = 0; activeIndex < activeGaps.length;) {
      if (updateGap(activeGaps[activeIndex], current)) {
        activeIndex++
      } else {
        activeGaps.splice(activeIndex, 1)
      }
    }

    if (dataIndex === 0) continue

    const previous = dataList[dataIndex - 1]
    if (
      !Number.isFinite(previous.high) ||
      !Number.isFinite(previous.low) ||
      !Number.isFinite(current.high) ||
      !Number.isFinite(current.low)
    ) {
      continue
    }

    let direction: Gap1Direction | undefined
    if (current.low > previous.high) {
      direction = 'up'
    } else if (current.high < previous.low) {
      direction = 'down'
    }

    if (direction && exceedsOriginalChangeThreshold(direction, previous, current)) {
      activeGaps.push(createGap(direction, dataIndex, previous, current))
    }
  }

  const normalizedMaxGapCount = normalizeMaxGapCount(maxGapCount, defaultGap1Options.maxGapCount)
  return activeGaps
    .sort((first, second) => second.openTimestamp - first.openTimestamp || second.openIndex - first.openIndex)
    .slice(0, normalizedMaxGapCount)
}
