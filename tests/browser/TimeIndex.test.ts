import { expect, it } from 'vitest'
import { dispose, init } from '../../src/index'

async function settleFrames(): Promise<void> {
  await new Promise<void>(resolve => { requestAnimationFrame(() => resolve()) })
  await new Promise<void>(resolve => { requestAnimationFrame(() => resolve()) })
}

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
