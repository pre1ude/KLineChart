import { describe, expect, it, vi } from 'vitest'
import Chart from '../Chart'
import ChartStore from './ChartStore'
import { registerIndicator } from '../extension/indicator'

const bars = () => [100, 200].map(timestamp => ({ timestamp, open: 10, high: 20, low: 5, close: 15 }))
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

function fixture(existingPane = false) {
  const pane = {
    getId: () => 'indicator', getDefaultYScaleId: () => 'default',
    getYScaleById: () => ({}), getYScales: () => [],
    setHeightSpec: vi.fn(), setBounding: vi.fn()
  }
  const chart = Object.assign(Object.create(Chart.prototype), {
    refreshViewportLayout: vi.fn(), refreshPaneLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn(),
    getDrawPaneById: () => existingPane ? pane : undefined,
    _createPane: () => pane, _setPaneOptions: vi.fn()
  }) as Chart
  const store = new ChartStore(chart)
  Reflect.set(chart, '_chartStore', store)
  store.applyDataSnapshot(bars(), false)
  const pending: Array<(result: number[]) => void> = []
  registerIndicator({ name: 'creation-lifecycle', calcParams: [1], calc: () => new Promise<number[]>(resolve => pending.push(resolve)) })
  const done = vi.fn()
  chart.createIndicator({ name: 'creation-lifecycle', id: 'line' }, true, { id: 'indicator', height: 120 }, done)
  return { chart, store, pending, done, applied: Reflect.get(chart, '_setPaneOptions') as ReturnType<typeof vi.fn> }
}

describe('indicator creation completion', () => {
  it.each([false, true])('follows a same-dataset tick without waiting for an obsolete calculation (old first: %s)', async oldFirst => {
    const { chart, store, pending, done } = fixture()
    chart.updateData({ ...bars()[1], close: 30 })
    if (oldFirst) { pending[0]([15]); await flush() }
    expect(done).not.toHaveBeenCalled()
    pending[1]([30])
    await flush()
    expect(done).toHaveBeenCalledOnce()
    expect(chart.getIndicators({ id: 'line' })[0].result).toEqual([30])
    if (!oldFirst) { pending[0]([15]); await flush() }
    expect(done).toHaveBeenCalledOnce()
    store.destroy()
  })

  it('applies existing-pane options after a replacement calculation completes', async () => {
    const { chart, store, pending, applied } = fixture(true)
    chart.updateData({ ...bars()[1], close: 30 })
    pending[1]([30])
    await flush()
    expect(applied).toHaveBeenCalledExactlyOnceWith({ id: 'indicator', height: 120 }, false)
    pending[0]([15])
    await flush()
    expect(applied).toHaveBeenCalledOnce()
    store.destroy()
  })

  it('follows parameter recalculation during creation', async () => {
    const { store, pending, done } = fixture()
    const updating = store.getIndicatorStore().override({ id: 'line', calcParams: [2] })
    pending[1]([2])
    await updating
    await flush()
    expect(done).toHaveBeenCalledOnce()
    pending[0]([1])
    await flush()
    expect(done).toHaveBeenCalledOnce()
    store.destroy()
  })

  it.each([false, true])('preserves pending OHLC work when setting isTimeShare=%s', async isTimeShare => {
    const { chart, store, pending, done } = fixture()
    const dataVersion = store.getDataVersion()
    const timeVersion = store.getTimeIndexVersion()
    store.setOptions({ isTimeShare, timeShareTicks: ['09:30', '09:31'] })
    expect(pending).toHaveLength(1)
    pending[0]([15])
    await flush()
    expect(chart.getIndicators({ id: 'line' })[0].result).toEqual([15])
    expect(done).toHaveBeenCalledOnce()
    expect(store.getDataVersion()).toBe(dataVersion)
    expect(store.getTimeIndexVersion()).toBeGreaterThan(timeVersion)
    store.destroy()
  })

  it('cancels completion if the creation layout switches datasets', async () => {
    const { chart, store, pending, done } = fixture()
    Reflect.set(chart, 'refreshPaneLayout', () => chart.applyNewData(bars(), false))
    pending[0]([15])
    await flush()
    expect(done).not.toHaveBeenCalled()
    pending[1]([30])
    await flush()
    expect(done).not.toHaveBeenCalled()
    store.destroy()
  })

  it.each(['dataset', 'clear', 'remove', 'replace', 'destroy'] as const)('cancels creation on %s and ignores its late calculation', async operation => {
    const { chart, store, pending, done } = fixture()
    const indicators = store.getIndicatorStore()
    if (operation === 'dataset') chart.applyNewData(bars(), false)
    else if (operation === 'clear') store.clear()
    else if (operation === 'remove') indicators.removeInstances({ id: 'line' })
    else if (operation === 'replace') void indicators.addInstance({ name: 'creation-lifecycle', id: 'replacement' }, 'indicator', false)
    else store.destroy()
    for (const finish of [...pending].reverse()) { finish([30]); await flush() }
    expect(done).not.toHaveBeenCalled()
    store.destroy()
  })
})
