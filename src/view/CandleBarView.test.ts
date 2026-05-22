import { describe, expect, it } from 'vitest'
import { YAxisPosition } from '../common/Styles'
import { resolveIndicatorOhlcYAxisPosition } from './CandleBarView'

describe('resolveIndicatorOhlcYAxisPosition', () => {
  it('uses global right y-axis as the default for indicators without explicit binding', () => {
    expect(resolveIndicatorOhlcYAxisPosition({}, YAxisPosition.Right)).toBe('right')
  })

  it('keeps explicit indicator y-axis binding', () => {
    expect(resolveIndicatorOhlcYAxisPosition({ yAxisPosition: 'right' }, YAxisPosition.Left)).toBe('right')
    expect(resolveIndicatorOhlcYAxisPosition({ yAxisPosition: 'left' }, YAxisPosition.Right)).toBe('left')
  })

  it('falls back to left when global y-axis position is left or both', () => {
    expect(resolveIndicatorOhlcYAxisPosition({}, YAxisPosition.Left)).toBe('left')
    expect(resolveIndicatorOhlcYAxisPosition({}, YAxisPosition.Both)).toBe('left')
  })
})
