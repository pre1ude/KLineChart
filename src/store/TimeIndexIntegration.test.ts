import { describe, expect, it, vi } from 'vitest'
import type Chart from '../Chart'
import type KLineData from '../common/KLineData'
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
  return { store, scale: store.getTimeScaleStore() }
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

  it('keeps drawing anchors unchanged through prepend and internal-hole replacement', () => {
    const { store } = fixture()
    const overlays = store.getOverlayStore()
    const points = [{ timestamp: 10000, value: 12 }, { timestamp: 10900, offset: 2, value: 15 }]
    const [id] = overlays.addInstances([{ name: 'segment', points }])
    const overlay = overlays.getInstanceById(id!)!
    store.addData([bar(900)], LoadDataType.Backward)
    expect(overlays.getProjectedPoints(overlay)?.map(point => point.dataIndex)).toEqual([91, 102])
    const replacement = [...store.getDataList()]
    replacement.splice(95, 0, bar(replacement[94].timestamp + 50))
    store.replaceData(replacement)
    expect(overlays.getProjectedPoints(overlay)?.map(point => point.dataIndex)).toEqual([91, 103])
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
