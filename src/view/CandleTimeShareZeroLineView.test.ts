import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, LineType } from '../common/Styles'
import { drawStaticFigure } from '../extension/figure'
import CandleTimeShareZeroLineView from './CandleTimeShareZeroLineView'

vi.mock('../extension/figure', () => ({
  drawStaticFigure: vi.fn()
}))

describe('CandleTimeShareZeroLineView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  it('draws the time-share zero line with primary horizontal grid style', () => {
    const styles = getDefaultStyles()
    styles.grid.horizontal.style = LineType.Dashed
    styles.grid.horizontal.color = '#eeeeee'
    styles.grid.horizontal.size = 1
    styles.grid.horizontal.dashedValue = [3, 3]
    styles.grid.horizontal.primary = {
      color: '#123456',
      size: 2,
      dashedValue: [8, 4]
    }
    styles.candle.priceMark.last.line.style = LineType.Solid
    styles.candle.priceMark.last.line.size = 3
    styles.candle.priceMark.last.noChangeColor = '#abcdef'
    styles.candle.priceMark.show = false

    const yAxis = {
      convertToPixel: vi.fn(() => 42)
    }
    const chartStore = {
      getIsTimeShare: () => true,
      getStyles: () => styles,
      getTimeShareBasisPrice: () => 100
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getMainAxisWidget: () => ({ getAxisComponent: () => yAxis })
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 })
    }
    const view = new CandleTimeShareZeroLineView(widget as never)

    view.draw({} as never)

    expect(yAxis.convertToPixel).toHaveBeenCalledWith(100)
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2]).toMatchObject({
      attrs: {
        coordinates: [
          { x: 0, y: 42 },
          { x: 80, y: 42 }
        ]
      },
      styles: {
        style: LineType.Dashed,
        color: '#123456',
        size: 2,
        dashedValue: [8, 4]
      }
    })
  })

  it('does not draw when primary horizontal grid lines are hidden', () => {
    const styles = getDefaultStyles()
    styles.grid.horizontal.primary = {
      show: false
    }
    const chartStore = {
      getIsTimeShare: () => true,
      getStyles: () => styles,
      getTimeShareBasisPrice: () => 100
    }
    const pane = {
      getChart: () => ({ getChartStore: () => chartStore }),
      getMainAxisWidget: () => ({ getAxisComponent: () => ({ convertToPixel: vi.fn(() => 42) }) })
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 })
    }
    const view = new CandleTimeShareZeroLineView(widget as never)

    view.draw({} as never)

    expect(vi.mocked(drawStaticFigure)).not.toHaveBeenCalled()
  })
})
