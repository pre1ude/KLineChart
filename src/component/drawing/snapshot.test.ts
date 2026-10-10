import { expect, it, vi } from 'vitest'
import Chart from '../../Chart'
import ChartStore from '../../store/ChartStore'
import type { OverlayCreate } from '../Overlay'

function fixture() {
  const chart = Object.assign(Object.create(Chart.prototype), { getChartStore: () => store, updatePane: vi.fn(), refreshViewportLayout: vi.fn(), onCrosshairChange: vi.fn() }) as Chart
  const store = new ChartStore(chart)
  Reflect.set(chart, '_chartStore', store)
  store.applyDataSnapshot([100, 200, 300].map(timestamp => ({ timestamp, open: 10, high: 20, low: 5, close: 15 })))
  return { chart, store, drawing: chart }
}
function input(): OverlayCreate {
  return {
    name: 'segment', groupId: 'saved', points: [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }],
    controlPointVisibility: 'always', needDefaultPointFigure: false, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
    styles: { line: { color: 'red', dashedValue: [2, 3] } }, extendData: { nested: { label: 'original' } }
  }
}

it('preserves isolated nested dates in exports and restores', () => {
  const { drawing } = fixture()
  const date = new Date('2026-10-08T00:00:00Z')
  const configuration = { ...input(), extendData: { createdAt: date, nested: [{ date }] } }
  const id = drawing.createOverlay(configuration)!
  const saved = drawing.getChartStore().getOverlayStore().exportOverlay(id)!
  expect(saved.extendData.createdAt).toEqual(date)
  expect(saved.extendData.nested[0].date).toEqual(date)
  expect(saved.extendData.createdAt).not.toBe(date)
  expect(JSON.parse(JSON.stringify(saved)).extendData.createdAt).toBe(date.toISOString())
  saved.extendData.nested[0].date.setUTCFullYear(2000)
  expect(drawing.getOverlayById(id)!.extendData.nested[0].date).toEqual(date)
  const restored = drawing.getChartStore().getOverlayStore().exportOverlay(id)!
  drawing.removeOverlay(id)
  drawing.createOverlay(restored)
  expect(drawing.getOverlayById(id)!.extendData.createdAt).toEqual(date)
  drawing.getChartStore().destroy()
})

it('round-trips presentation configuration without persisting callbacks or model state', () => {
  const { drawing } = fixture()
  const configuration = input()
  const id = drawing.createOverlay({ ...configuration, onCreated: vi.fn() })!
  const saved = drawing.getChartStore().getOverlayStore().exportOverlay(id)!
  expect(saved).toMatchObject(configuration)
  expect(saved).not.toHaveProperty('onCreated')
  expect(saved).not.toHaveProperty('state')
  expect(saved).not.toHaveProperty('period')
  drawing.removeOverlay(id)
  drawing.createOverlay(saved)
  expect(drawing.getOverlayById(id)).toMatchObject(configuration)
  drawing.getChartStore().destroy()
})

it.each(['single', 'all'] as const)('isolates %s exports from live nested properties and other exports', method => {
  const { drawing } = fixture()
  const id = drawing.createOverlay(input())!
  const saved = method === 'single' ? drawing.getChartStore().getOverlayStore().exportOverlay(id)! : drawing.getChartStore().getOverlayStore().exportAllOverlays()[0]
  const independent = drawing.getChartStore().getOverlayStore().exportOverlay(id)!
  saved.styles!.line!.color = 'blue'
  saved.styles!.line!.dashedValue![0] = 99
  saved.extendData!.nested.label = 'changed'
  saved.points![0].value = 99
  expect(drawing.getOverlayById(id)).toMatchObject(input())
  expect(independent).toMatchObject(input())
  drawing.getChartStore().destroy()
})
