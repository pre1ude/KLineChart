import { describe, expect, it } from 'vitest'
import {
  calcYScaleTickTextHeight,
  calcYScaleTickBounds,
  calcYScaleTickInterval,
  createTimeShareYScaleTickValues,
  formatYScaleTickText,
  layoutYScaleTicks,
  mapYScaleTicksToPixels,
  resolveStandardAutoScale,
  resolveStandardScale,
  resolveStandardTypedExtent,
  resolveTimeShareMainScale,
  resolveYScaleMode,
  resolveYScaleShowMinLabel,
  resolveYScaleTickTextOptions,
  YScaleMode
} from './YScale'
import { YScaleType } from './YScale'

describe('calcYScaleTickTextHeight', () => {
  it('includes vertical edge padding for positive text height', () => {
    expect(calcYScaleTickTextHeight(12)).toBe(16)
  })

  it('keeps non-positive text height unchanged', () => {
    expect(calcYScaleTickTextHeight(0)).toBe(0)
    expect(calcYScaleTickTextHeight(-1)).toBe(-1)
  })
})

describe('calcYScaleTickInterval', () => {
  it('keeps tick spacing large enough for label height', () => {
    const [interval] = calcYScaleTickInterval(0.0082, 153, 12)

    expect(interval).toBe(0.002)
  })

  it('includes vertical edge padding in tick spacing', () => {
    const [interval] = calcYScaleTickInterval(100, 100, 12)

    expect(interval).toBe(50)
  })

  it('uses split number as an approximate target like ECharts', () => {
    const [interval100, precision100] = calcYScaleTickInterval(100, 1000, 0)
    const [from100, to100] = calcYScaleTickBounds(0, 100, interval100, precision100)
    const [interval120, precision120] = calcYScaleTickInterval(120, 1000, 0)
    const [from120, to120] = calcYScaleTickBounds(0, 120, interval120, precision120)

    expect((to100 - from100) / interval100).toBe(5)
    expect((to120 - from120) / interval120).toBe(6)
  })
})

describe('calcYScaleTickBounds', () => {
  it('covers data max and min with outer ticks', () => {
    expect(calcYScaleTickBounds(2.2702, 2.2784, 0.002, 3)).toEqual([2.27, 2.28])
  })

  it('keeps standard k-line ticks covering data min and max', () => {
    const dataMin = 2.2702
    const dataMax = 2.2784
    const extent = resolveStandardTypedExtent(dataMin, dataMax, YScaleType.Normal, 4)
    const range = resolveStandardScale(extent[0], extent[1], YScaleType.Normal, 0.2, 0.1)
    const [interval, precision] = calcYScaleTickInterval(range.to - range.from, 153, 12)
    const [tickFrom, tickTo] = calcYScaleTickBounds(extent[0], extent[1], interval, precision)

    expect(tickFrom).toBeLessThanOrEqual(dataMin)
    expect(tickTo).toBeGreaterThanOrEqual(dataMax)
  })
})

describe('resolveYScaleMode', () => {
  it('separates time-share main y-axis from standard y-axis', () => {
    expect(resolveYScaleMode(true, true)).toBe(YScaleMode.TimeShareMain)
    expect(resolveYScaleMode(true, false)).toBe(YScaleMode.Standard)
    expect(resolveYScaleMode(false, true)).toBe(YScaleMode.Standard)
  })

  it('keeps indicator y-axis standard in time-share mode', () => {
    expect(resolveYScaleMode(false, true)).toBe(YScaleMode.Standard)
  })
})

