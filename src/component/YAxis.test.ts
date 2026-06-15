import { describe, expect, it } from 'vitest'
import {
  calcYAxisTickBounds,
  calcYAxisTickInterval,
  createTimeShareYAxisTickValues,
  createSyncedYAxisTick,
  formatYAxisTickText,
  getIndicatorYAxisPosition,
  layoutYAxisTicks,
  mapYAxisTicksToPixels,
  resolveStandardAutoScale,
  resolveStandardScale,
  resolveStandardTypedExtent,
  resolveTimeShareMainScale,
  resolveYAxisScaleMode,
  resolveYAxisShowMinLabel,
  resolveYAxisTickTextOptions,
  YAxisScaleMode
} from './YAxis'
import { YAxisPosition, YAxisType } from '../common/Styles'
import { type Indicator } from './Indicator'

describe('calcYAxisTickInterval', () => {
  it('keeps tick spacing large enough for label height', () => {
    const [interval] = calcYAxisTickInterval(0.0082, 153, 12)

    expect(interval).toBe(0.002)
  })

  it('uses split number as an approximate target like ECharts', () => {
    const [interval100, precision100] = calcYAxisTickInterval(100, 1000, 0)
    const [from100, to100] = calcYAxisTickBounds(0, 100, interval100, precision100)
    const [interval120, precision120] = calcYAxisTickInterval(120, 1000, 0)
    const [from120, to120] = calcYAxisTickBounds(0, 120, interval120, precision120)

    expect((to100 - from100) / interval100).toBe(5)
    expect((to120 - from120) / interval120).toBe(6)
  })
})

describe('getIndicatorYAxisPosition', () => {
  it('keeps explicit y-axis position and uses the caller default for legacy indicators', () => {
    const indicator: Pick<Indicator, 'yAxisPosition'> = {}
    expect(getIndicatorYAxisPosition(indicator)).toBe('left')
    expect(getIndicatorYAxisPosition(indicator, 'right')).toBe('right')

    indicator.yAxisPosition = 'right'
    expect(getIndicatorYAxisPosition(indicator, 'left')).toBe('right')
    expect(getIndicatorYAxisPosition(indicator)).toBe('right')
  })

  it('supports global y-axis position fallback rules for indicators without explicit axis binding', () => {
    const indicator: Pick<Indicator, 'yAxisPosition'> = {}
    const resolveDefaultPosition = (position: YAxisPosition): 'left' | 'right' => (
      position === YAxisPosition.Right ? YAxisPosition.Right : YAxisPosition.Left
    )

    expect(getIndicatorYAxisPosition(indicator, resolveDefaultPosition(YAxisPosition.Left))).toBe('left')
    expect(getIndicatorYAxisPosition(indicator, resolveDefaultPosition(YAxisPosition.Right))).toBe('right')
    expect(getIndicatorYAxisPosition(indicator, resolveDefaultPosition(YAxisPosition.Both))).toBe('left')
  })
})

describe('calcYAxisTickBounds', () => {
  it('covers data max and min with outer ticks', () => {
    expect(calcYAxisTickBounds(2.2702, 2.2784, 0.002, 3)).toEqual([2.27, 2.28])
  })

  it('keeps standard k-line ticks covering data min and max', () => {
    const dataMin = 2.2702
    const dataMax = 2.2784
    const extent = resolveStandardTypedExtent(dataMin, dataMax, YAxisType.Normal, 4, undefined, 0)
    const range = resolveStandardScale(extent[0], extent[1], YAxisType.Normal, undefined, 0, 0.2, 0.1)
    const [interval, precision] = calcYAxisTickInterval(range.to - range.from, 153, 12)
    const [tickFrom, tickTo] = calcYAxisTickBounds(extent[0], extent[1], interval, precision)

    expect(tickFrom).toBeLessThanOrEqual(dataMin)
    expect(tickTo).toBeGreaterThanOrEqual(dataMax)
  })
})

