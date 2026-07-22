import { beforeEach, describe, expect, it, vi } from 'vitest'

import ChartImp from '../Chart'
import type KLineData from '../common/KLineData'
import type { Indicator } from '../component/Indicator'
import { drawStaticFigure } from '../extension/figure'
import { getStyles as getRegisteredStyles } from '../extension/styles'
import { PaneIdConstants } from '../pane/types'
import ChartStore from '../store/ChartStore'
import IndicatorTooltipView from './IndicatorTooltipView'

vi.mock('../common/utils/canvas', () => ({
  calcTextWidth: vi.fn((text: string) => text.length * 8),
  createFont: vi.fn(() => 'normal 12px sans-serif')
}))

vi.mock('../extension/figure', () => ({
  createFigure: vi.fn(),
  drawStaticFigure: vi.fn()
}))

describe('IndicatorTooltipView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  it('uses the light Standard tooltip background after switching from dark at runtime', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const chartStore = new ChartStore(chart)
    const refreshMetricLayout = vi.fn()
    Reflect.set(chart, '_chartStore', chartStore)
    Reflect.set(chart, 'refreshMetricLayout', refreshMetricLayout)

    const data: KLineData = {
      timestamp: 1,
      open: 100,
      high: 101,
      low: 99,
      close: 100
    }
    const indicator = {
      id: 'ma',
      name: 'MA',
      shortName: 'MA',
      calcParams: [],
      figures: [],
      result: [],
      visible: true
    } as unknown as Indicator

    vi.spyOn(chartStore, 'getDataList').mockReturnValue([data])
    vi.spyOn(chartStore.getTooltipStore(), 'getCrosshair').mockReturnValue({
      dataIndex: 0,
      kLineData: data
    })
    vi.spyOn(chartStore.getIndicatorStore(), 'getInstances').mockReturnValue([indicator])

    const pane = {
      getId: () => PaneIdConstants.CANDLE,
      getChart: () => chart
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 600, height: 400, left: 0, top: 0 })
    }
    const view = new IndicatorTooltipView(widget as never)
    const ctx = {} as CanvasRenderingContext2D
    const darkBackgroundColor = getRegisteredStyles('dark')?.indicator?.tooltip?.backgroundColor
    const lightBackgroundColor = getRegisteredStyles('light')?.indicator?.tooltip?.backgroundColor

    expect(darkBackgroundColor).toBeDefined()
    expect(lightBackgroundColor).toBeDefined()
    expect(lightBackgroundColor).not.toBe(darkBackgroundColor)

    chart.setStyles('dark')
    view.draw(ctx)

    expect(getDrawnBackgroundColor()).toBe(darkBackgroundColor)

    vi.mocked(drawStaticFigure).mockClear()
    chart.setStyles('light')
    view.draw(ctx)

    expect(chart.getStyles().indicator.tooltip.backgroundColor).toBe(lightBackgroundColor)
    expect(getDrawnBackgroundColor()).toBe(lightBackgroundColor)
    expect(refreshMetricLayout).toHaveBeenCalledTimes(2)
  })
})

function getDrawnBackgroundColor(): unknown {
  const backgroundCall = vi.mocked(drawStaticFigure).mock.calls.find(([, name]) => name === 'rect')
  return (backgroundCall?.[2].styles as { color?: unknown } | undefined)?.color
}
