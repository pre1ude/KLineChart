import type VisibleRange from '../../common/VisibleRange'
import { getDefaultVisibleRange } from '../../common/VisibleRange'
import { clamp } from '../../common/utils/number'
import type BarSpace from '../../common/BarSpace'
import { createKLineEntityWidth, TimeScaleMode } from './TimeScaleMode'

const MIN_VISIBLE_DATA_COUNT = 3
const MIN_PERCENT_SPAN = 0.000001

export class DataZoomTimeScaleMode extends TimeScaleMode {
  private _start = 0
  private _end = 100
  private _minSpan?: number
  private _maxSpan?: number

  getRange(): { start: number, end: number } {
    return {
      start: this._start,
      end: this._end
    }
  }

  getMinSpan(): number {
    const dataCount = this.context.getDataList().length
    if (dataCount <= MIN_VISIBLE_DATA_COUNT) {
      return 100
    }
    return getMinPercentSpan(dataCount)
  }

  setSpanLimit(minSpan?: number, maxSpan?: number): void {
    const normalized = normalizeSpanLimit(minSpan, maxSpan)
    this._minSpan = normalized.minSpan
    this._maxSpan = normalized.maxSpan
    this.setRange(this._start, this._end)
  }

  setRange(start: number = 0, end: number = 100): boolean {
    const normalized = normalizeRange(start, end, this._minSpan, this._maxSpan)
    const changed = this._start !== normalized.start || this._end !== normalized.end
    this._start = normalized.start
    this._end = normalized.end
    return changed
  }

  setRangeByMove(start: number, end: number, delta: number, handleIndex: DataZoomRangeMoveHandle): DataZoomRangeMoveResult {
    const movedRange = this.getRangeByMove(start, end, delta, handleIndex)
    const changed = this.setRange(movedRange.start, movedRange.end)
    return {
      ...movedRange,
      changed
    }
  }

  getRangeByMove(start: number, end: number, delta: number, handleIndex: DataZoomRangeMoveHandle): { start: number, end: number } {
    const normalizedStart = normalizePercent(start, 0)
    const normalizedEnd = normalizePercent(end, 100)
    const handleEnds = handleIndex === 'all'
      ? toOrderedRange(normalizedStart, normalizedEnd)
      : { start: normalizedStart, end: normalizedEnd }
    return moveRangeHandles(handleEnds, delta, handleIndex, this._minSpan, this._maxSpan)
  }

  override createBarSpace(): BarSpace {
    const barWidth = this.context.getBarWidth()
    const entityWidth = createKLineEntityWidth(barWidth, this.context.getBarSpaceLimit().max)
    return {
      bar: barWidth,
      halfBar: barWidth / 2,
      gapBar: entityWidth,
      halfGapBar: Math.floor(entityWidth / 2)
    }
  }

  override applyBarSpaceLimitChange(): boolean {
    return true
  }

  override setBarSpace(): boolean {
    return false
  }

  override calcVisibleRange(): VisibleRange {
    const dataCount = this.context.getDataList().length
    const mainWidth = this.context.getMainWidth()

    if (dataCount === 0 || mainWidth <= 0) {
      return getDefaultVisibleRange()
    }

    const range = dataCount <= MIN_VISIBLE_DATA_COUNT ? { start: 0, end: 100 } : getEffectiveRange(this._start, this._end, this.getMinSpan())

    const domainFrom = dataCount * range.start / 100
    const domainTo = dataCount * range.end / 100
    const domainSpan = Math.max(domainTo - domainFrom, MIN_PERCENT_SPAN)
    const barWidth = mainWidth / domainSpan
    const offsetRight = (domainTo - dataCount) * barWidth

    this.context.setBarWidth(barWidth)
    this.context.setOffsetRightDistance(offsetRight)

    return {
      from: Math.max(0, Math.floor(domainFrom)),
      to: Math.min(dataCount, Math.ceil(domainTo)),
      domainFrom,
      domainTo
    }
  }

  override scroll(distance: number): boolean {
    const dataCount = this.context.getDataList().length
    const mainWidth = this.context.getMainWidth()
    if (dataCount <= MIN_VISIBLE_DATA_COUNT || mainWidth <= 0) {
      return false
    }

    const span = this._end - this._start
    const deltaPercent = distance / mainWidth * span
    this.moveRange(-deltaPercent)
    return true
  }

  override zoom(scaleDelta: number, xCoord?: number): number | undefined {
    const dataCount = this.context.getDataList().length
    const mainWidth = this.context.getMainWidth()
    const scaleRatio = 1 + scaleDelta
    if (dataCount <= MIN_VISIBLE_DATA_COUNT || mainWidth <= 0 || scaleRatio <= 0) {
      return undefined
    }

    const x = clamp(this.context.getZoomCoordinate(xCoord), 0, mainWidth)
    const anchorRatio = x / mainWidth
    const prevSpan = this._end - this._start
    const anchorPercent = this._start + prevSpan * anchorRatio
    const rawSpan = prevSpan / scaleRatio
    const rawStart = anchorPercent - rawSpan * anchorRatio
    const constrainedRange = normalizeRange(rawStart, rawStart + rawSpan, Math.max(this.getMinSpan(), this._minSpan ?? 0), this._maxSpan)

    this._start = constrainedRange.start
    this._end = constrainedRange.end

    return prevSpan / (this._end - this._start)
  }

  override fitToWidth(): boolean {
    const prevStart = this._start
    const prevEnd = this._end
    this.setRange(0, 100)
    return prevStart !== this._start || prevEnd !== this._end
  }

  override alignLeft(): boolean {
    return this.fitToWidth()
  }

