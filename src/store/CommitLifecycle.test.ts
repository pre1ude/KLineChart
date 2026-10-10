import { describe, expect, it, vi } from 'vitest'
import type Chart from '../Chart'
import ChartStore from './ChartStore'
import { ActionType } from '../common/Action'
import { registerIndicator } from '../extension/indicator'
import { LoadDataType } from '../common/LoadDataCallback'

const bars = (start = 100, close = 15) => [0, 1, 2].map(i => ({ timestamp: start + i * 100, open: 10, high: 40, low: 5, close }))
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve() }
function fixture() {
  const chart = { refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn() }
  const store = new ChartStore(chart as unknown as Chart)
  store.mainWidth = 800
  store.applyDataSnapshot(bars(), false)
  return { store, chart }
}

describe('committed data notifications', () => {
  it('supersedes remaining subscribers when a newer notification of the same type is queued', () => {
    const { store } = fixture()
    const actions = store.getActionStore()
    const range = store.getTimeScaleStore().getVisibleRange()
    const seen: number[] = []
    actions.subscribe(ActionType.OnVisibleRangeChange, value => {
      if (value.from === 1) actions.execute(ActionType.OnVisibleRangeChange, { ...range, from: 2 })
    })
    actions.subscribe(ActionType.OnVisibleRangeChange, value => seen.push(value.from))
    actions.execute(ActionType.OnVisibleRangeChange, { ...range, from: 1 })
    expect(seen).toEqual([2])
    store.destroy()
  })

  it.each(['snapshot', 'replace', 'prepend'] as const)('notifies only after %s data and visible indices agree', operation => {
    const { store } = fixture()
    const seen: Array<{ first: number, consistent: boolean }> = []
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, () => {
      const data = store.getDataList()
      seen.push({ first: data[0]?.timestamp, consistent: store.getVisibleDataList().filter(item => item.data).every(item => item.data === data[item.dataIndex]) })
    })
    if (operation === 'snapshot') store.applyDataSnapshot(bars(1000), false)
    else if (operation === 'replace') store.replaceData(bars(1000))
    else store.addData([{ ...bars()[0], timestamp: 50 }], LoadDataType.Backward)
    expect(seen).toEqual([{ first: operation === 'prepend' ? 50 : 1000, consistent: true }])
    store.destroy()
  })

  it('cancels stale range observers after same-dataset reentry without nested delivery', () => {
    const { store } = fixture()
    const observed: number[] = []
    let depth = 0
    let maximum = 0
    const first = () => {
      depth++
      maximum = Math.max(maximum, depth)
      if (store.getDataList()[2].close === 20) store.addData({ ...bars()[2], close: 30 })
      depth--
    }
    const second = () => observed.push(store.getDataList()[2].close)
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, first)
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, second)
    store.addData({ ...bars()[2], close: 20 })
    expect(maximum).toBe(1)
    expect(observed).toEqual([30])
    store.destroy()
  })

  it('isolates a failing action observer and still finishes the committed update', () => {
    const { store } = fixture()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const observer = vi.fn()
    const done = vi.fn()
    const fail = () => { throw new Error('observer') }
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, fail)
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, observer)
    try {
      expect(() => store.replaceData(bars(1000), false, done)).not.toThrow()
      expect(observer).toHaveBeenCalledOnce()
      expect(done).toHaveBeenCalledOnce()
      expect(errors).toHaveBeenCalledOnce()
    } finally { errors.mockRestore(); store.destroy() }
  })
})

