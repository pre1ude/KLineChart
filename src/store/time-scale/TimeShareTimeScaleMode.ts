import type VisibleRange from '../../common/VisibleRange'
import { createDefaultTimeShareVisibleRange } from '../../common/VisibleRange'
import { clamp } from '../../common/utils/number'
import { TimeScaleMode } from './TimeScaleMode'

export class TimeShareTimeScaleMode extends TimeScaleMode {
  override createBarSpaceLimit(): { min: number, max: number } {
    return { min: 0.1, max: 50 }
  }

  override applyBarSpaceLimitChange(nextBarWidth: number): boolean {
    this.context.setBarWidth(nextBarWidth)
    return true
  }

  override prepareVisibleRange(): void {
    const mainWidth = this.context.getMainWidth()
    const dataList = this.context.getDataList()
    const totalBarCount = dataList.length
    const timeShareTicks = this.context.getTimeShareTicks()
    const timeShareDays = this.context.getTimeShareDays()
    const tickCount = timeShareTicks.length * timeShareDays

    if (tickCount === 0) {
      console.error('Time share ticks is empty, cannot adjust for time share.')
      return
    }

    const barWidth = mainWidth / tickCount
    let offsetRight = this.context.getOffsetRightDistance()
    if (totalBarCount === 0) {
      offsetRight = mainWidth
    } else {
      offsetRight = (tickCount - totalBarCount) * barWidth
    }

    this.context.setBarWidth(clamp(barWidth, this.context.getBarSpaceLimit().min, this.context.getBarSpaceLimit().max))
    this.context.setOffsetRightDistance(offsetRight)
  }

  override calcVisibleRange(): VisibleRange {
    return this.calcVisibleRangeByCurrentState(
      createDefaultTimeShareVisibleRange(this.context.getTimeShareTicks().length * this.context.getTimeShareDays())
    )
  }
}