  override alignRight(): boolean {
    return this.fitToWidth()
  }

  override alignCenter(): boolean {
    return this.fitToWidth()
  }

  override autoInitialAlignment(): boolean {
    return false
  }

  private moveRange(deltaPercent: number): void {
    this._start += deltaPercent
    this._end += deltaPercent
    this.keepRangeInBounds()
  }

  private keepRangeInBounds(): void {
    const span = this._end - this._start
    if (this._start < 0) {
      this._start = 0
      this._end = span
    }
    if (this._end > 100) {
      this._end = 100
      this._start = 100 - span
    }
    this.setRange(this._start, this._end)
  }
}

export type DataZoomRangeMoveHandle = 'all' | 0 | 1

export type DataZoomRangeMoveResult = {
  start: number
  end: number
  changed: boolean
}

function normalizePercent(value: number | undefined, fallback: number): number {
  return isFiniteNumber(value) ? clamp(value, 0, 100) : fallback
}

function normalizeRange(start: number, end: number, minSpan?: number, maxSpan?: number): { start: number, end: number } {
  const normalizedStart = normalizePercent(start, 0)
  const normalizedEnd = normalizePercent(end, 100)
  const orderedRange = toOrderedRange(normalizedStart, normalizedEnd)
  const movedRange = moveRangeHandles(orderedRange, 0, 'all', minSpan, maxSpan)
  return toOrderedRange(movedRange.start, movedRange.end)
}

function normalizeSpanLimit(minSpan?: number, maxSpan?: number): { minSpan?: number, maxSpan?: number } {
  const normalizedMinSpan = isFiniteNumber(minSpan) ? clamp(minSpan, 0, 100) : undefined
  let normalizedMaxSpan = isFiniteNumber(maxSpan) ? clamp(maxSpan, 0, 100) : undefined
  if (normalizedMaxSpan != null && normalizedMinSpan != null) {
    normalizedMaxSpan = Math.max(normalizedMaxSpan, normalizedMinSpan)
  }
  return {
    minSpan: normalizedMinSpan,
    maxSpan: normalizedMaxSpan
  }
}

function isFiniteNumber(value: number | undefined): value is number {
  return Number.isFinite(value)
}

function getMinPercentSpan(dataCount: number): number {
  return Math.min(100, MIN_VISIBLE_DATA_COUNT / dataCount * 100)
}

function getEffectiveRange(start: number, end: number, minSpan: number): { start: number, end: number } {
  const span = end - start
  if (span >= minSpan) {
    return { start, end }
  }
  const center = (start + end) / 2
  const nextStart = clamp(center - minSpan / 2, 0, 100 - minSpan)
  return {
    start: nextStart,
    end: nextStart + minSpan
  }
}

function toOrderedRange(start: number, end: number): { start: number, end: number } {
  return start <= end ? { start, end } : { start: end, end: start }
}

function moveRangeHandles(
  range: { start: number, end: number },
  delta: number,
  handleIndex: DataZoomRangeMoveHandle,
  minSpan?: number,
  maxSpan?: number
): { start: number, end: number } {
  const extent = { start: 0, end: 100 }
  const extentSpan = extent.end - extent.start
  let restrictedMinSpan = minSpan != null ? clamp(minSpan, 0, extentSpan) : undefined
  let restrictedMaxSpan = maxSpan != null ? Math.max(maxSpan, restrictedMinSpan ?? 0) : undefined
  let start = clamp(range.start, extent.start, extent.end)
  let end = clamp(range.end, extent.start, extent.end)
  let movingHandleIndex: 0 | 1
  if (handleIndex === 'all') {
    const span = restrictValue(Math.abs(end - start), restrictedMinSpan, restrictedMaxSpan)
    restrictedMinSpan = span
    restrictedMaxSpan = span
    movingHandleIndex = 0
  } else {
    movingHandleIndex = handleIndex
  }

  const index = movingHandleIndex
  const originalSign = getHandleSign(start, end, index)
  const extentMinSpan = restrictedMinSpan ?? 0
  const movingValue = (index === 0 ? start : end) + delta
  const constrainedMovingValue = originalSign < 0
    ? clamp(movingValue, extent.start + extentMinSpan, extent.end)
    : clamp(movingValue, extent.start, extent.end - extentMinSpan)

  if (index === 0) {
    start = constrainedMovingValue
  } else {
    end = constrainedMovingValue
  }

  const currentSign = getHandleSign(start, end, index)
  let currentSpan = Math.abs(start - end)
  if (restrictedMinSpan != null && (currentSign !== originalSign || currentSpan < restrictedMinSpan)) {
    const pushedValue = constrainedMovingValue + originalSign * restrictedMinSpan
    if (index === 0) {
      end = pushedValue
    } else {
      start = pushedValue
    }
  }

  currentSpan = Math.abs(start - end)
  if (restrictedMaxSpan != null && currentSpan > restrictedMaxSpan) {
    const currentDistSign = getHandleSign(start, end, index)
    const pushedValue = constrainedMovingValue + currentDistSign * restrictedMaxSpan
    if (index === 0) {
      end = pushedValue
    } else {
      start = pushedValue
    }
  }

  return { start, end }
}

function restrictValue(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))
}

function getHandleSign(start: number, end: number, handleIndex: 0 | 1): number {
  const movingValue = handleIndex === 0 ? start : end
  const fixedValue = handleIndex === 0 ? end : start
  const dist = movingValue - fixedValue
  if (dist > 0) {
    return -1
  }
  if (dist < 0) {
    return 1
  }
  return handleIndex === 0 ? 1 : -1
}
