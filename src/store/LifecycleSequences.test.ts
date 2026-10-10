import { expect, it, vi } from 'vitest'
import Chart from '../Chart'
import ChartStore from './ChartStore'
import { registerIndicator } from '../extension/indicator'

const bar = (timestamp: number, close = 10) => ({ timestamp, open: 10, high: 40, low: 5, close })
const bars = () => [100, 200, 300].map(timestamp => bar(timestamp))
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve() }
function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
function fixture() {
  const chart = Object.assign(Object.create(Chart.prototype), { getChartStore: () => store, refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn() }) as Chart
  const store = new ChartStore(chart)
  Reflect.set(chart, '_chartStore', store)
  store.mainWidth = 800
  store.applyDataSnapshot(bars(), false)
  return { chart, store }
}

it.each([7, 31, 97].flatMap(seed => [false, true].map(oldFirst => ({ seed, oldFirst }))))('settles only current indicator work across interleaved operations ($seed, old first: $oldFirst)', async ({ seed, oldFirst }) => {
  const { store } = fixture()
  const jobs: Array<{ finish: (value: string[]) => void, value: string }> = []
  const signature = (data: ReturnType<typeof bars>, parameter: number) => `${data[0]?.timestamp}:${data[data.length - 1]?.close}:${parameter}`
  const name = `sequence-${seed}-${oldFirst}`
  registerIndicator({ name, calcParams: [1], calc: (data, indicator) => new Promise<string[]>(finish => {
    jobs.push({ finish, value: signature(data, indicator.calcParams[0] as number) })
  }) })
  const indicators = store.getIndicatorStore()
  let id = 'line-0'
  let parameter = 1
  let data = bars()
  void indicators.addInstance({ name, id }, 'candle_pane', true)
  const seen: string[] = []
  const operations = ['tick', 'params', 'replace', 'remove-create', 'dataset', 'clear-reload'] as const
  try {
    for (let round = 0; round < 4; round++) {
      const before = seen.length
      let expected: string[] = []
      for (const [step, operation] of shuffled(operations, seed + round).entries()) {
        const label = `${round}:${step}`
        if (operation === 'tick') {
          data = data.map((point, index) => index === data.length - 1 ? { ...point, close: point.close + 1 } : point)
          expected.push(label)
          store.addData(data[data.length - 1], undefined, undefined, () => seen.push(label))
        } else if (operation === 'params') {
          parameter++
          void indicators.override({ id, calcParams: [parameter] })
        } else if (operation === 'replace' || operation === 'remove-create') {
          if (operation === 'remove-create') indicators.removeInstances({ id })
          id = `line-${round}-${step}`
          parameter = 1
          void indicators.addInstance({ name, id }, 'candle_pane', operation === 'remove-create')
        } else {
          if (operation === 'clear-reload') store.clear()
          data = data.map(point => ({ ...point, timestamp: point.timestamp + 1000 }))
          expected = [label]
          store.applyDataSnapshot(data, false, () => seen.push(label))
        }
      }
      const latest = jobs.pop()!
      const old = jobs.splice(0)
      const settleOld = async () => {
        for (const job of shuffled(old, seed + round)) { job.finish([job.value]); await flush() }
      }
      if (oldFirst) { await settleOld(); expect(seen.slice(before)).toEqual([]) }
      latest.finish([latest.value])
      await flush()
      expect(store.getTaskScheduler().hasPending()).toBe(false)
      expect(indicators.getInstances('candle_pane')[0].result).toEqual([signature(data, parameter)])
      expect(seen.slice(before)).toEqual(expected)
      if (!oldFirst) await settleOld()
      expect(seen.slice(before)).toEqual(expected)
      expect(indicators.getInstances('candle_pane')[0].result).toEqual([signature(data, parameter)])
    }
  } finally { store.destroy() }
})
