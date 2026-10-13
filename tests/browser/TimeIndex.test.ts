import { expect, it } from 'vitest'
import { dispose, DomPosition, init } from '../../src/index'

async function settleFrames(): Promise<void> {
  await new Promise<void>(resolve => { requestAnimationFrame(() => resolve()) })
  await new Promise<void>(resolve => { requestAnimationFrame(() => resolve()) })
}

function send(target: Element, type: string, clientX: number, clientY: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0, view: window })
  Object.defineProperty(event, 'sourceCapabilities', { value: { firesTouchEvents: false } })
  target.dispatchEvent(event)
}

it('uses the same midpoint picking rule for public conversion, crosshair and drawing after prepend', async () => {
  const container = document.createElement('div')
  container.style.cssText = 'width:800px;height:400px'
  document.body.appendChild(container)
  const chart = init(container)!
  const bar = (index: number) => ({ timestamp: 1000000 + index * 60000, open: 10, high: 20, low: 5, close: 15 })
  const original = Array.from({ length: 10 }, (_, i) => bar(i))
  try {
    await new Promise<void>(resolve => chart.applyNewData(original, false, resolve))
    chart.prependData(Array.from({ length: 8 }, (_, i) => bar(i - 8)), false)
    const store = chart.getChartStore()
    const scale = store.getTimeScaleStore()
    for (const spacing of [8, 3.3, 8.8]) {
      chart.setBarSpace(spacing)
      chart.alignLeft()
      for (const delta of [-1e-7, 0, 1e-7]) {
        const x = scale.logicalToCoordinate(0.5 + delta)
        const expected = delta < 0 ? 0 : 1
        expect(chart.coordinateToDataIndex(x)).toBe(8 + expected)
        expect(chart.convertFromPixel({ x, y: 100 }, {}).timestamp).toBe(original[expected].timestamp)
        store.getTooltipStore().setCrosshair({ x, y: 100 })
        expect(store.getTooltipStore().getCrosshair().kLineData?.timestamp).toBe(original[expected].timestamp)
      }
    }

    chart.setBarSpace(8)
    chart.alignLeft()
    const id = chart.createOverlay({ name: 'verticalStraightLine' })!
    await settleFrames()
    const bounds = chart.getDom('candle_pane', DomPosition.Main)!.getBoundingClientRect()
    const x = bounds.left + scale.logicalToCoordinate(0.5)
    const y = bounds.top + 100
    const target = document.elementFromPoint(x, y)!
    for (const type of ['mouseenter', 'mousemove', 'mousedown', 'mouseup']) send(target, type, x, y)
    expect(chart.getOverlayById(id)!.points[0].timestamp).toBe(original[1].timestamp)
  } finally {
    await settleFrames()
    dispose(chart)
    container.remove()
  }
})

