import { describe, expect, it, vi } from 'vitest'
import type Chart from '../Chart'
import type KLineData from '../common/KLineData'
import { ActionType } from '../common/Action'
import { LoadDataType, type LoadDataParams } from '../common/LoadDataCallback'
import ChartStore from './ChartStore'
import { TimeScaleModeKind } from './time-scale'
import { Indicator } from '../component/Indicator'
import { registerIndicator } from '../extension/indicator'

const bar = (timestamp: number): KLineData => ({ timestamp, open: 10, high: 20, low: 5, close: 15 })
const bars = (count = 100, start = 1000): KLineData[] => Array.from({ length: count }, (_, i) => bar(start + i * 100))

function fixture() {
  const chart = { refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn() }
  const store = new ChartStore(chart as unknown as Chart)
  store.mainWidth = 160
  store.addData(bars(), LoadDataType.Init)
  return { store, scale: store.getTimeScaleStore(), chart }
}

describe('time index data updates', () => {
  it('does not let an older async indicator calculation replace a newer result', async () => {
    const pending: Array<(value: number[]) => void> = []
    const indicator = new Indicator<number>({ name: 'async-order', calc: () => new Promise(resolve => pending.push(resolve)) })
    const first = indicator.calcIndicator(bars())
    const second = indicator.calcIndicator(bars(101))
    pending[1]([2])
    expect(await second).toBe(true)
    pending[0]([1])
    expect(await first).toBe(false)
    expect(indicator.result).toEqual([2])
  })

  it.each(['clear', 'dataset', 'remove'] as const)('discards async indicator results after %s', async change => {
    const { store } = fixture()
    let finish!: (value: number[]) => void
    const name = `async-context-${change}`
    registerIndicator({ name, calc: () => new Promise<number[]>(resolve => { finish = resolve }) })
    const indicators = store.getIndicatorStore()
    const calculation = indicators.addInstance({ name, id: name }, 'candle_pane', true)
    const indicator = indicators.getIndicatorsByFilter({ id: name })[0]
    const finishOld = finish
    if (change === 'clear') store.clear()
    if (change === 'dataset') store.applyDataSnapshot(bars())
    if (change === 'remove') indicators.removeInstances({ id: name })
    finishOld([1])
    expect(await calculation).toBe(false)
    expect(indicator.result).toEqual([])
  })

  it('preserves logical positions and pixels while public data indices move on prepend', () => {
    const { store, scale } = fixture()
    const timestamp = store.getDataList()[90].timestamp
    const index = store.getTimeIndex()
    const logical = index.timeToLogical(timestamp)!
    const x = scale.dataIndexToCoordinate(90)
    const range = scale.getLogicalVisibleRange()
    const publicRange = scale.getVisibleRange()

    store.addData([bar(800), bar(900)], LoadDataType.Backward)

    expect(index.timeToLogical(timestamp)).toBe(logical)
    expect(index.timeToLogical(800)).toBe(-2)
    expect(store.timestampToDataIndex(timestamp)).toBe(92)
    expect(scale.logicalToCoordinate(logical)).toBeCloseTo(x)
    expect(scale.dataIndexToCoordinate(92)).toBeCloseTo(x)
    expect(scale.coordinateToDataIndex(x)).toBe(92)
    expect(scale.getLogicalVisibleRange()).toEqual(range)
    expect(scale.getVisibleRange().from).toBe(publicRange.from + 2)
    expect(scale.getXScale()(92)).toBeCloseTo(x)
    expect(store.getVisibleDataList().find(point => point.data.timestamp === timestamp)?.x).toBeCloseTo(x)
    store.getTooltipStore().setCrosshair({ x, y: 10 })
    expect(store.getTooltipStore().getCrosshair().kLineData?.timestamp).toBe(timestamp)
  })

  it.each([TimeScaleModeKind.KLine, TimeScaleModeKind.DataZoom, TimeScaleModeKind.TimeShare])('keeps continuous conversion and data picking aligned in %s mode', mode => {
    const { store, scale } = fixture()
    if (mode === TimeScaleModeKind.TimeShare) {
      store.setOptions({ isTimeShare: true, timeShareTicks: ['09:30', '09:31', '09:32', '09:33'], timeShareDays: 30 })
    } else {
      scale.setMode(mode)
    }
    if (mode === TimeScaleModeKind.DataZoom) scale.setDataZoomOptions({ start: 20, end: 80 })
    scale.adjustVisibleRange()
    store.addData([bar(800), bar(900)], LoadDataType.Backward)
    const index = store.getTimeIndex()

    for (const logical of [-4.25, -2, 0.49, 0.51, 70.25, 105.75]) {
      const x = scale.logicalToCoordinate(logical)
      expect(scale.coordinateToLogical(x)).toBeCloseTo(logical)
      expect(scale.coordinateToDataIndex(x)).toBe(Math.floor(index.logicalToDataIndex(logical) + 0.5))
      expect(scale.getXScale()(index.logicalToDataIndex(logical))).toBeCloseTo(x)
    }
  })

  it('preserves the bounded ceil and clamped nearest public timestamp contracts', () => {
    const { store } = fixture()
    expect(store.timestampToDataIndex(1050)).toBe(1)
    expect(store.timestampToNearestDataIndex(1050)).toBe(0)
    expect(store.timestampToDataIndex(999)).toBeUndefined()
    expect(store.timestampToDataIndex(11000)).toBeUndefined()
    expect(store.timestampToNearestDataIndex(999)).toBe(0)
    expect(store.timestampToNearestDataIndex(11000)).toBe(99)
    store.addData([bar(900)], LoadDataType.Backward)
    expect(store.timestampToDataIndex(1050)).toBe(2)
    expect(store.dataIndexToTimestamp(0)).toBe(900)
    expect(store.dataIndexToTimestamp(-1)).toBeUndefined()
  })

  it.each([0, 8])('excludes an offscreen high from the centered visible range after prepending %s bars', prepend => {
    const { store, scale } = fixture()
    const firstVisible = prepend === 0 ? 450 : 454
    const data = bars(1000)
    data[firstVisible - prepend - 1].high = 1000
    store.mainWidth = 333
    store.applyDataSnapshot(data)
    if (prepend > 0) store.addData(bars(prepend, 200), LoadDataType.Backward)
    scale.setBarSpace(3.3)
    const onVisibleRangeChange = vi.fn()
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, onVisibleRangeChange)

    scale.alignCenter()

    expect(scale.getVisibleRange()).toMatchObject({ from: firstVisible, to: firstVisible + 101 })
    expect(onVisibleRangeChange).toHaveBeenLastCalledWith(expect.objectContaining({ from: firstVisible }))
    expect(store.getVisibleDataList()[0].dataIndex).toBe(firstVisible)
    expect(Math.max(...store.getVisibleDataList().map(({ data }) => data.high))).toBe(20)
    expect(scale.dataIndexToCoordinate(firstVisible - 1)).toBeLessThan(0)
  })

  it.each([0, 8])('does not ceil a rounded right boundary to an extra bar after prepending %s bars', prepend => {
    const { store, scale } = fixture()
    store.mainWidth = 333
    store.applyDataSnapshot(bars(1000))
    if (prepend > 0) store.addData(bars(prepend, 200), LoadDataType.Backward)
    scale.setBarSpace(3.3)

    scale.setOffsetRightDistance((102 - store.getDataList().length) * 3.3, true)

    expect(scale.getVisibleRange()).toMatchObject({ from: 1, to: 102 })
    const visible = store.getVisibleDataList()
    expect(visible[visible.length - 1].dataIndex).toBe(101)
  })

  it.each([-1e-7, 1e-7])('preserves a real fractional boundary displacement of %s bars', delta => {
    const { store, scale } = fixture()
    store.mainWidth = 33
    store.addData(bars(8, 200), LoadDataType.Backward)
    scale.setBarSpace(3.3)

    scale.setOffsetRightDistance((20 + delta - store.getDataList().length) * 3.3, true)

    const range = scale.getVisibleRange()
    expect(range).toMatchObject({ from: delta < 0 ? 9 : 10, to: delta < 0 ? 20 : 21 })
    expect(range.domainFrom).toBeCloseTo(10 + delta, 10)
    expect(range.domainTo).toBeCloseTo(20 + delta, 10)
    expect(scale.coordinateToLogical(scale.logicalToCoordinate(12 + delta))).toBeCloseTo(12 + delta, 10)
  })

  it('keeps the visible time anchor at the same pixel when replacement fills a later hole', () => {
    const { store, scale } = fixture()
    const anchor = store.getDataList()[scale.coordinateToDataIndex(80)]
    const x = scale.dataIndexToCoordinate(store.timestampToDataIndex(anchor.timestamp)!)
    const replacement = [...store.getDataList()]
    replacement.splice(95, 0, bar(replacement[94].timestamp + 50))

    store.replaceData(replacement)

    expect(scale.dataIndexToCoordinate(store.timestampToDataIndex(anchor.timestamp)!)).toBeCloseTo(x)
  })

  it('keeps the visible time anchor when a later historical bar is deleted', () => {
    const { store, scale } = fixture()
    const anchor = store.getDataList()[scale.coordinateToDataIndex(80)]
    const x = scale.dataIndexToCoordinate(store.timestampToDataIndex(anchor.timestamp)!)
    const replacement = [...store.getDataList()]
    replacement.splice(95, 1)

    store.replaceData(replacement)

    expect(scale.dataIndexToCoordinate(store.timestampToDataIndex(anchor.timestamp)!)).toBeCloseTo(x)
  })

  it('retains the offset fallback for a missing anchor', () => {
    const { store, scale } = fixture()
    const offset = scale.getOffsetRightDistance()
    const replacement = [...store.getDataList()]
    replacement.splice(scale.coordinateToDataIndex(80), 1)
    store.replaceData(replacement)
    expect(scale.getOffsetRightDistance()).toBe(offset)
  })

  it('retains dataZoom percentages across replacement and rebases the internal origin', () => {
    const { store, scale } = fixture()
    scale.setMode(TimeScaleModeKind.DataZoom)
    scale.setDataZoomRange(20, 80)
    store.addData([bar(900)], LoadDataType.Backward)
    const replacement = [...store.getDataList()]
    replacement.splice(50, 0, bar(replacement[49].timestamp + 50))
    store.replaceData(replacement)
    expect(scale.getDataZoomRange()).toEqual({ start: 20, end: 80 })
    expect(scale.getVisibleRange().domainFrom).toBeCloseTo(replacement.length * 0.2)
    expect(scale.getVisibleRange().domainTo).toBeCloseTo(replacement.length * 0.8)
    expect(store.getTimeIndex().getFirstLogicalIndex()).toBe(0)
  })

  it('keeps logical coordinates across full snapshots that extend the existing timeline', () => {
    const { store, scale } = fixture()
    const original = [...store.getDataList()]
    const timestamp = original[90].timestamp
    const index = store.getTimeIndex()
    const range = scale.getLogicalVisibleRange()
    const x = scale.logicalToCoordinate(90)
    const revision = index.getRevision()
    store.replaceData([bar(800), bar(900), ...original, bar(11000)])
    expect(index.timeToLogical(timestamp)).toBe(90)
    expect(index.getFirstLogicalIndex()).toBe(-2)
    expect(index.timeToLogical(11000)).toBe(100)
    store.replaceData(store.getDataList().map(item => ({ ...item, close: 16 })))
    expect(index.timeToLogical(timestamp)).toBe(90)
    expect(index.getFirstLogicalIndex()).toBe(-2)
    store.replaceData([bar(700), ...store.getDataList()])
    expect(index.timeToLogical(timestamp)).toBe(90)
    expect(index.timeToLogical(700)).toBe(-3)
    expect(index.logicalToDataIndex(90)).toBe(93)
    expect(index.getRevision()).toBe(revision)
    expect(scale.getLogicalVisibleRange()).toEqual(range)
    expect(scale.logicalToCoordinate(90)).toBeCloseTo(x)
    expect(scale.coordinateToDataIndex(x)).toBe(93)
  })

  it('keeps the last of ten bars at logical 9 after loading eight historical bars', () => {
    const { store, scale } = fixture()
    store.applyDataSnapshot(bars(10))
    scale.alignRight()
    const point = { timestamp: 1900, value: 12 }
    const [id] = store.getOverlayStore().addInstances([{ name: 'verticalStraightLine', points: [point] }])
    const overlay = store.getOverlayStore().getInstanceById(id!)!
    const range = scale.getLogicalVisibleRange()
    const x = scale.logicalToCoordinate(9)

    store.addData(bars(8, 200), LoadDataType.Backward)

    expect(store.getOverlayStore().getProjectedPoints(overlay)).toEqual([{ logicalIndex: 9, value: 12 }])
    expect(store.getTimeIndex().logicalToDataIndex(9)).toBe(17)
    expect(scale.getLogicalVisibleRange()).toEqual(range)
    expect(scale.dataIndexToCoordinate(17)).toBeCloseTo(x)
    expect(scale.coordinateToDataIndex(x)).toBe(17)
    expect(overlay.points).toEqual([point])
  })

  it('scrolls and zooms around the same logical anchor after history loading', () => {
    const { store, scale } = fixture()
    store.addData(bars(8, 200), LoadDataType.Backward)
    const before = scale.getLogicalVisibleRange()
    scale.scroll(16)
    expect(scale.getLogicalVisibleRange()).toEqual({ from: before.from - 2, to: before.to - 2 })
    const x = 64
    const anchor = scale.coordinateToLogical(x)
    scale.zoom(1, x)
    expect(scale.coordinateToLogical(x)).toBeCloseTo(anchor)
    expect(scale.logicalToCoordinate(anchor)).toBeCloseTo(x)
    expect(scale.getVisibleRange().domainTo).toBeCloseTo(scale.getLogicalVisibleRange().to + 8)
  })

  it.each([3.3, 8.8, 11.2])('only refreshes a fractional viewport reset when its position changes at spacing %s', spacing => {
    const { store, scale, chart } = fixture()
    store.applyDataSnapshot(bars(10))
    scale.setBarSpace(spacing)
    scale.alignLeft()
    scale.captureInitialView()
    const range = scale.getLogicalVisibleRange()
    const onVisibleRangeChange = vi.fn()
    store.getActionStore().subscribe(ActionType.OnVisibleRangeChange, onVisibleRangeChange)
    chart.refreshViewportLayout.mockClear()

    scale.resetTimeScale()
    scale.resetTimeScale()
    expect(scale.getLogicalVisibleRange()).toEqual(range)
    expect(chart.refreshViewportLayout).not.toHaveBeenCalled()
    expect(onVisibleRangeChange).not.toHaveBeenCalled()

    scale.scroll(0.01)
    chart.refreshViewportLayout.mockClear()
    onVisibleRangeChange.mockClear()
    scale.resetTimeScale()
    scale.resetTimeScale()
    expect(scale.getLogicalVisibleRange()).toEqual(range)
    expect(chart.refreshViewportLayout).toHaveBeenCalledTimes(1)
    expect(onVisibleRangeChange).toHaveBeenCalledTimes(1)
  })

  it.each([3.3, 8.8, 11.2])('restores initial left alignment after prepend at fractional spacing %s', spacing => {
    const { store, scale, chart } = fixture()
    store.applyDataSnapshot(bars(10))
    scale.setBarSpace(spacing)
    scale.autoInitialAlignment()
    scale.captureInitialView()
    store.addData(bars(8, 200), LoadDataType.Backward)
    scale.scroll(30)
    chart.refreshViewportLayout.mockClear()
    scale.resetTimeScale()
    expect(scale.getVisibleRange().domainFrom).toBeCloseTo(0)
    expect(scale.getLogicalVisibleRange().from).toBeCloseTo(-8)
    expect(scale.getBarSpace().bar).toBe(spacing)
    scale.resetTimeScale()
    expect(chart.refreshViewportLayout).toHaveBeenCalledTimes(1)
  })

  it('does not treat a slightly shifted fractional viewport as left aligned', () => {
    const { store, scale, chart } = fixture()
    store.applyDataSnapshot(bars(10))
    scale.setBarSpace(3.3)
    scale.alignLeft()
    scale.scroll(0.01)
    const offset = scale.getOffsetRightDistance()
    scale.captureInitialView()
    store.addData(bars(8, 200), LoadDataType.Backward)
    scale.scroll(30)
    chart.refreshViewportLayout.mockClear()
    scale.resetTimeScale()
    expect(scale.getOffsetRightDistance()).toBeCloseTo(offset, 10)
    expect(scale.getVisibleRange().domainFrom).toBeCloseTo(8 - 0.01 / 3.3)
    scale.resetTimeScale()
    expect(chart.refreshViewportLayout).toHaveBeenCalledTimes(1)
  })

  it.each(['domainFrom', 'domainTo'] as const)('preserves the %s resize anchor with a nonzero logical origin', anchor => {
    const { store, scale } = fixture()
    store.addData(bars(8, 200), LoadDataType.Backward)
    scale.setBarSpaceLimit({ max: 10 })
    const range = scale.getLogicalVisibleRange()
    scale.adjustBarSpaceForMainWidthChange(160, 480, anchor)
    store.mainWidth = 480
    scale.adjustVisibleRange()
    expect(scale.getBarSpace().bar).toBe(10)
    const key = anchor === 'domainFrom' ? 'from' : 'to'
    expect(scale.getLogicalVisibleRange()[key]).toBeCloseTo(range[key])
    const logical = 90
    expect(scale.coordinateToLogical(scale.logicalToCoordinate(logical))).toBeCloseTo(logical)
  })

  it('keeps streaming bars fixed while array appends retain the offset policy', () => {
    const { store, scale } = fixture()
    store.addData([bar(900)], LoadDataType.Backward)
    const range = scale.getLogicalVisibleRange()
    store.addData(bar(11000))
    expect(scale.getLogicalVisibleRange()).toEqual(range)
    const offset = scale.getOffsetRightDistance()
    store.addData([bar(11100), bar(11200)], LoadDataType.Forward)
    expect(scale.getOffsetRightDistance()).toBeCloseTo(offset)
    expect(scale.getLogicalVisibleRange()).toEqual({ from: range.from + 2, to: range.to + 2 })
  })

  it('derives logical DataZoom boundaries from the retained percentages after prepend', () => {
    const { store, scale } = fixture()
    scale.setMode(TimeScaleModeKind.DataZoom)
    scale.setDataZoomRange(20, 80)
    store.addData(bars(8, 200), LoadDataType.Backward)
    expect(scale.getDataZoomRange()).toEqual({ start: 20, end: 80 })
    expect(scale.getLogicalVisibleRange().from).toBeCloseTo(-8 + 108 * 0.2)
    expect(scale.getLogicalVisibleRange().to).toBeCloseTo(-8 + 108 * 0.8)
    expect(scale.getVisibleRange().domainFrom).toBeCloseTo(108 * 0.2)
  })

  it('keeps an empty DataZoom viewport at the current origin and restores its percentages after resize', () => {
    const { store, scale } = fixture()
    store.addData(bars(8, 200), LoadDataType.Backward)
    scale.setMode(TimeScaleModeKind.DataZoom)
    scale.setDataZoomRange(20, 80)
    const range = scale.getVisibleRange()

    store.mainWidth = 0
    scale.adjustVisibleRange()

    expect(scale.getVisibleRange()).toEqual({ from: 0, to: 0, domainFrom: 0, domainTo: 0 })
    expect(scale.getLogicalVisibleRange()).toEqual({ from: -8, to: -8 })
    expect(scale.coordinateToDataIndex(0)).toBe(0)
    expect(store.getVisibleDataList()).toEqual([])

    store.mainWidth = 160
    scale.adjustVisibleRange()
    expect(scale.getDataZoomRange()).toEqual({ start: 20, end: 80 })
    expect(scale.getVisibleRange()).toEqual(range)
  })

  it('resets logical coordinates when replacing with an unrelated or empty dataset', () => {
    const { store } = fixture()
    store.addData([bar(900)], LoadDataType.Backward)
    store.replaceData([bar(20000)])
    expect(store.getTimeIndex().timeToLogical(20000)).toBe(0)
    store.addData([bar(19000)], LoadDataType.Backward)
    expect(store.getTimeIndex().getFirstLogicalIndex()).toBe(-1)
    store.replaceData([])
    expect(store.getTimeIndex().getFirstLogicalIndex()).toBe(0)
  })

  it('clears logical geometry while retaining the offset policy until a new dataset initializes it', () => {
    const { store, scale } = fixture()
    store.addData([bar(900)], LoadDataType.Backward)
    scale.setOffsetRightDistance(-24, true)
    store.clear()
    expect(scale.getLogicalVisibleRange()).toEqual({ from: 0, to: 0 })
    expect(scale.getVisibleRange()).toEqual({ from: 0, to: 0, domainFrom: 0, domainTo: 0 })
    expect(scale.getOffsetRightDistance()).toBe(-24)
    store.applyDataSnapshot(bars())
    expect(scale.getOffsetRightDistance()).toBe(10)
    expect(store.getTimeIndex().getFirstLogicalIndex()).toBe(0)
  })

  it('keeps drawing anchors unchanged through prepend and internal-hole replacement', () => {
    const { store } = fixture()
    const overlays = store.getOverlayStore()
    const points = [{ timestamp: 10000, value: 12 }, { timestamp: 10900, offset: 2, value: 15 }]
    const [id] = overlays.addInstances([{ name: 'segment', points }])
    const overlay = overlays.getInstanceById(id!)!
    store.addData([bar(900)], LoadDataType.Backward)
    expect(overlays.getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([90, 101])
    const replacement = [...store.getDataList()]
    replacement.splice(95, 0, bar(replacement[94].timestamp + 50))
    store.replaceData(replacement)
    expect(overlays.getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([91, 103])
    expect(overlay.points).toEqual(points)
    expect(overlays.exportOverlay(id!)?.points).toEqual(points)
  })

  it.each(['clear', 'init', 'dataset', 'callback'] as const)('ignores responses from the previous %s context', change => {
    const { store } = fixture()
    const requests: LoadDataParams[] = []
    store.setLoadDataCallback(request => requests.push(request))
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    const old = requests[0]

    if (change === 'clear') store.clear()
    if (change === 'init') store.addData(bars(), LoadDataType.Init)
    if (change === 'dataset') store.applyDataSnapshot(bars())
    if (change === 'callback') store.setLoadDataCallback(request => requests.push(request))

    const before = [...store.getDataList()]
    old.addData([bar(100)])
    expect(store.getDataList()).toEqual(before)
  })

  it('keeps one pending history request across repeated same-dataset replacement updates', () => {
    const { store, scale } = fixture()
    const requests: LoadDataParams[] = []
    store.setLoadDataCallback(request => requests.push(request))
    scale.alignLeft()
    expect(requests).toHaveLength(1)
    expect(requests[0].type).toBe(LoadDataType.Backward)

    for (let update = 1; update <= 3; update++) {
      const replacement = [...store.getDataList()]
      replacement[replacement.length - 1] = { ...bar(10900 + update), close: 15 + update }
      store.replaceData(replacement, true)
    }
    expect(requests).toHaveLength(1)
    requests[0].addData([bar(900)], true)
    requests[0].callback()
    expect(store.getDataList()).toHaveLength(101)
    expect(store.getDataList()[0].timestamp).toBe(900)
    expect(store.getDataList().at(-1)).toMatchObject({ timestamp: 10903, close: 18 })

    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    expect(requests).toHaveLength(2)
  })

  it('accepts both pending pagination directions after same-context replacement', () => {
    const { store } = fixture()
    const requests: LoadDataParams[] = []
    store.setLoadDataCallback(request => requests.push(request))
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    store.executeLoadDataCallback({ type: LoadDataType.Forward })
    const replacement = [...store.getDataList()]
    replacement[replacement.length - 1] = { ...bar(10950), close: 18 }
    store.replaceData(replacement, true)
    expect(requests).toHaveLength(2)

    requests[1].addData([bar(11000)], false)
    requests[0].addData([bar(900)], false)
    expect(store.getDataList()).toHaveLength(102)
    expect(store.getDataList()[0].timestamp).toBe(900)
    expect(store.getDataList().at(-2)).toMatchObject({ timestamp: 10950, close: 18 })
    expect(store.getDataList().at(-1)?.timestamp).toBe(11000)
  })

  it('does not let an old completion unlock a new pagination request', () => {
    const { store } = fixture()
    const requests: LoadDataParams[] = []
    store.setLoadDataCallback(request => requests.push(request))
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    const old = requests[0]
    store.applyDataSnapshot(bars(), false)
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    expect(requests).toHaveLength(2)

    old.callback()
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    expect(requests).toHaveLength(2)
    requests[1].callback()
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    expect(requests).toHaveLength(3)
    requests[1].callback()
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    expect(requests).toHaveLength(3)
  })

  it('accepts concurrent pagination around ordinary data updates', () => {
    const { store } = fixture()
    const requests: LoadDataParams[] = []
    store.setLoadDataCallback(request => requests.push(request))
    store.executeLoadDataCallback({ type: LoadDataType.Backward })
    store.executeLoadDataCallback({ type: LoadDataType.Forward })
    store.addData({ ...store.getDataList().at(-1)!, close: 16 })

    requests[1].addData([bar(11000)], false)
    requests[0].addData([bar(900)], false)

    expect(store.getDataList()).toHaveLength(102)
    expect(store.getDataList()[0].timestamp).toBe(900)
    expect(store.getDataList().at(-1)?.timestamp).toBe(11000)
  })
})
