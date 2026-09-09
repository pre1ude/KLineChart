import { describe, expect, it, vi } from 'vitest'

import { YScaleType, type YScale } from '../component/YScale'
import YAxisWidget, { YAxisLabelDisplay, type YAxisOptions } from './YAxisWidget'

interface WidgetFixtureOptions {
  display: YAxisLabelDisplay
  visibleFirstClose?: number
  minuteBasis?: number
  scaleType?: YScaleType
  ticks?: Array<{ coord: number, value: number, text: string }>
  convertToRealValue?: (value: number) => number
}

function createWidget(options: WidgetFixtureOptions): {
  widget: YAxisWidget
  scale: Pick<YScale, 'getTicks' | 'getAutoSize' | 'convertToRealValue'>
} {
  const scale = {
    getTicks: vi.fn(() => options.ticks ?? []),
    convertToRealValue: vi.fn(options.convertToRealValue ?? ((value: number) => value)),
    getAutoSize: vi.fn((ticks, formatLabel) => {
      const tickWidth = (ticks ?? []).reduce((width, tick) => Math.max(width, tick.text.length), 0)
      return Math.max(tickWidth, formatLabel?.(120, '120').length ?? 0)
    })
  }
  const chartStore = {
    getVisibleFirstData: () => options.visibleFirstClose === undefined ? undefined : { close: options.visibleFirstClose },
    getMinutePercentageBasis: () => options.minuteBasis ?? 0,
    getThousandsSeparator: () => ',',
    getDecimalFoldThreshold: () => 100
  }
  const scaleHost = {
    getOptions: () => ({ type: options.scaleType ?? YScaleType.Normal }),
    getComponent: () => scale
  }
  const pane = {
    getId: () => 'candle_pane',
    getChart: () => ({ getChartStore: () => chartStore }),
    getYScaleById: () => scaleHost,
    isDefaultYScale: (id: string) => id === 'price'
  }
  const widget = Object.assign(Object.create(YAxisWidget.prototype) as YAxisWidget, {
    getPane: () => pane
  })
  Reflect.set(widget, '_axisOptions', {
    id: 'axis',
    paneId: 'candle_pane',
    yScaleId: 'price',
    needWidget: true,
    position: 'left',
    order: 0,
    labelDisplay: options.display
  } satisfies YAxisOptions)
  return { widget, scale }
}

describe('YAxisWidget label projection', () => {
  it('keeps shared tick geometry while projecting percentage text per axis', () => {
    const ticks = [
      { coord: 80, value: 100, text: '100.00' },
      { coord: 20, value: 110, text: '110.00' }
    ]
    const valueAxis = createWidget({ display: YAxisLabelDisplay.Value, visibleFirstClose: 100, ticks }).widget
    const percentageAxis = createWidget({ display: YAxisLabelDisplay.Percentage, visibleFirstClose: 100, ticks }).widget

    expect(valueAxis.getTicks()).toEqual(ticks)
    expect(percentageAxis.getTicks()).toEqual([
      { coord: 80, value: 100, text: '0.00%' },
      { coord: 20, value: 110, text: '10.00%' }
    ])
    expect(percentageAxis.getTicks().map(tick => tick.coord)).toEqual(valueAxis.getTicks().map(tick => tick.coord))
  })

  it('uses the minute basis only for minute-percentage labels', () => {
    const { widget } = createWidget({
      display: YAxisLabelDisplay.MinutePercentage,
      visibleFirstClose: 80,
      minuteBasis: 100
    })

    expect(widget.formatLabel(105, '105.00')).toBe('5.00%')
  })

  it('projects the canonical real value from a log scale', () => {
    const convertToRealValue = vi.fn((value: number) => 10 ** value)
    const { widget } = createWidget({
      display: YAxisLabelDisplay.Percentage,
      visibleFirstClose: 100,
      scaleType: YScaleType.Log,
      ticks: [{ coord: 40, value: Math.log10(110), text: '110.00' }],
      convertToRealValue
    })

    expect(widget.getTicks()[0]).toMatchObject({ coord: 40, text: '10.00%' })
    expect(convertToRealValue).toHaveBeenCalledWith(Math.log10(110))
  })

  it('uses an unavailable marker when the percentage basis is unavailable or invalid', () => {
    const missingBasis = createWidget({ display: YAxisLabelDisplay.Percentage }).widget
    const zeroBasis = createWidget({ display: YAxisLabelDisplay.MinutePercentage, minuteBasis: 0 }).widget

    expect(missingBasis.formatLabel(110, '110.00')).toBe('--')
    expect(zeroBasis.formatLabel(110, '110.00')).toBe('--')
  })

  it('does not project non-price scales as chart price percentages', () => {
    const { widget } = createWidget({
      display: YAxisLabelDisplay.Percentage,
      visibleFirstClose: 100
    })
    Reflect.set(widget, '_axisOptions', {
      ...widget.getOptions(),
      yScaleId: 'volume'
    })
    expect(widget.formatLabel(110, '110.00')).toBe('--')
  })

  it('measures auto width with the visual axis projection', () => {
    const { widget, scale } = createWidget({
      display: YAxisLabelDisplay.Percentage,
      visibleFirstClose: 100,
      ticks: [{ coord: 20, value: 110, text: '110.00' }]
    })

    expect(widget.getAutoSize()).toBe('20.00%'.length)
    expect(scale.getAutoSize).toHaveBeenCalledWith(
      [{ coord: 20, value: 110, text: '10.00%' }],
      expect.any(Function)
    )
  })
})
