import { describe, expect, it } from 'vitest'

import type KLineData from '../../common/KLineData'
import { getDefaultStyles } from '../../common/Styles'
import { getFigureBaseStyles, Indicator, IndicatorSeries } from '../../component/Indicator'
import { getIndicatorTemplate, getSupportedIndicators } from './index'

interface MikeResult {
  wr?: number
  mr?: number
  sr?: number
  ws?: number
  ms?: number
  ss?: number
}

function bar(open: number, high: number, low: number, close: number, timestamp: number): KLineData {
  return { timestamp, open, high, low, close }
}

function createMike(calcParams?: number[]): Indicator<MikeResult> {
  const template = getIndicatorTemplate('MIKE')
  expect(template).toBeDefined()
  const indicator = new Indicator(template!) as Indicator<MikeResult>
  if (calcParams != null) {
    indicator.calcParams = calcParams
  }
  return indicator
}

async function calculate(dataList: KLineData[], calcParams?: number[]): Promise<MikeResult[]> {
  const indicator = createMike(calcParams)
  return await indicator.calc(dataList, indicator)
}

describe('MIKE built-in indicator', () => {
  it('registers the standard price-series template using six shared line colors', () => {
    expect(getSupportedIndicators()).toContain('MIKE')

    const template = getIndicatorTemplate('MIKE')
    expect(template).toMatchObject({
      name: 'MIKE',
      shortName: 'MIKE',
      series: IndicatorSeries.Price,
      calcParams: [12],
      shouldOhlc: true,
      figures: [
        { key: 'wr', title: 'WR: ', type: 'line' },
        { key: 'mr', title: 'MR: ', type: 'line' },
        { key: 'sr', title: 'SR: ', type: 'line' },
        { key: 'ws', title: 'WS: ', type: 'line' },
        { key: 'ms', title: 'MS: ', type: 'line' },
        { key: 'ss', title: 'SS: ', type: 'line' }
      ]
    })

    const indicator = createMike()
    expect(indicator.styles?.figures?.ss).toBeUndefined()

    const defaultStyles = getDefaultStyles().indicator
    const colors = indicator.figures.map((figure, index) => {
      const baseStyles = getFigureBaseStyles(figure.type ?? 'line', index, defaultStyles)
      const figureStyles = indicator.styles?.figures?.[figure.key] as { color?: string } | undefined
      return figureStyles?.color ?? baseStyles.color
    })
    expect(new Set(colors).size).toBe(6)
  })

  it('calculates all six lines for the first complete window', async () => {
    const result = await calculate([
      bar(9, 12, 8, 10, 0),
      bar(10, 15, 9, 12, 1),
      bar(11, 14, 10, 13, 2)
    ], [3])

    expect(result.slice(0, 2)).toEqual([{}, {}])
    expect(result[2].wr).toBeCloseTo(50 / 3, 10)
    expect(result[2].mr).toBeCloseTo(58 / 3, 10)
    expect(result[2].sr).toBe(22)
    expect(result[2].ws).toBeCloseTo(29 / 3, 10)
    expect(result[2].ms).toBeCloseTo(16 / 3, 10)
    expect(result[2].ss).toBe(1)
  })

  it('evicts extrema that leave the fixed-size rolling window', async () => {
    const result = await calculate([
      bar(9, 12, 8, 10, 0),
      bar(10, 15, 9, 12, 1),
      bar(11, 14, 10, 13, 2),
      bar(12, 13, 11, 12, 3)
    ], [3])

    expect(result[3]).toEqual({
      wr: 15,
      mr: 18,
      sr: 21,
      ws: 9,
      ms: 6,
      ss: 3
    })
  })

  it('preserves alignment and waits for the complete default window', async () => {
    const partialData = Array.from({ length: 11 }, (_, index) => {
      return bar(10, 10, 10, 10, index)
    })

    expect(await calculate([])).toEqual([])
    expect(await calculate(partialData)).toEqual(Array.from({ length: 11 }, () => ({})))

    const completeResult = await calculate([
      ...partialData,
      bar(10, 10, 10, 10, 11)
    ])
    expect(completeResult).toHaveLength(12)
    expect(completeResult.slice(0, 11)).toEqual(Array.from({ length: 11 }, () => ({})))
    expect(completeResult[11]).toEqual({
      wr: 10,
      mr: 10,
      sr: 10,
      ws: 10,
      ms: 10,
      ss: 10
    })
  })

  it('uses an overridden positive period and keeps flat-price outputs finite', async () => {
    const result = await calculate([
      bar(10, 10, 10, 10, 0),
      bar(10, 10, 10, 10, 1)
    ], [2])

    expect(result).toEqual([
      {},
      {
        wr: 10,
        mr: 10,
        sr: 10,
        ws: 10,
        ms: 10,
        ss: 10
      }
    ])
    expect(Object.values(result[1]).every(Number.isFinite)).toBe(true)
  })
})