describe('resolveTimeShareMainScale', () => {
  it('keeps time-share main y-axis symmetric without padding or nice ticks when pane gap is zero', () => {
    expect(resolveTimeShareMainScale(
      2.2702,
      2.2784,
      YScaleType.Normal,
      4,
      2.274
    )).toEqual({
      from: 2.2696,
      to: 2.2784,
      domainFrom: 2.2696,
      domainTo: 2.2784
    })
  })

  it('applies pane gap to time-share main y-axis while keeping the basis centered', () => {
    const range = resolveTimeShareMainScale(
      2.2702,
      2.2784,
      YScaleType.Normal,
      4,
      2.274,
      0.1,
      0.2
    )

    expect(range.from).toBeCloseTo(2.26784)
    expect(range.to).toBeCloseTo(2.28016)
    expect((range.from + range.to) / 2).toBeCloseTo(2.274)
    expect(range.domainFrom).toBeCloseTo(2.2696)
    expect(range.domainTo).toBeCloseTo(2.2784)
  })

  it('supports reserved space converted to a pane gap rate for time-share main y-axis', () => {
    const reservedTopRate = 20 / (100 - 20)
    const range = resolveTimeShareMainScale(
      2.2702,
      2.2784,
      YScaleType.Normal,
      4,
      2.274,
      reservedTopRate,
      0
    )

    expect(range.from).toBeCloseTo(2.2674)
    expect(range.to).toBeCloseTo(2.2806)
    expect((range.from + range.to) / 2).toBeCloseTo(2.274)
  })

  it('keeps the canonical price range symmetric for time-share display projections', () => {
    const range = resolveTimeShareMainScale(
      96.8,
      102.7,
      YScaleType.Normal,
      4,
      100
    )

    expect(range.from).toBeCloseTo(96.8)
    expect(range.to).toBeCloseTo(103.2)
    expect(range.domainFrom).toBeCloseTo(96.8)
    expect(range.domainTo).toBeCloseTo(103.2)
  })
})

describe('resolveStandardScale', () => {
  it('keeps range equal to typed extent when pane gap is zero', () => {
    const extent = resolveStandardTypedExtent(2.2702, 2.2784, YScaleType.Normal, 4)

    expect(resolveStandardScale(extent[0], extent[1], YScaleType.Normal, 0, 0)).toEqual({
      from: 2.2702,
      to: 2.2784,
      domainFrom: 2.2702,
      domainTo: 2.2784
    })
  })

  it('applies explicit standard y-axis padding after typed extent is resolved', () => {
    const extent = resolveStandardTypedExtent(2.2702, 2.2784, YScaleType.Normal, 4)

    expect(resolveStandardScale(extent[0], extent[1], YScaleType.Normal, 0.2, 0.1)).toEqual({
      from: 2.26938,
      to: 2.28004,
      domainFrom: 2.2702,
      domainTo: 2.2784
    })
  })
})

describe('resolveStandardAutoScale', () => {
  it('expands tick extent before applying pane gap so max tick covers data max and stays visible', () => {
    const dataMin = 1.824
    const dataMax = 1.84
    const height = 165
    const scale = resolveStandardAutoScale(
      dataMin,
      dataMax,
      YScaleType.Normal,
      0.2,
      0.1,
      height,
      12
    )
    const maxTickCoord = Math.round((1 - (scale.tickSequence.to - scale.range.from) / (scale.range.to - scale.range.from)) * height)

    expect(scale.tickSequence.from).toBeLessThanOrEqual(dataMin)
    expect(scale.tickSequence.to).toBeGreaterThanOrEqual(dataMax)
    expect(scale.range.to).toBeGreaterThan(scale.tickSequence.to)
    expect(maxTickCoord).toBeGreaterThanOrEqual(0)
  })

  it('keeps the data extent as the scale range when nice is disabled', () => {
    const scale = resolveStandardAutoScale(
      0,
      123,
      YScaleType.Normal,
      0,
      0,
      165,
      12,
      false
    )

    expect(scale.range).toEqual({
      from: 0,
      to: 123,
      domainFrom: 0,
      domainTo: 123
    })
    expect(scale.tickSequence).toMatchObject({
      from: 0,
      to: 123,
      nice: false
    })
  })
})

