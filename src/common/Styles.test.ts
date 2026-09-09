import { describe, expect, it } from 'vitest'

import { getDefaultStyles } from './Styles'

describe('getDefaultStyles', () => {
  it('面积图默认使用圆角纯折线', () => {
    const styles = getDefaultStyles()

    expect(styles.candle.area).toMatchObject({
      lineJoin: 'round',
      smooth: false
    })
  })

  it('面积图 line symbol 默认关闭', () => {
    const styles = getDefaultStyles()

    expect(styles.candle.area.symbol).toEqual({ show: false })
  })

  it('指标 line symbol 默认关闭', () => {
    const styles = getDefaultStyles()

    expect(styles.indicator.lines.every(line => line.symbol?.show !== true)).toBe(true)
  })

  it('指标 line 默认使用六种不同颜色', () => {
    const styles = getDefaultStyles()
    const colors = styles.indicator.lines.map(line => line.color)

    expect(colors).toEqual([
      '#FDD75D',
      '#FF9379',
      '#0BE6CE',
      '#CF8FFF',
      '#23B6FF',
      '#A7E163'
    ])
    expect(new Set(colors).size).toBe(6)
  })

  it('X 轴端点 label 默认显示', () => {
    const styles = getDefaultStyles()

    expect(styles.xAxis.showMinLabel).toBe(true)
    expect(styles.xAxis.showMaxLabel).toBe(true)
  })

  it('Y 轴样式不携带轴拓扑', () => {
    const styles = getDefaultStyles()

    expect(styles.yAxis).not.toHaveProperty('position')
    expect(styles.yAxis).not.toHaveProperty('mainPosition')
    expect(styles.yAxis).not.toHaveProperty('reverse')
  })

  it('缺口默认使用上涨红色和下跌绿色', () => {
    const styles = getDefaultStyles()

    expect(styles.gap).toEqual({
      up: {
        borderColor: 'red',
        backgroundColor: 'rgba(255, 0, 0, 0.15)',
        borderSize: 1
      },
      down: {
        borderColor: 'green',
        backgroundColor: 'rgba(0, 128, 0, 0.15)',
        borderSize: 1
      }
    })
  })
})
