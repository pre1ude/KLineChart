import { describe, expect, it } from 'vitest'
import {
  calculatePaneHeights,
  PANE_DEFAULT_HEIGHT,
  PANE_DEFAULT_HEIGHT_SPEC,
  parsePaneHeight,
  resolvePaneHeight,
  updatePaneHeightSpecFromDrag
} from './types'

describe('parsePaneHeight', () => {
  it('uses ten percent as the built-in default indicator pane height', () => {
    expect(PANE_DEFAULT_HEIGHT).toBe(0.1)
    expect(parsePaneHeight(PANE_DEFAULT_HEIGHT)).toEqual({ unit: 'percent', value: 0.1 })
    expect(PANE_DEFAULT_HEIGHT_SPEC).toEqual({ unit: 'percent', value: 0.1 })
  })

  it('keeps positive numbers greater than or equal to one as rounded pixel heights', () => {
    expect(parsePaneHeight(100)).toEqual({ unit: 'pixel', value: 100 })
    expect(parsePaneHeight(100.4)).toEqual({ unit: 'pixel', value: 100 })
    expect(parsePaneHeight(100.6)).toEqual({ unit: 'pixel', value: 101 })
    expect(parsePaneHeight(1)).toEqual({ unit: 'pixel', value: 1 })
  })

  it('uses positive numbers less than one as percentage ratios', () => {
    expect(parsePaneHeight(0.2)).toEqual({ unit: 'percent', value: 0.2 })
    expect(parsePaneHeight(0.125)).toEqual({ unit: 'percent', value: 0.125 })
  })

  it('rejects invalid, zero, and negative heights', () => {
    expect(parsePaneHeight(0)).toBeNull()
    expect(parsePaneHeight(-10)).toBeNull()
    expect(parsePaneHeight(Number.NaN)).toBeNull()
    expect(parsePaneHeight('20%' as unknown as number)).toBeNull()
  })
})

describe('calculatePaneHeights', () => {
  it('keeps pixel heights and resolves percentages from the drawable pane area', () => {
    expect(calculatePaneHeights([
      { height: { unit: 'pixel', value: 100 }, minHeight: 30 },
      { height: { unit: 'percent', value: 0.2 }, minHeight: 30 }
    ], 500)).toEqual({
      heights: [100, 100],
      remainingHeight: 300
    })
  })

  it('applies min height before assigning the candle pane remainder', () => {
    expect(calculatePaneHeights([
      { height: { unit: 'percent', value: 0.05 }, minHeight: 40 }
    ], 500)).toEqual({
      heights: [40],
      remainingHeight: 460
    })
  })

  it('clips overflowing indicator panes in pane order without overflowing', () => {
    expect(calculatePaneHeights([
      { height: { unit: 'percent', value: 0.7 }, minHeight: 30 },
      { height: { unit: 'percent', value: 0.7 }, minHeight: 30 }
    ], 500)).toEqual({
      heights: [350, 150],
      remainingHeight: 0
    })
  })

  it('rounds percentage layout to integer pixels while preserving total height', () => {
    const layout = calculatePaneHeights([
      { height: { unit: 'percent', value: 0.15 }, minHeight: 60 },
      { height: { unit: 'pixel', value: 120 }, minHeight: 60 }
    ], 539)

    expect(layout).toEqual({
      heights: [81, 120],
      remainingHeight: 338
    })
    expect([...layout.heights, layout.remainingHeight].every(Number.isInteger)).toBe(true)
    expect(layout.heights.reduce((sum, height) => sum + height, layout.remainingHeight)).toBe(539)
  })
})

describe('updatePaneHeightSpecFromDrag', () => {
  it('updates percentage panes as a ratio that survives resize', () => {
    const state = updatePaneHeightSpecFromDrag({ unit: 'percent', value: 0.2 }, 150, 500)

    expect(state).toEqual({ unit: 'percent', value: 0.3 })
    expect(resolvePaneHeight(state, 800)).toBe(240)
  })

  it('keeps pixel panes in pixel mode', () => {
    const state = updatePaneHeightSpecFromDrag({ unit: 'pixel', value: 100 }, 150, 500)

    expect(state).toEqual({ unit: 'pixel', value: 150 })
    expect(resolvePaneHeight(state, 800)).toBe(150)
  })

  it('keeps the previous percentage when no drawable height is available', () => {
    expect(updatePaneHeightSpecFromDrag({ unit: 'percent', value: 0.2 }, 0, 0))
      .toEqual({ unit: 'percent', value: 0.2 })
  })
})
