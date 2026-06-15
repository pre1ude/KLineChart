import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import { drawStaticFigure } from '../extension/figure'
import CandleHighLowPriceView from './CandleHighLowPriceView'

vi.mock('../extension/figure', () => ({
  drawStaticFigure: vi.fn()
}))

describe('CandleHighLowPriceView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  it('snaps high and low price mark arrow lines to stroke pixels', () => {
    const styles = getDefaultStyles()
    styles.candle.priceMark.low.show = false
    const yAxis = {
      convertToPixel: vi.fn((value: number) => value === 100 ? 30.4 : 50.4)
    }
    const chartStore = {
      getStyles: () => styles,
      getThousandsSeparator: () => '',
      getDecimalFoldThreshold: () => 0,
      getPrecision: () => ({ price: 2 }),
      getVisibleDataList: () => [{
        x: 20.4,
        data: { high: 100, low: 80 }
      }]
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getMainAxisWidget: () => ({ getAxisComponent: () => yAxis })
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 100, height: 100, left: 0, top: 0 })
    }
    const view = new CandleHighLowPriceView(widget as never)

    view.draw({} as never)

    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toEqual({
      coordinates: [
        { x: 18.5, y: 26.5 },
        { x: 20.5, y: 28.5 },
        { x: 22.5, y: 26.5 }
      ]
    })
    expect(vi.mocked(drawStaticFigure).mock.calls[1][2].attrs).toEqual({
      coordinates: [
        { x: 20.5, y: 28.5 },
        { x: 20.5, y: 23.5 },
        { x: 25.5, y: 23.5 }
      ]
    })
    expect(vi.mocked(drawStaticFigure).mock.calls[2][2].attrs).toMatchObject({
      x: 30.5,
      y: 23.5
    })
  })
})
