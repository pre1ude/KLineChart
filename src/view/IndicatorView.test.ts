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

describe('IndicatorView', () => {
  beforeEach(() => {
    vi.mocked(createFigure).mockClear()
    figureMock.setAttrs.mockClear()
    figureMock.setStyles.mockClear()
    figureMock.setData.mockClear()
    figureMock.draw.mockClear()
  })

  it('snaps default bar rect horizontal edges to integer fill-rect pixels', () => {
    const styles = getDefaultStyles()
    const yAxis = {
      convertToPixel: vi.fn((value: number) => value === 0 ? 100 : 60),
      getRange: () => ({ from: 0, to: 100 })
    }
    const yAxisWidget = {
      getAxisComponent: () => yAxis
    }
    const xAxis = {}
    const dataList = [{ open: 1, high: 1, low: 1, close: 1, volume: 10 }]
    const indicator = {
      visible: true,
      figures: [{ key: 'volume', type: 'bar', baseValue: 0 }],
      result: [{ volume: 10 }]
    }
    const chartStore = {
      getDataList: () => dataList,
      getVisibleDataList: () => [{
        dataIndex: 0,
        x: 20.4,
        data: dataList[0]
      }],
      getTimeScaleStore: () => ({
        getVisibleRange: () => ({ from: 0, to: 0 }),
        getBarSpace: () => ({
          bar: 8,
          halfBar: 4,
          gapBar: 8,
          halfGapBar: 4
        })
      }),
      getIndicatorStore: () => ({
        getInstances: () => [indicator]
      }),
      getIsTimeShare: () => false,
      getTimeShareTicks: () => [],
      getTimeShareBreakOnCrossDays: () => false,
      getStyles: () => styles
    }
    const chart = {
      getStyles: () => styles,
      getChartStore: () => chartStore,
      getXAxisPane: () => ({
        getMainWidget: () => ({
          getAxisComponent: () => xAxis
        })
      })
    }
    const pane = {
      getId: () => `${PaneIdConstants.INDICATOR}vol`,
      getChart: () => chart,
      getYLeftAxisWidget: () => yAxisWidget,
      getYRightAxisWidget: () => yAxisWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 100, height: 100, left: 0, top: 0 })
    }
    const ctx = {
      save: vi.fn(),
      restore: vi.fn()
    }
    const view = new IndicatorView(widget as never)

    view.draw(ctx as never)

    expect(createFigure).toHaveBeenCalledWith('rect')
    const attrs = figureMock.setAttrs.mock.calls[0][0] as RectAttrs
    expect(attrs.x).toBe(16)
    expect(attrs.width).toBe(8)
  })

  it('keeps a 1px bar on the same pixel column as the crosshair at half-pixel data coordinates', () => {
    const styles = getDefaultStyles()
    const yAxis = {
      convertToPixel: vi.fn((value: number) => value === 0 ? 100 : 60),
      getRange: () => ({ from: 0, to: 100 })
    }
    const yAxisWidget = {
      getAxisComponent: () => yAxis
    }
    const xAxis = {}
    const dataList = [{ open: 1, high: 1, low: 1, close: 1, volume: 10 }]
    const indicator = {
      visible: true,
      figures: [{ key: 'volume', type: 'bar', baseValue: 0 }],
      result: [{ volume: 10 }]
    }
    const chartStore = {
      getDataList: () => dataList,
      getVisibleDataList: () => [{
        dataIndex: 0,
        x: 20.5,
        data: dataList[0]
      }],
      getTimeScaleStore: () => ({
        getVisibleRange: () => ({ from: 0, to: 0 }),
        getBarSpace: () => ({
          bar: 1,
          halfBar: 0.5,
          gapBar: 1,
          halfGapBar: 0
        })
      }),
      getIndicatorStore: () => ({
        getInstances: () => [indicator]
      }),
      getIsTimeShare: () => false,
      getTimeShareTicks: () => [],
      getTimeShareBreakOnCrossDays: () => false,
      getStyles: () => styles
    }
    const chart = {
      getStyles: () => styles,
      getChartStore: () => chartStore,
      getXAxisPane: () => ({
        getMainWidget: () => ({
          getAxisComponent: () => xAxis
        })
      })
    }
    const pane = {
      getId: () => `${PaneIdConstants.INDICATOR}vol`,
      getChart: () => chart,
      getYLeftAxisWidget: () => yAxisWidget,
      getYRightAxisWidget: () => yAxisWidget
    }
    const widget = {
      getPane: () => pane,
      getBounding: () => ({ width: 100, height: 100, left: 0, top: 0 })
    }
    const ctx = {
      save: vi.fn(),
      restore: vi.fn()
    }
    const view = new IndicatorView(widget as never)

    view.draw(ctx as never)

    const attrs = figureMock.setAttrs.mock.calls[0][0] as RectAttrs
    expect(attrs.x).toBe(20)
    expect(attrs.width).toBe(1)
  })
})
