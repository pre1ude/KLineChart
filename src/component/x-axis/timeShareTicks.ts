import { getDateTimeFormat } from '../../common/utils/dateTimeFormat'
import { formatDate } from '../../common/utils/format'
import { GridLineLevel } from '../../common/Styles'
import { parseTimeShareTickMinutes } from '../../store/time-share'
import {
  X_AXIS_DAY_START_TICK_PRIORITY,
  type XAxisTick,
  type XAxisTickLayoutOptions
} from './tickLayout'

const TIME_SHARE_NICE_STEPS = [15, 30, 60, 120, 240, 360]
const TIME_SHARE_INTRADAY_TICK_MAX_DAYS = 4

export function createTimeShareXAxisTicks(
  timeShareTicks: string[],
  dayCount: number,
  maxTickCount: number,
  layoutOptions: Required<XAxisTickLayoutOptions>,
  preferXTicks: string[] | undefined,
  showSessionGap: boolean,
  sessionGapForN: number,
  getTimestampByDataIndex: (dataIndex: number) => number | undefined,
  convertToPixel: (dataIndex: number) => number
): XAxisTick[] {
  if (timeShareTicks.length === 0) {
    return []
  }

  const totalTimeShareTickCount = timeShareTicks.length * dayCount
  let tickIndexes: number[]
  if (preferXTicks) {
    tickIndexes = getPreferredTimeShareTickIndexes(timeShareTicks, dayCount, preferXTicks)
  } else {
    tickIndexes = selectTimeShareTickIndexes(timeShareTicks, dayCount, maxTickCount, layoutOptions)
  }
  tickIndexes = mergeTimeShareDayStartTickIndexes(tickIndexes, timeShareTicks.length, dayCount)
  tickIndexes = mergeTimeShareBoundaryTickIndexes(tickIndexes, totalTimeShareTickCount, layoutOptions)

  const dateTimeFormat = getDateTimeFormat()
  const shouldShowSessionGap = showSessionGap && dayCount <= sessionGapForN
  const tickMinutes = shouldShowSessionGap ? timeShareTicks.map(parseTimeShareTickMinutes) : []
  const sessionGap = shouldShowSessionGap ? calcTimeShareBaseInterval(tickMinutes) * 1.5 : 0
  let prevYear: string | null = null
  return tickIndexes.map(tickIndex => {
    const index = tickIndex % timeShareTicks.length
    const timestamp = getTimestampByDataIndex(tickIndex)
    let text = timeShareTicks[index]
    let priority: number | undefined
    let gridLineLevel: GridLineLevel | undefined
    if (dayCount > 1 && index === 0) {
      if (timestamp != null) {
        const currentYear = formatDate(dateTimeFormat, timestamp, 'YYYY')
        if (prevYear === null || prevYear !== currentYear) {
          text = formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
          prevYear = currentYear
        } else {
          text = formatDate(dateTimeFormat, timestamp, 'MM-DD')
        }
      }
      priority = X_AXIS_DAY_START_TICK_PRIORITY
      if (tickIndex !== 0) {
        gridLineLevel = GridLineLevel.Primary
      }
    } else if (shouldShowSessionGap && isIntradayTimeShareSessionBoundaryTick(index, tickMinutes, sessionGap)) {
      gridLineLevel = GridLineLevel.Primary
    }
    return { text, coord: convertToPixel(tickIndex), value: timestamp ?? tickIndex, dataIndex: tickIndex, priority, gridLineLevel }
  })
}

