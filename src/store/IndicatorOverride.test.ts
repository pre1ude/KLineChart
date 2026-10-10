import { describe, expect, it, vi } from 'vitest'
import Chart from '../Chart'
import ChartStore from './ChartStore'
import { registerIndicator } from '../extension/indicator'

const bars = () => [100, 200].map(timestamp => ({ timestamp, open: 10, high: 30, low: 5, close: 15 }))
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve() }
async function fixture() {
  const chart = Object.assign(Object.create(Chart.prototype), {
    refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn(), _refreshPaneViews: vi.fn()
  }) as Chart
  const store = new ChartStore(chart)
  Reflect.set(chart, '_chartStore', store)
  store.applyDataSnapshot(bars(), false)
  const pending: Array<{ resolve: (result: number[]) => void, reject: (error: Error) => void }> = []
  registerIndicator({ name: 'override-lifecycle', calcParams: [1], calc: () => new Promise<number[]>((resolve, reject) => pending.push({ resolve, reject })) })
  const creation = store.getIndicatorStore().addInstance({ name: 'override-lifecycle', id: 'line' }, 'candle_pane', true)
  pending.shift()!.resolve([1])
  await creation
  await flush()
  return { chart, store, pending }
}

describe('indicator override completion', () => {
  it.each([false, true])('follows ticks without waiting for obsolete calculations (old first: %s)', async oldFirst => {
    const { chart, store, pending } = await fixture()
    const done = vi.fn(), dataDone = vi.fn()
    chart.overrideIndicator({ id: 'line', calcParams: [2] }, undefined, done)
    for (const close of [16, 17, 18]) chart.updateData({ ...bars()[1], close }, dataDone)
    const latest = pending.pop()!
    if (oldFirst) {
      pending.forEach(job => job.resolve([99]))
      await flush()
    }
    expect(done).not.toHaveBeenCalled()
    latest.resolve([2])
    await flush()
    expect(done).toHaveBeenCalledOnce()
    expect(dataDone).toHaveBeenCalledTimes(3)
    expect(chart.getIndicators({ id: 'line' })[0].result).toEqual([2])
    if (!oldFirst) { pending.forEach(job => job.resolve([99])); await flush() }
    expect(done).toHaveBeenCalledOnce()
    store.destroy()
  })

  it('does not cancel a presentation-only override on a price tick', async () => {
    const { chart, store, pending } = await fixture()
    vi.spyOn(chart.getIndicators({ id: 'line' })[0], 'shouldUpdate').mockReturnValue({ draw: true, calc: false, sort: false })
    const done = vi.fn()
    chart.overrideIndicator({ id: 'line', visible: false }, undefined, done)
    chart.updateData({ ...bars()[1], close: 20 })
    await flush()
    expect(done).toHaveBeenCalledOnce()
    pending.shift()!.resolve([20])
    await flush()
    expect(done).toHaveBeenCalledOnce()
    store.destroy()
  })

  it.each(['remove', 'recreate', 'replace', 'clear', 'dataset', 'destroy'] as const)('cancels pending override on %s without waiting for old work', async operation => {
    const { chart, store, pending } = await fixture()
    const indicators = store.getIndicatorStore()
    const done = vi.fn()
    chart.overrideIndicator({ id: 'line', calcParams: [2] }, undefined, done)
    const waiting = indicators.override({ id: 'line', calcParams: [3] })
    const settled = vi.fn()
    void waiting.then(settled)
    if (operation === 'remove' || operation === 'recreate') indicators.removeInstances({ id: 'line' })
    if (operation === 'recreate') void indicators.addInstance({ name: 'override-lifecycle', id: 'line' }, 'candle_pane', true)
    if (operation === 'replace') void indicators.addInstance({ name: 'override-lifecycle', id: 'new' }, 'candle_pane', false)
    if (operation === 'clear') store.clear()
    if (operation === 'dataset') chart.applyNewData(bars(), false)
    if (operation === 'destroy') store.destroy()
    await flush()
    expect(settled).toHaveBeenCalledOnce()
    pending.reverse().forEach(job => job.resolve([30]))
    await flush()
    expect(done).not.toHaveBeenCalled()
    store.destroy()
  })

  it('keeps only the latest override notification when parameters are superseded', async () => {
    const { chart, store, pending } = await fixture()
    const previous = vi.fn(), latest = vi.fn()
    chart.overrideIndicator({ id: 'line', calcParams: [2] }, undefined, previous)
    chart.overrideIndicator({ id: 'line', calcParams: [3] }, undefined, latest)
    chart.updateData({ ...bars()[1], close: 20 })
    pending.pop()!.resolve([3])
    await flush()
    expect(previous).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
    pending.forEach(job => job.resolve([99]))
    await flush()
    expect(previous).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
    store.destroy()
  })

  it('suppresses a settled presentation notification superseded before delivery', async () => {
    const { chart, store } = await fixture()
    vi.spyOn(chart.getIndicators({ id: 'line' })[0], 'shouldUpdate').mockReturnValue({ draw: true, calc: false, sort: false })
    const previous = vi.fn(), latest = vi.fn()
    chart.overrideIndicator({ id: 'line', visible: false }, undefined, previous)
    chart.overrideIndicator({ id: 'line', visible: true }, undefined, latest)
    await flush()
    expect(previous).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
    store.destroy()
  })

  it('checks operation validity again after layout reentry', async () => {
    const { chart, store, pending } = await fixture()
    const done = vi.fn()
    chart.overrideIndicator({ id: 'line', calcParams: [2] }, undefined, done)
    vi.mocked(chart.refreshViewportLayout).mockImplementationOnce(() => chart.applyNewData(bars(), false))
    pending.shift()!.resolve([2])
    await flush()
    expect(done).not.toHaveBeenCalled()
    pending.forEach(job => job.resolve([30]))
    await flush()
    expect(done).not.toHaveBeenCalled()
    store.destroy()
  })

  it('does not report successful override when the current calculation fails', async () => {
    const { chart, store, pending } = await fixture()
    const done = vi.fn(), dataDone = vi.fn()
    chart.overrideIndicator({ id: 'line', calcParams: [2] }, undefined, done)
    chart.updateData({ ...bars()[1], close: 20 }, dataDone)
    pending.pop()!.reject(new Error('calculation failed'))
    await flush()
    expect(done).not.toHaveBeenCalled()
    expect(dataDone).toHaveBeenCalledOnce()
    pending.shift()!.resolve([99])
    await flush()
    expect(done).not.toHaveBeenCalled()
    expect(chart.getIndicators({ id: 'line' })[0].result).toEqual([1])
    store.destroy()
  })
})
