import { describe, expect, it } from 'vitest'
import { clampYAxisTickLineY, clampYAxisTickTextY } from './YAxisView'

describe('clampYAxisTickTextY', () => {
  it('keeps y-axis tick text fully visible inside axis height', () => {
    expect(clampYAxisTickTextY(-4, 100, 12)).toBe(6)
    expect(clampYAxisTickTextY(50, 100, 12)).toBe(50)
    expect(clampYAxisTickTextY(104, 100, 12)).toBe(94)
  })

  it('centers text when axis height is smaller than text height', () => {
    expect(clampYAxisTickTextY(0, 8, 12)).toBe(4)
  })
})

describe('clampYAxisTickLineY', () => {
  it('keeps one-pixel y-axis tick lines visible inside axis height', () => {
    expect(clampYAxisTickLineY(0, 100, 1)).toBe(0)
    expect(clampYAxisTickLineY(50, 100, 1)).toBe(50)
    expect(clampYAxisTickLineY(100, 100, 1)).toBe(99)
  })

  it('keeps even-width y-axis tick lines visible inside axis height', () => {
    expect(clampYAxisTickLineY(0, 100, 2)).toBe(1)
    expect(clampYAxisTickLineY(100, 100, 2)).toBe(99)
  })
})
