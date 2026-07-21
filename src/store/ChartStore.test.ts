import { describe, expect, it, vi } from 'vitest'
import type KLineData from '../common/KLineData'
import { LoadDataType } from '../common/LoadDataCallback'
import type Chart from '../Chart'
import ChartStore from './ChartStore'
import { PANE_DEFAULT_HEIGHT } from '../pane/types'
import * as logger from '../common/utils/logger'

describe('ChartStore', () => {
  it('uses main-flex pane resizing by default and accepts adjacent mode', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart

    const store = new ChartStore(chart)
    expect(store.getPaneResizeMode()).toBe('main-flex')

    store.setOptions({ paneResizeMode: 'adjacent' })

    expect(store.getPaneResizeMode()).toBe('adjacent')
  })

  it('uses built-in indicator pane defaults and accepts global overrides', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart

    const store = new ChartStore(chart)
    expect(store.getIndicatorPaneDefaultHeight()).toBe(PANE_DEFAULT_HEIGHT)
    expect(store.getMinIndicatorPaneHeight()).toBe(30)

    store.setOptions({
      indicatorPaneDefaultHeight: 120,
      minIndicatorPaneHeight: 50
    })

    expect(store.getIndicatorPaneDefaultHeight()).toBe(120)
    expect(store.getMinIndicatorPaneHeight()).toBe(50)
  })

  it('applies initial auto alignment before the first init data render', () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    try {
      const chart = {
        refreshViewportLayout: vi.fn((afterLayoutSettled?: () => void) => {
          afterLayoutSettled?.()
        })
      } as unknown as Chart
      const store = new ChartStore(chart)
      store.mainWidth = 100

      store.addData(createDataList(5), LoadDataType.Init)

      expect(timeoutSpy).not.toHaveBeenCalled()
      expect(chart.refreshViewportLayout).toHaveBeenNthCalledWith(1, expect.any(Function))
      expect(store.getTimeScaleStore().getOffsetRightDistance()).toBe(60)
      expect(store.getTimeScaleStore().getVisibleRange()).toMatchObject({
        from: 0,
        domainFrom: 0
      })
      expect(chart.refreshViewportLayout).toHaveBeenCalledTimes(2)
    } finally {
      timeoutSpy.mockRestore()
    }
  })

  it('configures and recalculates chart gaps without creating an indicator', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart
    const store = new ChartStore(chart, { gaps: true })

    store.addData([
      { timestamp: 0, open: 90, high: 100, low: 90, close: 100 },
      { timestamp: 1, open: 103, high: 110, low: 103, close: 110 }
    ], LoadDataType.Init)

    expect(store.getGapStore().isEnabled()).toBe(true)
    expect(store.getGapStore().getGaps()).toHaveLength(1)
    expect(store.getIndicatorStore().getIndicatorsByFilter({})).toEqual([])
    expect(store.getOverlayStore().getInstances()).toEqual([])
    expect(store.getOverlayStore().exportAllOverlays()).toEqual([])

    store.setOptions({ gaps: false })
    expect(store.getGapStore().getGaps()).toEqual([])
  })

  it('updates gap styles without recalculating gap records', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart
    const store = new ChartStore(chart, { gaps: true })
    store.addData([
      { timestamp: 0, open: 90, high: 100, low: 90, close: 100 },
      { timestamp: 1, open: 103, high: 110, low: 103, close: 110 }
    ], LoadDataType.Init)
    const records = store.getGapStore().getGaps()
    const recalculate = vi.spyOn(store.getGapStore(), 'recalculate')

    store.setOptions({
      styles: {
        gap: {
          up: { backgroundColor: '#ff000026' }
        }
      }
    })

    expect(store.getStyles().gap.up.backgroundColor).toBe('#ff000026')
    expect(store.getGapStore().getGaps()).toBe(records)
    expect(recalculate).not.toHaveBeenCalled()
  })

  it('classifies every data mutation for gap recalculation', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart
    const store = new ChartStore(chart, { gaps: true })
    const recalculate = vi.spyOn(store.getGapStore(), 'recalculate')

    store.addData(createTimestampDataList([10, 20]), LoadDataType.Init)
    expect(recalculate).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'init', fromIndex: 0 })

    store.addData(createTimestampDataList([0]), LoadDataType.Backward)
    expect(recalculate).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'prepend', fromIndex: 0 })

    store.addData(createTimestampDataList([30]), LoadDataType.Forward)
    expect(recalculate).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'append', fromIndex: 3 })

    store.addData({ timestamp: 30, open: 30, high: 30, low: 30, close: 30 })
    expect(recalculate).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'update-latest', fromIndex: 3 })

    store.addData({ timestamp: 10, open: 10, high: 10, low: 10, close: 10 })
    expect(recalculate).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'update-history', fromIndex: 1 })

    store.replaceData(createTimestampDataList([100, 200]))
    expect(recalculate).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'replace', fromIndex: 0 })
  })

  it('configures Gap1 independently and recalculates against the current visible horizon', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart
    const store = new ChartStore(chart, {
      gaps: true,
      gap1: { maxGapCount: 2, showValue: true }
    })
    expect(store.getGap1Store().getOptions()).toEqual({ maxGapCount: 2, showValue: true })
    store.mainWidth = 100
    store.addData([
      { timestamp: 0, open: 90, high: 100, low: 90, close: 100 },
      { timestamp: 1, open: 110, high: 120, low: 110, close: 120 },
      { timestamp: 2, open: 106, high: 115, low: 106, close: 115 },
      { timestamp: 3, open: 100, high: 108, low: 100, close: 108 }
    ], LoadDataType.Init)

    const timeScaleStore = store.getTimeScaleStore()
    Reflect.set(timeScaleStore, '_visibleRange', { from: 0, to: 3, domainFrom: 0, domainTo: 3 })
    store.adjustVisibleDataList()
    expect(store.getGap1Store().getGaps()).toMatchObject([{ bottom: 100, top: 106 }])

    Reflect.set(timeScaleStore, '_visibleRange', { from: 1, to: 4, domainFrom: 1, domainTo: 4 })
    store.adjustVisibleDataList()
    expect(store.getGap1Store().getGaps()).toEqual([])

    store.setOptions({ gap1: false })
    expect(store.getGap1Store().isEnabled()).toBe(false)
    expect(store.getGapStore().isEnabled()).toBe(true)
  })

  it('recalculates Gap1 for viewport and data changes but not style-only updates', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart
    const store = new ChartStore(chart, { gap1: true })
    store.mainWidth = 100
    store.addData(createDataList(20), LoadDataType.Init)
    const recalculate = vi.spyOn(store.getGap1Store(), 'recalculate')

    store.getTimeScaleStore().scroll(8)
    expect(recalculate).toHaveBeenCalled()

    recalculate.mockClear()
    store.getTimeScaleStore().zoom(0.1)
    expect(recalculate).toHaveBeenCalled()

    recalculate.mockClear()
    store.addData(createTimestampDataList([20]), LoadDataType.Forward)
    expect(recalculate).toHaveBeenCalled()

    recalculate.mockClear()
    const records = store.getGap1Store().getGaps()
    store.setOptions({ gap1: { showValue: true } })
    expect(recalculate).not.toHaveBeenCalled()
    expect(store.getGap1Store().getGaps()).toBe(records)

    store.setOptions({
      styles: {
        gap: {
          up: { backgroundColor: '#ff000026' }
        }
      }
    })
    expect(recalculate).not.toHaveBeenCalled()
    expect(store.getGap1Store().getGaps()).toBe(records)
  })

  it('clears Gap1 records with chart data', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart
    const store = new ChartStore(chart, { gap1: true })
    store.mainWidth = 100
    store.addData([
      { timestamp: 0, open: 90, high: 100, low: 90, close: 100 },
      { timestamp: 1, open: 110, high: 120, low: 110, close: 120 }
    ], LoadDataType.Init)
    expect(store.getGap1Store().getGaps()).toHaveLength(1)

    store.clear()

    expect(store.getGap1Store().getGaps()).toEqual([])
    expect(store.getGap1Store().isEnabled()).toBe(true)
  })

  it('keeps Gap1 silent and isolated from indicator, tooltip, and overlay state', () => {
    const logInfo = vi.spyOn(logger, 'logInfo')
    try {
      const chart = {
        refreshViewportLayout: vi.fn()
      } as unknown as Chart
      const store = new ChartStore(chart, { gap1: true })
      store.mainWidth = 100

      store.addData([
        { timestamp: 0, open: 90, high: 100, low: 90, close: 100 },
        { timestamp: 1, open: 110, high: 120, low: 110, close: 120 }
      ], LoadDataType.Init)
      store.getTimeScaleStore().scroll(8)

      expect(store.getGap1Store().getGaps()).toHaveLength(1)
      expect(store.getIndicatorStore().getIndicatorsByFilter({})).toEqual([])
      expect(store.getTooltipStore().getCrosshair()).not.toHaveProperty('indicatorData')
      expect(store.getOverlayStore().getInstances()).toEqual([])
      expect(store.getOverlayStore().exportAllOverlays()).toEqual([])
      expect(logInfo).not.toHaveBeenCalled()
    } finally {
      logInfo.mockRestore()
    }
  })
})

function createDataList(count: number): KLineData[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: index,
    open: index,
    high: index,
    low: index,
    close: index
  }))
}

function createTimestampDataList(timestamps: number[]): KLineData[] {
  return timestamps.map(timestamp => ({
    timestamp,
    open: timestamp,
    high: timestamp,
    low: timestamp,
    close: timestamp
  }))
}
