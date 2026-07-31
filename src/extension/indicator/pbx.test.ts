import { describe, expect, it } from 'vitest'

import type KLineData from '../../common/KLineData'
import { getDefaultStyles } from '../../common/Styles'
import { getFigureBaseStyles, Indicator, IndicatorSeries } from '../../component/Indicator'
import { getIndicatorTemplate, getSupportedIndicators } from './index'

interface PbxResult {
  [key: string]: number | undefined
}

function bar(close: number, timestamp: number): KLineData {
  return { timestamp, open: close, high: close, low: close, close }
}

function createPbx(calcParams?: number[]): Indicator<PbxResult> {
  const template = getIndicatorTemplate('PBX')
  expect(template).toBeDefined()
  const indicator = new Indicator(template!) as Indicator<PbxResult>
  if (calcParams != null) {
    indicator.override({ calcParams })
  }
  return indicator
}

async function calculate(closes: number[], calcParams?: number[]): Promise<PbxResult[]> {
  const indicator = createPbx(calcParams)
  const dataList = closes.map((close, index) => bar(close, index))
  return await indicator.calc(dataList, indicator)
}

describe('PBX built-in indicator', () => {
  it('registers the conventional six-line price-series template', () => {
    expect(getSupportedIndicators()).toContain('PBX')

    const template = getIndicatorTemplate('PBX')
    expect(template).toMatchObject({
      name: 'PBX',
      shortName: 'PBX',
      series: IndicatorSeries.Price,
      calcParams: [4, 6, 9, 13, 18, 24],
      shouldOhlc: true,
      figures: [
        { key: 'pbx1', title: 'PBX1: ', type: 'line', calcParamIndex: 0 },
        { key: 'pbx2', title: 'PBX2: ', type: 'line', calcParamIndex: 1 },
        { key: 'pbx3', title: 'PBX3: ', type: 'line', calcParamIndex: 2 },
        { key: 'pbx4', title: 'PBX4: ', type: 'line', calcParamIndex: 3 },
        { key: 'pbx5', title: 'PBX5: ', type: 'line', calcParamIndex: 4 },
        { key: 'pbx6', title: 'PBX6: ', type: 'line', calcParamIndex: 5 }
      ]
    })

    const indicator = createPbx()
    const defaultStyles = getDefaultStyles().indicator
    const colors = indicator.figures.map((figure, index) => {
      return getFigureBaseStyles(figure.type ?? 'line', index, defaultStyles).color
    })
    expect(indicator.styles?.figures).toBeUndefined()
    expect(new Set(colors).size).toBe(6)
  })

  it('uses the first close as the EMA seed in the first complete PBX value', async () => {
    const result = await calculate([1, 2, 3, 4, 5, 6, 7, 8], [2])

    expect(result.slice(0, 7)).toEqual(Array.from({ length: 7 }, () => ({})))

    const ema2 = 16403 / 2187
    const ma4 = (5 + 6 + 7 + 8) / 4
    const ma8 = (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8) / 8
    expect(result[7].pbx1).toBeCloseTo((ema2 + ma4 + ma8) / 3, 10)
  })

  it('updates EMA and both moving-average windows after warm-up', async () => {
    const result = await calculate([1, 2, 3, 4, 5, 6, 7, 8, 9], [2])

    const ema2 = 55769 / 6561
    const ma4 = (6 + 7 + 8 + 9) / 4
    const ma8 = (2 + 3 + 4 + 5 + 6 + 7 + 8 + 9) / 8
    expect(result[8].pbx1).toBeCloseTo((ema2 + ma4 + ma8) / 3, 10)
  })

  it('warms multiple overridden periods independently and preserves alignment', async () => {
    expect(await calculate([], [1, 2])).toEqual([])

    const result = await calculate([1, 2, 3, 4, 5, 6, 7, 8], [1, 2])
    expect(result).toHaveLength(8)
    expect(result.slice(0, 3)).toEqual([{}, {}, {}])
    expect(result[3].pbx1).toBeCloseTo((4 + 3.5 + 2.5) / 3, 10)
    expect(result[3].pbx2).toBeUndefined()
    expect(result[7].pbx1).toBeCloseTo((8 + 7.5 + 6.5) / 3, 10)
    expect(result[7].pbx2).toBeCloseTo((16403 / 2187 + 6.5 + 4.5) / 3, 10)
  })

  it('regenerates position-based figures for overridden periods', () => {
    const indicator = createPbx([2, 5, 8])

    expect(indicator.calcParams).toEqual([2, 5, 8])
    expect(indicator.figures).toEqual([
      { key: 'pbx1', title: 'PBX1: ', type: 'line', calcParamIndex: 0 },
      { key: 'pbx2', title: 'PBX2: ', type: 'line', calcParamIndex: 1 },
      { key: 'pbx3', title: 'PBX3: ', type: 'line', calcParamIndex: 2 }
    ])
  })

  it('keeps emitted flat-price values finite', async () => {
    const result = await calculate(Array.from({ length: 12 }, () => 10), [2, 3])

    expect(result[7]).toEqual({ pbx1: 10 })
    expect(result[11]).toEqual({ pbx1: 10, pbx2: 10 })
    expect(Object.values(result[11]).every(value => value != null && Number.isFinite(value))).toBe(true)
  })
})
