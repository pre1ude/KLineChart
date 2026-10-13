import type { LogicalRange } from '../../common/VisibleRange'
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
  getBarWidth: () => number
  setBarWidth: (barWidth: number) => void
  getBarSpaceLimit: () => { min: number, max: number }
  getMainWidth: () => number
  getDataList: () => KLineData[]
  getFirstLogicalIndex: () => number
  getRightLogicalIndex: () => number
  setRightLogicalIndex: (logicalIndex: number) => void
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
    return this.setBarSpace(nextBarWidth)
  }

  setBarSpace(barWidth: number): boolean {
    const nextBarWidth = clamp(barWidth, this.context.getBarSpaceLimit().min, this.context.getBarSpaceLimit().max)
    if (this.context.getBarWidth() === nextBarWidth) {
      return false
    }
    const offset = this.context.getOffsetRightDistance()
    this.context.setBarWidth(nextBarWidth)
    this.context.setOffsetRightDistance(offset)
    return true
  }

  prepareVisibleRange(): void {}

  calcLogicalRange(): LogicalRange {
    return this.calcLogicalRangeByCurrentState({ from: 0, to: 0 })
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

  protected calcLogicalRangeByCurrentState(emptyRange: LogicalRange): LogicalRange {
    const totalBarCount = this.context.getDataList().length
    if (!totalBarCount) return emptyRange

    const barWidth = this.context.getBarWidth()
    const mainWidth = this.context.getMainWidth()
    const minRemainWidth = this.context.getMinRemainWidth()
    const first = this.context.getFirstLogicalIndex()
    const end = first + totalBarCount
    const leftMin = Math.min(minRemainWidth.left / barWidth, totalBarCount)
    const rightMin = Math.min(minRemainWidth.right / barWidth, totalBarCount)
    const to = clamp(this.context.getRightLogicalIndex(), first + rightMin, end + mainWidth / barWidth - leftMin)
    this.context.setRightLogicalIndex(to)
    return { from: to - mainWidth / barWidth, to }
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
