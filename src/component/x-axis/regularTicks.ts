import type VisibleRange from '../../common/VisibleRange'
import type { DateTimeFormat } from '../../common/utils/dateTimeFormat'
import { type FormatDate, FormatDateType } from '../../Options'
import type { AxisTick } from '../Axis'
import { mergeBoundaryXAxisTicks, type XAxisTick, type XAxisTickLayoutOptions } from './tickLayout'

export function createRegularXAxisTicks(
  ticks: AxisTick[],
  dataList: Array<{ timestamp: number }>,
  range: VisibleRange,
  defaultLabelWidth: number,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  layoutOptions: Required<XAxisTickLayoutOptions>,
  convertToPixel: (dataIndex: number) => number
): XAxisTick[] {
  const optimalTicks = createRegularCoreTicks(
    ticks,
    dataList,
    defaultLabelWidth,
    formatDate,
    dateTimeFormat,
    convertToPixel
  )
  if (layoutOptions.showMinLabel || layoutOptions.showMaxLabel) {
    const boundaryTicks = createBoundaryXAxisTicks(dataList, range, formatDate, dateTimeFormat, layoutOptions, convertToPixel)
    return mergeBoundaryXAxisTicks(optimalTicks, boundaryTicks)
  }
  return optimalTicks
}

export function formatComparedXAxisTickLabel(
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  timestamp: number,
  comparedTimestamp: number
): string | null {
  const year = formatDate(dateTimeFormat, timestamp, 'YYYY', FormatDateType.XAxis)
  const month = formatDate(dateTimeFormat, timestamp, 'YYYY-MM', FormatDateType.XAxis)
  const day = formatDate(dateTimeFormat, timestamp, 'MM-DD', FormatDateType.XAxis)
  if (year !== formatDate(dateTimeFormat, comparedTimestamp, 'YYYY', FormatDateType.XAxis)) {
    return year
  }
  if (month !== formatDate(dateTimeFormat, comparedTimestamp, 'YYYY-MM', FormatDateType.XAxis)) {
    return month
  }
  if (day !== formatDate(dateTimeFormat, comparedTimestamp, 'MM-DD', FormatDateType.XAxis)) {
    return day
  }
  return null
}

function createRegularCoreTicks(
  ticks: AxisTick[],
  dataList: Array<{ timestamp: number }>,
  defaultLabelWidth: number,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  convertToPixel: (dataIndex: number) => number
): XAxisTick[] {
  const optimalTicks: XAxisTick[] = []
  const tickLength = ticks.length
  if (tickLength === 0) {
    return optimalTicks
  }

  const firstPos = getTickDataIndex(ticks[0])
  const firstX = firstPos == null ? 0 : convertToPixel(firstPos)
  let tickCountDif = 1
  if (tickLength > 1) {
    const nextPos = getTickDataIndex(ticks[1])
    const nextX = nextPos == null ? firstX : convertToPixel(nextPos)
    const xDif = Math.abs(nextX - firstX)
    if (xDif > 0 && xDif < defaultLabelWidth * 1.5) {
      tickCountDif = Math.ceil(defaultLabelWidth * 1.5 / xDif)
    } else if (xDif === 0 && defaultLabelWidth > 0) {
      tickCountDif = tickLength
    }
  }

  for (let i = 0; i < tickLength; i += tickCountDif) {
    const pos = getTickDataIndex(ticks[i])
    if (pos == null) {
      continue
    }
    const kLineData = dataList[pos]
    if (kLineData == null) {
      continue
    }
    const timestamp = kLineData.timestamp
    let text = formatDate(dateTimeFormat, timestamp, 'HH:mm', FormatDateType.XAxis)
    if (i !== 0) {
      const prevPos = getTickDataIndex(ticks[i - tickCountDif])
      const prevKLineData = prevPos == null ? undefined : dataList[prevPos]
      if (prevKLineData != null) {
        text = formatComparedXAxisTickLabel(formatDate, dateTimeFormat, timestamp, prevKLineData.timestamp) ?? text
      }
    }
    optimalTicks.push({ text, coord: convertToPixel(pos), value: timestamp })
  }

  relabelFirstRegularTick(optimalTicks, formatDate, dateTimeFormat)
  return optimalTicks
}

function relabelFirstRegularTick(
  ticks: XAxisTick[],
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat
): void {
  const tickLength = ticks.length
  if (tickLength === 1) {
    ticks[0].text = formatDate(dateTimeFormat, ticks[0].value as number, 'YYYY-MM-DD HH:mm', FormatDateType.XAxis)
  } else if (tickLength > 1) {
    const firstTimestamp = ticks[0].value as number
    const secondTimestamp = ticks[1].value as number
    const thirdText = ticks[2]?.text
    if (thirdText != null) {
      if (/^[0-9]{2}-[0-9]{2}$/.test(thirdText)) {
        ticks[0].text = formatDate(dateTimeFormat, firstTimestamp, 'MM-DD', FormatDateType.XAxis)
      } else if (/^[0-9]{4}-[0-9]{2}$/.test(thirdText)) {
        ticks[0].text = formatDate(dateTimeFormat, firstTimestamp, 'YYYY-MM', FormatDateType.XAxis)
      } else if (/^[0-9]{4}$/.test(thirdText)) {
        ticks[0].text = formatDate(dateTimeFormat, firstTimestamp, 'YYYY', FormatDateType.XAxis)
      }
    } else {
      ticks[0].text = formatComparedXAxisTickLabel(formatDate, dateTimeFormat, firstTimestamp, secondTimestamp) ?? ticks[0].text
    }
  }
}

function createBoundaryXAxisTicks(
  dataList: Array<{ timestamp: number }>,
  range: VisibleRange,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  options: Required<XAxisTickLayoutOptions>,
  convertToPixel: (dataIndex: number) => number
): XAxisTick[] {
  const fromIndex = Math.max(Math.floor(range.from), 0)
  const toIndex = Math.min(Math.ceil(range.to) - 1, dataList.length - 1)
  if (fromIndex > toIndex) {
    return []
  }
  const indexes: number[] = []
  if (options.showMinLabel) {
    indexes.push(fromIndex)
  }
  if (options.showMaxLabel && !indexes.includes(toIndex)) {
    indexes.push(toIndex)
  }
  return indexes.map(index => {
    const timestamp = dataList[index].timestamp
    const previousData = dataList[index - 1]
    const defaultText = formatDate(dateTimeFormat, timestamp, 'HH:mm', FormatDateType.XAxis)
    const text = previousData != null
      ? formatComparedXAxisTickLabel(formatDate, dateTimeFormat, timestamp, previousData.timestamp) ?? defaultText
      : defaultText
    return {
      text,
      coord: convertToPixel(index),
      value: timestamp
    }
  })
}

function getTickDataIndex(tick: AxisTick): number | undefined {
  const value = Number.parseInt(String(tick.value), 10)
  return Number.isFinite(value) ? value : undefined
}