describe('formatYScaleTickText', () => {
  it('formats log ticks as their original values', () => {
    expect(formatYScaleTickText(2, '', YScaleType.Log, 2, false, String, ',', 4)).toBe('100.00')
  })

  it('applies custom big number formatting before thousands and fold formatting', () => {
    expect(formatYScaleTickText(1234, '', YScaleType.Normal, 0, true, value => `${value}000`, ',', 4)).toBe('1,234,000')
  })
})

describe('layoutYScaleTicks', () => {
  it('supports showMinLabel and showMaxLabel strategy', () => {
    const ticks = [
      { text: 'min', coord: 10, value: 10 },
      { text: 'mid', coord: 50, value: 50 },
      { text: 'max', coord: 90, value: 90 }
    ]

    expect(layoutYScaleTicks(ticks, false, true).map(tick => tick.text)).toEqual(['mid', 'max'])
    expect(layoutYScaleTicks(ticks, true, false).map(tick => tick.text)).toEqual(['min', 'mid'])
  })
})

describe('createTimeShareYScaleTickValues', () => {
  it('keeps time-share min and max values visible as y-axis ticks', () => {
    const ticks = createTimeShareYScaleTickValues(2.2696, 2.2784, 153, 12)

    expect(ticks[0]).toBe(2.2696)
    expect(ticks[ticks.length - 1]).toBe(2.2784)
  })

  it('keeps time-share y-axis ticks evenly distributed', () => {
    const ticks = createTimeShareYScaleTickValues(-0.49, 0.49, 153, 12)
    const step = ticks[1] - ticks[0]

    ticks.slice(1).forEach((tick, index) => {
      expect(tick - ticks[index]).toBeCloseTo(step)
    })
  })

  it('includes vertical edge padding when estimating time-share tick count', () => {
    expect(createTimeShareYScaleTickValues(-0.49, 0.49, 153, 12)).toHaveLength(3)
  })

  it('keeps up to nine evenly distributed time-share y-axis ticks', () => {
    expect(createTimeShareYScaleTickValues(-0.49, 0.49, 300, 12)).toHaveLength(9)
  })

  it('keeps boundary values even when the axis is too short for middle ticks', () => {
    expect(createTimeShareYScaleTickValues(2.2696, 2.2784, 10, 12)).toEqual([
      2.2696,
      2.2784
    ])
  })
})

describe('mapYScaleTicksToPixels', () => {
  it('formats text and maps tick values to pixel coordinates', () => {
    expect(mapYScaleTicksToPixels(
      [{ text: '', coord: 0, value: 12.345, colorHint: 1 }],
      YScaleType.Normal,
      2,
      false,
      String,
      ',',
      4,
      value => value * 10
    )).toEqual([{ text: '12.35', coord: 123.45, value: 12.345, colorHint: 1 }])
  })
})

describe('resolveYScaleTickTextOptions', () => {
  it('uses price precision and disables big number formatting for candle y-axis', () => {
    expect(resolveYScaleTickTextOptions(true, 4, [
      { precision: 6, shouldFormatBigNumber: true }
    ])).toEqual({ precision: 4, shouldFormatBigNumber: false })
  })

  it('uses max indicator precision and big number formatting for indicator y-axis', () => {
    expect(resolveYScaleTickTextOptions(false, 4, [
      { precision: 2, shouldFormatBigNumber: false },
      { precision: 5, shouldFormatBigNumber: true }
    ])).toEqual({ precision: 5, shouldFormatBigNumber: true })
  })
})

describe('resolveYScaleShowMinLabel', () => {
  it('hides min label for time-share indicator y-axis with an axis title', () => {
    expect(resolveYScaleShowMinLabel(true, true, false, 'VOL')).toBe(false)
  })

  it('keeps configured min label in other y-axis contexts', () => {
    expect(resolveYScaleShowMinLabel(true, true, true, 'VOL')).toBe(true)
    expect(resolveYScaleShowMinLabel(true, false, false, 'VOL')).toBe(true)
    expect(resolveYScaleShowMinLabel(true, true, false, '')).toBe(true)
    expect(resolveYScaleShowMinLabel(false, true, false, 'VOL')).toBe(false)
  })
})
