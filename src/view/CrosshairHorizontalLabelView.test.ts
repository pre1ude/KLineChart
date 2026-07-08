import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, YAxisType } from '../common/Styles'
import { drawStaticFigure } from '../extension/figure'
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
      getAxisType: () => YAxisType.Normal,
      getAxisComponent: () => yAxis,
      isAlignLeft: () => false
    }
    const view = new CrosshairHorizontalLabelView(widget as never)

    view.draw({} as never)

    expect(yAxis.convertFromPixel).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).not.toHaveBeenCalled()
  })
})
