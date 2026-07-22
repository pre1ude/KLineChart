import { beforeEach, describe, expect, it, vi } from 'vitest'

import type KLineData from '../common/KLineData'
import type ChartStore from './ChartStore'
import GapStore from './GapStore'
import { logInfo } from '../common/utils/logger'

vi.mock('../common/utils/logger', () => ({
  logInfo: vi.fn()
}))

function candle(timestamp: number, low: number, high: number): KLineData {
  return { timestamp, open: low, high, low, close: high }
}

function createStore(initialData: KLineData[] = []): { store: GapStore, setData: (data: KLineData[]) => void } {
  let dataList = initialData
  const chartStore = {
    getDataList: () => dataList
  } as unknown as ChartStore
  return {
    store: new GapStore(chartStore),
    setData: data => { dataList = data }
  }
}

describe('GapStore', () => {
  beforeEach(() => {
    vi.mocked(logInfo).mockClear()
  })

  it('keeps configuration separate from visibility and retains records when equivalent options are reapplied', () => {
    const data = [candle(0, 90, 100), candle(1, 103, 110)]
    const { store } = createStore(data)

    store.setOptions({})
    expect(store.getGaps()).toEqual([])
    store.setShow(true)
    const records = store.getGaps()
    store.setOptions({ maxGapCount: 15 })

    expect(store.isEnabled()).toBe(true)
    expect(store.getOptions().maxGapCount).toBe(15)
    expect(store.getGaps()).toBe(records)
    expect(logInfo).not.toHaveBeenCalled()
  })

  it('disables and clears results while retaining normalized configuration', () => {
    const { store } = createStore([candle(0, 90, 100), candle(1, 103, 110)])
    store.setOptions({ maxGapCount: 2 })

    store.setShow(false)
    store.setShow(true)

    expect(store.getOptions().maxGapCount).toBe(2)
    expect(store.getGaps()).toHaveLength(1)
    expect(logInfo).not.toHaveBeenCalled()
  })

  it('keeps initial, prepend, historical, replace, and option recalculations silent', () => {
    const data = [candle(0, 90, 100), candle(1, 103, 110)]
    const { store } = createStore(data)
    store.setShow(true)

    store.recalculate(data, { kind: 'init', fromIndex: 0 })
    store.recalculate(data, { kind: 'prepend', fromIndex: 0 })
    store.recalculate(data, { kind: 'update-history', fromIndex: 0 })
    store.recalculate(data, { kind: 'replace', fromIndex: 0 })
    store.setOptions({ minimalDeviationPercent: 40 })

    expect(logInfo).not.toHaveBeenCalled()
  })

  it('logs a newly appended gap once', () => {
    const initial = [candle(0, 90, 100)]
    const next = [...initial, candle(1, 103, 110)]
    const { store, setData } = createStore(initial)
    store.setShow(true)
    setData(next)

    store.recalculate(next, { kind: 'append', fromIndex: 1 })
    store.recalculate(next, { kind: 'update-latest', fromIndex: 1 })

    expect(logInfo).toHaveBeenCalledTimes(1)
    expect(logInfo).toHaveBeenCalledWith('Gaps', 'New Gap Appeared', expect.objectContaining({
      direction: 'up',
      lowerPrice: 100,
      upperPrice: 103
    }))
  })

  it('logs touch close once and does not log truncation', () => {
    const initial = [candle(0, 90, 100), candle(1, 110, 120)]
    const closed = [...initial, candle(2, 109, 115)]
    const { store } = createStore(initial)
    store.setShow(true)
    vi.mocked(logInfo).mockClear()

    store.recalculate(closed, { kind: 'append', fromIndex: 2 })
    store.recalculate(closed, { kind: 'update-latest', fromIndex: 2 })

    expect(logInfo).toHaveBeenCalledTimes(1)
    expect(logInfo).toHaveBeenCalledWith('Gaps', 'Gap Closed', expect.objectContaining({ closeReason: 'entered' }))

    vi.mocked(logInfo).mockClear()
    store.setOptions({ limitMaxTrailLength: true, maxTrailLength: 1 })
    store.recalculate([...initial, candle(2, 111, 121)], { kind: 'append', fromIndex: 2 })
    expect(logInfo).not.toHaveBeenCalled()
  })

  it('does not log partial progress and logs complete fill once', () => {
    const initial = [candle(0, 90, 100), candle(1, 110, 120)]
    const partial = [...initial, candle(2, 106, 115)]
    const filled = [...partial, candle(3, 100, 108)]
    const { store } = createStore(initial)
    store.setOptions({ closeGapsPartially: true })
    store.setShow(true)
    vi.mocked(logInfo).mockClear()

    store.recalculate(partial, { kind: 'append', fromIndex: 2 })
    expect(logInfo).not.toHaveBeenCalled()

    store.recalculate(filled, { kind: 'append', fromIndex: 3 })
    store.recalculate(filled, { kind: 'update-latest', fromIndex: 3 })

    expect(logInfo).toHaveBeenCalledTimes(1)
    expect(logInfo).toHaveBeenCalledWith('Gaps', 'Gap Closed', expect.objectContaining({ closeReason: 'filled' }))
  })

  it('does not log a close when count limiting evicts an active gap', () => {
    const initial = [candle(0, 0, 10)]
    const appended = [
      ...initial,
      candle(1, 20, 30),
      candle(2, 40, 50)
    ]
    const { store } = createStore(initial)
    store.setOptions({ maxGapCount: 1 })
    store.setShow(true)
    vi.mocked(logInfo).mockClear()

    store.recalculate(appended, { kind: 'append', fromIndex: 1 })

    expect(vi.mocked(logInfo).mock.calls.filter(call => call[1] === 'Gap Closed')).toEqual([])
  })

  it('clear removes records and resets log de-duplication state', () => {
    const data = [candle(0, 90, 100), candle(1, 103, 110)]
    const { store } = createStore(data)
    store.setShow(true)

    store.clear()

    expect(store.getGaps()).toEqual([])
    expect(logInfo).not.toHaveBeenCalled()
  })
})
