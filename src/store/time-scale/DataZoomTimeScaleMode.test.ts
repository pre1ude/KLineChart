import { describe, expect, it } from 'vitest'
import type BarSpace from '../../common/BarSpace'
import type KLineData from '../../common/KLineData'
import { DataZoomTimeScaleMode } from './DataZoomTimeScaleMode'
import type { TimeScaleModeContext } from './TimeScaleMode'

describe('DataZoomTimeScaleMode', () => {
  it('derives visible range, bar width, and offset from percent range', () => {
    const harness = createHarness(100, 600)
    harness.mode.setRange(80, 100)

    const range = harness.mode.calcVisibleRange()

    expect(range).toEqual({ from: 80, to: 100, domainFrom: 80, domainTo: 100 })
    expect(harness.getBarWidth()).toBe(30)
    expect(harness.getOffsetRight()).toBe(0)
  })

  it('keeps percent range when appended data increases visible count', () => {
    const harness = createHarness(100, 600)
    harness.mode.setRange(80, 100)
    harness.mode.calcVisibleRange()
    const initialBarWidth = harness.getBarWidth()

    harness.setDataCount(120)
    const range = harness.mode.calcVisibleRange()

    expect(range).toEqual({ from: 96, to: 120, domainFrom: 96, domainTo: 120 })
    expect(harness.getBarWidth()).toBeLessThan(initialBarWidth)
    expect(harness.getBarWidth()).toBe(25)
    expect(harness.getOffsetRight()).toBe(0)
  })

  it('caps candlestick entity width without changing band width', () => {
    const harness = createHarness(1, 600)

    harness.mode.calcVisibleRange()
    const barSpace = harness.mode.createBarSpace()

    expect(barSpace.bar).toBe(600)
    expect(barSpace.gapBar).toBe(50)
  })

  it('does not zoom or scroll when data count is at the minimum visible count', () => {
    const harness = createHarness(3, 600)

    expect(harness.mode.scroll(100)).toBe(false)
    expect(harness.mode.zoom(0.5, 300)).toBeUndefined()

    const range = harness.mode.calcVisibleRange()
    expect(range).toEqual({ from: 0, to: 3, domainFrom: 0, domainTo: 3 })
  })

  it('clamps zoom to at least three visible data points', () => {
    const harness = createHarness(100, 600)
    harness.mode.setRange(80, 100)

    harness.mode.zoom(100, 300)
    const range = harness.mode.calcVisibleRange()

    expect(range.domainTo - range.domainFrom).toBeCloseTo(3)
  })

  it('exposes the effective range after min visible count is applied', () => {
    const harness = createHarness(100, 600)

    harness.mode.setRange(99, 100)
    harness.mode.calcVisibleRange()

    expect(harness.mode.getRange()).toEqual({ start: 97, end: 100 })
    expect(harness.mode.getMinSpan()).toBe(3)
  })

  it('reports full span as the minimum when data cannot be zoomed', () => {
    const harness = createHarness(2, 600)

    expect(harness.mode.getMinSpan()).toBe(100)
    expect(harness.mode.setRange(0, 100)).toBe(false)
  })
})

function createHarness(dataCount: number, mainWidth: number): {
  mode: DataZoomTimeScaleMode
  getBarWidth: () => number
  getOffsetRight: () => number
  setDataCount: (count: number) => void
} {
  let barWidth = 8
  let offsetRight = 10
  let dataList = createDataList(dataCount)
  const context: TimeScaleModeContext = {
    getBarSpace: (): BarSpace => ({
      bar: barWidth,
      halfBar: barWidth / 2,
      gapBar: Math.max(1, Math.floor(barWidth)),
      halfGapBar: Math.floor(Math.max(1, Math.floor(barWidth)) / 2)
    }),
    getBarWidth: () => barWidth,
    setBarWidth: value => {
      barWidth = value
    },
    getBarSpaceLimit: () => ({ min: 1, max: 50 }),
    getMainWidth: () => mainWidth,
    getDataList: () => dataList,
    getMinRemainWidth: () => ({ left: 0, right: 0 }),
    getTimeShareTicks: () => [],
    getTimeShareDays: () => 1,
    getZoomCoordinate: xCoord => xCoord ?? mainWidth / 2,
    getInitialOffsetRightDistance: () => 10,
    getOffsetRightDistance: () => offsetRight,
    setOffsetRightDistance: value => {
      offsetRight = value
    }
  }

  return {
    mode: new DataZoomTimeScaleMode(context),
    getBarWidth: () => barWidth,
    getOffsetRight: () => offsetRight,
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
