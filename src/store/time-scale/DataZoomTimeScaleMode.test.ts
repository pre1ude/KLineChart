import { describe, expect, it } from 'vitest'
import type KLineData from '../../common/KLineData'
import { DataZoomTimeScaleMode } from './DataZoomTimeScaleMode'
import type { TimeScaleModeContext } from './TimeScaleMode'

describe('DataZoomTimeScaleMode', () => {
  it('derives visible range, bar width, and offset from percent range', () => {
    const harness = createHarness(100, 600)
    harness.mode.setRange(80, 100)

    const range = harness.mode.calcLogicalRange()

    expect(range).toEqual({ from: 80, to: 100 })
    expect(harness.getBarWidth()).toBe(30)
    expect(harness.getOffsetRight()).toBe(0)
  })

  it('keeps percent range when appended data increases visible count', () => {
    const harness = createHarness(100, 600)
    harness.mode.setRange(80, 100)
    harness.mode.calcLogicalRange()
    const initialBarWidth = harness.getBarWidth()

    harness.setDataCount(120)
    const range = harness.mode.calcLogicalRange()

    expect(range).toEqual({ from: 96, to: 120 })
    expect(harness.getBarWidth()).toBeLessThan(initialBarWidth)
    expect(harness.getBarWidth()).toBe(25)
    expect(harness.getOffsetRight()).toBe(0)
  })

  it('caps candlestick entity width without changing band width', () => {
    const harness = createHarness(1, 600)

    harness.mode.calcLogicalRange()
    const barSpace = harness.mode.createBarSpace()

    expect(barSpace.bar).toBe(600)
    expect(barSpace.gapBar).toBe(50)
  })

  it('does not zoom or scroll when data count is at the minimum visible count', () => {
    const harness = createHarness(3, 600)

    expect(harness.mode.scroll(100)).toBe(false)
    expect(harness.mode.zoom(0.5, 300)).toBeUndefined()

    const range = harness.mode.calcLogicalRange()
    expect(range).toEqual({ from: 0, to: 3 })
  })

  it('clamps zoom to at least three visible data points', () => {
    const harness = createHarness(100, 600)
    harness.mode.setRange(80, 100)

    harness.mode.zoom(100, 300)
    const range = harness.mode.calcLogicalRange()

    expect(range.to - range.from).toBeCloseTo(3)
  })

  it('keeps the raw range after min visible count is applied to the visible range', () => {
    const harness = createHarness(100, 600)

    harness.mode.setRange(99, 100)
    const range = harness.mode.calcLogicalRange()

    expect(range.from).toBe(97)
    expect(range.to).toBe(100)
    expect(harness.mode.getRange()).toEqual({ start: 99, end: 100 })
    expect(harness.mode.getMinSpan()).toBe(3)
  })

  it('allows a zero span dataZoom range and derives a minimum visible range', () => {
    const harness = createHarness(100, 600)

    harness.mode.setRange(50, 50)
    const range = harness.mode.calcLogicalRange()

    expect(harness.mode.getRange()).toEqual({ start: 50, end: 50 })
    expect(range.to - range.from).toBe(3)
  })

  it('reports full span as the minimum when data cannot be zoomed', () => {
    const harness = createHarness(2, 600)

    expect(harness.mode.getMinSpan()).toBe(100)
    expect(harness.mode.setRange(0, 100)).toBe(false)
  })

  it('allows handles to cross when minSpan is not configured', () => {
    const harness = createHarness(100, 600)
    harness.mode.setRange(40, 60)

    expect(harness.mode.setRangeByMove(40, 60, 30, 0)).toEqual({ start: 70, end: 60, changed: true })
    expect(harness.mode.getRange()).toEqual({ start: 60, end: 70 })
  })

  it('prevents handles from crossing when minSpan is zero and pushes the opposite handle', () => {
    const harness = createHarness(100, 600)
    harness.mode.setSpanLimit(0)
    harness.mode.setRange(40, 60)

    expect(harness.mode.setRangeByMove(40, 60, 30, 0)).toEqual({ start: 70, end: 70, changed: true })
    expect(harness.mode.getRange()).toEqual({ start: 70, end: 70 })
  })

  it('pushes the opposite handle when minSpan is reached', () => {
    const harness = createHarness(100, 600)
    harness.mode.setSpanLimit(2)
    harness.mode.setRange(40, 60)

    expect(harness.mode.setRangeByMove(40, 60, 30, 0)).toEqual({ start: 70, end: 72, changed: true })
    expect(harness.mode.getRange()).toEqual({ start: 70, end: 72 })
  })

  it('keeps the pushed opposite handle still when dragging back from minSpan', () => {
    const harness = createHarness(100, 600)
    harness.mode.setSpanLimit(2)
    harness.mode.setRange(50, 100)

    const pushedRange = harness.mode.setRangeByMove(50, 100, -49, 1)
    expect(pushedRange).toEqual({ start: 49, end: 51, changed: true })

    expect(harness.mode.setRangeByMove(pushedRange.start, pushedRange.end, 4, 1)).toEqual({ start: 49, end: 55, changed: true })
    expect(harness.mode.getRange()).toEqual({ start: 49, end: 55 })
  })

  it('pushes the opposite handle when maxSpan is reached', () => {
    const harness = createHarness(100, 600)
    harness.mode.setSpanLimit(undefined, 20)
    harness.mode.setRange(40, 60)

    expect(harness.mode.setRangeByMove(40, 60, -30, 0)).toEqual({ start: 10, end: 30, changed: true })
    expect(harness.mode.getRange()).toEqual({ start: 10, end: 30 })
  })

  it('constrains wheel zoom with ECharts sliderMove semantics', () => {
    const harness = createHarness(100, 600)
    harness.mode.setSpanLimit(10, 30)
    harness.mode.setRange(40, 60)

    harness.mode.zoom(100, 300)
    expect(harness.mode.getRange().start).toBeCloseTo(49.9009900990099)
    expect(harness.mode.getRange().end).toBeCloseTo(59.9009900990099)

    harness.mode.zoom(-0.9, 300)
    expect(harness.mode.getRange().start).toBeCloseTo(4.9009900990099)
    expect(harness.mode.getRange().end).toBeCloseTo(34.9009900990099)
  })

  it('moves the range right when zooming in below minSpan like ECharts', () => {
    const harness = createHarness(100, 600)
    harness.mode.setSpanLimit(20)
    harness.mode.setRange(50, 70)

    harness.mode.zoom(1, 300)

    expect(harness.mode.getRange()).toEqual({ start: 55, end: 75 })
  })
})

