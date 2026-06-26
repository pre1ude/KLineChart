import { describe, expect, it, vi } from 'vitest'
import ChartImp from './Chart'
import { PaneIdConstants } from './pane/types'

function createPendingIndicatorChart(ready = true): {
  chart: ChartImp
  addInstance: ReturnType<typeof vi.fn>
  adjustPaneViewport: ReturnType<typeof vi.fn>
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

  Reflect.set(chart, '_chartStore', {
    getIndicatorStore: () => ({ addInstance })
  })
  Reflect.set(chart, '_createPane', vi.fn(() => pane))
  Reflect.set(chart, 'getDrawPaneById', vi.fn(() => undefined))
  Reflect.set(chart, 'adjustPaneViewport', adjustPaneViewport)
  if (ready) {
    Reflect.set(chart, '_dataZoomSlider', {})
  }

  return { chart, addInstance, adjustPaneViewport, pane }
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
})