export function selectTimeShareTickIndexes(
  timeShareTicks: string[],
  dayCount: number,
  maxTickCount: number,
  options: XAxisTickLayoutOptions = {}
): number[] {
  const ticksPerDay = timeShareTicks.length
  const totalTickCount = ticksPerDay * dayCount
  if (ticksPerDay === 0 || totalTickCount === 0) {
    return []
  }

  const requiredIndexes = new Set<number>()
  if (options.showMinLabel === true) {
    requiredIndexes.add(0)
  }
  if (options.showMaxLabel === true) {
    requiredIndexes.add(totalTickCount - 1)
  }
  addTimeShareDayStartTickIndexes(requiredIndexes, ticksPerDay, dayCount)
  if (dayCount > TIME_SHARE_INTRADAY_TICK_MAX_DAYS) {
    return Array.from(requiredIndexes).sort((a, b) => a - b)
  }

  const selectedCountLimit = Math.max(1, Math.floor(maxTickCount), requiredIndexes.size)
  const tickMinutes = timeShareTicks.map(parseTimeShareTickMinutes)
  const baseInterval = calcTimeShareBaseInterval(tickMinutes)
  if (tickMinutes.every(value => value == null)) {
    return selectRegularTimeShareTickIndexes(totalTickCount, selectedCountLimit, requiredIndexes)
  }

  const sessions = getTimeShareSessions(tickMinutes, baseInterval)
  const steps = getTimeShareNiceSteps(baseInterval)
  let fallbackIndexes: number[] = []
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const indexes = collectTimeShareTickIndexesByStep(
      tickMinutes,
      dayCount,
      step,
      baseInterval,
      requiredIndexes,
      sessions
    )
    if (fallbackIndexes.length === 0 || indexes.length < fallbackIndexes.length) {
      fallbackIndexes = indexes
    }
    if (indexes.length <= selectedCountLimit) {
      return indexes
    }
  }

  return thinTimeShareTickIndexes(fallbackIndexes, selectedCountLimit, requiredIndexes, tickMinutes, baseInterval)
}

function getPreferredTimeShareTickIndexes(timeShareTicks: string[], dayCount: number, preferXTicks: string[]): number[] {
  const preferredTicks = new Set(preferXTicks)
  const tickIndexes: number[] = []
  for (let i = 0; i < timeShareTicks.length; i++) {
    if (preferredTicks.has(timeShareTicks[i])) {
      for (let day = 0; day < dayCount; day++) {
        tickIndexes.push(i + day * timeShareTicks.length)
      }
    }
  }
  return tickIndexes
}

function mergeTimeShareDayStartTickIndexes(tickIndexes: number[], ticksPerDay: number, dayCount: number): number[] {
  if (dayCount <= 1 || ticksPerDay <= 0) {
    return tickIndexes
  }
  const indexes = new Set(tickIndexes)
  addTimeShareDayStartTickIndexes(indexes, ticksPerDay, dayCount)
  return Array.from(indexes).sort((a, b) => a - b)
}

function addTimeShareDayStartTickIndexes(indexes: Set<number>, ticksPerDay: number, dayCount: number): void {
  if (dayCount <= 1 || ticksPerDay <= 0) {
    return
  }
  for (let day = 0; day < dayCount; day++) {
    indexes.add(day * ticksPerDay)
  }
}

function mergeTimeShareBoundaryTickIndexes(
  tickIndexes: number[],
  totalTickCount: number,
  options: Required<XAxisTickLayoutOptions>
): number[] {
  if (totalTickCount <= 0) {
    return tickIndexes
  }
  const indexes = new Set(tickIndexes)
  if (options.showMinLabel) {
    indexes.add(0)
  }
  if (options.showMaxLabel) {
    indexes.add(totalTickCount - 1)
  }
  return Array.from(indexes).sort((a, b) => a - b)
}

function calcTimeShareBaseInterval(tickMinutes: Array<number | undefined>): number {
  let interval = Number.MAX_SAFE_INTEGER
  for (let i = 1; i < tickMinutes.length; i++) {
    const diff = calcTimeShareMinuteDiff(tickMinutes[i - 1], tickMinutes[i])
    if (diff != null && diff > 0) {
      interval = Math.min(interval, diff)
    }
  }
  return interval === Number.MAX_SAFE_INTEGER ? 1 : interval
}

function calcTimeShareMinuteDiff(from: number | undefined, to: number | undefined): number | undefined {
  if (from == null || to == null) {
    return undefined
  }
  let diff = to - from
  if (diff < 0) {
    diff += 24 * 60
  }
  return diff
}

function selectRegularTimeShareTickIndexes(
  totalTickCount: number,
  maxTickCount: number,
  requiredIndexes: Set<number>
): number[] {
  const indexes = new Set(requiredIndexes)
  if (totalTickCount <= 0) {
    return []
  }

  const tickCount = Math.max(1, maxTickCount)
  const interval = tickCount > 1
    ? Math.max(1, Math.ceil((totalTickCount - 1) / (tickCount - 1)))
    : totalTickCount
  for (let i = 0; i < totalTickCount && indexes.size < tickCount; i += interval) {
    indexes.add(i)
  }
  if (indexes.size < tickCount) {
    indexes.add(totalTickCount - 1)
  }

  return Array.from(indexes).sort((a, b) => a - b)
}

