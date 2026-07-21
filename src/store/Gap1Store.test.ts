import { describe, expect, it } from 'vitest'

import type KLineData from '../common/KLineData'
import type VisibleRange from '../common/VisibleRange'
import type ChartStore from './ChartStore'
import Gap1Store from './Gap1Store'

function candle(timestamp: number, low: number, high: number): KLineData {
  return { timestamp, open: low, high, low, close: high }
}

function range(from: number, to: number): VisibleRange {
  return { from, to, domainFrom: from, domainTo: to }
}

function createStore(initialData: KLineData[], initialRange: VisibleRange) {
  let dataList = initialData
  let visibleRange = initialRange
  const chartStore = {
    getDataList: () => dataList,
    getTimeScaleStore: () => ({ getVisibleRange: () => visibleRange })
  } as unknown as ChartStore
  return {
    store: new Gap1Store(chartStore),
    setData: (value: KLineData[]) => { dataList = value },
    setRange: (value: VisibleRange) => { visibleRange = value }
  }
}

describe('Gap1Store', () => {
  it('is disabled by default and ignores recalculation while disabled', () => {
    const data = [candle(0, 90, 100), candle(1, 110, 120)]
    const { store } = createStore(data, range(0, 2))

    store.recalculate(data, range(0, 2))

    expect(store.isEnabled()).toBe(false)
    expect(store.getGaps()).toEqual([])
  })

  it('calculates immediately when enabled and clears when disabled', () => {
    const data = [candle(0, 90, 100), candle(1, 110, 120)]
    const { store } = createStore(data, range(0, 2))

    store.setOptions(true)
    expect(store.getGaps()).toHaveLength(1)

    store.setOptions(false)
    expect(store.isEnabled()).toBe(false)
    expect(store.getGaps()).toEqual([])
  })

  it('enables with normalized object options and retains them across disable and re-enable', () => {
    const data = [candle(0, 90, 100), candle(1, 110, 120)]
    const { store } = createStore(data, range(0, 2))

    store.setOptions({ maxGapCount: 0, showValue: true })
    store.setOptions(false)
    store.setOptions(true)

    expect(store.isEnabled()).toBe(true)
    expect(store.getOptions()).toEqual({ maxGapCount: 1, showValue: true })
  })

  it('recalculates from the supplied visible range', () => {
    const data = [
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 106, 115),
      candle(3, 100, 108)
    ]
    const { store, setRange } = createStore(data, range(0, 3))
    store.setOptions(true)

    expect(store.getGaps()).toMatchObject([{ bottom: 100, top: 106 }])

    setRange(range(1, 4))
    store.recalculate(data, range(1, 4))
    expect(store.getGaps()).toEqual([])
  })

  it('uses current chart data when re-enabled and clear removes records', () => {
    const initial = [candle(0, 90, 100)]
    const next = [...initial, candle(1, 110, 120)]
    const { store, setData, setRange } = createStore(initial, range(0, 1))
    store.setOptions(true)
    store.setOptions(false)
    setData(next)
    setRange(range(0, 2))

    store.setOptions(true)
    expect(store.getGaps()).toHaveLength(1)

    store.clear()
    expect(store.getGaps()).toEqual([])
  })

  it('keeps the newest gaps and does not recalculate when only showValue changes', () => {
    const data = [
      candle(0, 0, 10),
      candle(1, 20, 30),
      candle(2, 40, 50),
      candle(3, 60, 70)
    ]
    const { store } = createStore(data, range(0, 4))
    store.setOptions({ maxGapCount: 2 })

    const records = store.getGaps()
    expect(records.map(gap => gap.openTimestamp)).toEqual([3, 2])

    store.setOptions({ showValue: true })

    expect(store.getOptions().showValue).toBe(true)
    expect(store.getGaps()).toBe(records)
  })
})
