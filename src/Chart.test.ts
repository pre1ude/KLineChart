import { describe, expect, it, vi } from 'vitest'
import ChartImp from './Chart'
import { PaneIdConstants } from './pane/types'

function createPendingIndicatorChart(ready = true): {
  chart: ChartImp
  addInstance: ReturnType<typeof vi.fn>
  adjustPaneViewport: ReturnType<typeof vi.fn>
  createPane: ReturnType<typeof vi.fn>
  pane: {
    setHeightSpec: ReturnType<typeof vi.fn>
    setBounding: ReturnType<typeof vi.fn>
  }
} {
  const chart = Object.create(ChartImp.prototype) as ChartImp
  const pane = {
    setHeightSpec: vi.fn(),
    setBounding: vi.fn()
  }
  const addInstance = vi.fn(() => new Promise<boolean>(() => {}))
  const adjustPaneViewport = vi.fn()
  const createPane = vi.fn(() => pane)

  Reflect.set(chart, '_chartStore', {
    getIndicatorPaneDefaultHeight: () => 0.25,
    getMinIndicatorPaneHeight: () => 80,
    getIndicatorStore: () => ({ addInstance })
  })
  Reflect.set(chart, '_createPane', createPane)
  Reflect.set(chart, 'getDrawPaneById', vi.fn(() => undefined))
  Reflect.set(chart, 'adjustPaneViewport', adjustPaneViewport)
  if (ready) {
    Reflect.set(chart, '_dataZoomSlider', {})
  }

  return { chart, addInstance, adjustPaneViewport, createPane, pane }
}

describe('ChartImp.createIndicator', () => {
  it('lays out a new percentage pane before indicator calculation settles', () => {
    const { chart, addInstance, adjustPaneViewport, pane } = createPendingIndicatorChart()

    const paneId = chart.createIndicator('VOL', false, { height: 0.25 })

    expect(paneId?.startsWith(PaneIdConstants.INDICATOR)).toBe(true)
    expect(pane.setHeightSpec).toHaveBeenCalledWith({ unit: 'percent', value: 0.25 })
    expect(pane.setBounding).toHaveBeenCalledWith({ height: 0 })
    expect(addInstance).toHaveBeenCalledOnce()
    expect(adjustPaneViewport).toHaveBeenCalledWith(true, true, true, true, true)
  })

  it('defers provisional layout while constructor layout dependencies are not ready', () => {
    const { chart, adjustPaneViewport } = createPendingIndicatorChart(false)

    chart.createIndicator('VOL', false, { height: 0.25 })

    expect(adjustPaneViewport).not.toHaveBeenCalled()
  })

  it('uses global indicator pane defaults when pane options omit them', () => {
    const { chart, createPane, pane } = createPendingIndicatorChart()

    chart.createIndicator('VOL')

    expect(createPane).toHaveBeenCalledWith(expect.any(Function), expect.any(String), {
      height: 0.25,
      minHeight: 80
    })
    expect(pane.setHeightSpec).toHaveBeenCalledWith({ unit: 'percent', value: 0.25 })
  })

  it('keeps explicit indicator pane height and min height above global defaults', () => {
    const { chart, createPane, pane } = createPendingIndicatorChart()

    chart.createIndicator('VOL', false, { height: 120, minHeight: 60 })

    expect(createPane).toHaveBeenCalledWith(expect.any(Function), expect.any(String), {
      height: 120,
      minHeight: 60
    })
    expect(pane.setHeightSpec).toHaveBeenCalledWith({ unit: 'pixel', value: 120 })
  })
})