function getTimeShareNiceSteps(baseInterval: number): number[] {
  const minStep = Math.max(1, Math.floor(baseInterval))
  const steps = TIME_SHARE_NICE_STEPS.filter(step => step >= minStep)
  if (steps.length > 0) {
    return steps
  }

  const stepsFallback: number[] = []
  let step = minStep
  for (let i = 0; i < TIME_SHARE_NICE_STEPS.length; i++) {
    stepsFallback.push(step)
    step *= 2
  }
  return stepsFallback
}

function collectTimeShareTickIndexesByStep(
  tickMinutes: Array<number | undefined>,
  dayCount: number,
  step: number,
  baseInterval: number,
  requiredIndexes: Set<number>,
  sessions: Array<[number, number]>
): number[] {
  const indexes = new Set(requiredIndexes)
  const ticksPerDay = tickMinutes.length
  for (let day = 0; day < dayCount; day++) {
    const dayOffset = day * ticksPerDay
    for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex++) {
      const [from, to] = sessions[sessionIndex]
      if (shouldAddTimeShareSessionStartTick(tickMinutes, sessions, sessionIndex, baseInterval)) {
        indexes.add(dayOffset + from)
      }
      const startMinute = tickMinutes[from]
      const useSessionAnchor = calcTimeShareTickNicePriority(startMinute) > 0
      for (let i = from + 1; i < to; i++) {
        if (shouldAddTimeShareCadenceTick(startMinute, tickMinutes[i], step, useSessionAnchor)) {
          indexes.add(dayOffset + i)
        }
      }
      if (shouldAddTimeShareSessionEndTick(tickMinutes, dayCount, day, to, baseInterval)) {
        indexes.add(dayOffset + to)
      }
    }
  }

  return Array.from(indexes).sort((a, b) => a - b)
}

function shouldAddTimeShareSessionStartTick(
  tickMinutes: Array<number | undefined>,
  sessions: Array<[number, number]>,
  sessionIndex: number,
  baseInterval: number
): boolean {
  if (sessionIndex === 0) {
    return true
  }
  const previousSessionEnd = sessions[sessionIndex - 1][1]
  const currentSessionStart = sessions[sessionIndex][0]
  if (!isTimeShareSessionGap(tickMinutes[previousSessionEnd], tickMinutes[currentSessionStart], baseInterval)) {
    return true
  }
  return !shouldPreferTimeShareSessionEndTick(tickMinutes[previousSessionEnd], tickMinutes[currentSessionStart])
}

function shouldAddTimeShareCadenceTick(
  startMinute: number | undefined,
  minuteValue: number | undefined,
  step: number,
  useSessionAnchor: boolean
): boolean {
  if (useSessionAnchor) {
    const elapsedMinutes = calcTimeShareMinuteDiff(startMinute, minuteValue)
    return elapsedMinutes != null && elapsedMinutes % step === 0
  }
  return minuteValue != null && minuteValue % step === 0
}

function shouldAddTimeShareSessionEndTick(
  tickMinutes: Array<number | undefined>,
  dayCount: number,
  day: number,
  sessionEnd: number,
  baseInterval: number
): boolean {
  const ticksPerDay = tickMinutes.length
  const currentIndex = day * ticksPerDay + sessionEnd
  const nextIndex = currentIndex + 1
  if (nextIndex >= ticksPerDay * dayCount) {
    return true
  }

  const nextTickIndex = nextIndex % ticksPerDay
  if (nextTickIndex === 0) {
    return false
  }
  if (!isTimeShareSessionGap(tickMinutes[sessionEnd], tickMinutes[nextTickIndex], baseInterval)) {
    return true
  }
  return shouldPreferTimeShareSessionEndTick(tickMinutes[sessionEnd], tickMinutes[nextTickIndex])
}

function shouldPreferTimeShareSessionEndTick(
  sessionEndMinute: number | undefined,
  nextSessionStartMinute: number | undefined
): boolean {
  return calcTimeShareTickNicePriority(sessionEndMinute) > calcTimeShareTickNicePriority(nextSessionStartMinute)
}

function getTimeShareSessions(tickMinutes: Array<number | undefined>, baseInterval: number): Array<[number, number]> {
  const sessions: Array<[number, number]> = []
  if (tickMinutes.length === 0) {
    return sessions
  }

  let from = 0
  for (let i = 1; i < tickMinutes.length; i++) {
    if (isTimeShareSessionGap(tickMinutes[i - 1], tickMinutes[i], baseInterval)) {
      sessions.push([from, i - 1])
      from = i
    }
  }
  sessions.push([from, tickMinutes.length - 1])
  return sessions
}

