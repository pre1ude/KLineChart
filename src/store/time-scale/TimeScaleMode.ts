import type VisibleRange from '../../common/VisibleRange'
import { getDefaultVisibleRange } from '../../common/VisibleRange'
import { clamp } from '../../common/utils/number'
import type { ResizeAnchor } from '../../Chart'
import type BarSpace from '../../common/BarSpace'
import type KLineData from '../../common/KLineData'

export const enum TimeScaleModeKind {
  KLine = 'kLine',
  TimeShare = 'timeShare',
  DataZoom = 'dataZoom'
}

export interface TimeScaleModeContext {
  getBarSpace: () => BarSpace
  getBarWidth: () => number
  setBarWidth: (barWidth: number) => void
  getBarSpaceLimit: () => { min: number, max: number }
  getMainWidth: () => number
  getDataList: () => KLineData[]
  getMinRemainWidth: () => { left: number, right: number }
  getTimeShareTicks: () => string[]
  getTimeShareDays: () => number
  getZoomCoordinate: (xCoord?: number) => number
  getInitialOffsetRightDistance: () => number
  getOffsetRightDistance: () => number
  setOffsetRightDistance: (distance: number) => void
}

export abstract class TimeScaleMode {
  protected readonly context: TimeScaleModeContext

  constructor(context: TimeScaleModeContext) {
    this.context = context
  }

  createBarSpaceLimit(): { min: number, max: number } {
    return { min: 1, max: 50 }
  }

  createBarSpace(): BarSpace {
    const barWidth = this.context.getBarWidth()
    const entityWidth = createKLineEntityWidth(barWidth)
    return {
      bar: barWidth,
      halfBar: barWidth / 2,
      gapBar: entityWidth,
      halfGapBar: Math.floor(entityWidth / 2)
    }
  }

  applyBarSpaceLimitChange(nextBarWidth: number): boolean {
    if (nextBarWidth === this.context.getBarWidth()) {
      return false
    }
    this.context.setBarWidth(nextBarWidth)
    return true
  }

  setBarSpace(barWidth: number): boolean {
    const nextBarWidth = clamp(barWidth, this.context.getBarSpaceLimit().min, this.context.getBarSpaceLimit().max)
    if (this.context.getBarWidth() === nextBarWidth) {
      return false
    }
    this.context.setBarWidth(nextBarWidth)
    return true
  }

  prepareVisibleRange(): void {}

  calcVisibleRange(): VisibleRange {
    return this.calcVisibleRangeByCurrentState(getDefaultVisibleRange())
  }

  scroll(_distance: number): boolean {
    return false
  }

  zoom(_scaleDelta: number, _xCoord?: number): number | undefined {
    return undefined
  }

  fitToWidth(_align: 'left' | 'center' | 'right' | 'auto'): boolean {
    return false
  }

  adjustBarSpaceForMainWidthChange(_prevMainWidth: number, _nextMainWidth: number, _anchor: ResizeAnchor): void {}

  alignLeft(): boolean {
    return false
  }

  alignRight(): boolean {
    return false
  }

  alignCenter(): boolean {
    return false
  }

  autoInitialAlignment(): boolean {
    return false
  }

  onAppendData(): void {}

  protected calcVisibleRangeByCurrentState(emptyVisibleRange: VisibleRange): VisibleRange {
    const totalBarCount = this.context.getDataList().length
    if (!totalBarCount) {
      return emptyVisibleRange
    }

    const barWidth = this.context.getBarWidth()
    const totalBarWidth = totalBarCount * barWidth
    const mainWidth = this.context.getMainWidth()
    const minRemainWidth = this.context.getMinRemainWidth()
    const lmin = Math.min(minRemainWidth.left, totalBarWidth)
    const rmin = Math.min(minRemainWidth.right, totalBarWidth)
    const offsetRight = clamp(this.context.getOffsetRightDistance(), -totalBarWidth + rmin, mainWidth - lmin)

    this.context.setOffsetRightDistance(offsetRight)

    const to = offsetRight > 0 ? totalBarCount : Math.ceil(totalBarCount + offsetRight / barWidth)
    const diff = offsetRight + totalBarCount * barWidth - mainWidth
    const from = diff < 0 ? 0 : Math.floor(diff / barWidth)
    const domainTo = totalBarCount + offsetRight / barWidth
    const domainFrom = domainTo - mainWidth / barWidth

    return { from, to, domainFrom, domainTo }
  }
}

const K_BAR_RATIO = 0.88

export function createKLineEntityWidth(barWidth: number, maxWidth?: number): number {
  let kWidth: number
  if (barWidth > 3) {
    kWidth = Math.floor(barWidth * K_BAR_RATIO)
  } else {
    kWidth = Math.floor(barWidth)
    if (kWidth === barWidth) {
      kWidth--
    }
  }
  if (kWidth % 2 === 0) {
    kWidth--
  }
  kWidth = Math.max(1, kWidth)
  return maxWidth == null ? kWidth : Math.max(1, Math.min(kWidth, Math.floor(maxWidth)))
}