it.each(['prepend', 'snapshot', 'correction'] as const)('continues a vertical-line drag across %s using logical coordinates', async update => {
  const container = document.createElement('div')
  container.style.cssText = 'width:800px;height:400px'
  document.body.appendChild(container)
  const chart = init(container)!
  const start = Date.UTC(2026, 8, 18, 1, 30)
  const bar = (offset: number) => ({ timestamp: start + offset * 60000, open: 10, high: 20, low: 5, close: 15 })
  const original = Array.from({ length: 10 }, (_, i) => bar(i))
  try {
    await new Promise<void>(resolve => chart.applyNewData(original, false, resolve))
    chart.setBarSpace(30)
    chart.alignLeft()
    const point = { timestamp: original[9].timestamp, value: 12 }
    const id = chart.createOverlay({ name: 'verticalStraightLine', points: [point] })!
    await settleFrames()

    const store = chart.getChartStore()
    const scale = store.getTimeScaleStore()
    const range = scale.getLogicalVisibleRange()
    const pixel = chart.convertToPixel(point, {})
    const bounds = chart.getDom('candle_pane', DomPosition.Main)!.getBoundingClientRect()
    const x = bounds.left + pixel.x!, y = bounds.top + pixel.y! + 30
    const target = document.elementFromPoint(x, y)!
    send(target, 'mouseenter', x, y)
    send(target, 'mousemove', x, y)
    send(target, 'mousedown', x, y)
    expect(store.getOverlayStore().getSelectedInfo()?.overlay.id).toBe(id)

    const history = Array.from({ length: 8 }, (_, i) => bar(i - 8))
    if (update === 'prepend') chart.prependData(history, false)
    else chart.replaceData([...history, ...original], false)
    expect(store.getTimeIndex().timeToLogical(point.timestamp)).toBe(9)
    expect(store.timestampToDataIndex(point.timestamp)).toBe(17)
    expect(scale.getLogicalVisibleRange()).toEqual(range)
    expect(chart.convertToPixel(point, {}).x).toBeCloseTo(pixel.x!, 5)

    if (update === 'correction') {
      const replacement = [...store.getDataList()]
      replacement.splice(5, 0, bar(-3.5))
      chart.replaceData(replacement, false)
    }
    await settleFrames()
    const current = chart.convertToPixel(point, {})
    const currentBounds = chart.getDom('candle_pane', DomPosition.Main)!.getBoundingClientRect()
    const nextX = currentBounds.left + current.x! - scale.getBarSpace().bar
    send(target, 'mousemove', nextX, y)
    send(target, 'mouseup', nextX, y)
    expect(chart.getOverlayById(id)!.points[0].timestamp).toBe(original[8].timestamp)
    expect(chart.getOverlayById(id)!.points[0].offset).toBe(0)
  } finally {
    await settleFrames()
    dispose(chart)
    container.remove()
  }
})

it('keeps a real-chart time anchor and pixel picking aligned after prepend and hole replacement', async () => {
  const container = document.createElement('div')
  container.style.cssText = 'width:800px;height:400px'
  document.body.appendChild(container)
  const chart = init(container)!
  const start = Date.UTC(2026, 8, 18, 1, 30)
  const bar = (offset: number) => ({ timestamp: start + offset * 60000, open: 10, high: 20, low: 5, close: 15 })
  try {
    await new Promise<void>(resolve => chart.applyNewData(Array.from({ length: 100 }, (_, i) => bar(i)), false, resolve))
    await settleFrames()
    const store = chart.getChartStore()
    const scale = store.getTimeScaleStore()
    const dataIndex = scale.coordinateToDataIndex(store.mainWidth / 2)
    const point = { timestamp: store.getDataList()[dataIndex].timestamp, value: 12 }
    const original = chart.convertToPixel(point, {})
    const logical = store.getTimeIndex().timeToLogical(point.timestamp)
    const id = chart.createOverlay({ name: 'segment', points: [point, { ...point, offset: 2, value: 15 }] })!
    const saved = chart.getOverlayById(id)!.points.map(p => ({ ...p }))

    chart.prependData([bar(-2), bar(-1)], false)
    expect(store.getTimeIndex().timeToLogical(point.timestamp)).toBe(logical)
    expect(chart.convertToPixel(point, {}).x).toBeCloseTo(original.x!, 5)

    const replacement = [...store.getDataList()]
    replacement.splice(95, 0, { ...bar(0), timestamp: replacement[94].timestamp + 30000 })
    await new Promise<void>(resolve => chart.replaceData(replacement, false, resolve))
    await settleFrames()

    const pixel = chart.convertToPixel(point, {})
    expect(pixel.x).toBeCloseTo(original.x!, 5)
    expect(chart.convertFromPixel(pixel, {}).timestamp).toBe(point.timestamp)
    expect(chart.getOverlayById(id)!.points).toEqual(saved)
    expect(store.getVisibleDataList().find(item => item.data.timestamp === point.timestamp)?.x).toBeCloseTo(pixel.x!, 5)
  } finally {
    await settleFrames()
    dispose(chart)
    container.remove()
  }
})
