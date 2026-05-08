import type VisibleRange from '../../common/VisibleRange'
import { getDefaultVisibleRange } from '../../common/VisibleRange'
import { clamp } from '../../common/utils/number'
import type { ResizeAnchor } from '../../Chart'
import type BarSpace from '../../common/BarSpace'
import type KLineData from '../../common/KLineData'

export const enum TimeScaleModeKind {
  KLine = 'kLine',
  TimeShare = 'timeShare'
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

  shouldRefreshAfterBarSpaceLimitChange(nextBarWidth: number): boolean {
    return nextBarWidth !== this.context.getBarWidth()
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
