import { describe, expect, it, vi } from 'vitest'
import type Chart from '../Chart'
import { ActionType } from '../common/Action'
import { LoadDataType, type LoadDataParams } from '../common/LoadDataCallback'
import { registerIndicator } from '../extension/indicator'
import ChartStore from './ChartStore'

const bars = (start: number) => Array.from({ length: 4 }, (_, i) => ({ timestamp: start + i, open: 10, high: 20, low: 5, close: 15 }))
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function fixture() {
  const chart = { refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn() }
  const store = new ChartStore(chart as unknown as Chart)
  store.mainWidth = 800
  return { store, chart }
}

describe('atomic data snapshots', () => {
  it('rejects invalid input before replacing the current dataset', () => {
    const { store } = fixture()
    store.applyDataSnapshot(bars(100))
    const previous = store.getDataList()
    const epoch = store.getDatasetEpoch()
    expect(() => store.applyDataSnapshot(bars(300).reverse())).toThrow()
    expect(store.getDataList()).toBe(previous)
    expect(store.getDatasetEpoch()).toBe(epoch)
  })

  it('cancels remaining observers and loading when notification starts a newer dataset', () => {
    const { store } = fixture()
    const seen: number[] = []
    const loader = vi.fn()
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, () => {
      if (store.getDataList()[0]?.timestamp === 100) store.applyDataSnapshot(bars(200), false)
    })
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, () => seen.push(store.getDataList()[0].timestamp))
    store.setLoadDataCallback(loader)
    store.applyDataSnapshot(bars(100))
    expect(seen).toEqual([200])
    expect(loader.mock.calls.map(([request]) => request.data?.timestamp)).toEqual([200])
  })

  it('retains the loader across datasets, rejects stale responses and accepts a response only once', () => {
    const { store } = fixture()
    const requests: LoadDataParams[] = []
    store.setLoadDataCallback(request => requests.push(request))
    store.applyDataSnapshot(bars(100))
    const old = requests[0]
    store.applyDataSnapshot(bars(200))
    const current = requests.find(request => request.data?.timestamp === 200)!
    old.addData(bars(50), false)
    expect(store.getDataList()[0].timestamp).toBe(200)
    current.addData(bars(150), false)
    current.addData(bars(150), false)
    expect(store.getDataList()).toHaveLength(8)
    store.applyDataSnapshot(bars(300), false)
    const count = requests.length
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    expect(requests).toHaveLength(count)
  })

  it('keeps remaining callbacks queued when a completion callback starts new indicator work', async () => {
    const { store } = fixture()
    store.applyDataSnapshot(bars(100))
    const pending: Array<(value: number[]) => void> = []
    registerIndicator({ name: 'callback-reentry', calc: () => new Promise<number[]>(resolve => pending.push(resolve)) })
    const adding = store.getIndicatorStore().addInstance({ name: 'callback-reentry' }, 'candle_pane', true)
    pending.shift()!([1])
    await adding
    const done: string[] = []
    store.replaceData(bars(100), false, () => {
      done.push('A')
      store.replaceData(bars(300), false, () => done.push('C'))
    })
    store.replaceData(bars(200), false, () => done.push('B'))
    pending[1]([20])
    await flush()
    expect(done).toEqual(['A'])
    pending[2]([30])
    await flush()
    expect(done).toEqual(['A', 'B', 'C'])
    pending[0]([10])
    await flush()
    expect(done).toEqual(['A', 'B', 'C'])
  })

  it.each(['update', 'replace', 'clear', 'destroy', 'dataset'] as const)('isolates async results, layout and completion after %s', async change => {
    const { store, chart } = fixture()
    store.applyDataSnapshot(bars(100))
    const pending: Array<(value: number[]) => void> = []
    const name = `snapshot-${change}`
    registerIndicator({ name, calc: () => new Promise<number[]>(resolve => pending.push(resolve)) })
    const adding = store.getIndicatorStore().addInstance({ name, id: name }, 'candle_pane', true)
    pending.shift()!([1])
    await adding
    const done: string[] = []
    store.replaceData(bars(100), false, () => done.push('A'))
    const a = pending.shift()!
    if (change === 'clear') store.clear()
    else if (change === 'destroy') store.destroy()
    else if (change === 'dataset') store.applyDataSnapshot(bars(200), undefined, () => done.push('B'))
    else if (change === 'update') store.addData({ ...bars(100)[3], close: 30 }, undefined, undefined, () => done.push('B'))
    else store.replaceData(bars(200), false, () => done.push('B'))
    chart.refreshViewportLayout.mockClear()
    a([15])
    await flush()
    expect(done).toEqual([])
    expect(chart.refreshViewportLayout).not.toHaveBeenCalled()
    const b = pending.shift()
    if (b) {
      b([30])
      await flush()
      expect(done).toEqual(change === 'dataset' ? ['B'] : ['A', 'B'])
      expect(store.getIndicatorStore().getIndicatorsByFilter({ id: name })[0].result).toEqual([30])
    }
  })
})
