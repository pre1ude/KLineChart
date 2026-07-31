import { describe, expect, it } from 'vitest'

import type KLineData from '../../common/KLineData'
import { Indicator, IndicatorSeries } from '../../component/Indicator'
import { getIndicatorTemplate, getSupportedIndicators } from './index'

interface AtrResult {
  atr?: number
}

function bar(high: number, low: number, close: number, timestamp: number): KLineData {
  return { timestamp, open: close, high, low, close }
}

function createAtr(calcParams?: number[]): Indicator<AtrResult> {
  const template = getIndicatorTemplate('ATR')
  expect(template).toBeDefined()
  const indicator = new Indicator(template!) as Indicator<AtrResult>
  if (calcParams != null) {
    indicator.override({ calcParams })
  }
  return indicator
}

async function calculate(dataList: KLineData[], calcParams?: number[]): Promise<AtrResult[]> {
  const indicator = createAtr(calcParams)
  return await indicator.calc(dataList, indicator)
}

describe('ATR built-in indicator', () => {
  it('registers the standard ATR template and defaults', () => {
    expect(getSupportedIndicators()).toContain('ATR')

    const template = getIndicatorTemplate('ATR')
    expect(template).toMatchObject({
      name: 'ATR',
      shortName: 'ATR',
      series: IndicatorSeries.Price,
      calcParams: [14],
      figures: [
        { key: 'atr', title: 'ATR: ', type: 'line' }
      ]
    })
  })

  it('uses true range and Wilder smoothing after the initial average', async () => {
    const result = await calculate([
      bar(12, 8, 10, 0),
      bar(15, 11, 14, 1),
      bar(13, 9, 10, 2),
      bar(16, 12, 15, 3),
      bar(15, 13, 14, 4)
    ], [3])

    expect(result.slice(0, 2)).toEqual([{}, {}])
    expect(result[2].atr).toBeCloseTo(14 / 3, 10)
    expect(result[3].atr).toBeCloseTo(46 / 9, 10)
    expect(result[4].atr).toBeCloseTo(110 / 27, 10)
  })

  it('preserves input alignment for empty and short inputs', async () => {
    expect(await calculate([], [3])).toEqual([])
    expect(await calculate([bar(12, 8, 10, 0)], [3])).toEqual([{}])
  })

  it('returns NaN values for invalid periods', async () => {
    const dataList = [
      bar(12, 8, 10, 0),
      bar(15, 11, 14, 1)
    ]

    expect(await calculate(dataList, [0])).toEqual([{ atr: NaN }, { atr: NaN }])
  })
})
