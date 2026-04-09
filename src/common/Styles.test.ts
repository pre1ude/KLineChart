import { describe, expect, it } from 'vitest'

import { getDefaultStyles } from './Styles'

describe('getDefaultStyles', () => {
  it('面积图 line symbol 默认关闭', () => {
    const styles = getDefaultStyles()

    expect(styles.candle.area.symbol).toEqual({ show: false })
  })

  it('指标 line symbol 默认关闭', () => {
    const styles = getDefaultStyles()

    expect(styles.indicator.lines.every(line => line.symbol?.show !== true)).toBe(true)
  })
})
