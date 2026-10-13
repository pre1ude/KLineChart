import { describe, expect, it, vi } from 'vitest'

import type Chart from '../Chart'
import type { Point } from '../common/Point'
import { LoadDataType } from '../common/LoadDataCallback'
import ChartStore from './ChartStore'

function data(timestamps: number[]) {
  return timestamps.map(timestamp => ({ timestamp, open: 10, high: 20, low: 5, close: 15 }))
}

function fixture(points: Point[], timestamps = [100, 200], name = 'segment') {
  const store = new ChartStore({
    refreshViewportLayout: vi.fn(),
    updatePane: vi.fn()
  } as unknown as Chart)
  store.addData(data(timestamps), LoadDataType.Init)
  const overlays = store.getOverlayStore()
  const [id] = overlays.addInstances([{ name, paneId: 'candle', points }])
  const overlay = overlays.getInstanceById(id!)!
  return { store, overlays, overlay }
}

describe('Overlay integer offsets', () => {
  it.each([0.5, -0.5, NaN, Infinity])('rejects offset %s on creation and update without changing existing state', (offset) => {
    const points = [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }]
    const { overlays, overlay } = fixture(points)
    const invalid = [{ timestamp: 100, offset, value: 30 }, points[1]]

    expect(overlays.addInstances([{ name: 'segment', paneId: 'candle', points: invalid }])).toEqual([undefined])
    expect(overlays.getInstances()).toEqual([overlay])
    expect(overlays.update({ id: overlay.id }, { visible: false, points: invalid })).toBe(false)
    expect(overlay.points).toEqual(points)
    expect(overlay.visible).toBe(true)
    overlay.update({ visible: false, points: invalid })
    expect(overlay.points).toEqual(points)
    expect(overlay.visible).toBe(true)
  })

  it.each([undefined, 0, -2, 2])('accepts omitted or integer offset %s', (offset) => {
    const points = [{ timestamp: 100, offset, value: 10 }, { timestamp: 200, value: 20 }]
    const { store, overlays, overlay } = fixture(points)
    expect(overlay.points).toEqual(points)
    expect(store.getOverlayStore().getProjectedPoints(overlay)?.[0].logicalIndex).toBe(offset ?? 0)
    expect(overlays.exportOverlay(overlay.id)?.points).toEqual(points)
  })

  it('rejects fractional drawing and control-point inputs instead of rounding them', () => {
    const { overlay } = fixture([])
    overlay.updateDrawPoint({ timestamp: 100, offset: 0.5, value: 10 })
    expect(overlay.points).toEqual([])
    overlay.updateDrawPoint({ timestamp: 100, offset: -1, value: 10 })
    overlay.onDragMoveControlPoint({ timestamp: 200, offset: -0.5, value: 20 }, 0)
    expect(overlay.points).toEqual([{ timestamp: 100, offset: -1, value: 10 }])
  })

  it('does not produce horizontal coordinates or time anchors from fractional positions', () => {
    const { store } = fixture([])
    expect(store.externalToInternal({ timestamp: 100, offset: 0.5, value: 10 })).toEqual({ value: 10 })
    for (const logicalIndex of [-0.5, 0.5, 2.5]) {
      expect(store.internalToExternal({ logicalIndex, value: 10 })).toEqual({ value: 10 })
    }
  })
})

describe('Actual bar timestamp conversion', () => {
  it('uses one internal point shape and round-trips it after prepend', () => {
    const point = { timestamp: 200, value: 12 }
    const { store, overlays, overlay } = fixture([point], [100, 200], 'verticalStraightLine')
    const internal = store.externalToInternal(point)
    expect(internal).toEqual({ logicalIndex: 1, value: 12 })
    expect(internal).not.toHaveProperty('dataIndex')
    store.addData(data([50]), LoadDataType.Backward)
    expect(store.externalToInternal(point)).toEqual(internal)
    expect(overlays.getProjectedPoints(overlay)).toEqual([internal])
    expect(store.getTimeIndex().logicalToDataIndex(internal.logicalIndex!)).toBe(2)
    expect(store.internalToExternal(internal)).toEqual({ ...point, offset: 0 })
  })

  it('resolves logical coordinates outside both loaded boundaries after prepend', () => {
    const { store } = fixture([], [100, 200])
    store.addData(data([50]), LoadDataType.Backward)
    for (const logicalIndex of [-3, -1, 0, 1, 4]) {
      const internal = { logicalIndex, value: 12 }
      expect(store.externalToInternal(store.internalToExternal(internal))).toEqual(internal)
    }
    expect(store.internalToExternal({ logicalIndex: -3, value: 12 })).toEqual({ timestamp: 50, offset: -2, value: 12 })
    expect(store.internalToExternal({ logicalIndex: 4, value: 12 })).toEqual({ timestamp: 200, offset: 3, value: 12 })
  })

  it('round-trips every loaded time-share bar even when intermediate ticks have no data', () => {
    const time = (minute: number) => new Date(2026, 8, 18, 9, minute).getTime()
    const timestamps = [time(30), time(32), time(33)]
    const { store } = fixture([], timestamps)
    store.setOptions({ isTimeShare: true, timeShareTicks: ['09:30', '09:31', '09:32', '09:33'] })

    timestamps.forEach((timestamp, logicalIndex) => {
      const point = store.internalToExternal({ logicalIndex, value: 10 })
      expect(point).toEqual({ timestamp, offset: 0, value: 10 })
      expect(store.externalToInternal(point)).toEqual({ logicalIndex, value: 10 })
    })
    for (const logicalIndex of [-2, 3, 5]) {
      const point = store.internalToExternal({ logicalIndex, value: 10 })
      expect(store.externalToInternal(point)).toEqual({ logicalIndex, value: 10 })
    }
  })
})

