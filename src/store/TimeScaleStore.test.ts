import { describe, expect, it } from 'vitest'
import { CandleType, getDefaultStyles } from '../common/Styles'
import { calcTimeScaleHorizontalInset } from './TimeScaleStore'

describe('calcTimeScaleHorizontalInset', () => {
  it('keeps the time scale range unchanged outside area symbol and point drawing', () => {
    const styles = getDefaultStyles()

    expect(calcTimeScaleHorizontalInset(styles)).toBe(0)

    styles.candle.type = CandleType.Area

    expect(calcTimeScaleHorizontalInset(styles)).toBe(0)
  })

  it('uses the visible area symbol outer radius as horizontal inset', () => {
    const styles = getDefaultStyles()
    styles.candle.type = CandleType.Area
    styles.candle.area.symbol = {
      show: true,
      radius: 4,
      borderSize: 2
    }

    expect(calcTimeScaleHorizontalInset(styles)).toBe(5)
  })

  it('uses the area ripple point radius when it is larger than the line symbol', () => {
    const styles = getDefaultStyles()
    styles.candle.type = CandleType.Area
    styles.candle.area.symbol = {
      show: true,
      radius: 2,
      borderSize: 1
    }
    styles.candle.area.point.show = true
    styles.candle.area.point.rippleRadius = 8

    expect(calcTimeScaleHorizontalInset(styles)).toBe(8)
  })
})
