import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import { YScaleType } from '../component/YScale'
import { drawStaticFigure } from '../extension/figure'
import { YAxisLabelDisplay } from '../widget/YAxisWidget'
import CandleLastPriceLabelView from './CandleLastPriceLabelView'

vi.mock('../extension/figure', () => ({
  drawStaticFigure: vi.fn()
}))

function createView(labelDisplay: YAxisLabelDisplay, y: number, formatter?: (value: number) => string): {
  view: CandleLastPriceLabelView
  convertToPixel: ReturnType<typeof vi.fn>
} {
  const styles = getDefaultStyles()
  const convertToPixel = vi.fn(() => y)
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
    getChart: () => ({ getChartStore: () => chartStore })
  }
  const widget = {
    getPane: () => pane,
    getBounding: () => ({ width: 80, height: 120, left: 0, top: 0 }),
    getScale: () => ({ getOptions: () => ({ formatter }) }),
    getScaleComponent: () => ({ convertToPixel }),
    getScaleType: () => YScaleType.Normal,
    formatLabel: (value: number, fallback: string) => labelDisplay === YAxisLabelDisplay.Percentage
      ? `${((value - 100) / 100 * 100).toFixed(2)}%`
      : fallback,
    isAlignLeft: () => false
  }
  return {
    view: new CandleLastPriceLabelView(widget as never),
    convertToPixel
  }
}

describe('CandleLastPriceLabelView', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockClear()
  })

  it('uses the visual axis referenced shared scale for coordinate and formatting', () => {
    const { view, convertToPixel } = createView(YAxisLabelDisplay.Percentage, 42)

    view.draw({} as never)

    expect(convertToPixel).toHaveBeenCalledWith(110)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      y: 42,
      text: '10.00%'
    })
  })

  it('formats normal shared-scale values as prices', () => {
    const { view } = createView(YAxisLabelDisplay.Value, 42)

    view.draw({} as never)

    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({
      text: '110.00'
    })
  })

  it('uses the shared scale formatter for its latest-value label', () => {
    const formatter = vi.fn((value: number) => `$${value}`)
    const { view } = createView(YAxisLabelDisplay.Value, 42, formatter)

    view.draw({} as never)

    expect(formatter).toHaveBeenCalledWith(110)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({ text: '$110' })
  })

  it('does not draw a label outside the scale range', () => {
    const { view } = createView(YAxisLabelDisplay.Value, -1)

    view.draw({} as never)

    expect(vi.mocked(drawStaticFigure)).not.toHaveBeenCalled()
  })

  it('keeps the label fully visible near the scale edge', () => {
    const { view } = createView(YAxisLabelDisplay.Value, 2)

    view.draw({} as never)

    expect(vi.mocked(drawStaticFigure).mock.calls[0][2].attrs).toMatchObject({ y: 10 })
  })
})
