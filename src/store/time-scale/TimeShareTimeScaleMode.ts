import type VisibleRange from '../../common/VisibleRange'
import { createDefaultTimeShareVisibleRange } from '../../common/VisibleRange'
import { clamp } from '../../common/utils/number'
import { formatToHHmm } from '../../common/utils/format'
import { TimeScaleMode } from './TimeScaleMode'

export class TimeShareTimeScaleMode extends TimeScaleMode {
  override createBarSpaceLimit(): { min: number, max: number } {
    return { min: 0.1, max: 50 }
  }

  override shouldRefreshAfterBarSpaceLimitChange(): boolean {
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
      const lastData = dataList[totalBarCount - 1]
      const hhmm = formatToHHmm(lastData.timestamp)
      const tickIndex = timeShareTicks.indexOf(hhmm)
      if (tickIndex === -1) {
        console.error('Last data timestamp not found in time share ticks:', hhmm, lastData)
        return
      }
      const dayIndex = Math.floor((totalBarCount - 1) / timeShareTicks.length)
      const index = dayIndex * timeShareTicks.length + tickIndex
      offsetRight = (tickCount - index - 1) * barWidth
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
