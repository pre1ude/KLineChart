import type KLineData from '../../common/KLineData'
import { lowerBound } from '../../common/utils/number'
import { formatToHHmm } from '../../common/utils/format'

const DAY_MINUTES = 24 * 60
const MINUTE_TIMESTAMP = 60 * 1000

export function timestampToTimeShareDataIndex(
  dataList: KLineData[],
  timestamp: number,
  timeShareTicks: string[],
  getTimeShareTimestamp = createTimeShareTimestampGetter(timeShareTicks)
): number | undefined {
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

  const ticksPerDay = timeShareTicks.length
  const dayIndex = lb > 0
    ? Math.floor(Math.min(lb, dataList.length) / ticksPerDay)
    : -1
  const dayStartTimestamp = dayIndex >= 0 ? dataList[dayIndex * ticksPerDay]?.timestamp : undefined
  const tickStr = formatToHHmm(timestamp)
  const tickIndex = findTimeShareTickIndexByTimestamp(timeShareTicks, tickStr, timestamp, dayStartTimestamp, getTimeShareTimestamp)
  if (tickIndex == null) {
    return undefined
  }

  if (lb > 0) {
    return dayIndex * ticksPerDay + tickIndex
  }

  return tickIndex - timeShareTicks.length
}

export function createTimeShareTimestampGetter(timeShareTicks: string[]): (tickIndex: number, dayStartTimestamp: number | undefined) => number | undefined {
  if (timeShareTicks.length === 0) {
    return () => undefined
  }

  const dayStartMinutes = parseTimeShareTickMinutes(timeShareTicks[0])
  if (dayStartMinutes == null) {
    return () => undefined
  }

  const minuteOffsets = timeShareTicks.map((text, index) => {
    const tickMinutes = parseTimeShareTickMinutes(text)
    if (tickMinutes == null) {
      return undefined
    }
    const dayOffsetMinutes = tickMinutes < dayStartMinutes || (index > 0 && tickMinutes === dayStartMinutes)
      ? DAY_MINUTES
      : 0
    return tickMinutes - dayStartMinutes + dayOffsetMinutes
  })

  return (tickIndex, dayStartTimestamp) => {
    const minuteOffset = minuteOffsets[tickIndex]
    return dayStartTimestamp == null || minuteOffset == null
      ? undefined
      : dayStartTimestamp + minuteOffset * MINUTE_TIMESTAMP
  }
}

export function timeShareDataIndexToTimestamp(
  dataList: Array<{ timestamp: number }>,
  dataIndex: number,
  timeShareTicks: string[],
  getTimeShareTimestamp = createTimeShareTimestampGetter(timeShareTicks)
): number | undefined {
  const ticksPerDay = timeShareTicks.length
  if (dataIndex < 0 || ticksPerDay === 0) {
    return undefined
  }

  const dayIndex = Math.floor(dataIndex / ticksPerDay)
  const tickIndex = dataIndex % ticksPerDay
  const dayStartTimestamp = dataList[dayIndex * ticksPerDay]?.timestamp
  return getTimeShareTimestamp(tickIndex, dayStartTimestamp)
}

function findTimeShareTickIndexByTimestamp(
  timeShareTicks: string[],
  tickText: string,
  timestamp: number,
  dayStartTimestamp: number | undefined,
  getTimeShareTimestamp: (tickIndex: number, dayStartTimestamp: number | undefined) => number | undefined
): number | undefined {
  const firstTickIndex = timeShareTicks.indexOf(tickText)
  if (firstTickIndex === -1) {
    return undefined
  }
  if (dayStartTimestamp == null) {
    return firstTickIndex
  }

  for (let i = firstTickIndex; i < timeShareTicks.length; i++) {
    if (timeShareTicks[i] === tickText && isSameMinute(getTimeShareTimestamp(i, dayStartTimestamp), timestamp)) {
      return i
    }
  }
  return firstTickIndex
}

function isSameMinute(timestamp: number | undefined, target: number): boolean {
  return timestamp != null && Math.floor(timestamp / MINUTE_TIMESTAMP) === Math.floor(target / MINUTE_TIMESTAMP)
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

export function parseTimeShareTickMinutes(text: string): number | undefined {
  const length = text.length
  if (length !== 4 && length !== 5) {
    return undefined
  }

  const colonIndex = length - 3
  if (text.charCodeAt(colonIndex) !== 58) {
    return undefined
  }

  const hour = length === 4
    ? parseTimeShareDigit(text.charCodeAt(0))
    : parseTimeShareTwoDigits(text.charCodeAt(0), text.charCodeAt(1))
  const minute = parseTimeShareTwoDigits(text.charCodeAt(length - 2), text.charCodeAt(length - 1))

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined
  }
  return hour * 60 + minute
}

function parseTimeShareDigit(code: number): number {
  const digit = code - 48
  return digit >= 0 && digit <= 9 ? digit : -1
}

function parseTimeShareTwoDigits(tensCode: number, onesCode: number): number {
  const tens = parseTimeShareDigit(tensCode)
  const ones = parseTimeShareDigit(onesCode)
  return tens < 0 || ones < 0 ? -1 : tens * 10 + ones
}
