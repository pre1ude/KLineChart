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

  setRange(start: number = 0, end: number = 100): void {
    const normalized = normalizeRange(start, end)
    this._start = normalized.start
    this._end = normalized.end
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

    if (dataCount <= MIN_VISIBLE_DATA_COUNT) {
      this.setRange(0, 100)
    } else {
      this.setRange(this._start, this._end)
      this.applyMinSpan(dataCount)
    }

    const domainFrom = dataCount * this._start / 100
    const domainTo = dataCount * this._end / 100
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
    const minSpan = getMinPercentSpan(dataCount)
    const nextSpan = clamp(prevSpan / scaleRatio, minSpan, 100)
    const nextStart = anchorPercent - nextSpan * anchorRatio

    this._start = nextStart
    this._end = nextStart + nextSpan
    this.keepRangeInBounds()

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

  private applyMinSpan(dataCount: number): void {
    const span = this._end - this._start
    const minSpan = getMinPercentSpan(dataCount)
    if (span >= minSpan) {
      return
    }
    const center = (this._start + this._end) / 2
    this._start = center - minSpan / 2
    this._end = center + minSpan / 2
    this.keepRangeInBounds()
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

function normalizeRange(start: number, end: number): { start: number, end: number } {
  const normalizedStart = Number.isFinite(start) ? clamp(start, 0, 100) : 0
  const normalizedEnd = Number.isFinite(end) ? clamp(end, 0, 100) : 100
  if (normalizedEnd > normalizedStart) {
    return { start: normalizedStart, end: normalizedEnd }
  }
  return { start: 0, end: 100 }
}

function getMinPercentSpan(dataCount: number): number {
  return Math.min(100, MIN_VISIBLE_DATA_COUNT / dataCount * 100)
}
