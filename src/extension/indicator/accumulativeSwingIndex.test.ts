import { describe, expect, it } from 'vitest'

import type KLineData from '../../common/KLineData'
import { Indicator } from '../../component/Indicator'
import { getIndicatorTemplate, getSupportedIndicators } from './index'

interface AsiResult {
  asi?: number
  asit?: number
}

function bar(open: number, high: number, low: number, close: number, timestamp: number): KLineData {
  return { timestamp, open, high, low, close }
}

function createAsi(calcParams: number[]): Indicator<AsiResult> {
  const template = getIndicatorTemplate('ASI')
  expect(template).toBeDefined()
  const indicator = new Indicator(template!) as Indicator<AsiResult>
  indicator.calcParams = calcParams
  return indicator
}

async function calculate(dataList: KLineData[], calcParams: number[] = [1, 1]): Promise<AsiResult[]> {
  const indicator = createAsi(calcParams)
  return await indicator.calc(dataList, indicator)
}

describe('ASI built-in indicator', () => {
  it('registers the standard ASI template and defaults', () => {
    expect(getSupportedIndicators()).toContain('ASI')

    const template = getIndicatorTemplate('ASI')
    expect(template).toMatchObject({
      name: 'ASI',
      shortName: 'ASI',
      calcParams: [26, 10],
      figures: [
        { key: 'asi', title: 'ASI: ', type: 'line' },
        { key: 'asit', title: 'ASIT: ', type: 'line' }
      ]
    })
  })

  it.each([
    {
      branch: 'A',
      dataList: [
        bar(9, 12, 11, 10, 0),
        bar(11, 12, 10.5, 11.5, 1)
      ],
      expected: 35.2
    },
    {
      branch: 'B',
      dataList: [
        bar(8, 11, 7, 10, 0),
        bar(8, 9, 4, 5, 1)
      ],
      expected: -432 / 7
    },
    {
      branch: 'C1',
      dataList: [
        bar(9, 11, 8, 10, 0),
        bar(12, 15, 11, 14, 1)
      ],
      expected: 1920 / 29
    }
  ])('calculates the $branch denominator branch with factor 16', async ({ dataList, expected }) => {
    const result = await calculate(dataList)

    expect(result).toHaveLength(dataList.length)
    expect(result[0]).toEqual({})
    expect(result[1].asi).toBeCloseTo(expected, 10)
    expect(result[1].asit).toBeCloseTo(expected, 10)
  })

  it('uses a neutral swing when the denominator is zero', async () => {
    const result = await calculate([
      bar(10, 10, 10, 10, 0),
      bar(10, 10, 10, 10, 1)
    ])

    expect(result).toEqual([{}, { asi: 0, asit: 0 }])
  })

  it('preserves alignment for empty and single-bar inputs', async () => {
    expect(await calculate([])).toEqual([])
    expect(await calculate([bar(10, 12, 8, 11, 0)])).toEqual([{}])
  })

  it('uses fixed-size ASI and ASIT windows after complete warm-up periods', async () => {
    const result = await calculate([
      bar(10, 12, 9, 11, 0),
      bar(11, 13, 10, 12, 1),
      bar(12, 14, 11, 13, 2),
      bar(13, 15, 12, 14, 3),
      bar(14, 17, 13, 16, 4)
    ], [2, 2])

    expect(result).toHaveLength(5)
    expect(result.slice(0, 2)).toEqual([{}, {}])
    expect(result[2].asi).toBeCloseTo(640 / 17, 10)
    expect(result[2].asit).toBeUndefined()
    expect(result[3].asi).toBeCloseTo(640 / 17, 10)
    expect(result[3].asit).toBeCloseTo(640 / 17, 10)
    expect(result[4].asi).toBeCloseTo(6592 / 119, 10)
    expect(result[4].asit).toBeCloseTo(5536 / 119, 10)
  })
})
