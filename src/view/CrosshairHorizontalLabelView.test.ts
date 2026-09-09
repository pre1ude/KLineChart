import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import { YScaleType } from '../component/YScale'
import { drawStaticFigure } from '../extension/figure'
import { YAxisLabelDisplay } from '../widget/YAxisWidget'
import CrosshairHorizontalLabelView from './CrosshairHorizontalLabelView'

vi.mock('../common/utils/canvas', () => ({
  calcTextWidth: vi.fn(() => 20),
  createFont: vi.fn(() => '12px Arial')
}))

vi.mock('../extension/figure', () => ({
  drawStaticFigure: vi.fn()
}))

describe('CrosshairHorizontalLabelView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  function createView(crosshairY: number, formatter?: (value: number) => string): { view: CrosshairHorizontalLabelView, yAxis: { convertFromPixel: ReturnType<typeof vi.fn> } } {
    const styles = getDefaultStyles()
    const yAxis = {
      hasValidData: () => true,
      isInCandle: () => false,
      convertFromPixel: vi.fn(() => 12.345)
    }
    const chartStore = {
      getStyles: () => styles,
      getTooltipStore: () => ({
        getCrosshair: () => ({
          paneId: 'indicator_pane_1',
          kLineData: { close: 1 },
          y: crosshairY
        })
      }),
      getIndicatorStore: () => ({
        getInstances: () => []
      }),
      getThousandsSeparator: () => ',',
      getDecimalFoldThreshold: () => 100,
      getCustomApi: () => ({
        formatBigNumber: (value: string | number) => `${value}`
      })
    }
    const pane = {
      getId: () => 'indicator_pane_1',
      getChart: () => ({
        getChartStore: () => chartStore
      })
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 }),
      getScaleType: () => YScaleType.Normal,
      getScale: () => ({ getOptions: () => ({ formatter }) }),
      getScaleComponent: () => yAxis,
      getOptions: () => ({ yScaleId: 'default', labelDisplay: YAxisLabelDisplay.Value }),
      formatLabel: (_value: number, fallback: string) => fallback,
      isAlignLeft: () => false
    }
    return {
      view: new CrosshairHorizontalLabelView(widget as never),
      yAxis
    }
  }

  it('does not draw a horizontal label for an axis without valid data', () => {
    const styles = getDefaultStyles()
    const yAxis = {
      hasValidData: () => false,
      isInCandle: () => false,
      convertFromPixel: vi.fn(() => 12.345)
    }
    const chartStore = {
      getStyles: () => styles,
      getTooltipStore: () => ({
        getCrosshair: () => ({
          paneId: 'indicator_pane_1',
          kLineData: { close: 1 },
          y: 42
        })
      }),
      getIndicatorStore: () => ({
        getInstances: () => []
      }),
      getThousandsSeparator: () => ',',
      getDecimalFoldThreshold: () => 100,
      getCustomApi: () => ({
        formatBigNumber: (value: string | number) => `${value}`
      })
    }
    const pane = {
      getId: () => 'indicator_pane_1',
      getChart: () => ({
        getChartStore: () => chartStore
      })
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 }),
      getScaleType: () => YScaleType.Normal,
      getScale: () => ({ getOptions: () => ({ formatter: undefined }) }),
      getScaleComponent: () => yAxis,
      getOptions: () => ({ yScaleId: 'default', labelDisplay: YAxisLabelDisplay.Value }),
      formatLabel: (_value: number, fallback: string) => fallback,
      isAlignLeft: () => false
    }
    const view = new CrosshairHorizontalLabelView(widget as never)

    view.draw({} as never)

    expect(yAxis.convertFromPixel).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).not.toHaveBeenCalled()
  })

  it('keeps the horizontal label fully visible at the top of the y-axis', () => {
    const { view, yAxis } = createView(0)

    view.draw({} as never)

    expect(yAxis.convertFromPixel).toHaveBeenCalledWith(0)
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      y: 10,
      text: '12'
    })
  })

  it('keeps the horizontal label fully visible at the bottom of the y-axis', () => {
    const { view, yAxis } = createView(120)

    view.draw({} as never)

    expect(yAxis.convertFromPixel).toHaveBeenCalledWith(120)
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      y: 110,
      text: '12'
    })
  })

  it('uses the shared scale formatter for the crosshair label', () => {
    const formatter = vi.fn((value: number) => `value=${value}`)
    const { view } = createView(42, formatter)

    view.draw({} as never)

    expect(formatter).toHaveBeenCalledWith(12.345)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({ text: 'value=12.345' })
  })
})
