import { describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import XAxisView, { clampXAxisTickLineX } from './XAxisView'

vi.mock('../common/utils/canvas', () => ({
  calcTextWidth: (text: string) => text.length,
  createFont: () => ''
}))

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

  it('aligns fractional x-axis tick line coordinates to the pixel grid', () => {
    expect(clampXAxisTickLineX(10.3, 100, 1)).toBe(10)
    expect(clampXAxisTickLineX(10.7, 100, 1)).toBe(11)
    expect(clampXAxisTickLineX(99.6, 100, 1)).toBe(99)
  })
})

describe('XAxisView axisLine visibility', () => {
  it('keeps tick lines visible when the axis line is hidden', () => {
    const styles = getDefaultStyles().xAxis
    styles.axisLine.show = false
    styles.axisLine.size = 6
    styles.tickLine.length = 3
    styles.tickText.marginStart = 4

    const view = new XAxisView(undefined as never)
    const ticks = [{ coord: 10, value: 10, text: '10:00' }]
    const bounding = { width: 100, height: 24, left: 0, top: 0 }

    const [tickLine] = view.createTickLines(ticks, bounding, styles)
    const [tickText] = view.createTickTexts(ticks, bounding, styles)

    expect(tickLine.coordinates[1].y).toBe(3)
    expect(tickText.attrs.y).toBe(7)
  })
})
