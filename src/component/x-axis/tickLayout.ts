import type { AxisTick } from '../Axis'

export const X_AXIS_TICK_MIN_GAP = 6
export const X_AXIS_DAY_START_TICK_PRIORITY = 1

const X_AXIS_MIN_TICK_PRIORITY = 2
const X_AXIS_MAX_TICK_PRIORITY = 3

export type XAxisTick = AxisTick & { priority?: number }

export type XAxisTickLayoutOptions = {
  showMinLabel?: boolean
  showMaxLabel?: boolean
}

export function resolveXAxisTickLayoutOptions(
  options: XAxisTickLayoutOptions,
  isDataZoom: boolean
): Required<XAxisTickLayoutOptions> {
  return {
    showMinLabel: isDataZoom || options.showMinLabel === true,
    showMaxLabel: isDataZoom || options.showMaxLabel === true
  }
}

export function mergeBoundaryXAxisTicks(ticks: AxisTick[], boundaryTicks: AxisTick[]): AxisTick[] {
  if (boundaryTicks.length === 0) {
    return ticks
  }

  const ticksByValue = new Map<AxisTick['value'], AxisTick>()
  ticks.forEach(tick => {
    ticksByValue.set(tick.value, tick)
  })
  boundaryTicks.forEach(tick => {
    if (!ticksByValue.has(tick.value)) {
      ticksByValue.set(tick.value, tick)
    }
  })

  return Array.from(ticksByValue.values()).sort((a, b) => a.coord - b.coord)
}

export function measureXAxisTickWidths(ticks: AxisTick[], measureText: (text: string) => number): number[] {
  return ticks.map(tick => measureText(tick.text))
}

export function filterOverlappedXAxisTicks(
  ticks: XAxisTick[],
  widths: number[],
  canvasWidth: number,
  options: XAxisTickLayoutOptions = {},
  minGap: number = X_AXIS_TICK_MIN_GAP
): XAxisTick[] {
  const tickLength = ticks.length
  if (tickLength <= 1) {
    return ticks
  }

  const selectedIndexes = ticks.map((_, index) => index)
  const minValue = ticks[0].value
  const maxValue = ticks[tickLength - 1].value
  let i = 1
  while (i < selectedIndexes.length) {
    const leftIndex = selectedIndexes[i - 1]
    const rightIndex = selectedIndexes[i]
    const leftWidth = widths[leftIndex]
    const rightWidth = widths[rightIndex]
    const leftCenter = calcXAxisTickTextX(ticks[leftIndex], leftWidth, i - 1, selectedIndexes.length, canvasWidth)
    const rightCenter = calcXAxisTickTextX(ticks[rightIndex], rightWidth, i, selectedIndexes.length, canvasWidth)
    if (isTickOverlap(leftCenter, leftWidth, rightCenter, rightWidth, minGap)) {
      const leftPriority = getXAxisTickPriority(ticks[leftIndex], minValue, maxValue, options)
      const rightPriority = getXAxisTickPriority(ticks[rightIndex], minValue, maxValue, options)
      if (leftPriority < rightPriority) {
        selectedIndexes.splice(i - 1, 1)
        if (i > 1) {
          i--
        }
      } else {
        selectedIndexes.splice(i, 1)
        if (i > 1) {
          i--
        }
      }
    } else {
      i++
    }
  }

  if (selectedIndexes.length === tickLength) {
    return ticks
  }
  return selectedIndexes.map(index => ticks[index])
}

export function calcXAxisTickTextX(
  tick: AxisTick,
  tickWidth: number,
  index: number,
  total: number,
  canvasWidth: number
): number {
  let x = tick.coord
  if (index === 0) {
    const delta = x - tickWidth / 2
    if (delta < 0) {
      x -= delta
    }
  } else if (index === total - 1) {
    const delta = x + tickWidth / 2 - canvasWidth
    if (delta > 0) {
      x -= delta
    }
  }
  return x
}

function getXAxisTickPriority(
  tick: XAxisTick,
  minValue: AxisTick['value'],
  maxValue: AxisTick['value'],
  options: XAxisTickLayoutOptions
): number {
  if (options.showMaxLabel === true && tick.value === maxValue) {
    return X_AXIS_MAX_TICK_PRIORITY
  }
  if (options.showMinLabel === true && tick.value === minValue) {
    return X_AXIS_MIN_TICK_PRIORITY
  }
  return tick.priority ?? 0
}

function isTickOverlap(
  leftCenter: number,
  leftWidth: number,
  rightCenter: number,
  rightWidth: number,
  minGap: number
): boolean {
  const distance = Math.abs(rightCenter - leftCenter)
  return distance < (leftWidth + rightWidth) / 2 + minGap
}
