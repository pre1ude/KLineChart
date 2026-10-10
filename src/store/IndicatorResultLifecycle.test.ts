import { expect, it, vi } from 'vitest'
import type Chart from '../Chart'
import ChartStore from './ChartStore'
import { registerIndicator } from '../extension/indicator'
import { LoadDataType } from '../common/LoadDataCallback'

const bars = () => [100, 200].map(timestamp => ({ timestamp, open: 10, high: 20, low: 5, close: 15 }))
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
async function fixture() {
  const store = new ChartStore({ updatePane: vi.fn(), refreshViewportLayout: vi.fn(), onCrosshairChange: vi.fn() } as unknown as Chart)
  store.applyDataSnapshot(bars())
  let finish!: (value: number[]) => void
  let reject!: (error: Error) => void
  const previous: number[][] = []
  registerIndicator({ name: 'result-lifecycle', calc: (_data, indicator) => {
    previous.push([...indicator.result] as number[])
    return new Promise<number[]>((resolve, fail) => { finish = resolve; reject = fail })
  } })
  const adding = store.getIndicatorStore().addInstance({ name: 'result-lifecycle', id: 'line' }, 'candle_pane', true)
  finish([10, 20])
  await adding
  const indicator = store.getIndicatorStore().getIndicatorsByFilter({ id: 'line' })[0]
  return { store, indicator, previous, finish: (value: number[]) => finish(value), reject: () => reject(new Error('failed')) }
}

it.each(['tick', 'replace', 'append'] as const)('retains the committed result while %s calculation is pending or rejected', async kind => {
  const { store, indicator, previous, reject } = await fixture()
  if (kind === 'tick') store.addData({ ...bars()[1], close: 30 })
  else if (kind === 'replace') store.replaceData(bars())
  else store.addData({ ...bars()[1], timestamp: 300 })
  expect(previous.at(-1)).toEqual([10, 20])
  expect(indicator.result).toEqual([10, 20])
  reject()
  await flush()
  expect(indicator.result).toEqual([10, 20])
  store.destroy()
})

it.each(['prepend', 'replace', 'dataset', 'timestamp', 'clear'] as const)('invalidates the result on %s structure changes', async kind => {
  const { store, indicator, finish } = await fixture()
  if (kind === 'prepend') store.addData([{ ...bars()[0], timestamp: 50 }], LoadDataType.Backward)
  else if (kind === 'replace') store.replaceData(bars().slice(1))
  else if (kind === 'dataset') store.applyDataSnapshot(bars())
  else if (kind === 'timestamp') {
    const latest = store.getDataList()[1]
    latest.timestamp = 300
    store.addData(latest)
  } else store.clear()
  expect(indicator.result).toEqual([])
  if (kind !== 'clear') {
    finish([30])
    await flush()
    expect(indicator.result).toEqual([30])
  }
  store.destroy()
})

async function pendingFixture() {
  const chart = { updatePane: vi.fn(), refreshViewportLayout: vi.fn(), onCrosshairChange: vi.fn() }
  const store = new ChartStore(chart as unknown as Chart)
  store.applyDataSnapshot(bars())
  const pending = new Map<string, Array<(value: number[]) => void>>()
  registerIndicator({ name: 'removal-lifecycle', calc: (_data, indicator) => new Promise<number[]>(resolve => {
    const queue = pending.get(indicator.id) ?? []
    queue.push(resolve)
    pending.set(indicator.id, queue)
  }) })
  const indicators = store.getIndicatorStore()
  for (const [id, pane] of [['A', 'candle_pane'], ['B', 'other_pane']]) {
    const adding = indicators.addInstance({ name: 'removal-lifecycle', id }, pane, true)
    pending.get(id)!.shift()!([1])
    await adding
  }
  return { store, chart, indicators, pending }
}

