import { describe, expect, it } from 'vitest'

import { pixelSnapBarCenter, pixelSnapBarStart } from './barPixel'

describe('bar pixel alignment', () => {
  it('snaps bar centers to the candle wick pixel column', () => {
    expect(pixelSnapBarCenter(20.4)).toBe(20)
    expect(pixelSnapBarCenter(20.5)).toBe(20)
    expect(pixelSnapBarCenter(21)).toBe(21)
  })

  it('derives bar starts from the shared snapped center', () => {
    expect(pixelSnapBarStart(20.4, 4)).toBe(16)
  })

  it('preserves non-finite coordinates for downstream clipping', () => {
    expect(pixelSnapBarCenter(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
    expect(pixelSnapBarCenter(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY)
    expect(pixelSnapBarCenter(Number.NaN)).toBeNaN()
  })
})