describe('Overlay time-point persistence', () => {
  it('keeps boundary anchors after new bars reach the target, replacement and prepend', () => {
    const points = [
      { timestamp: 100, value: 10 },
      { timestamp: 200, offset: 2, value: 20 }
    ]
    const { store, overlays, overlay } = fixture(points)

    store.addData(data([300, 400]), LoadDataType.Forward)
    expect(overlays.exportOverlay(overlay.id)?.points).toEqual(points)
    store.replaceData(data([100, 200, 300, 400]))
    expect(overlay.points).toEqual(points)
    store.addData(data([50]), LoadDataType.Backward)
    expect(overlay.points).toEqual(points)
    expect(overlays.exportOverlay(overlay.id)?.points).toEqual(points)
  })

  it('retains and exports unresolvable points independently of the loaded window', () => {
    const points = [
      { timestamp: 300, value: 10 },
      { timestamp: 400, offset: 1, value: 20 }
    ]
    const { store, overlays, overlay } = fixture(points)

    expect(overlay.isCompleted()).toBe(true)
    expect(overlays.exportOverlay(overlay.id)?.points).toEqual(points)
    expect(store.getOverlayStore().getProjectedPoints(overlay)).toBeUndefined()
    store.replaceData(data([300, 400]))
    expect(overlay.points).toEqual(points)
    expect(store.getOverlayStore().getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([0, 2])
    store.clear()
    expect(store.getOverlayStore().getProjectedPoints(overlay)).toBeUndefined()
    expect(overlays.exportOverlay(overlay.id)?.points).toEqual(points)
  })

  it('keeps committed drawing points and drawing state when data is unavailable', () => {
    const points = [{ timestamp: 300, offset: -1, value: 10 }]
    const { store, overlays, overlay } = fixture(points)

    expect(overlay.points).toEqual(points)
    expect(overlay.isDrawing()).toBe(true)
    expect(overlay.currentStep).toBe(1)
    store.replaceData(data([300, 400]))
    expect(overlay.points).toEqual(points)
    expect(overlays.getProgressOverlay()).toBe(overlay)
    expect(overlay.currentStep).toBe(1)
  })

  it('owns imported and exported points without sharing mutable point objects', () => {
    const points = [{ timestamp: 100, value: 10 }, { timestamp: 200, offset: 2, value: 20 }]
    const { store, overlays, overlay } = fixture(points)
    points[0].timestamp = 900
    const exported = overlays.exportOverlay(overlay.id)!
    exported.points[1].offset = 9
    expect(overlay.points).toEqual([{ timestamp: 100, value: 10 }, { timestamp: 200, offset: 2, value: 20 }])

    overlays.update({ id: overlay.id }, { points: [{ timestamp: 100, offset: -2, value: 5 }, { timestamp: 200, value: 7 }] })
    expect(store.getOverlayStore().getProjectedPoints(overlay)).toEqual([{ logicalIndex: -2, value: 5 }, { logicalIndex: 1, value: 7 }])
    expect(overlays.exportOverlay(overlay.id)?.points).toEqual(overlay.points)
  })
})

describe('Overlay projection cache', () => {
  it.each(['latest', 'history'] as const)('invalidates time lookups when a submitted %s bar was modified in place', position => {
    const target = position === 'latest' ? 350 : 150
    const { store, overlays, overlay } = fixture([{ timestamp: target, value: 10 }], [100, 200, 300], 'horizontalStraightLine')
    overlays.getProjectedPoints(overlay)
    const bar = store.getDataList()[position === 'latest' ? 2 : 0]
    bar.timestamp = position === 'latest' ? 400 : 175
    store.addData(bar)
    expect(overlays.getProjectedPoints(overlay)?.[0].logicalIndex).toBe(position === 'latest' ? 2 : undefined)
    const version = store.getTimeIndexVersion()
    bar.close++
    store.addData(bar)
    expect(store.getTimeIndexVersion()).toBe(version)
    expect(overlays.getProjectedPoints(overlay)?.[0].logicalIndex).toBe(store.externalToInternal(overlay.points[0]).logicalIndex)
  })

  it('retains ordinary time lookups across latest, historical and full-snapshot price updates', () => {
    const { store, overlays, overlay } = fixture([{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }])
    const lookup = vi.spyOn(store, 'externalToInternal')
    overlays.getProjectedPoints(overlay)
    const revision = store.getTimeIndex().getRevision()
    lookup.mockClear()
    store.addData({ ...store.getDataList()[1], close: 25 })
    store.addData({ ...store.getDataList()[0], close: 15 })
    store.replaceData(store.getDataList().map(bar => ({ ...bar, close: 30 })))
    expect(store.getDataList().map(bar => bar.close)).toEqual([30, 30])
    expect(store.getTimeIndex().getRevision()).toBe(revision)
    expect(overlays.getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([0, 1])
    expect(lookup).not.toHaveBeenCalled()
  })

  it('does not retain chart services in an overlay instance', () => {
    const { overlays, overlay } = fixture([{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }])
    expect(() => JSON.stringify(overlay)).not.toThrow()
    const serialized = JSON.stringify(overlay)
    overlays.getProjectedPoints(overlay)
    expect(JSON.stringify(overlay)).toBe(serialized)
    expect(JSON.parse(JSON.stringify(overlay)).points).toEqual(overlay.points)
  })

  it('can update a spread instance without traversing the chart object graph', () => {
    const { overlays, overlay } = fixture([{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }])
    expect(() => overlays.update({ id: overlay.id }, { ...overlay, visible: false })).not.toThrow()
    expect(overlay.visible).toBe(false)
    expect(overlay.points).toEqual([{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }])
  })

  it('reuses time lookups across redraws and price edits while returning fresh geometry', () => {
    const { store, overlay } = fixture([{ timestamp: 100, value: 10 }, { timestamp: 200, offset: 1, value: 20 }])
    const lookup = vi.spyOn(store, 'externalToInternal')
    const first = store.getOverlayStore().getProjectedPoints(overlay)!
    expect(first.map(point => point.logicalIndex)).toEqual([0, 2])
    for (let i = 0; i < 20; i++) store.getOverlayStore().getProjectedPoints(overlay)
    expect(lookup).toHaveBeenCalledTimes(2)
    first[0].logicalIndex = 999
    overlay.points[0].value = 15
    expect(store.getOverlayStore().getProjectedPoints(overlay)).toEqual([{ logicalIndex: 0, value: 15 }, { logicalIndex: 2, value: 20 }])
    expect(lookup).toHaveBeenCalledTimes(2)

    overlay.points[0].offset = -1
    expect(store.getOverlayStore().getProjectedPoints(overlay)![0].logicalIndex).toBe(-1)
    expect(lookup).toHaveBeenCalledTimes(3)
    overlay.points[0].timestamp = 200
    expect(store.getOverlayStore().getProjectedPoints(overlay)![0].logicalIndex).toBe(0)
    expect(lookup).toHaveBeenCalledTimes(4)

    store.addData(data([50]), LoadDataType.Backward)
    expect(store.getOverlayStore().getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([0, 2])
    expect(lookup).toHaveBeenCalledTimes(4)
  })

  it('caches an unresolved lookup and retries after data arrives', () => {
    const { store, overlay } = fixture([{ timestamp: 300, value: 10 }, { timestamp: 400, value: 20 }])
    const lookup = vi.spyOn(store, 'externalToInternal')
    for (let i = 0; i < 10; i++) expect(store.getOverlayStore().getProjectedPoints(overlay)).toBeUndefined()
    expect(lookup).toHaveBeenCalledTimes(2)
    store.addData(data([300, 400]), LoadDataType.Forward)
    expect(store.getOverlayStore().getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([2, 3])
    expect(lookup).toHaveBeenCalledTimes(4)
  })

  it('invalidates projection when time-share mapping changes without new bars', () => {
    const first = new Date(2026, 8, 18, 9, 30).getTime()
    const last = first + 120000
    const { store, overlay } = fixture([{ timestamp: first, value: 10 }, { timestamp: last, value: 20 }], [first])
    expect(store.getOverlayStore().getProjectedPoints(overlay)).toBeUndefined()
    store.setOptions({ isTimeShare: true, timeShareTicks: ['09:30', '09:31', '09:32'] })
    expect(store.getOverlayStore().getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([0, 2])
    store.setOptions({ isTimeShare: true, timeShareTicks: ['09:30', '09:32'] })
    expect(store.getOverlayStore().getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([0, 1])
    store.setOptions({ isTimeShare: false })
    expect(store.getOverlayStore().getProjectedPoints(overlay)).toBeUndefined()
  })
})
