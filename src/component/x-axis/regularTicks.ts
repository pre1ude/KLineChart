import type VisibleRange from '../../common/VisibleRange'
import type { DateTimeFormat } from '../../common/utils/dateTimeFormat'
import { type FormatDate, FormatDateType } from '../../Options'
import { mergeBoundaryXAxisTicks, X_AXIS_TICK_MIN_GAP, type XAxisTick, type XAxisTickLayoutOptions } from './tickLayout'

const REGULAR_LABEL_SAMPLE_COUNT = 8

export function createRegularXAxisTicks(
  dataList: Array<{ timestamp: number }>,
  range: VisibleRange,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  layoutOptions: Required<XAxisTickLayoutOptions>,
  barSpace: number,
  measureText: (text: string) => number,
  convertToPixel: (dataIndex: number) => number
): XAxisTick[] {
  const optimalTicks = createRegularCoreTicks(
    dataList,
    range,
    formatDate,
    dateTimeFormat,
    barSpace,
    measureText,
    convertToPixel
  )
  if (layoutOptions.showMinLabel || layoutOptions.showMaxLabel) {
    const boundaryTicks = createBoundaryXAxisTicks(dataList, range, formatDate, dateTimeFormat, layoutOptions, convertToPixel)
    return mergeBoundaryXAxisTicks(optimalTicks, boundaryTicks)
  }
  return optimalTicks
}

function estimateRegularXAxisLabelWidth(
  indexes: number[],
  dataList: Array<{ timestamp: number }>,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  measureText: (text: string) => number
): number {
  return createRegularTickLabelItems(indexes, dataList, formatDate, dateTimeFormat)
    .reduce((width, item) => Math.max(width, measureText(item.text)), 0)
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
  dataList: Array<{ timestamp: number }>,
  range: VisibleRange,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  barSpace: number,
  measureText: (text: string) => number,
  convertToPixel: (dataIndex: number) => number
): XAxisTick[] {
  const indexes = createRegularTickIndexes(dataList, range, formatDate, dateTimeFormat, barSpace, measureText)
  return createRegularTickLabelItems(indexes, dataList, formatDate, dateTimeFormat)
    .map(item => ({
      text: item.text,
      coord: convertToPixel(item.dataIndex),
      value: item.timestamp
    }))
}

function createRegularTickLabelItems(
  indexes: number[],
  dataList: Array<{ timestamp: number }>,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat
): Array<{ dataIndex: number, timestamp: number, text: string }> {
  const labelItems: Array<{ dataIndex: number, timestamp: number, text: string }> = []
  const tickLength = indexes.length
  if (tickLength === 0) {
    return labelItems
  }

  for (let i = 0; i < tickLength; i++) {
    const pos = indexes[i]
    const kLineData = dataList[pos]
    if (kLineData == null) {
      continue
    }
    const timestamp = kLineData.timestamp
    let text = formatDate(dateTimeFormat, timestamp, 'HH:mm', FormatDateType.XAxis)
    if (i !== 0) {
      const prevKLineData = dataList[indexes[i - 1]]
      if (prevKLineData != null) {
        text = formatComparedXAxisTickLabel(formatDate, dateTimeFormat, timestamp, prevKLineData.timestamp) ?? text
      }
    }
    labelItems.push({ dataIndex: pos, timestamp, text })
  }

  relabelFirstRegularTickLabelItem(labelItems, formatDate, dateTimeFormat)
  return labelItems
}

function createRegularTickIndexes(
  dataList: Array<{ timestamp: number }>,
  range: VisibleRange,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat,
  barSpace: number,
  measureText: (text: string) => number
): number[] {
  const visibleIndexRange = calcVisibleDataIndexRange(dataList, range)
  if (visibleIndexRange == null) {
    return []
  }

  const { fromIndex, toIndex } = visibleIndexRange
  const sampleIndexes = createRegularLabelSampleIndexes(fromIndex, toIndex)
  const estimatedLabelWidth = estimateRegularXAxisLabelWidth(sampleIndexes, dataList, formatDate, dateTimeFormat, measureText)
  const minPixelGap = Math.max(estimatedLabelWidth + X_AXIS_TICK_MIN_GAP, 1)
  const minIndexStep = Number.isFinite(barSpace) && barSpace > 0
    ? Math.ceil(minPixelGap / barSpace)
    : toIndex - fromIndex + 1
  const indexStep = Math.max(minIndexStep, 1)
  const firstTickIndex = Math.ceil(fromIndex / indexStep) * indexStep
  const indexes: number[] = []
  for (let index = firstTickIndex; index <= toIndex; index += indexStep) {
    indexes.push(index)
  }
  if (indexes.length === 0) {
    indexes.push(fromIndex)
  }
  return indexes
}

function createRegularLabelSampleIndexes(fromIndex: number, toIndex: number): number[] {
  const length = toIndex - fromIndex + 1
  if (length <= REGULAR_LABEL_SAMPLE_COUNT) {
    return Array.from({ length }, (_, index) => fromIndex + index)
  }

  const sampleIndexes: number[] = []
  for (let i = 0; i < REGULAR_LABEL_SAMPLE_COUNT; i++) {
    const index = Math.round(fromIndex + (length - 1) * i / (REGULAR_LABEL_SAMPLE_COUNT - 1))
    if (sampleIndexes[sampleIndexes.length - 1] !== index) {
      sampleIndexes.push(index)
    }
  }
  return sampleIndexes
}

function calcVisibleDataIndexRange(
  dataList: Array<{ timestamp: number }>,
  range: VisibleRange
): { fromIndex: number, toIndex: number } | null {
  const fromIndex = Math.max(Math.floor(range.from), 0)
  const toIndex = Math.min(Math.ceil(range.to) - 1, dataList.length - 1)
  if (fromIndex > toIndex) {
    return null
  }
  return { fromIndex, toIndex }
}

function relabelFirstRegularTickLabelItem(
  items: Array<{ timestamp: number, text: string }>,
  formatDate: FormatDate,
  dateTimeFormat: DateTimeFormat
): void {
  const tickLength = items.length
  if (tickLength === 1) {
    items[0].text = formatDate(dateTimeFormat, items[0].timestamp, 'YYYY-MM-DD HH:mm', FormatDateType.XAxis)
  } else if (tickLength > 1) {
    const firstTimestamp = items[0].timestamp
    const secondTimestamp = items[1].timestamp
    const thirdText = items[2]?.text
    if (thirdText != null) {
      if (/^[0-9]{2}-[0-9]{2}$/.test(thirdText)) {
        items[0].text = formatDate(dateTimeFormat, firstTimestamp, 'MM-DD', FormatDateType.XAxis)
      } else if (/^[0-9]{4}-[0-9]{2}$/.test(thirdText)) {
        items[0].text = formatDate(dateTimeFormat, firstTimestamp, 'YYYY-MM', FormatDateType.XAxis)
      } else if (/^[0-9]{4}$/.test(thirdText)) {
        items[0].text = formatDate(dateTimeFormat, firstTimestamp, 'YYYY', FormatDateType.XAxis)
      }
    } else {
      items[0].text = formatComparedXAxisTickLabel(formatDate, dateTimeFormat, firstTimestamp, secondTimestamp) ?? items[0].text
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
