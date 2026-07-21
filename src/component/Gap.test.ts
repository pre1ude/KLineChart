import { describe, expect, it } from 'vitest'

import {
  calculateGaps,
  defaultGapOptions,
  getGapCalculationSignature,
  normalizeGapOptions,
  type RequiredGapOptions
} from './Gap'
import type KLineData from '../common/KLineData'

function candle(timestamp: number, low: number, high: number, open: number = low, close: number = high): KLineData {
  return { timestamp, open, high, low, close }
}

function options(override: Parameters<typeof normalizeGapOptions>[1] = true): RequiredGapOptions {
  return normalizeGapOptions(defaultGapOptions, override)
}

describe('gap options', () => {
  it('uses the configured gap defaults', () => {
    expect(defaultGapOptions).toEqual({
      closeGapsPartially: false,
      maxGapCount: 15,
      minimalDeviationPercent: 30,
      limitMaxTrailLength: false,
      maxTrailLength: 300
    })
  })

  it('deep-merges and normalizes numeric values', () => {
    const options = normalizeGapOptions(defaultGapOptions, {
      maxGapCount: 800,
      minimalDeviationPercent: -10,
      maxTrailLength: 2.6
    })

    expect(options).toMatchObject({
      maxGapCount: 500,
      minimalDeviationPercent: 1,
      maxTrailLength: 3
    })
  })

  it('includes every behavior option in the calculation signature', () => {
    const changed = normalizeGapOptions(defaultGapOptions, {
      closeGapsPartially: true
    })

    expect(getGapCalculationSignature(changed)).not.toBe(getGapCalculationSignature(defaultGapOptions))
  })
})

describe('calculateGaps', () => {
  it('detects full upward and downward gaps during the warm-up range', () => {
    const upward = calculateGaps([
      candle(0, 90, 100),
      candle(1, 103, 110)
    ], options())
    const downward = calculateGaps([
      candle(0, 100, 110),
      candle(1, 90, 97)
    ], options())

    expect(upward.gaps).toMatchObject([{
      direction: 'up',
      originalBottom: 100,
      originalTop: 103,
      status: 'active',
      segments: [{ fromIndex: 0, bottom: 100, top: 103 }]
    }])
    expect(downward.gaps).toMatchObject([{
      direction: 'down',
      originalBottom: 97,
      originalTop: 100,
      status: 'active',
      segments: [{ fromIndex: 0, bottom: 97, top: 100 }]
    }])
  })

  it('does not treat an open-close discontinuity with overlapping ranges as a gap', () => {
    const result = calculateGaps([
      candle(0, 90, 100, 95, 95),
      candle(1, 99, 105, 110, 102)
    ], options())

    expect(result.gaps).toEqual([])
  })

  it('uses the current 14-bar average and includes gaps exactly at the deviation threshold', () => {
    const base = Array.from({ length: 13 }, (_, index) => candle(index, 90, 100))
    const atThreshold = calculateGaps([...base, candle(13, 103, 113)], options())
    const belowThreshold = calculateGaps([...base, candle(13, 102.99, 112.99)], options())

    expect(atThreshold.gaps).toHaveLength(1)
    expect(belowThreshold.gaps).toHaveLength(0)
  })

  it('keeps a touch-mode gap active at the outer boundary and closes it after entry', () => {
    const result = calculateGaps([
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 110, 115),
      candle(3, 109, 115)
    ], options())

    expect(result.gaps).toMatchObject([{
      status: 'closed',
      closeReason: 'entered',
      closeIndex: 3,
      segments: [{ fromIndex: 0, toIndex: 3, bottom: 100, top: 110 }]
    }])
    expect(result.events.map(event => event.type)).toEqual(['opened', 'closed'])
  })

  it('tracks advancing partial fills without creating segments for non-advancing bars', () => {
    const result = calculateGaps([
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 106, 115),
      candle(3, 108, 112),
      candle(4, 103, 109),
      candle(5, 100, 105)
    ], options({ closeGapsPartially: true }))

    expect(result.gaps).toMatchObject([{
      status: 'closed',
      closeReason: 'filled',
      closeIndex: 5,
      segments: [
        { fromIndex: 0, toIndex: 2, bottom: 100, top: 110 },
        { fromIndex: 2, toIndex: 4, bottom: 100, top: 106 },
        { fromIndex: 4, toIndex: 5, bottom: 100, top: 103 }
      ]
    }])
  })

  it('tracks downward partial fills symmetrically', () => {
    const result = calculateGaps([
      candle(0, 100, 110),
      candle(1, 90, 97),
      candle(2, 92, 98.5),
      candle(3, 95, 100)
    ], options({ closeGapsPartially: true }))

    expect(result.gaps).toMatchObject([{
      direction: 'down',
      status: 'closed',
      closeReason: 'filled',
      segments: [
        { fromIndex: 0, toIndex: 2, bottom: 97, top: 100 },
        { fromIndex: 2, toIndex: 3, bottom: 98.5, top: 100 }
      ]
    }])
  })

  it('retains only the newest configured gap records', () => {
    const result = calculateGaps([
      candle(0, 0, 10),
      candle(1, 20, 30),
      candle(2, 40, 50),
      candle(3, 60, 70)
    ], options({ maxGapCount: 2 }))

    expect(result.gaps.map(gap => gap.openIndex)).toEqual([2, 3])
  })

  it('measures trail length from the original opening index', () => {
    const result = calculateGaps([
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 111, 121),
      candle(3, 112, 122),
      candle(4, 113, 123)
    ], options({ limitMaxTrailLength: true, maxTrailLength: 3 }))

    expect(result.gaps).toMatchObject([{
      status: 'truncated',
      segments: [{ fromIndex: 0, toIndex: 4 }]
    }])
    expect(result.events.map(event => event.type)).toEqual(['opened'])
  })

  it('prioritizes complete fill over truncation on the limit bar', () => {
    const result = calculateGaps([
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 111, 121),
      candle(3, 112, 122),
      candle(4, 100, 113)
    ], options({ closeGapsPartially: true, limitMaxTrailLength: true, maxTrailLength: 3 }))

    expect(result.gaps[0]).toMatchObject({ status: 'closed', closeReason: 'filled', closeIndex: 4 })
  })

  it('is deterministic and removes a latest-bar gap when revised data overlaps', () => {
    const initial = [candle(0, 90, 100), candle(1, 103, 110)]
    const first = calculateGaps(initial, options())
    const second = calculateGaps(initial, options())
    const revised = calculateGaps([candle(0, 90, 100), candle(1, 99, 110)], options())

    expect(second).toEqual(first)
    expect(revised.gaps).toEqual([])
  })
})
