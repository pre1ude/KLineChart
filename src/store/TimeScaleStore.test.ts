import { describe, expect, it, vi } from 'vitest'
import { CandleType, getDefaultStyles } from '../common/Styles'
import TimeScaleStore, { calcTimeScaleHorizontalInset } from './TimeScaleStore'

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

describe('TimeScaleStore viewport refresh scheduling', () => {
  it('uses synchronous viewport refresh unless a request refresh is explicitly asked for', () => {
    const store = Object.create(TimeScaleStore.prototype) as TimeScaleStore
    const refreshViewportLayout = vi.fn()
    const requestViewportLayout = vi.fn()
    const recalculateCrosshair = vi.fn()
    const adjustVisibleRange = vi.fn()

    Reflect.set(store, 'adjustVisibleRange', adjustVisibleRange)
    Reflect.set(store, '_chartStore', {
      getTooltipStore: () => ({ recalculateCrosshair }),
      getChart: () => ({ refreshViewportLayout, requestViewportLayout })
    })

    Reflect.get(store, '_refreshTimeScale').call(store)
    Reflect.get(store, '_refreshTimeScale').call(store, true)

    expect(adjustVisibleRange).toHaveBeenCalledTimes(2)
    expect(recalculateCrosshair).toHaveBeenCalledTimes(2)
    expect(refreshViewportLayout).toHaveBeenCalledTimes(1)
    expect(requestViewportLayout).toHaveBeenCalledTimes(1)
  })
})
