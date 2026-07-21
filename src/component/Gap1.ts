import type KLineData from '../common/KLineData'
import type VisibleRange from '../common/VisibleRange'
import { clone, isBoolean, isNumber, merge } from '../common/utils/typeChecks'
import type { Gap1Options } from '../Options'

export interface RequiredGap1Options {
  maxGapCount: number
  showValue: boolean
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

  return {
    maxGapCount: normalizeMaxGapCount(next.maxGapCount, current.maxGapCount),
    showValue: isBoolean(next.showValue) ? next.showValue : current.showValue
  }
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

    if (current.low > previous.high) {
      activeGaps.push(createGap('up', dataIndex, previous, current))
    } else if (current.high < previous.low) {
      activeGaps.push(createGap('down', dataIndex, previous, current))
    }
  }

  const normalizedMaxGapCount = normalizeMaxGapCount(maxGapCount, defaultGap1Options.maxGapCount)
  return activeGaps
    .sort((first, second) => second.openTimestamp - first.openTimestamp || second.openIndex - first.openIndex)
    .slice(0, normalizedMaxGapCount)
}
