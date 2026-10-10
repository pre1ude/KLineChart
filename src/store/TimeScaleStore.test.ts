import { describe, expect, it, vi } from 'vitest'
import type KLineData from '../common/KLineData'
import { CandleType, getDefaultStyles } from '../common/Styles'
import TimeScaleStore, { calcTimeScaleHorizontalInset } from './TimeScaleStore'
import { TimeScaleModeKind } from './time-scale'
import TimeIndex from '../component/TimeIndex'

describe('calcTimeScaleHorizontalInset', () => {
  it('keeps the time scale range unchanged outside area symbol and point drawing', () => {
    const styles = getDefaultStyles()

    expect(calcTimeScaleHorizontalInset(styles)).toBe(0)

    styles.candle.type = CandleType.Area

    expect(calcTimeScaleHorizontalInset(styles)).toBe(0)
  })

  it('uses the visible area symbol outer radius as horizontal inset', () => {
    const styles = getDefaultStyles()
    styles.candle.type = CandleType.Area
    styles.candle.area.symbol = {
      show: true,
      radius: 4,
      borderSize: 2
    }

    expect(calcTimeScaleHorizontalInset(styles)).toBe(5)
  })

  it('uses the area ripple point radius when it is larger than the line symbol', () => {
    const styles = getDefaultStyles()
    styles.candle.type = CandleType.Area
    styles.candle.area.symbol = {
      show: true,
      radius: 2,
      borderSize: 1
    }
    styles.candle.area.point.show = true
    styles.candle.area.point.rippleRadius = 8

    expect(calcTimeScaleHorizontalInset(styles)).toBe(8)
  })
})

describe('TimeScaleStore viewport refresh scheduling', () => {
  it('uses synchronous viewport refresh unless a request refresh is explicitly asked for', () => {
    const store = Object.create(TimeScaleStore.prototype) as TimeScaleStore
    const refreshViewportLayout = vi.fn()
    const requestViewportLayout = vi.fn()
    const recalculateCrosshair = vi.fn()
    const adjustVisibleRange = vi.fn()

    Reflect.set(store, 'adjustVisibleRange', adjustVisibleRange)
    Reflect.set(store, '_chartStore', {
      getTooltipStore: () => ({ recalculateCrosshair }),
      getChart: () => ({ refreshViewportLayout, requestViewportLayout })
    })

    Reflect.get(store, '_refreshTimeScale').call(store)
    Reflect.get(store, '_refreshTimeScale').call(store, true)

    expect(adjustVisibleRange).toHaveBeenCalledTimes(2)
    expect(recalculateCrosshair).toHaveBeenCalledTimes(2)
    expect(refreshViewportLayout).toHaveBeenCalledTimes(1)
    expect(requestViewportLayout).toHaveBeenCalledTimes(1)
  })
})

describe('TimeScaleStore offsetRight resize bounds', () => {
  it('keeps offsetRight while the resized visible candle width remains above the minimum', () => {
    const { chartStore, timeScaleStore } = createTimeScaleHarness(250)
    timeScaleStore.setMaxOffsetRightDistance(120)
    timeScaleStore.setOffsetRightDistance(100)

    chartStore.mainWidth = 180
    timeScaleStore.adjustVisibleRange()

    expect(timeScaleStore.getOffsetRightDistance()).toBe(100)
  })

  it('reduces offsetRight after resize when visible candle width reaches the minimum', () => {
    const { chartStore, timeScaleStore } = createTimeScaleHarness(250)
    timeScaleStore.setMaxOffsetRightDistance(120)
    timeScaleStore.setOffsetRightDistance(100)

    chartStore.mainWidth = 90
    timeScaleStore.adjustVisibleRange()

    expect(timeScaleStore.getOffsetRightDistance()).toBe(90)
  })
})

describe('TimeScaleStore initial view reset', () => {
  it('restores the initial K-line bar width and right position after zooming', () => {
    const { timeScaleStore } = createTimeScaleHarness(600)
    timeScaleStore.adjustVisibleRange()
    timeScaleStore.captureInitialView()

    timeScaleStore.zoom(1, 300)
    expect(timeScaleStore.getBarSpace().bar).toBe(16)

    timeScaleStore.resetTimeScale()

    expect(timeScaleStore.getBarSpace().bar).toBe(8)
    expect(timeScaleStore.getOffsetRightDistance()).toBe(10)
  })

  it('restores the initial left alignment when the data fits the chart', () => {
    const { timeScaleStore } = createTimeScaleHarness(100, 5)
    timeScaleStore.autoInitialAlignment()
    timeScaleStore.adjustVisibleRange()
    timeScaleStore.captureInitialView()

    timeScaleStore.scroll(20)
    timeScaleStore.resetTimeScale()

    expect(timeScaleStore.getOffsetRightDistance()).toBe(60)
    expect(timeScaleStore.getVisibleRange()).toMatchObject({ from: 0, domainFrom: 0 })
  })

  it('restores the configured initial DataZoom range', () => {
    const { timeScaleStore } = createTimeScaleHarness(600)
    timeScaleStore.setMode(TimeScaleModeKind.DataZoom)
    timeScaleStore.setDataZoomOptions({ start: 80, end: 100 })
    timeScaleStore.adjustVisibleRange()
    timeScaleStore.captureInitialView()

    timeScaleStore.setDataZoomRange(20, 40)
    timeScaleStore.resetTimeScale()

    expect(timeScaleStore.getDataZoomRange()).toEqual({ start: 80, end: 100 })
    expect(timeScaleStore.getVisibleRange()).toMatchObject({ domainFrom: 80, domainTo: 100 })
  })

  it('respects the current bar space limit when restoring the initial view', () => {
    const { timeScaleStore } = createTimeScaleHarness(600)
    timeScaleStore.adjustVisibleRange()
    timeScaleStore.captureInitialView()

    timeScaleStore.setBarSpaceLimit({ max: 4 })
    timeScaleStore.resetTimeScale()

    expect(timeScaleStore.getBarSpace().bar).toBe(4)
  })

})

function createTimeScaleHarness(mainWidth: number, dataCount: number = 100): {
  chartStore: { mainWidth: number }
  timeScaleStore: TimeScaleStore
} {
  const timeIndex = new TimeIndex(() => createDataList(dataCount))
  const chartStore = {
    batchEffects: (effect: () => unknown) => effect(),
    mainWidth,
    getDataList: () => createDataList(dataCount),
    getTimeIndex: () => timeIndex,
    getMinRemainWidth: () => ({ left: 0, right: 0 }),
    getTimeShareTicks: () => [],
    getTimeShareDays: () => 1,
    getTooltipStore: () => ({
      getCrosshair: () => undefined,
      recalculateCrosshair: vi.fn()
    }),
    getActionStore: () => ({
      execute: vi.fn()
    }),
    getChart: () => ({
      refreshViewportLayout: vi.fn(),
      requestViewportLayout: vi.fn()
    }),
    adjustVisibleDataList: vi.fn(),
    executeLoadDataCallback: vi.fn(),
    getStyles: () => getDefaultStyles()
  }
  const timeScaleStore = new TimeScaleStore(chartStore as never)

  return {
    chartStore,
    timeScaleStore
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