it.each(['filter', 'legacy-name', 'legacy-pane'] as const)('releases pending tasks on %s removal and ignores their late completion', async kind => {
  const { store, chart, indicators, pending } = await pendingFixture()
  const done = vi.fn()
  store.addData({ ...bars()[1], close: 20 }, undefined, undefined, done)
  const removed = indicators.getIndicatorsByFilter({ id: 'A' })[0]
  if (kind === 'filter') indicators.removeInstances({ id: 'A' })
  else indicators.removeInstance('candle_pane', kind === 'legacy-name' ? 'removal-lifecycle' : undefined)
  store.addData({ ...bars()[1], close: 30 })
  chart.refreshViewportLayout.mockClear()
  pending.get('B')!.at(-1)!([30])
  await flush()
  expect(store.getTaskScheduler().hasPending()).toBe(false)
  expect(done).toHaveBeenCalledOnce()
  expect(chart.refreshViewportLayout).toHaveBeenCalledOnce()
  pending.get('A')![0]([20])
  pending.get('B')![0]([20])
  await flush()
  expect(removed.result).toEqual([1])
  expect(done).toHaveBeenCalledOnce()
  expect(chart.refreshViewportLayout).toHaveBeenCalledOnce()
  store.destroy()
})

it('finishes after deleting the last pending indicator, outside the removal call', async () => {
  const { store, indicators, pending } = await pendingFixture()
  const done = vi.fn(() => expect(indicators.getIndicatorsByFilter({})).toEqual([]))
  store.addData({ ...bars()[1], close: 20 }, undefined, undefined, done)
  pending.get('B')![0]([20])
  await flush()
  indicators.removeInstances({})
  expect(done).not.toHaveBeenCalled()
  await flush()
  expect(store.getTaskScheduler().hasPending()).toBe(false)
  expect(done).toHaveBeenCalledOnce()
  store.destroy()
})

it('waits for a replacement indicator instead of retired pane tasks', async () => {
  const { store, indicators, pending } = await pendingFixture()
  const done = vi.fn()
  store.addData({ ...bars()[1], close: 20 }, undefined, undefined, done)
  const replacing = indicators.addInstance({ name: 'removal-lifecycle', id: 'C' }, 'candle_pane', false)
  pending.get('B')![0]([20])
  await flush()
  expect(done).not.toHaveBeenCalled()
  pending.get('C')![0]([20])
  await replacing
  await flush()
  expect(store.getTaskScheduler().hasPending()).toBe(false)
  expect(done).toHaveBeenCalledOnce()
  pending.get('A')![0]([99])
  await flush()
  expect(done).toHaveBeenCalledOnce()
  expect(indicators.getInstances('candle_pane')[0].result).toEqual([20])
  store.destroy()
})

it('does not cancel a same-ID indicator owned by another pane', async () => {
  const store = new ChartStore({ updatePane: vi.fn(), refreshViewportLayout: vi.fn(), onCrosshairChange: vi.fn() } as unknown as Chart)
  store.applyDataSnapshot(bars())
  const pending = new Map<string, (value: number[]) => void>()
  registerIndicator({ name: 'pane-task-ownership', calc: (_data, indicator) => new Promise<number[]>(resolve => pending.set(indicator.paneId, resolve)) })
  const indicators = store.getIndicatorStore()
  for (const pane of ['A', 'B']) {
    const adding = indicators.addInstance({ name: 'pane-task-ownership', id: 'same' }, pane, true)
    pending.get(pane)!([1])
    await adding
  }
  const done = vi.fn()
  store.addData({ ...bars()[1], close: 20 }, undefined, undefined, done)
  indicators.removeInstances({ paneId: 'A', id: 'same' })
  pending.get('A')!([99])
  await flush()
  expect(store.getTaskScheduler().hasPending()).toBe(true)
  expect(done).not.toHaveBeenCalled()
  pending.get('B')!([20])
  await flush()
  expect(done).toHaveBeenCalledOnce()
  expect(indicators.getInstances('B')[0].result).toEqual([20])
  store.destroy()
})