function isTimeShareSessionGap(from: number | undefined, to: number | undefined, baseInterval: number): boolean {
  const diff = calcTimeShareMinuteDiff(from, to)
  return diff == null || diff > baseInterval * 1.5
}

function isIntradayTimeShareSessionBoundaryTick(
  tickIndex: number,
  tickMinutes: Array<number | undefined>,
  sessionGap: number
): boolean {
  const prevDiff = tickIndex > 0 ? calcTimeShareMinuteDiff(tickMinutes[tickIndex - 1], tickMinutes[tickIndex]) : undefined
  const nextDiff = tickIndex < tickMinutes.length - 1 ? calcTimeShareMinuteDiff(tickMinutes[tickIndex], tickMinutes[tickIndex + 1]) : undefined
  return (prevDiff != null && prevDiff > sessionGap) || (nextDiff != null && nextDiff > sessionGap)
}

function thinTimeShareTickIndexes(
  indexes: number[],
  maxTickCount: number,
  requiredIndexes: Set<number>,
  tickMinutes: Array<number | undefined>,
  baseInterval: number
): number[] {
  const selectedIndexes = Array.from(new Set([...indexes, ...requiredIndexes])).sort((a, b) => a - b)
  while (selectedIndexes.length > maxTickCount) {
    const removePosition = findTimeShareTickRemovePosition(selectedIndexes, requiredIndexes, tickMinutes, baseInterval)
    if (removePosition < 0) {
      break
    }
    selectedIndexes.splice(removePosition, 1)
  }
  return selectedIndexes
}

function findTimeShareTickRemovePosition(
  selectedIndexes: number[],
  requiredIndexes: Set<number>,
  tickMinutes: Array<number | undefined>,
  baseInterval: number
): number {
  let removePosition = -1
  let nearestDistance = Number.MAX_SAFE_INTEGER
  let keepPriority = Number.MAX_SAFE_INTEGER
  for (let i = 0; i < selectedIndexes.length; i++) {
    const index = selectedIndexes[i]
    if (requiredIndexes.has(index)) {
      continue
    }
    const prevDistance = i > 0 ? index - selectedIndexes[i - 1] : Number.MAX_SAFE_INTEGER
    const nextDistance = i < selectedIndexes.length - 1 ? selectedIndexes[i + 1] - index : Number.MAX_SAFE_INTEGER
    const currentNearestDistance = Math.min(prevDistance, nextDistance)
    const currentKeepPriority = calcTimeShareTickKeepPriority(index, tickMinutes, baseInterval)
    if (
      currentNearestDistance < nearestDistance ||
      (currentNearestDistance === nearestDistance && currentKeepPriority < keepPriority)
    ) {
      removePosition = i
      nearestDistance = currentNearestDistance
      keepPriority = currentKeepPriority
    }
  }
  return removePosition
}

function calcTimeShareTickKeepPriority(
  index: number,
  tickMinutes: Array<number | undefined>,
  baseInterval: number
): number {
  const ticksPerDay = tickMinutes.length
  const tickIndex = index % ticksPerDay
  const minuteValue = tickMinutes[tickIndex]
  const sessionGap = baseInterval * 1.5
  const prevDiff = tickIndex > 0 ? calcTimeShareMinuteDiff(tickMinutes[tickIndex - 1], minuteValue) : undefined
  const nextDiff = tickIndex < ticksPerDay - 1 ? calcTimeShareMinuteDiff(minuteValue, tickMinutes[tickIndex + 1]) : undefined
  if (
    tickIndex === 0 ||
    tickIndex === ticksPerDay - 1 ||
    (prevDiff != null && prevDiff > sessionGap) ||
    (nextDiff != null && nextDiff > sessionGap)
  ) {
    return 4 + calcTimeShareTickNicePriority(minuteValue)
  }
  return calcTimeShareTickNicePriority(minuteValue)
}

function calcTimeShareTickNicePriority(minuteValue: number | undefined): number {
  if (minuteValue == null) {
    return 0
  }
  if (minuteValue % 60 === 0) {
    return 3
  }
  if (minuteValue % 30 === 0) {
    return 2
  }
  if (minuteValue % 15 === 0) {
    return 1
  }
  return 0
}
