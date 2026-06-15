import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CandleType, getDefaultStyles, YAxisPosition, YAxisType } from '../common/Styles'
import { createFigure } from '../extension/figure'
import { type RectAttrs } from '../extension/figure/rect'
import { PaneIdConstants } from '../pane/types'
import CandleBarView, { resolveIndicatorOhlcYAxisPosition } from './CandleBarView'

const figureMock = vi.hoisted(() => {
  const instance = {
    setAttrs: vi.fn(),
    setStyles: vi.fn(),
    draw: vi.fn()
  }
  instance.setAttrs.mockReturnValue(instance)
  instance.setStyles.mockReturnValue(instance)
  return instance
})

vi.mock('../extension/figure', () => ({
  createFigure: vi.fn(() => figureMock)
}))

beforeEach(() => {
  vi.mocked(createFigure).mockClear()
  figureMock.setAttrs.mockClear()
  figureMock.setStyles.mockClear()
  figureMock.draw.mockClear()
})

describe('resolveIndicatorOhlcYAxisPosition', () => {
  it('uses global right y-axis as the default for indicators without explicit binding', () => {
    expect(resolveIndicatorOhlcYAxisPosition({}, YAxisPosition.Right)).toBe('right')
  })

  it('keeps explicit indicator y-axis binding', () => {
    expect(resolveIndicatorOhlcYAxisPosition({ yAxisPosition: 'right' }, YAxisPosition.Left)).toBe('right')
    expect(resolveIndicatorOhlcYAxisPosition({ yAxisPosition: 'left' }, YAxisPosition.Right)).toBe('left')
  })

  it('falls back to left when global y-axis position is left or both', () => {
    expect(resolveIndicatorOhlcYAxisPosition({}, YAxisPosition.Left)).toBe('left')
    expect(resolveIndicatorOhlcYAxisPosition({}, YAxisPosition.Both)).toBe('left')
  })
})

describe('CandleBarView', () => {
  it('draws main candles with the main candle coordinate axis', () => {
    const styles = getDefaultStyles()
    styles.candle.type = CandleType.CandleSolid
    const leftPercentageAxis = {
      convertToPixel: vi.fn((value: number) => value)
    }
    const rightPriceAxis = {
      convertToPixel: vi.fn(() => 1)
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
      getIsTimeShare: () => false,
      getStyles: () => styles,
      getVisibleDataList: () => [{
        dataIndex: 0,
        x: 20,
        data: { open: 100, high: 120, low: 90, close: 110 }
      }],
      getTimeScaleStore: () => ({
        getBarSpace: () => ({
          bar: 8,
          halfBar: 4,
          gapBar: 8,
          halfGapBar: 4
        })
      }),
      getIndicatorStore: () => ({
        getInstances: () => []
      })
    }
    const pane = {
      getId: () => PaneIdConstants.CANDLE,
      getChart: () => ({ getChartStore: () => chartStore }),
      getYLeftAxisWidget: () => leftPercentageWidget,
      getYRightAxisWidget: () => rightPriceWidget,
      getMainAxisWidget: () => leftPercentageWidget
    }
    const widget = {
      getPane: () => pane
    }
    const view = new CandleBarView(widget as never)

    view.draw({} as never)

    expect(leftPercentageAxis.convertToPixel).toHaveBeenCalledWith(100)
    expect(leftPercentageAxis.convertToPixel).toHaveBeenCalledWith(110)
    expect(leftPercentageAxis.convertToPixel).toHaveBeenCalledWith(120)
    expect(leftPercentageAxis.convertToPixel).toHaveBeenCalledWith(90)
    expect(rightPriceAxis.convertToPixel).not.toHaveBeenCalled()
    expect(createFigure).toHaveBeenCalled()
  })

  it('snaps candle wick and body horizontal edges to integer fill-rect pixels', () => {
    const styles = getDefaultStyles()
    styles.candle.type = CandleType.CandleSolid
    const yAxis = {
      convertToPixel: vi.fn((value: number) => value)
    }
    const yAxisWidget = {
      getAxisType: () => YAxisType.Normal,
      getAxisComponent: () => yAxis
    }
    const chartStore = {
      getIsTimeShare: () => false,
      getStyles: () => styles,
      getVisibleDataList: () => [{
        dataIndex: 0,
        x: 20.4,
        data: { open: 100, high: 120, low: 90, close: 110 }
      }],
      getTimeScaleStore: () => ({
        getBarSpace: () => ({
          bar: 8,
          halfBar: 4,
          gapBar: 8,
          halfGapBar: 4
        })
      }),
      getIndicatorStore: () => ({
        getInstances: () => []
      })
    }
    const pane = {
      getId: () => PaneIdConstants.CANDLE,
      getChart: () => ({ getChartStore: () => chartStore }),
      getYLeftAxisWidget: () => yAxisWidget,
      getYRightAxisWidget: () => yAxisWidget,
      getMainAxisWidget: () => yAxisWidget
    }
    const widget = {
      getPane: () => pane
    }
    const view = new CandleBarView(widget as never)

    view.draw({} as never)

    const [wickAttrs] = figureMock.setAttrs.mock.calls[0][0] as RectAttrs[]
    const [bodyAttrs] = figureMock.setAttrs.mock.calls[1][0] as RectAttrs[]
    expect(wickAttrs.x).toBe(20)
    expect(bodyAttrs.x).toBe(16)
    expect(bodyAttrs.width).toBe(8)
  })
})
