import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, YAxisType } from '../common/Styles'
import { drawStaticFigure } from '../extension/figure'
import CandleLastPriceLineView from './CandleLastPriceLineView'

vi.mock('../extension/figure', () => ({
  drawStaticFigure: vi.fn()
}))

describe('CandleLastPriceLineView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  it('aligns the latest-price line to the main candle coordinate axis', () => {
    const styles = getDefaultStyles()
    const leftPercentageAxis = {
      convertToPixel: vi.fn(() => 42)
    }
    const rightPriceAxis = {
      convertToPixel: vi.fn(() => 86)
    }
    const leftPercentageWidget = {
      getAxisType: () => YAxisType.Percentage,
      getAxisComponent: () => leftPercentageAxis
    }
    const rightPriceWidget = {
      getAxisType: () => YAxisType.Normal,
      getAxisComponent: () => rightPriceAxis
    }
    const chartStore = {
      getStyles: () => styles,
      getDataList: () => [{ open: 105, close: 110 }]
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getYLeftAxisWidget: () => leftPercentageWidget,
      getYRightAxisWidget: () => rightPriceWidget,
      getMainAxisWidget: () => leftPercentageWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 })
    }
    const view = new CandleLastPriceLineView(widget as never)

    view.draw({} as never)

    expect(leftPercentageAxis.convertToPixel).toHaveBeenCalledWith(110)
    expect(rightPriceAxis.convertToPixel).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      coordinates: [
        { x: 0, y: 42 },
        { x: 80, y: 42 }
      ]
    })
  })
})
