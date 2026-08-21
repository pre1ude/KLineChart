import { describe, expect, it } from 'vitest'

import { getTooltipDirectionVisual, getTooltipValueDirection } from './TooltipDirection'

describe('tooltip value direction', () => {
  it('calculates the sign from adjacent finite raw values', () => {
    expect(getTooltipValueDirection(2, 1)).toBe(1)
    expect(getTooltipValueDirection(1, 2)).toBe(-1)
    expect(getTooltipValueDirection(1 + 1e-12, 1)).toBe(0)
    expect(getTooltipValueDirection(1, undefined)).toBeUndefined()
    expect(getTooltipValueDirection(Number.POSITIVE_INFINITY, 1)).toBeUndefined()
  })

  it('maps non-flat directions to their shared visual representation', () => {
    const style = { show: true, upColor: '#f00', downColor: '#0f0' }

    expect(getTooltipDirectionVisual(1, style)).toEqual({ text: '↑', color: '#f00' })
    expect(getTooltipDirectionVisual(-1, style)).toEqual({ text: '↓', color: '#0f0' })
    expect(getTooltipDirectionVisual(0, style)).toBeUndefined()
    expect(getTooltipDirectionVisual(1, { ...style, show: false })).toBeUndefined()
  })
})
