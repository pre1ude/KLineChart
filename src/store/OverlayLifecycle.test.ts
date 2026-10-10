import { expect, it, vi } from 'vitest'
import { Overlay } from '../component/Overlay'
import segment from '../extension/overlay/segment'
import ChartStore from './ChartStore'
import type Chart from '../Chart'

it('finishes ordinary sorting and redraw before notifying a throwing point observer', () => {
  const redraw = vi.fn()
  const store = new ChartStore({ updatePane: redraw } as unknown as Chart).getOverlayStore()
  const points = [{ timestamp: 1, value: 1 }, { timestamp: 2, value: 2 }]
  const observed: Array<{ order: string[], redrawn: boolean }> = []
  store.addInstances([
    { name: 'segment', id: 'A', points, zLevel: 10 },
    { name: 'segment', id: 'B', points, zLevel: 20, onPointsChange() {
      observed.push({ order: store.getInstances().map(overlay => overlay.id), redrawn: redraw.mock.calls.length > 0 })
      throw new Error('observer failed')
    } }
  ])
  redraw.mockClear()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(() => store.update({ id: 'B' }, { zLevel: 0, points: points.map(point => ({ ...point, value: 3 })) })).not.toThrow()
    expect(observed).toEqual([{ order: ['B', 'A'], redrawn: true }])
    expect(store.getInstances().map(overlay => overlay.id)).toEqual(['B', 'A'])
    expect(error).toHaveBeenCalledOnce()
  } finally { error.mockRestore() }
})

it('commits an entire ordinary batch before observers and skips a removed instance notification', () => {
  const store = new ChartStore({ updatePane: vi.fn() } as unknown as Chart).getOverlayStore()
  const points = [{ timestamp: 1, value: 1 }, { timestamp: 2, value: 2 }]
  const next = vi.fn()
  const observed: number[] = []
  store.addInstances([
    { name: 'segment', id: 'first', points, onPointsChange() {
      observed.push(store.getInstanceById('second')!.points[0].value)
      store.removeInstance({ id: 'second' })
    } },
    { name: 'segment', id: 'second', points, onPointsChange: next }
  ])
  store.update({}, { points: points.map(point => ({ ...point, value: 3 })) })
  expect(observed).toEqual([3])
  expect(next).not.toHaveBeenCalled()
})

it('constructs candidates without publishing creation', () => {
  const created = vi.fn()
  new Overlay(segment, { id: 'candidate', groupId: 'candidate', paneId: 'candle_pane', onCreated: created })
  expect(created).not.toHaveBeenCalled()
})

it('notifies ordinary creation after every candidate is installed', () => {
  const store = new ChartStore({ updatePane: vi.fn() } as unknown as Chart).getOverlayStore()
  const seen: string[] = []
  store.addInstances(['first', 'second'].map(id => ({ name: 'segment', id, points: [{ timestamp: 1, value: 1 }, { timestamp: 2, value: 2 }], onCreated() {
    expect(store.getInstanceById(id)).toBe(this)
    expect(store.getInstanceById('second')).toBeDefined()
    seen.push(id)
  } })))
  expect(seen).toEqual(['first', 'second'])
})

it('isolates lifecycle observer failures without preventing later notifications', () => {
  const store = new ChartStore({ updatePane: vi.fn() } as unknown as Chart).getOverlayStore()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const next = vi.fn()
  const points = [{ timestamp: 1, value: 1 }, { timestamp: 2, value: 2 }]
  store.addInstances([
    { name: 'segment', id: 'first', points, onCreated() { throw new Error('observer failed') } },
    { name: 'segment', id: 'second', points, onCreated: next }
  ])
  expect(store.getInstanceById('first')).toBeDefined()
  expect(store.getInstanceById('second')).toBeDefined()
  expect(next).toHaveBeenCalledOnce()
  expect(error).toHaveBeenCalledOnce()
  error.mockRestore()
})

it('does not notify an instance removed by an earlier creation callback', () => {
  const store = new ChartStore({ updatePane: vi.fn() } as unknown as Chart).getOverlayStore()
  const next = vi.fn()
  const points = [{ timestamp: 1, value: 1 }, { timestamp: 2, value: 2 }]
  store.addInstances([
    { name: 'segment', id: 'first', points, onCreated() { store.removeInstance({ id: 'second' }) } },
    { name: 'segment', id: 'second', points, onCreated: next }
  ])
  expect(store.getInstanceById('second')).toBeUndefined()
  expect(next).not.toHaveBeenCalled()
})

it.each(['reload', 'clear', 'destroy'] as const)('delivers every committed removal when the first observer triggers %s', change => {
  const chart = { refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn() }
  const store = new ChartStore(chart as unknown as Chart)
  const data = [100, 200].map(timestamp => ({ timestamp, open: 10, high: 20, low: 5, close: 15 }))
  store.applyDataSnapshot(data, false)
  const overlays = store.getOverlayStore()
  const removed: string[] = []
  overlays.addInstances(['first', 'second'].map(id => ({ id, name: 'horizontalStraightLine', points: [{ timestamp: 100, value: 10 }], onRemoved() {
    removed.push(id)
    if (id !== 'first') return
    expect(overlays.getInstances()).toEqual([])
    if (change === 'reload') store.applyDataSnapshot(data, false)
    else if (change === 'clear') store.clear()
    else store.destroy()
  } })))
  overlays.removeInstance()
  expect(removed).toEqual(['first', 'second'])
  store.destroy()
  expect(removed).toEqual(['first', 'second'])
})

it('delivers creation notifications for live instances after a previous observer reloads data', () => {
  const store = new ChartStore({ refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn() } as unknown as Chart)
  const seen: string[] = []
  const data = [{ timestamp: 100, open: 10, high: 20, low: 5, close: 15 }]
  store.getOverlayStore().addInstances(['first', 'second'].map(id => ({ id, name: 'horizontalStraightLine', points: [{ timestamp: 100, value: 10 }], onCreated() {
    seen.push(id)
    if (id === 'first') store.applyDataSnapshot(data, false)
    expect(store.getOverlayStore().getInstanceById(id)).toBe(this)
  } })))
  expect(seen).toEqual(['first', 'second'])
  store.destroy()
})
