import { describe, expect, it } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import YAxisView from './YAxisView'
import { clampYAxisLabelY } from './utils/labelPosition'

describe('clampYAxisLabelY', () => {
  it('keeps y-axis tick text fully visible inside axis height', () => {
    expect(clampYAxisLabelY(-4, 100, 12)).toBe(6)
    expect(clampYAxisLabelY(50, 100, 12)).toBe(50)
    expect(clampYAxisLabelY(104, 100, 12)).toBe(94)
  })

  it('supports extra vertical padding for mixed-language tick text', () => {
    expect(clampYAxisLabelY(0, 100, 16)).toBe(8)
    expect(clampYAxisLabelY(100, 100, 16)).toBe(92)
  })

  it('centers text when axis height is smaller than text height', () => {
    expect(clampYAxisLabelY(0, 8, 12)).toBe(4)
    expect(clampYAxisLabelY(0, 15, 16)).toBe(7.5)
  })
})

describe('YAxisView axisLine visibility', () => {
  it('keeps left tick lines visible when the axis line is hidden', () => {
    const styles = getDefaultStyles().yAxis
    styles.axisLine.show = false
    styles.axisLine.size = 6
    styles.tickLine.length = 3

    const view = new YAxisView({ isAlignLeft: () => true } as never)
    const ticks = [{ coord: 10, value: 10, text: '10' }]
    const bounding = { width: 100, height: 100, left: 0, top: 0 }
    const [tickLine] = view.createTickLines(ticks, bounding, styles)

    expect(tickLine.coordinates).toEqual([
      { x: 0, y: 10 },
      { x: 3, y: 10 }
    ])
  })

  it('keeps right tick lines visible when the axis line is hidden', () => {
    const styles = getDefaultStyles().yAxis
    styles.axisLine.show = false
    styles.axisLine.size = 6
    styles.tickLine.length = 3

    const view = new YAxisView({ isAlignLeft: () => false } as never)
    const ticks = [{ coord: 10, value: 10, text: '10' }]
    const bounding = { width: 100, height: 100, left: 0, top: 0 }
    const [tickLine] = view.createTickLines(ticks, bounding, styles)

    expect(tickLine.coordinates).toEqual([
      { x: 100, y: 10 },
      { x: 97, y: 10 }
    ])
  })
})
