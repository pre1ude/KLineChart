import { describe, expect, it } from 'vitest'

import type KLineData from '../../common/KLineData'
import { Indicator, IndicatorSeries } from '../../component/Indicator'
import { getIndicatorTemplate, getSupportedIndicators } from './index'

interface AtrChannelsResult {
  ema?: number
  ema2?: number
  plus1Atr?: number
  plus2Atr?: number
  plus3Atr?: number
  minus1Atr?: number
  minus2Atr?: number
  minus3Atr?: number
  ema50?: number
  ema200?: number
}

function bar(high: number, low: number, close: number, timestamp: number): KLineData {
  return { timestamp, open: close, high, low, close }
}

function createAtrChannels(calcParams?: number[]): Indicator<AtrChannelsResult> {
  const template = getIndicatorTemplate('ATR_CHANNELS')
  expect(template).toBeDefined()
  const indicator = new Indicator(template!) as Indicator<AtrChannelsResult>
  if (calcParams != null) {
    indicator.override({ calcParams })
  }
  return indicator
}

async function calculate(dataList: KLineData[], calcParams?: number[]): Promise<AtrChannelsResult[]> {
  const indicator = createAtrChannels(calcParams)
  return await indicator.calc(dataList, indicator)
}

describe('ATR Channels built-in indicator', () => {
  it('registers the TradingView-compatible price-series template', () => {
    expect(getSupportedIndicators()).toContain('ATR_CHANNELS')

    const template = getIndicatorTemplate('ATR_CHANNELS')
    expect(template).toMatchObject({
      name: 'ATR_CHANNELS',
      shortName: 'ATR Channels',
      series: IndicatorSeries.Price,
      calcParams: [26, 13],
      shouldOhlc: true,
      figures: [
        { key: 'ema', title: 'EMA: ', type: 'line', calcParamIndex: 0 },
        { key: 'ema2', title: 'EMA 2: ', type: 'line', calcParamIndex: 1 },
        { key: 'plus1Atr', title: '+1 ATR: ', type: 'line', calcParamIndex: 0 },
        { key: 'plus2Atr', title: '+2 ATR: ', type: 'line', calcParamIndex: 0 },
        { key: 'plus3Atr', title: '+3 ATR: ', type: 'line', calcParamIndex: 0 },
        { key: 'minus1Atr', title: '-1 ATR: ', type: 'line', calcParamIndex: 0 },
        { key: 'minus2Atr', title: '-2 ATR: ', type: 'line', calcParamIndex: 0 },
        { key: 'minus3Atr', title: '-3 ATR: ', type: 'line', calcParamIndex: 0 },
        { key: 'ema50', title: '50 EMA: ', type: 'line' },
        { key: 'ema200', title: '200 EMA: ', type: 'line' }
      ]
    })

    expect(template?.styles?.figures).toMatchObject({
      ema: { color: 'rgba(255, 152, 0, 0.85)', size: 2 },
      ema2: { color: 'rgba(66, 165, 245, 0.85)', size: 2 },
      plus1Atr: { color: '#787B86' },
      plus2Atr: { color: '#434651' },
      plus3Atr: { color: '#787B86' },
      minus1Atr: { color: '#787B86' },
      minus2Atr: { color: '#434651' },
      minus3Atr: { color: '#787B86' },
      ema50: { color: 'rgba(144, 0, 0, 0.9)', size: 1 },
      ema200: { color: 'rgba(156, 39, 176, 0.7)', size: 1, visible: false }
    })
  })

  it('matches Pine EMA and Wilder ATR initialization and updates', async () => {
    const result = await calculate([
      bar(12, 8, 10, 0),
      bar(15, 11, 14, 1),
      bar(13, 9, 10, 2),
      bar(16, 12, 15, 3),
      bar(15, 13, 14, 4)
    ], [3, 2])

    expect(result[0]).toEqual({ ema: 10, ema2: 10, ema50: 10, ema200: 10 })
    expect(result[1].ema).toBe(12)
    expect(result[1].ema2).toBeCloseTo(38 / 3, 10)
    expect(result[1].plus1Atr).toBeUndefined()

    expect(result[2].ema).toBe(11)
    expect(result[2].ema2).toBeCloseTo(98 / 9, 10)
    expect(result[2].plus1Atr).toBeCloseTo(47 / 3, 10)
    expect(result[2].plus2Atr).toBeCloseTo(61 / 3, 10)
    expect(result[2].plus3Atr).toBe(25)
    expect(result[2].minus1Atr).toBeCloseTo(19 / 3, 10)
    expect(result[2].minus2Atr).toBeCloseTo(5 / 3, 10)
    expect(result[2].minus3Atr).toBe(-3)

    expect(result[3].ema).toBe(13)
    expect(result[3].plus1Atr).toBeCloseTo(163 / 9, 10)
    expect(result[4].ema).toBe(13.5)
    expect(result[4].plus1Atr).toBeCloseTo(13.5 + 110 / 27, 10)
    expect(result[4].minus3Atr).toBeCloseTo(13.5 - 110 / 9, 10)
  })

  it('preserves alignment for empty and warming inputs', async () => {
    expect(await calculate([], [3, 2])).toEqual([])
    expect(await calculate([bar(12, 8, 10, 0)], [3, 2])).toEqual([
      { ema: 10, ema2: 10, ema50: 10, ema200: 10 }
    ])
  })

  it('isolates invalid configurable periods', async () => {
    const dataList = [
      bar(12, 8, 10, 0),
      bar(15, 11, 14, 1)
    ]

    const invalidChannel = await calculate(dataList, [0, 2])
    expect(invalidChannel[0]).toMatchObject({
      ema: NaN,
      ema2: 10,
      plus1Atr: NaN,
      minus3Atr: NaN,
      ema50: 10,
      ema200: 10
    })

    const invalidSecondEma = await calculate(dataList, [2, 0])
    expect(invalidSecondEma[0]).toMatchObject({ ema: 10, ema2: NaN, ema50: 10, ema200: 10 })
    expect(invalidSecondEma[1].plus1Atr).toBeDefined()
  })
})