function createHarness(dataCount: number, mainWidth: number): {
  mode: DataZoomTimeScaleMode
  getBarWidth: () => number
  getOffsetRight: () => number
  setDataCount: (count: number) => void
} {
  let barWidth = 8
  let rightLogicalIndex = dataCount + 10 / barWidth
  let dataList = createDataList(dataCount)
  const context: TimeScaleModeContext = {
    getBarWidth: () => barWidth,
    setBarWidth: value => {
      barWidth = value
    },
    getBarSpaceLimit: () => ({ min: 1, max: 50 }),
    getMainWidth: () => mainWidth,
    getDataList: () => dataList,
    getFirstLogicalIndex: () => 0,
    getRightLogicalIndex: () => rightLogicalIndex,
    setRightLogicalIndex: value => { rightLogicalIndex = value },
    getMinRemainWidth: () => ({ left: 0, right: 0 }),
    getTimeShareTicks: () => [],
    getTimeShareDays: () => 1,
    getZoomCoordinate: xCoord => xCoord ?? mainWidth / 2,
    getInitialOffsetRightDistance: () => 10,
    getOffsetRightDistance: () => (rightLogicalIndex - dataList.length) * barWidth,
    setOffsetRightDistance: value => {
      rightLogicalIndex = dataList.length + value / barWidth
    }
  }

  return {
    mode: new DataZoomTimeScaleMode(context),
    getBarWidth: () => barWidth,
    getOffsetRight: () => (rightLogicalIndex - dataList.length) * barWidth,
    setDataCount: count => {
      dataList = createDataList(count)
    }
  }
}

function createDataList(count: number): KLineData[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: index,
    open: index,
    high: index,
    low: index,
    close: index
  }))
}
