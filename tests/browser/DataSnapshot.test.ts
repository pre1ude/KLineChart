import { expect, it, vi } from 'vitest'
import { ActionType, dispose, init, registerIndicator } from '../../src/index'

const bars = (start: number) => Array.from({ length: 4 }, (_, i) => ({ timestamp: start + i * 100, open: 10, high: 20, low: 5, close: 15 }))
const container = () => {
  const element = document.createElement('div')
  element.style.cssText = 'width:900px;height:400px'
  document.body.appendChild(element)
  return element
}
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

it('delivers only committed current data to observers when an observer synchronously updates again', async () => {
  const element = container()
  const chart = init(element)
  try {
    chart.applyNewData(bars(100), false)
    const store = chart.getChartStore()
    let depth = 0
    let maximum = 0
    chart.subscribeAction(ActionType.OnVisibleRangeChange, () => {
      depth++
      maximum = Math.max(maximum, depth)
      const data = chart.getDataList()
      if (data[3].close === 15) chart.updateData({ ...data[3], close: 30 })
      depth--
    })
    const seen: unknown[] = []
    chart.subscribeAction(ActionType.OnVisibleRangeChange, () => {
      const data = chart.getDataList()
      seen.push([data[0].timestamp, data[3].close, store.getVisibleDataList().filter(item => item.data).every(item => item.data === data[item.dataIndex])])
    })
    chart.applyNewData(bars(1000), false)
    expect(chart.getDataList()[0].timestamp).toBe(1000)
    expect(maximum).toBe(1)
    expect(seen.length).toBeGreaterThan(0)
    seen.forEach(snapshot => expect(snapshot).toEqual([1000, 30, true]))
    await nextFrame()
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('shares pending work between updateData and overrideIndicator without waiting for obsolete calculations', async () => {
  const element = container()
  const chart = init(element)
  const pending: Array<(value: Array<{ value: number }>) => void> = []
  registerIndicator({ name: 'unified-browser-async', calcParams: [1], figures: [{ key: 'value', type: 'line' }], calc: () => new Promise<Array<{ value: number }>>(resolve => pending.push(resolve)) })
  try {
    chart.applyNewData(bars(100), false)
    const paneId = chart.createIndicator({ name: 'unified-browser-async', id: 'unified' })!
    pending.shift()!([{ value: 1 }])
    await nextFrame()
    const seen: Array<{ source: string, value: unknown }> = []
    const observe = (source: string) => seen.push({ source, value: chart.getIndicators({ id: 'unified' })[0].result[0] })
    chart.updateData({ ...bars(100)[3], close: 30 }, () => observe('data'))
    const old = pending.shift()!
    chart.overrideIndicator({ id: 'unified', calcParams: [2] }, paneId, () => observe('parameters'))
    pending.shift()!([{ value: 60 }])
    await vi.waitFor(() => expect(seen).toHaveLength(2))
    expect(seen.map(item => item.source).sort()).toEqual(['data', 'parameters'])
    expect(seen.every(item => JSON.stringify(item.value) === JSON.stringify({ value: 60 }))).toBe(true)
    old([{ value: 30 }])
    await nextFrame()
    expect(seen).toHaveLength(2)
    expect(chart.getIndicators({ id: 'unified' })[0].result).toEqual([{ value: 60 }])
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it.each([false, true])('finishes overrideIndicator after a later price tick (old calculation first: %s)', async oldFirst => {
  const element = container()
  const chart = init(element)
  const pending: Array<(value: Array<{ value: number }>) => void> = []
  registerIndicator({ name: 'override-tick-browser', calcParams: [1], figures: [{ key: 'value', type: 'line' }], calc: () => new Promise<Array<{ value: number }>>(resolve => pending.push(resolve)) })
  try {
    chart.applyNewData(bars(100), false)
    const paneId = chart.createIndicator({ name: 'override-tick-browser', id: 'override-tick' })!
    pending.shift()!([{ value: 1 }])
    await nextFrame()
    const seen: unknown[] = []
    chart.overrideIndicator({ id: 'override-tick', calcParams: [2] }, paneId, () => seen.push(chart.getIndicators({ id: 'override-tick' })[0].result[0]))
    const old = pending.shift()!
    chart.updateData({ ...bars(100)[3], close: 30 })
    const latest = pending.shift()!
    if (oldFirst) { old([{ value: 2 }]); await nextFrame() }
    expect(seen).toEqual([])
    latest([{ value: 60 }])
    await vi.waitFor(() => expect(seen).toEqual([{ value: 60 }]))
    if (!oldFirst) { old([{ value: 2 }]); await nextFrame() }
    expect(seen).toEqual([{ value: 60 }])
    expect(chart.getIndicators({ id: 'override-tick' })[0].result).toEqual([{ value: 60 }])
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('finishes pending data work only after the removed indicator pane is detached', async () => {
  const element = container()
  const chart = init(element)
  const pending: Array<(value: number[]) => void> = []
  registerIndicator({ name: 'removed-browser-async', calc: () => new Promise<number[]>(resolve => pending.push(resolve)) })
  try {
    chart.applyNewData(bars(100), false)
    const paneId = chart.createIndicator('removed-browser-async')!
    pending.shift()!([1])
    await nextFrame()
    const snapshots: unknown[] = []
    chart.updateData({ ...bars(100)[3], close: 30 }, () => snapshots.push([chart.getDrawPaneById(paneId), chart.getIndicators({ paneId }).length]))
    chart.removeIndicator(paneId)
    expect(snapshots).toEqual([])
    await vi.waitFor(() => expect(snapshots).toEqual([[undefined, 0]]))
    pending.shift()!([99])
    await nextFrame()
    expect(snapshots).toEqual([[undefined, 0]])
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('keeps ordinary drawing order and rendering after a point observer throws', async () => {
  const element = container()
  const chart = init(element)
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    chart.applyNewData(bars(100), false)
    const points = [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }]
    chart.createOverlay({ id: 'A', name: 'segment', points, zLevel: 10 })
    chart.createOverlay({ id: 'B', name: 'segment', points, zLevel: 20, onPointsChange: () => { throw new Error('observer failed') } })
    chart.overrideOverlay({ id: 'B', zLevel: 0, points: points.map(point => ({ ...point, value: 12 })) })
    await nextFrame()
    expect(chart.getChartStore().getOverlayStore().getInstances().map(overlay => overlay.id)).toEqual(['B', 'A'])
    expect(chart.getOverlayById('B')!.points[0].value).toBe(12)
    expect(errors).toHaveBeenCalledOnce()
    expect(chart.getConvertPictureUrl(true)).toMatch(/^data:image\//)
  } finally { errors.mockRestore(); dispose(chart); element.remove() }
  await nextFrame()
})

it('refreshes drawing coordinates when updateData submits a timestamp modified in place', async () => {
  const element = container()
  const chart = init(element)
  try {
    chart.applyNewData(bars(100), false)
    const id = chart.createOverlay({ name: 'horizontalStraightLine', points: [{ timestamp: 450, value: 10 }] })!
    const overlay = chart.getOverlayById(id)!
    const overlays = chart.getChartStore().getOverlayStore()
    expect(overlays.getProjectedPoints(overlay)).toBeUndefined()
    const latest = chart.getDataList()[3]
    latest.timestamp = 500
    chart.updateData(latest)
    await nextFrame()
    expect(overlays.getProjectedPoints(overlay)?.[0].dataIndex).toBe(3)
    expect(chart.externalToInternal(overlay.points[0]).dataIndex).toBe(3)
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('waits for readable current indicator results and cancels obsolete callbacks in a real chart', async () => {
  const element = container()
  const chart = init(element)
  const pending: Array<(result: Array<{ value: number }>) => void> = []
  const name = 'snapshot-browser-async'
  registerIndicator({ name, figures: [{ key: 'value', title: 'Value:', type: 'line' }], calc: () => new Promise<Array<{ value: number }>>(resolve => pending.push(resolve)) })
  try {
    chart.applyNewData(bars(100), false)
    chart.createIndicator(name)
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    pending.shift()!([{ value: 1 }])
    await nextFrame()
    const callbacks: number[] = []
    const ready = () => callbacks.push((chart.getChartStore().getIndicatorStore().getIndicatorsByFilter({ name })[0].result[0] as { value: number }).value)
    chart.replaceData(bars(100), false, ready)
    const a = pending.shift()!
    expect(chart.getChartStore().getIndicatorStore().getIndicatorsByFilter({ name })[0].result).toEqual([{ value: 1 }])
    chart.replaceData(bars(200), false, ready)
    const b = pending.shift()!
    expect(chart.getChartStore().getIndicatorStore().getIndicatorsByFilter({ name })[0].result).toEqual([])
    a([{ value: 15 }])
    await nextFrame()
    expect(callbacks).toEqual([])
    b([{ value: 30 }])
    await vi.waitFor(() => expect(callbacks).toEqual([30, 30]))
    chart.replaceData(bars(300), false, () => callbacks.push(-1))
    const old = pending.shift()!
    chart.applyNewData(bars(400), false, ready)
    const latest = pending.shift()!
    latest([{ value: 40 }])
    await vi.waitFor(() => expect(callbacks).toEqual([30, 30, 40]))
    old([{ value: 99 }])
    await nextFrame()
    expect(callbacks).toEqual([30, 30, 40])
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it.each(['clear', 'destroy'] as const)('does not finish an obsolete indicator creation after %s', async change => {
  const element = container()
  const chart = init(element)
  let finish!: (result: number[]) => void
  const name = `snapshot-create-${change}`
  registerIndicator({ name, calc: () => new Promise<number[]>(resolve => { finish = resolve }) })
  const callback = vi.fn()
  chart.applyNewData(bars(100), false)
  chart.createIndicator(name, false, undefined, callback)
  const layout = vi.spyOn(chart.getChartStore().getChart(), 'refreshPaneLayout')
  if (change === 'clear') chart.clearData()
  else dispose(chart)
  layout.mockClear()
  finish([1])
  await nextFrame()
  expect(layout).not.toHaveBeenCalled()
  expect(callback).not.toHaveBeenCalled()
  if (change === 'clear') dispose(chart)
  element.remove()
})
