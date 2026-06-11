import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, YAxisType } from '../common/Styles'
import { drawStaticFigure } from '../extension/figure'
import { PaneIdConstants } from '../pane/types'
import GridView from './GridView'

vi.mock('../extension/figure', () => ({
  drawStaticFigure: vi.fn()
}))

describe('GridView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  it('draws horizontal grid lines from the main candle coordinate axis', () => {
    const styles = getDefaultStyles()
    styles.grid.vertical.show = false
    const leftPercentageAxis = {
      getTicks: vi.fn(() => [{ coord: 11, value: 1, text: '1%' }])
    }
    const rightPriceAxis = {
      getTicks: vi.fn(() => [
        { coord: 42, value: 100, text: '100' },
        { coord: 86, value: 110, text: '110' }
      ])
    }
    const leftPercentageWidget = {
      getAxisType: () => YAxisType.Percentage,
      getAxisComponent: () => leftPercentageAxis
    }
    const rightPriceWidget = {
      getAxisType: () => YAxisType.Normal,
      getAxisComponent: () => rightPriceAxis
    }
    const pane = {
      getId: () => PaneIdConstants.CANDLE,
      getChart: () => ({ getStyles: () => styles }),
      getYLeftAxisWidget: () => leftPercentageWidget,
      getYRightAxisWidget: () => rightPriceWidget,
      getMainAxisWidget: () => leftPercentageWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 120, height: 80, left: 0, top: 0 })
    }
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      globalCompositeOperation: 'source-over'
    }
    const view = new GridView(widget as never)

    view.draw(ctx as never)

    expect(leftPercentageAxis.getTicks).toHaveBeenCalledTimes(1)
    expect(rightPriceAxis.getTicks).not.toHaveBeenCalled()
    expect(vi.mocked(drawStaticFigure)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toEqual([
      {
        coordinates: [
          { x: 0, y: 11 },
          { x: 120, y: 11 }
        ]
      }
    ])
  })
})
