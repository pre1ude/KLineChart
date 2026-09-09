import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import { createFigure } from '../extension/figure'
import { type RectAttrs } from '../extension/figure/rect'
import { PaneIdConstants } from '../pane/types'
import IndicatorView from './IndicatorView'

const figureMock = vi.hoisted(() => {
  const instance = {
    setAttrs: vi.fn(),
    setStyles: vi.fn(),
    setData: vi.fn(),
    draw: vi.fn()
  }
  instance.setAttrs.mockReturnValue(instance)
  instance.setStyles.mockReturnValue(instance)
  instance.setData.mockReturnValue(instance)
  return instance
})

vi.mock('../extension/figure', () => ({
  createFigure: vi.fn(() => figureMock),
  drawStaticFigure: vi.fn()
}))

function createView(options: {
  x?: number
  halfGapBar?: number
  indicatorScaleId?: string
  defaultScale: { convertToPixel: (value: number) => number }
  otherScale?: { convertToPixel: (value: number) => number }
}): IndicatorView {
  const styles = getDefaultStyles()
  const dataList = [{ open: 1, high: 1, low: 1, close: 1, volume: 10 }]
  const indicator = {
    visible: true,
    yScaleId: options.indicatorScaleId ?? 'default',
    figures: [{ key: 'volume', type: 'bar', baseValue: 0 }],
    result: [{ volume: 10 }]
  }
  const halfGapBar = options.halfGapBar ?? 4
  const chartStore = {
    getDataList: () => dataList,
    getVisibleDataList: () => [{ dataIndex: 0, x: options.x ?? 20.4, data: dataList[0] }],
    getTimeScaleStore: () => ({
      getVisibleRange: () => ({ from: 0, to: 0 }),
      getBarSpace: () => ({
        bar: halfGapBar === 0 ? 1 : halfGapBar * 2,
        halfBar: halfGapBar,
        gapBar: halfGapBar === 0 ? 1 : halfGapBar * 2,
        halfGapBar
      })
    }),
    getIndicatorStore: () => ({ getInstances: () => [indicator] }),
    getIsTimeShare: () => false,
    getTimeShareTicks: () => [],
    getTimeShareBreakOnCrossDays: () => false,
    getStyles: () => styles
  }
  const chart = {
    getStyles: () => styles,
    getChartStore: () => chartStore,
    getXAxisPane: () => ({ getMainWidget: () => ({ getAxisComponent: () => ({}) }) })
  }
  const scales = new Map([
    ['default', { getComponent: () => options.defaultScale }],
    ['other', { getComponent: () => options.otherScale }]
  ])
  const pane = {
    getId: () => `${PaneIdConstants.INDICATOR}vol`,
    getChart: () => chart,
    resolveIndicatorYScaleId: (value: typeof indicator) => value.yScaleId,
    getYScaleById: (id: string) => scales.get(id)
  }
  const widget = {
    getPane: () => pane,
    getBounding: () => ({ width: 100, height: 100, left: 0, top: 0 })
  }
  return new IndicatorView(widget as never)
}

describe('IndicatorView', () => {
  beforeEach(() => {
    vi.mocked(createFigure).mockClear()
    figureMock.setAttrs.mockClear()
    figureMock.setStyles.mockClear()
    figureMock.setData.mockClear()
    figureMock.draw.mockClear()
  })

  it('snaps default-scale bar rect horizontal edges to integer fill-rect pixels', () => {
    const yScale = {
      convertToPixel: vi.fn((value: number) => value === 0 ? 100 : 60)
    }
    const view = createView({ defaultScale: yScale })

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(createFigure).toHaveBeenCalledWith('rect')
    expect(figureMock.setAttrs.mock.calls[0][0] as RectAttrs).toMatchObject({
      x: 16,
      y: 60,
      width: 8,
      height: 40
    })
  })

  it('uses the indicator yScaleId rather than any visual axis position', () => {
    const defaultScale = { convertToPixel: vi.fn(() => 100) }
    const otherScale = { convertToPixel: vi.fn((value: number) => value === 0 ? 80 : 20) }
    const view = createView({ indicatorScaleId: 'other', defaultScale, otherScale })

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(defaultScale.convertToPixel).not.toHaveBeenCalled()
    expect(otherScale.convertToPixel).toHaveBeenCalledWith(10)
    expect(otherScale.convertToPixel).toHaveBeenCalledWith(0)
  })

  it('keeps a 1px bar on the same pixel column as a half-pixel data coordinate', () => {
    const view = createView({
      x: 20.5,
      halfGapBar: 0,
      defaultScale: { convertToPixel: (value: number) => value === 0 ? 100 : 60 }
    })

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    const attrs = figureMock.setAttrs.mock.calls[0][0] as RectAttrs
    expect(attrs.x).toBe(20)
    expect(attrs.width).toBe(1)
  })
})
