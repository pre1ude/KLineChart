import { describe, expect, it } from 'vitest'
import { clampXAxisTickLineX } from './XAxisView'

describe('clampXAxisTickLineX', () => {
  it('keeps one-pixel x-axis tick lines visible inside axis width', () => {
    expect(clampXAxisTickLineX(0, 100, 1)).toBe(0)
    expect(clampXAxisTickLineX(50, 100, 1)).toBe(50)
    expect(clampXAxisTickLineX(100, 100, 1)).toBe(99)
  })

  it('keeps even-width x-axis tick lines visible inside axis width', () => {
    expect(clampXAxisTickLineX(0, 100, 2)).toBe(1)
    expect(clampXAxisTickLineX(100, 100, 2)).toBe(99)
  })
})