describe('one indicator task lifecycle', () => {
  async function pendingFixture() {
    const { store, chart } = fixture()
    const pending: Array<(value: number[]) => void> = []
    const calc = vi.fn(() => new Promise<number[]>(resolve => pending.push(resolve)))
    registerIndicator({ name: 'commit-lifecycle', calcParams: [1], calc })
    const indicators = store.getIndicatorStore()
    const adding = indicators.addInstance({ id: 'line', name: 'commit-lifecycle' }, 'candle_pane', true)
    pending.shift()!([1])
    await adding
    await flush()
    return { store, chart, indicators, pending, calc }
  }

  it.each([false, true])('parameter recalculation supersedes pending data work (old first: %s)', async oldFirst => {
    const { store, indicators, pending } = await pendingFixture()
    const done = vi.fn()
    store.addData({ ...bars()[2], close: 20 }, undefined, undefined, done)
    const old = pending.shift()!
    const overriding = indicators.override({ id: 'line', calcParams: [2] })
    const latest = pending.shift()!
    if (oldFirst) { old([10]); await flush(); expect(done).not.toHaveBeenCalled() }
    latest([20])
    await overriding
    await flush()
    expect(done).toHaveBeenCalledOnce()
    expect(indicators.getInstances('candle_pane')[0].result).toEqual([20])
    if (!oldFirst) { old([10]); await flush() }
    expect(done).toHaveBeenCalledOnce()
    store.destroy()
  })

  it('does not start a calculation retired before the enclosing commit finishes', async () => {
    const { store } = fixture()
    const calc = vi.fn(() => [1])
    registerIndicator({ name: 'retired-before-start', calc })
    let adding!: Promise<boolean>
    store.batchEffects(() => {
      adding = store.getIndicatorStore().addInstance({ name: 'retired-before-start', id: 'line' }, 'candle_pane', true)
      store.clear()
    })
    expect(await adding).toBe(false)
    expect(calc).not.toHaveBeenCalled()
    store.destroy()
  })

  it('registers calculation ownership before user calculation can update data again', async () => {
    const { store } = fixture()
    const pending: Array<{ close: number, finish: (value: number[]) => void }> = []
    let reenter = false
    registerIndicator({ name: 'calculation-reentry', calc: data => {
      const close = data[2].close
      if (reenter) { reenter = false; store.addData({ ...bars()[2], close: 30 }) }
      return new Promise<number[]>(finish => pending.push({ close, finish }))
    } })
    const indicators = store.getIndicatorStore()
    const adding = indicators.addInstance({ name: 'calculation-reentry', id: 'line' }, 'candle_pane', true)
    pending.shift()!.finish([1])
    await adding
    await flush()
    reenter = true
    const done = vi.fn()
    store.addData({ ...bars()[2], close: 20 }, undefined, undefined, done)
    pending.find(job => job.close === 30)!.finish([30])
    await flush()
    expect(done).toHaveBeenCalledOnce()
    expect(indicators.getInstances('candle_pane')[0].result).toEqual([30])
    pending.find(job => job.close === 20)!.finish([20])
    await flush()
    expect(done).toHaveBeenCalledOnce()
    store.destroy()
  })

  it('keeps remaining completion callbacks queued when the first changes indicator parameters', async () => {
    const { store, indicators, pending } = await pendingFixture()
    const seen: string[] = []
    store.addData({ ...bars()[2], close: 20 }, undefined, undefined, () => {
      seen.push('A')
      void indicators.override({ id: 'line', calcParams: [2] })
    })
    const old = pending.shift()!
    store.addData({ ...bars()[2], close: 30 }, undefined, undefined, () => seen.push('B'))
    pending.shift()!([30])
    await flush()
    expect(seen).toEqual(['A'])
    pending.shift()!([60])
    await flush()
    expect(seen).toEqual(['A', 'B'])
    old([20])
    await flush()
    expect(seen).toEqual(['A', 'B'])
    store.destroy()
  })

  it('always retires tasks on destruction even when a drawing removal observer fails', async () => {
    const { store, indicators, chart, pending } = await pendingFixture()
    const done = vi.fn()
    const instance = indicators.getInstances('candle_pane')[0]
    store.addData({ ...bars()[2], close: 30 }, undefined, undefined, done)
    store.getOverlayStore().addInstances([{ name: 'horizontalStraightLine', points: [{ timestamp: 100, value: 10 }], onRemoved() { throw new Error('removal') } }])
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    chart.refreshViewportLayout.mockClear()
    try {
      expect(() => store.destroy()).not.toThrow()
      expect(errors).toHaveBeenCalledOnce()
      pending.shift()!([30])
      await flush()
      expect(instance.result).toEqual([])
      expect(store.getTaskScheduler().hasPending()).toBe(false)
      expect(done).not.toHaveBeenCalled()
      expect(chart.refreshViewportLayout).not.toHaveBeenCalled()
    } finally { errors.mockRestore() }
  })
})
