import type KLineData from '../../common/KLineData'
import { lowerBound } from '../../common/utils/number'
import { formatToHHmm } from '../../common/utils/format'

export function timestampToTimeShareDataIndex(dataList: KLineData[], timestamp: number, timeShareTicks: string[]): number | undefined {
  if (dataList.length === 0) {
    return undefined
  }

  const lb = lowerBound(dataList, item => item.timestamp - timestamp)
  if (lb < dataList.length && dataList[lb].timestamp === timestamp) {
    return lb
  }

  if (timeShareTicks.length === 0) {
    return undefined
  }

  const tickStr = formatToHHmm(timestamp)
  const tickIndex = timeShareTicks.indexOf(tickStr)
  if (tickIndex === -1) {
    return undefined
  }

  if (lb > 0) {
    const ticksPerDay = timeShareTicks.length
    const dayIndex = Math.floor(Math.min(lb, dataList.length) / ticksPerDay)
    return dayIndex * ticksPerDay + tickIndex
  }

  return tickIndex - timeShareTicks.length
}

export function resolveTimeShareBasisPrice(firstData: KLineData | undefined, basisPrice?: number): number {
  if (basisPrice != null) {
    return basisPrice
  }
  return firstData?.prevClose ?? firstData?.open ?? 0
}

export function resolveMinutePercentageBasis(isTimeShare: boolean, timeShareBasisPrice: number, visibleFirstClose: number | undefined): number {
  if (isTimeShare) {
    return timeShareBasisPrice
  }
  return visibleFirstClose ?? 0
}
