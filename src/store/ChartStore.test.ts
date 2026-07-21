import { describe, expect, it, vi } from 'vitest'
import type KLineData from '../common/KLineData'
import { LoadDataType } from '../common/LoadDataCallback'
import type Chart from '../Chart'
import ChartStore from './ChartStore'
import { PANE_DEFAULT_HEIGHT } from '../pane/types'

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