describe('resolveYAxisScaleMode', () => {
  it('separates time-share main y-axis from standard y-axis', () => {
    expect(resolveYAxisScaleMode(true, true)).toBe(YAxisScaleMode.TimeShareMain)
    expect(resolveYAxisScaleMode(true, false)).toBe(YAxisScaleMode.Standard)
    expect(resolveYAxisScaleMode(false, true)).toBe(YAxisScaleMode.Standard)
  })

  it('keeps indicator y-axis standard in time-share mode', () => {
    expect(resolveYAxisScaleMode(false, true)).toBe(YAxisScaleMode.Standard)
  })
})

describe('resolveTimeShareMainScale', () => {
  it('keeps time-share main y-axis symmetric without padding or nice ticks when pane gap is zero', () => {
    expect(resolveTimeShareMainScale(
      2.2702,
      2.2784,
      YAxisType.Normal,
      4,
      2.274,
      undefined,
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
      YAxisType.Normal,
      4,
      2.274,
      undefined,
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
      YAxisType.Normal,
      4,
      2.274,
      undefined,
      2.274,
      reservedTopRate,
      0
    )

    expect(range.from).toBeCloseTo(2.2674)
    expect(range.to).toBeCloseTo(2.2806)
    expect((range.from + range.to) / 2).toBeCloseTo(2.274)
  })

  it('keeps minute percentage time-share main y-axis without padding or nice ticks when pane gap is zero', () => {
    const range = resolveTimeShareMainScale(
      96.8,
      102.7,
      YAxisType.MinutePercentage,
      4,
      100,
      undefined,
      100
    )

    expect(range.from).toBeCloseTo(-3.2)
    expect(range.to).toBeCloseTo(3.2)
    expect(range.domainFrom).toBeCloseTo(96.8)
    expect(range.domainTo).toBeCloseTo(103.2)
  })
})

describe('resolveStandardScale', () => {
  it('keeps range equal to typed extent when pane gap is zero', () => {
    const extent = resolveStandardTypedExtent(2.2702, 2.2784, YAxisType.Normal, 4, undefined, 0)

    expect(resolveStandardScale(extent[0], extent[1], YAxisType.Normal, undefined, 0, 0, 0)).toEqual({
      from: 2.2702,
      to: 2.2784,
      domainFrom: 2.2702,
      domainTo: 2.2784
    })
  })

  it('applies explicit standard y-axis padding after typed extent is resolved', () => {
    const extent = resolveStandardTypedExtent(2.2702, 2.2784, YAxisType.Normal, 4, undefined, 0)

    expect(resolveStandardScale(extent[0], extent[1], YAxisType.Normal, undefined, 0, 0.2, 0.1)).toEqual({
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
      YAxisType.Normal,
      undefined,
      0,
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
      YAxisType.Normal,
      undefined,
      0,
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

describe('formatYAxisTickText', () => {
  it('formats percentage ticks with fixed percentage precision', () => {
    expect(formatYAxisTickText(1.2345, '', YAxisType.Percentage, 4, false, String, ',', 4)).toBe('1.23%')
    expect(formatYAxisTickText(-1.2345, '', YAxisType.MinutePercentage, 4, false, String, ',', 4)).toBe('-1.23%')
  })

  it('formats log ticks as their original values', () => {
    expect(formatYAxisTickText(2, '', YAxisType.Log, 2, false, String, ',', 4)).toBe('100.00')
  })

  it('applies custom big number formatting before thousands and fold formatting', () => {
    expect(formatYAxisTickText(1234, '', YAxisType.Normal, 0, true, value => `${value}000`, ',', 4)).toBe('1,234,000')
  })
})

describe('layoutYAxisTicks', () => {
  it('supports showMinLabel and showMaxLabel strategy', () => {
    const ticks = [
      { text: 'min', coord: 10, value: 10 },
      { text: 'mid', coord: 50, value: 50 },
      { text: 'max', coord: 90, value: 90 }
    ]

    expect(layoutYAxisTicks(ticks, false, true).map(tick => tick.text)).toEqual(['mid', 'max'])
    expect(layoutYAxisTicks(ticks, true, false).map(tick => tick.text)).toEqual(['min', 'mid'])
  })
})

describe('createTimeShareYAxisTickValues', () => {
  it('keeps time-share min and max values visible as y-axis ticks', () => {
    const ticks = createTimeShareYAxisTickValues(2.2696, 2.2784, 153, 12)

    expect(ticks[0]).toBe(2.2696)
    expect(ticks[ticks.length - 1]).toBe(2.2784)
  })

  it('keeps time-share y-axis ticks evenly distributed', () => {
    const ticks = createTimeShareYAxisTickValues(-0.49, 0.49, 153, 12)
    const step = ticks[1] - ticks[0]

    ticks.slice(1).forEach((tick, index) => {
      expect(tick - ticks[index]).toBeCloseTo(step)
    })
  })

  it('keeps up to nine evenly distributed time-share y-axis ticks', () => {
    expect(createTimeShareYAxisTickValues(-0.49, 0.49, 300, 12)).toHaveLength(9)
  })

  it('keeps boundary values even when the axis is too short for middle ticks', () => {
    expect(createTimeShareYAxisTickValues(2.2696, 2.2784, 10, 12)).toEqual([
      2.2696,
      2.2784
    ])
  })
})

describe('mapYAxisTicksToPixels', () => {
  it('formats text and maps tick values to pixel coordinates', () => {
    expect(mapYAxisTicksToPixels(
      [{ text: '', coord: 0, value: 12.345, colorHint: 1 }],
      YAxisType.Normal,
      2,
      false,
      String,
      ',',
      4,
      value => value * 10
    )).toEqual([{ text: '12.35', coord: 123.45, value: 12.345, colorHint: 1 }])
  })
})

describe('resolveYAxisTickTextOptions', () => {
  it('uses price precision and disables big number formatting for candle y-axis', () => {
    expect(resolveYAxisTickTextOptions(true, 4, [
      { precision: 6, shouldFormatBigNumber: true }
    ])).toEqual({ precision: 4, shouldFormatBigNumber: false })
  })

  it('uses max indicator precision and big number formatting for indicator y-axis', () => {
    expect(resolveYAxisTickTextOptions(false, 4, [
      { precision: 2, shouldFormatBigNumber: false },
      { precision: 5, shouldFormatBigNumber: true }
    ])).toEqual({ precision: 5, shouldFormatBigNumber: true })
  })
})

describe('resolveYAxisShowMinLabel', () => {
  it('hides min label for time-share indicator y-axis with an axis title', () => {
    expect(resolveYAxisShowMinLabel(true, true, false, 'VOL')).toBe(false)
  })

  it('keeps configured min label in other y-axis contexts', () => {
    expect(resolveYAxisShowMinLabel(true, true, true, 'VOL')).toBe(true)
    expect(resolveYAxisShowMinLabel(true, false, false, 'VOL')).toBe(true)
    expect(resolveYAxisShowMinLabel(true, true, false, '')).toBe(true)
    expect(resolveYAxisShowMinLabel(false, true, false, 'VOL')).toBe(false)
  })
})

describe('createSyncedYAxisTick', () => {
  it('uses formatter for normal synced y-axis ticks', () => {
    expect(createSyncedYAxisTick(
      { text: '', coord: 12, value: 0 },
      YAxisType.Normal,
      2,
      value => `v:${value}`,
      () => 5.1234,
      0,
      undefined
    )).toEqual({ text: 'v:5.1234', coord: 12, value: 5.1234 })
  })

  it('formats percentage synced y-axis ticks from first close', () => {
    expect(createSyncedYAxisTick(
      { text: '', coord: 12, value: 0 },
      YAxisType.Percentage,
      2,
      value => `v:${value}`,
      () => 105,
      0,
      100
    )).toEqual({ text: '5.00%', coord: 12, value: 5 })
  })

  it('formats minute percentage synced y-axis ticks from minute basis', () => {
    expect(createSyncedYAxisTick(
      { text: '', coord: 12, value: 0 },
      YAxisType.MinutePercentage,
      2,
      value => `v:${value}`,
      () => 98,
      100,
      undefined
    )).toEqual({ text: '-2.00%', coord: 12, value: -2 })
  })

  it('formats log synced y-axis ticks as converted values', () => {
    expect(createSyncedYAxisTick(
      { text: '', coord: 12, value: 0 },
      YAxisType.Log,
      1,
      value => `v:${value}`,
      () => 100.12,
      0,
      undefined
    )).toEqual({ text: '100.1', coord: 12, value: 100.12 })
  })
})
