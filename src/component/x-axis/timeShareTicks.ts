import { genTimeStamp, getDateTimeFormat } from '../../common/utils/dateTimeFormat'
import { formatDate } from '../../common/utils/format'
import {
  X_AXIS_DAY_START_TICK_PRIORITY,
  type XAxisTick,
  type XAxisTickLayoutOptions
} from './tickLayout'

const TIME_SHARE_NICE_STEPS = [15, 30, 60, 120, 240]
const TIME_SHARE_MAX_THINNABLE_TICK_OVERFLOW = 1
const TIME_SHARE_INTRADAY_TICK_MAX_DAYS = 4

export function createTimeShareXAxisTicks(
  timeShareTicks: string[],
  timeShareDays: number,
  dataList: Array<{ timestamp: number }>,
  maxTickCount: number,
  layoutOptions: Required<XAxisTickLayoutOptions>,
  preferXTicks: string[] | undefined,
  convertToPixel: (dataIndex: number) => number
): XAxisTick[] {
  if (timeShareTicks.length === 0) {
    return []
  }

  const dayCount = Math.max(1, Math.floor(timeShareDays))
  const totalTimeShareTickCount = timeShareTicks.length * dayCount
  let tickIndexes: number[]
  if (preferXTicks) {
    tickIndexes = getPreferredTimeShareTickIndexes(timeShareTicks, dayCount, preferXTicks)
  } else {
    tickIndexes = selectTimeShareTickIndexes(timeShareTicks, timeShareDays, maxTickCount, layoutOptions)
  }
  tickIndexes = mergeTimeShareDayStartTickIndexes(tickIndexes, timeShareTicks.length, dayCount)
  tickIndexes = mergeTimeShareBoundaryTickIndexes(tickIndexes, totalTimeShareTickCount, layoutOptions)

  const dateTimeFormat = getDateTimeFormat()
  let prevYear: string | null = null
  return tickIndexes.map(tickIndex => {
    const index = tickIndex % timeShareTicks.length
    const dayIndex = Math.floor(tickIndex / timeShareTicks.length)
    const hintTs = dataList[dayIndex * timeShareTicks.length]?.timestamp ?? Date.now()
    const timeStamp = genTimeStamp(timeShareTicks[index], hintTs)
    let text = timeShareTicks[index]
    let priority: number | undefined
    if (timeShareDays > 1 && index === 0) {
      const currentYear = formatDate(dateTimeFormat, timeStamp, 'YYYY')
      if (prevYear === null || prevYear !== currentYear) {
        text = formatDate(dateTimeFormat, timeStamp, 'YYYY-MM-DD')
        prevYear = currentYear
      } else {
        text = formatDate(dateTimeFormat, timeStamp, 'MM-DD')
      }
      priority = X_AXIS_DAY_START_TICK_PRIORITY
    }
    return { text, coord: convertToPixel(tickIndex), value: timeStamp, priority }
  })
}

export function selectTimeShareTickIndexes(
  timeShareTicks: string[],
  timeShareDays: number,
  maxTickCount: number,
  options: XAxisTickLayoutOptions = {}
): number[] {
  const ticksPerDay = timeShareTicks.length
  const dayCount = Math.max(1, Math.floor(timeShareDays))
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

  const steps = getTimeShareNiceSteps(baseInterval)
  let fallbackIndexes: number[] = []
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const indexes = collectTimeShareTickIndexesByStep(tickMinutes, dayCount, step, baseInterval, requiredIndexes)
    if (fallbackIndexes.length === 0 || indexes.length < fallbackIndexes.length) {
      fallbackIndexes = indexes
    }
    const maxStepTickCount = step === TIME_SHARE_NICE_STEPS[0]
      ? selectedCountLimit
      : selectedCountLimit + TIME_SHARE_MAX_THINNABLE_TICK_OVERFLOW
    if (indexes.length <= maxStepTickCount) {
      return indexes.length <= selectedCountLimit
        ? indexes
        : thinTimeShareTickIndexes(indexes, selectedCountLimit, requiredIndexes, tickMinutes, baseInterval)
    }
  }

  return thinTimeShareTickIndexes(fallbackIndexes, selectedCountLimit, requiredIndexes, tickMinutes, baseInterval)
}

function getPreferredTimeShareTickIndexes(timeShareTicks: string[], timeShareDays: number, preferXTicks: string[]): number[] {
  const tickIndexes: number[] = []
  for (let i = 0; i < timeShareTicks.length; i++) {
    if (preferXTicks.includes(timeShareTicks[i])) {
      for (let day = 0; day < timeShareDays; day++) {
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

function parseTimeShareTickMinutes(text: string): number | undefined {
  const matched = /^([0-9]{1,2}):([0-9]{2})$/.exec(text)
  if (matched == null) {
    return undefined
  }
  const hour = Number(matched[1])
  const minute = Number(matched[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined
  }
  return hour * 60 + minute
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
  requiredIndexes: Set<number>
): number[] {
  const indexes = new Set(requiredIndexes)
  const sessions = getTimeShareSessions(tickMinutes, baseInterval)
  const ticksPerDay = tickMinutes.length
  for (let day = 0; day < dayCount; day++) {
    const dayOffset = day * ticksPerDay
    sessions.forEach(([from, to]) => {
      indexes.add(dayOffset + from)
      const startMinute = tickMinutes[from]
      for (let i = from + 1; i <= to; i++) {
        const elapsedMinutes = calcTimeShareMinuteDiff(startMinute, tickMinutes[i])
        if (elapsedMinutes != null && elapsedMinutes % step === 0) {
          indexes.add(dayOffset + i)
        }
      }
      indexes.add(dayOffset + to)
    })
  }

  return Array.from(indexes).sort((a, b) => a - b)
}

function getTimeShareSessions(tickMinutes: Array<number | undefined>, baseInterval: number): Array<[number, number]> {
  const sessions: Array<[number, number]> = []
  if (tickMinutes.length === 0) {
    return sessions
  }

  const sessionGap = baseInterval * 1.5
  let from = 0
  for (let i = 1; i < tickMinutes.length; i++) {
    const diff = calcTimeShareMinuteDiff(tickMinutes[i - 1], tickMinutes[i])
    if (diff == null || diff > sessionGap) {
      sessions.push([from, i - 1])
      from = i
    }
  }
  sessions.push([from, tickMinutes.length - 1])
  return sessions
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
  if (tickIndex === 0 || (prevDiff != null && prevDiff > sessionGap)) {
    return 4
  }
  if (tickIndex === ticksPerDay - 1 || (nextDiff != null && nextDiff > sessionGap)) {
    return 3
  }
  if (minuteValue == null) {
    return 0
  }
  if (minuteValue % 60 === 0) {
    return 2
  }
  if (minuteValue % 30 === 0) {
    return 1
  }
  return 0
}
