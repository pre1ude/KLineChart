import { describe, expect, it } from 'vitest'

import type KLineData from '../common/KLineData'
import type VisibleRange from '../common/VisibleRange'
import { calculateGap1, defaultGap1Options, normalizeGap1Options } from './Gap1'

function candle(timestamp: number, low: number, high: number, open: number = low, close: number = high): KLineData {
  return { timestamp, open, high, low, close }
}

function range(from: number, to: number): VisibleRange {
  return { from, to, domainFrom: from, domainTo: to }
}

describe('calculateGap1', () => {
  it('detects upward and downward full gaps above the formation threshold', () => {
    const upward = calculateGap1([
      candle(0, 90, 100),
      candle(1, 100.1, 110)
    ], range(0, 2))
    const downward = calculateGap1([
      candle(0, 100, 110),
      candle(1, 90, 99.9)
    ], range(0, 2))

    expect(upward).toMatchObject([{
      direction: 'up',
      fromIndex: 0,
      openIndex: 1,
      originalBottom: 100,
      originalTop: 100.1,
      bottom: 100,
      top: 100.1
    }])
    expect(downward).toMatchObject([{
      direction: 'down',
      fromIndex: 0,
      openIndex: 1,
      originalBottom: 99.9,
      originalTop: 100,
      bottom: 99.9,
      top: 100
    }])
  })

  it('rejects original upward and downward changes at or below 0.02%', () => {
    const upwardAtThreshold = calculateGap1([
      candle(0, 90, 100),
      candle(1, 100.02, 110)
    ], range(0, 2))
    const downwardAtThreshold = calculateGap1([
      candle(0, 100, 110),
      candle(1, 90, 99.98)
    ], range(0, 2))
    const upwardAboveThreshold = calculateGap1([
      candle(0, 90, 100),
      candle(1, 100.0201, 110)
    ], range(0, 2))
    const downwardAboveThreshold = calculateGap1([
      candle(0, 100, 110),
      candle(1, 90, 99.9799)
    ], range(0, 2))

    expect(upwardAtThreshold).toEqual([])
    expect(downwardAtThreshold).toEqual([])
    expect(upwardAboveThreshold).toMatchObject([{ direction: 'up' }])
    expect(downwardAboveThreshold).toMatchObject([{ direction: 'down' }])
  })

  it('retains accepted gaps after partial fills shrink the remainder to 0.02% or less', () => {
    const upward = calculateGap1([
      candle(0, 90, 100),
      candle(1, 100.03, 101),
      candle(2, 100.01, 100.5)
    ], range(0, 3))
    const downward = calculateGap1([
      candle(0, 100, 110),
      candle(1, 99, 99.97),
      candle(2, 99.5, 99.99)
    ], range(0, 3))

    expect(upward).toMatchObject([{ bottom: 100, top: 100.01 }])
    expect(downward).toMatchObject([{ bottom: 99.99, top: 100 }])
  })

  it('ignores an open-close discontinuity when candle ranges overlap', () => {
    const result = calculateGap1([
      candle(0, 90, 100, 95, 95),
      candle(1, 99, 105, 110, 102)
    ], range(0, 2))

    expect(result).toEqual([])
  })

  it('uses the preceding offscreen candle when the opening candle is first visible', () => {
    const result = calculateGap1([
      candle(0, 90, 100),
      candle(1, 103, 110),
      candle(2, 104, 111)
    ], range(1, 3))

    expect(result).toMatchObject([{
      direction: 'up',
      fromIndex: 0,
      openIndex: 1,
      bottom: 100,
      top: 103
    }])
  })

  it('excludes a gap whose opening candle is left of the visible range', () => {
    const result = calculateGap1([
      candle(0, 90, 100),
      candle(1, 103, 110),
      candle(2, 104, 111)
    ], range(2, 3))

    expect(result).toEqual([])
  })

  it('keeps only the current remaining range after multiple upward partial fills', () => {
    const result = calculateGap1([
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 106, 115),
      candle(3, 108, 112),
      candle(4, 103, 109)
    ], range(0, 5))

    expect(result).toMatchObject([{
      direction: 'up',
      fromIndex: 0,
      openIndex: 1,
      originalBottom: 100,
      originalTop: 110,
      bottom: 100,
      top: 103
    }])
    expect(result).toHaveLength(1)
  })

  it('tracks downward partial fills symmetrically', () => {
    const result = calculateGap1([
      candle(0, 100, 110),
      candle(1, 90, 97),
      candle(2, 92, 98.5),
      candle(3, 95, 99)
    ], range(0, 4))

    expect(result).toMatchObject([{
      direction: 'down',
      originalBottom: 97,
      originalTop: 100,
      bottom: 99,
      top: 100
    }])
  })

  it('removes a fully filled gap', () => {
    const result = calculateGap1([
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 106, 115),
      candle(3, 100, 108)
    ], range(0, 4))

    expect(result).toEqual([])
  })

  it('ignores later offscreen fills until they enter the visible horizon', () => {
    const data = [
      candle(0, 90, 100),
      candle(1, 110, 120),
      candle(2, 106, 115),
      candle(3, 100, 108)
    ]

    const beforePan = calculateGap1(data, range(0, 3))
    const afterPan = calculateGap1(data, range(1, 4))

    expect(beforePan).toMatchObject([{ bottom: 100, top: 106 }])
    expect(afterPan).toEqual([])
  })

  it('is deterministic for identical data and visible ranges', () => {
    const data = [candle(0, 90, 100), candle(1, 103, 110)]
    const visibleRange = range(0, 2)

    expect(calculateGap1(data, visibleRange)).toEqual(calculateGap1(data, visibleRange))
  })

  it('keeps the newest opening timestamps when the maximum count is exceeded', () => {
    const result = calculateGap1([
      candle(0, 0, 10),
      candle(1, 20, 30),
      candle(2, 40, 50),
      candle(3, 60, 70)
    ], range(0, 4), 2)

    expect(result.map(gap => gap.openTimestamp)).toEqual([3, 2])
  })
})

describe('normalizeGap1Options', () => {
  it('uses the default maximum count and hides values by default', () => {
    expect(defaultGap1Options).toEqual({
      maxGapCount: 15,
      showValue: false
    })
    expect(normalizeGap1Options()).toEqual(defaultGap1Options)
  })

  it('merges current options and normalizes the maximum count to 1-500', () => {
    const current = { maxGapCount: 20, showValue: true }

    expect(normalizeGap1Options(current, { maxGapCount: 0 })).toEqual({
      maxGapCount: 1,
      showValue: true
    })
    expect(normalizeGap1Options(current, { maxGapCount: 500.6, showValue: false })).toEqual({
      maxGapCount: 500,
      showValue: false
    })
  })
})
