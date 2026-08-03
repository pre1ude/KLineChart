import { beforeEach, describe, expect, it, vi } from 'vitest'

import type KLineData from '../../../common/KLineData'
import { LineType } from '../../../common/Styles'
import { Indicator, IndicatorSeries } from '../../../component/Indicator'
import { drawStaticFigure } from '../../figure'
import { calculateTD9Outputs } from '../td9'
import type { TD9BarOutput, TD9InputBar } from '../td9/types'
import { getIndicatorTemplate, getSupportedIndicators } from '../index'

vi.mock('../../figure', () => ({
  drawStaticFigure: vi.fn()
}))

function makeBar(close: number, index: number): TD9InputBar {
  return {
    timestamp: index,
    open: close,
    high: close + 0.25,
    low: close - 0.25,
    close
  }
}

function createIndicator(result: TD9BarOutput[] = []): Indicator<TD9BarOutput> {
  const template = getIndicatorTemplate('td9_timeshare')
  expect(template).toBeDefined()
  const indicator = new Indicator(template!) as Indicator<TD9BarOutput>
  indicator.result = result
  return indicator
}

describe('TD9 timeshare built-in indicator', () => {
  beforeEach(() => {
    vi.mocked(drawStaticFigure).mockReset()
  })

  it('registers a price-series indicator that reuses TD9 calculation', async () => {
    expect(getSupportedIndicators()).toContain('td9_timeshare')
    const indicator = createIndicator()
    expect(indicator).toMatchObject({
      name: 'td9_timeshare',
      shortName: 'TD9 Timeshare',
      series: IndicatorSeries.Price,
      shouldOhlc: true,
      figures: []
    })

    const data = Array.from({ length: 13 }, (_, index) => makeBar(100 - index, index))
    expect(await indicator.calc(data, indicator)).toEqual(calculateTD9Outputs(data))
  })

  it('starts the colored path at Setup 1 and labels only Setup 9', () => {
    const result: TD9BarOutput[] = [
      { barIndex: 0, timestamp: 0, provisional: false },
      {
        barIndex: 1,
        timestamp: 1,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction: 'BUY', value: 1 }
      },
      {
        barIndex: 2,
        timestamp: 2,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction: 'BUY', value: 2 }
      },
      {
        barIndex: 3,
        timestamp: 3,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction: 'BUY', value: 9, perfected: true }
      }
    ]
    const alphaStack: number[] = []
    const opacities: number[] = []
    const ctx = {
      globalAlpha: 1,
      save: vi.fn(() => { alphaStack.push(ctx.globalAlpha) }),
      restore: vi.fn(() => { ctx.globalAlpha = alphaStack.pop() ?? 1 })
    } as unknown as CanvasRenderingContext2D
    vi.mocked(drawStaticFigure).mockImplementation(ctx => {
      opacities.push(ctx.globalAlpha)
    })
    const indicator = createIndicator(result)
    const bars: KLineData[] = [makeBar(11, 0), makeBar(10, 1), makeBar(9, 2), makeBar(8, 3)]

    indicator.draw?.({
      ctx,
      kLineDataList: bars,
      indicator,
      visibleRange: { from: 0, to: 3 },
      bounding: { width: 100, height: 200, left: 0, top: 0 },
      xAxis: { convertToPixel: (value: number) => value * 10 },
      yAxis: { convertToPixel: (value: number) => value * 10 }
    } as never)

    expect(vi.mocked(drawStaticFigure).mock.calls).toHaveLength(4)
    expect(vi.mocked(drawStaticFigure).mock.calls[0]).toMatchObject([
      ctx,
      'line',
      {
        attrs: { coordinates: [{ x: 10, y: 100 }, { x: 20, y: 90 }] },
        styles: { color: '#D94A4A', size: 2, style: LineType.Solid }
      }
    ])
    expect(vi.mocked(drawStaticFigure).mock.calls[2]).toMatchObject([
      ctx,
      'line',
      {
        attrs: { coordinates: [{ x: 30, y: 80 }, { x: 30, y: 90 }] },
        styles: { color: '#D94A4A', style: LineType.Dashed, dashedValue: [2, 2] }
      }
    ])
    expect(vi.mocked(drawStaticFigure).mock.calls[3]).toMatchObject([
      ctx,
      'text',
      {
        attrs: { x: 30, y: 92, text: '9', baseline: 'top' },
        styles: { color: '#D94A4A', size: 24 }
      }
    ])
    expect(opacities).toEqual([1, 1, 1, 1])
  })

  it('extends a Sell Setup 9 marker upward', () => {
    const result: TD9BarOutput[] = [
      {
        barIndex: 0,
        timestamp: 0,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction: 'SELL', value: 8 }
      },
      {
        barIndex: 1,
        timestamp: 1,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction: 'SELL', value: 9 }
      }
    ]
    const ctx = {
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn()
    } as unknown as CanvasRenderingContext2D
    const indicator = createIndicator(result)

    indicator.draw?.({
      ctx,
      kLineDataList: [makeBar(9, 0), makeBar(10, 1)],
      indicator,
      visibleRange: { from: 0, to: 1 },
      bounding: { width: 100, height: 200, left: 0, top: 0 },
      xAxis: { convertToPixel: (value: number) => value * 10 },
      yAxis: { convertToPixel: (value: number) => value * 10 }
    } as never)

    expect(vi.mocked(drawStaticFigure).mock.calls[1][2]).toMatchObject({
      attrs: { coordinates: [{ x: 10, y: 100 }, { x: 10, y: 90 }] }
    })
    expect(vi.mocked(drawStaticFigure).mock.calls[2][2]).toMatchObject({
      attrs: { x: 10, y: 88, text: '9', baseline: 'bottom' }
    })
  })

  it.each([
    {
      direction: 'BUY' as const,
      y: 180,
      line: [{ x: 10, y: 180 }, { x: 10, y: 170 }],
      text: { x: 10, y: 168, text: '9', baseline: 'bottom' }
    },
    {
      direction: 'SELL' as const,
      y: 20,
      line: [{ x: 10, y: 20 }, { x: 10, y: 30 }],
      text: { x: 10, y: 32, text: '9', baseline: 'top' }
    }
  ])('reverses a $direction Setup 9 marker when its default side has insufficient space', ({
    direction,
    y,
    line,
    text
  }) => {
    const result: TD9BarOutput[] = [
      {
        barIndex: 0,
        timestamp: 0,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction, value: 8 }
      },
      {
        barIndex: 1,
        timestamp: 1,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction, value: 9, perfected: true }
      }
    ]
    const ctx = {
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn()
    } as unknown as CanvasRenderingContext2D
    const indicator = createIndicator(result)

    indicator.draw?.({
      ctx,
      kLineDataList: [makeBar(9, 0), makeBar(10, 1)],
      indicator,
      visibleRange: { from: 0, to: 1 },
      bounding: { width: 100, height: 200, left: 0, top: 0 },
      xAxis: { convertToPixel: (value: number) => value * 10 },
      yAxis: { convertToPixel: () => y }
    } as never)

    expect(vi.mocked(drawStaticFigure).mock.calls[1][2]).toMatchObject({
      attrs: { coordinates: line }
    })
    expect(vi.mocked(drawStaticFigure).mock.calls[2][2]).toMatchObject({
      attrs: text
    })
  })
})
