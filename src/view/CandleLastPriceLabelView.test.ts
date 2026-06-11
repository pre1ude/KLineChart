import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, YAxisType } from '../common/Styles'
import { drawStaticFigure } from '../extension/figure'
import CandleLastPriceLabelView from './CandleLastPriceLabelView'

vi.mock('../extension/figure', () => ({
  drawStaticFigure: vi.fn()
}))

describe('CandleLastPriceLabelView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  it('formats percentage y-axis latest-price labels while aligning to the main candle axis pixel', () => {
    const styles = getDefaultStyles()
    const leftPriceAxis = {
      convertToPixel: vi.fn(() => 42)
    }
    const rightPercentageAxis = {
      convertToPixel: vi.fn(() => 86)
    }
    const leftPriceWidget = {
      getAxisType: () => YAxisType.Normal,
      getAxisComponent: () => leftPriceAxis
    }
    const rightPercentageWidget = {
      getAxisType: () => YAxisType.Percentage,
      getAxisComponent: () => rightPercentageAxis
    }
    const chartStore = {
      getStyles: () => styles,
      getPrecision: () => ({ price: 2 }),
      getDataList: () => [{ open: 105, close: 110 }],
      getVisibleFirstData: () => ({ close: 100 }),
      getMinutePercentageBasis: () => 100,
      getThousandsSeparator: () => ',',
      getDecimalFoldThreshold: () => 100
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getYLeftAxisWidget: () => leftPriceWidget,
      getYRightAxisWidget: () => rightPercentageWidget,
      getMainAxisWidget: () => leftPriceWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 }),
      getAxisComponent: () => rightPercentageAxis,
      getAxisType: () => YAxisType.Percentage,
      isAlignLeft: () => false
    }
    const view = new CandleLastPriceLabelView(widget as never)

    view.draw({} as never)

    expect(leftPriceAxis.convertToPixel).toHaveBeenCalledWith(110)
    expect(rightPercentageAxis.convertToPixel).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      y: 42,
      text: '10.00%'
    })
  })

  it('formats minute percentage y-axis latest-price labels while aligning to the main candle axis pixel', () => {
    const styles = getDefaultStyles()
    const leftPriceAxis = {
      convertToPixel: vi.fn(() => 42)
    }
    const rightMinutePercentageAxis = {
      convertToPixel: vi.fn(() => 86)
    }
    const leftPriceWidget = {
      getAxisType: () => YAxisType.Normal,
      getAxisComponent: () => leftPriceAxis
    }
    const rightMinutePercentageWidget = {
      getAxisType: () => YAxisType.MinutePercentage,
      getAxisComponent: () => rightMinutePercentageAxis
    }
    const chartStore = {
      getStyles: () => styles,
      getPrecision: () => ({ price: 2 }),
      getDataList: () => [{ open: 105, close: 110 }],
      getVisibleFirstData: () => ({ close: 100 }),
      getMinutePercentageBasis: () => 100,
      getThousandsSeparator: () => ',',
      getDecimalFoldThreshold: () => 100
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getYLeftAxisWidget: () => leftPriceWidget,
      getYRightAxisWidget: () => rightMinutePercentageWidget,
      getMainAxisWidget: () => leftPriceWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 }),
      getAxisComponent: () => rightMinutePercentageAxis,
      getAxisType: () => YAxisType.MinutePercentage,
      isAlignLeft: () => false
    }
    const view = new CandleLastPriceLabelView(widget as never)

    view.draw({} as never)

    expect(leftPriceAxis.convertToPixel).toHaveBeenCalledWith(110)
    expect(rightMinutePercentageAxis.convertToPixel).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      y: 42,
      text: '10.00%'
    })
  })

  it('aligns left percentage y-axis latest-price labels to the main candle axis pixel', () => {
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
      getPrecision: () => ({ price: 2 }),
      getDataList: () => [{ open: 105, close: 110 }],
      getVisibleFirstData: () => ({ close: 100 }),
      getMinutePercentageBasis: () => 100,
      getThousandsSeparator: () => ',',
      getDecimalFoldThreshold: () => 100
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getYLeftAxisWidget: () => leftPercentageWidget,
      getYRightAxisWidget: () => rightPriceWidget,
      getMainAxisWidget: () => leftPercentageWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 }),
      getAxisComponent: () => leftPercentageAxis,
      getAxisType: () => YAxisType.Percentage,
      isAlignLeft: () => true
    }
    const view = new CandleLastPriceLabelView(widget as never)

    view.draw({} as never)

    expect(leftPercentageAxis.convertToPixel).toHaveBeenCalledWith(110)
    expect(rightPriceAxis.convertToPixel).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      y: 42,
      text: '10.00%'
    })
  })

  it('formats normal y-axis latest-price labels while aligning to the main candle axis pixel', () => {
    const styles = getDefaultStyles()
    const leftPriceAxis = {
      convertToPixel: vi.fn(() => 42)
    }
    const rightPriceAxis = {
      convertToPixel: vi.fn(() => 86)
    }
    const leftPriceWidget = {
      getAxisComponent: () => leftPriceAxis
    }
    const chartStore = {
      getStyles: () => styles,
      getPrecision: () => ({ price: 2 }),
      getDataList: () => [{ open: 105, close: 110 }],
      getVisibleFirstData: () => ({ close: 100 }),
      getMinutePercentageBasis: () => 100,
      getThousandsSeparator: () => ',',
      getDecimalFoldThreshold: () => 100
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getMainAxisWidget: () => leftPriceWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 }),
      getAxisComponent: () => rightPriceAxis,
      getAxisType: () => YAxisType.Normal,
      isAlignLeft: () => false
    }
    const view = new CandleLastPriceLabelView(widget as never)

    view.draw({} as never)

    expect(leftPriceAxis.convertToPixel).toHaveBeenCalledWith(110)
    expect(rightPriceAxis.convertToPixel).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      y: 42,
      text: '110.00'
    })
  })
})
