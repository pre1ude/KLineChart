import { describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, GridLineLevel } from '../common/Styles'
import type KLineData from '../common/KLineData'
import { getDefaultCustomApi } from '../Options'
import type { FormatDate } from '../Options'
import type { AxisCreateTicksParams, AxisTick } from './Axis'
import XAxisImp from './XAxis'
import {
  filterOverlappedXAxisTicks,
  mergeBoundaryXAxisTicks,
  resolveXAxisTickLayoutOptions,
  calcXAxisTickTextX,
  type XAxisTick
} from './x-axis/tickLayout'
import {
  selectTimeShareTickIndexes
} from './x-axis/timeShareTicks'

vi.mock('../common/utils/canvas', () => ({
  calcTextWidth: (text: string) => text.length,
  createFont: () => ''
}))

describe('mergeBoundaryXAxisTicks', () => {
  it('adds missing dataZoom boundary ticks and keeps ticks sorted by coordinate', () => {
    const ticks: AxisTick[] = [
      { text: '10:00', coord: 100, value: 1000 },
      { text: '10:30', coord: 200, value: 2000 }
    ]
    const boundaryTicks: AxisTick[] = [
      { text: '09:45', coord: 0, value: 500 },
      { text: '10:30', coord: 200, value: 2000 },
      { text: '11:00', coord: 300, value: 3000 }
    ]

    expect(mergeBoundaryXAxisTicks(ticks, boundaryTicks)).toEqual([
      { text: '09:45', coord: 0, value: 500 },
      { text: '10:00', coord: 100, value: 1000 },
      { text: '10:30', coord: 200, value: 2000 },
      { text: '11:00', coord: 300, value: 3000 }
    ])
  })
})

describe('filterOverlappedXAxisTicks', () => {
  it('keeps min and max labels when hiding overlapped middle labels', () => {
    const ticks: AxisTick[] = [
      { text: 'left', coord: 0, value: 'left' },
      { text: 'near-left', coord: 4, value: 'near-left' },
      { text: 'middle', coord: 50, value: 'middle' },
      { text: 'near-right', coord: 96, value: 'near-right' },
      { text: 'right', coord: 100, value: 'right' }
    ]
    const widths = [20, 20, 20, 20, 20]

    expect(filterOverlappedXAxisTicks(ticks, widths, 100, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(tick => tick.text)).toEqual(['left', '', 'middle', '', 'right'])
  })

  it('prefers max label when min and max labels overlap', () => {
    const ticks: AxisTick[] = [
      { text: 'left', coord: 0, value: 'left' },
      { text: 'right', coord: 10, value: 'right' }
    ]
    const widths = [20, 20]

    expect(filterOverlappedXAxisTicks(ticks, widths, 20, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(tick => tick.text)).toEqual(['', 'right'])
  })

  it('keeps higher priority ticks when regular ticks overlap them', () => {
    const ticks: XAxisTick[] = [
      { text: '15:00', coord: 96, value: '15:00' },
      { text: '05-12', coord: 100, value: '05-12', priority: 1 }
    ]
    const widths = [20, 20]

    expect(filterOverlappedXAxisTicks(ticks, widths, 120).map(tick => tick.text)).toEqual(['', '05-12'])
  })

  it('clamps a single visible label on both sides', () => {
    expect(calcXAxisTickTextX({
      text: 'right',
      coord: 118,
      value: 'right'
    }, 20, 0, 1, 120)).toBe(110)
  })
})

describe('resolveXAxisTickLayoutOptions', () => {
  it('uses style options outside dataZoom and forces both boundary labels in dataZoom', () => {
    expect(resolveXAxisTickLayoutOptions({
      showMinLabel: true,
      showMaxLabel: false
    }, false)).toEqual({
      showMinLabel: true,
      showMaxLabel: false
    })
    expect(resolveXAxisTickLayoutOptions({
      showMinLabel: false,
      showMaxLabel: false
    }, true)).toEqual({
      showMinLabel: true,
      showMaxLabel: true
    })
  })
})

describe('selectTimeShareTickIndexes', () => {
  it('prefers session boundaries and rounded times within the available tick count', () => {
    const timeShareTicks = [
      ...createMinuteTimeRange('09:30', '11:30'),
      ...createMinuteTimeRange('13:00', '15:00')
    ]

    expect(selectTimeShareTickIndexes(timeShareTicks, 1, 5, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(index => timeShareTicks[index])).toEqual([
      '09:30',
      '10:30',
      '13:00',
      '14:00',
      '15:00'
    ])
  })

  it('prefers a rounded session end over a non-rounded next session start', () => {
    const timeShareTicks = [
      ...createMinuteTimeRange('09:30', '11:30'),
      ...createMinuteTimeRange('13:01', '15:00')
    ]

    expect(selectTimeShareTickIndexes(timeShareTicks, 1, 5, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(index => timeShareTicks[index])).toEqual([
      '09:30',
      '10:30',
      '11:30',
      '14:00',
      '15:00'
    ])
  })

  it('selects stable ticks for SHFE gold futures trading sessions', () => {
    const timeShareTicks = [
      ...createMinuteTimeRange('21:00', '23:59'),
      ...createMinuteTimeRange('00:00', '02:30'),
      ...createMinuteTimeRange('09:00', '10:15'),
      ...createMinuteTimeRange('10:30', '11:30'),
      ...createMinuteTimeRange('13:30', '15:00')
    ]

    expect(selectTimeShareTickIndexes(timeShareTicks, 1, 12, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(index => timeShareTicks[index])).toEqual([
      '21:00',
      '22:00',
      '23:00',
      '00:00',
      '01:00',
      '02:00',
      '09:00',
      '10:00',
      '10:30',
      '13:30',
      '14:30',
      '15:00'
    ])
  })

  it('keeps one side of each SHFE gold futures session boundary when starts are not rounded', () => {
    const timeShareTicks = [
      ...createMinuteTimeRange('21:00', '23:59'),
      ...createMinuteTimeRange('00:00', '02:30'),
      ...createMinuteTimeRange('09:01', '10:15'),
      ...createMinuteTimeRange('10:31', '11:30'),
      ...createMinuteTimeRange('13:31', '15:00')
    ]

    expect(selectTimeShareTickIndexes(timeShareTicks, 1, 12, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(index => timeShareTicks[index])).toEqual([
      '21:00',
      '22:00',
      '23:00',
      '00:00',
      '01:00',
      '02:00',
      '02:30',
      '10:15',
      '11:00',
      '11:30',
      '14:00',
      '15:00'
    ])
  })

  it('keeps a uniform time cadence instead of mixing sparse quarter-hour ticks', () => {
    const timeShareTicks = [
      ...createMinuteTimeRange('09:30', '11:30'),
      ...createMinuteTimeRange('13:00', '15:15')
    ]

    expect(selectTimeShareTickIndexes(timeShareTicks, 1, 14, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(index => timeShareTicks[index])).toEqual([
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '15:15'
    ])
  })

  it('uses a fine cadence when session boundary filtering keeps it within the available tick count', () => {
    const timeShareTicks = [
      ...createMinuteTimeRange('09:30', '11:30'),
      ...createMinuteTimeRange('13:00', '15:15')
    ]

    expect(selectTimeShareTickIndexes(timeShareTicks, 1, 18, {
      showMinLabel: true,
      showMaxLabel: true
    }).map(index => timeShareTicks[index])).toEqual([
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
      '10:45',
      '11:00',
      '11:15',
      '13:00',
      '13:15',
      '13:30',
      '13:45',
      '14:00',
      '14:15',
      '14:30',
      '14:45',
      '15:00',
      '15:15'
    ])
  })

  it('keeps every day start tick in multi-day time-share charts', () => {
    const timeShareTicks = ['09:30', '10:30', '11:30', '13:00', '14:00', '15:00']

    expect(selectTimeShareTickIndexes(timeShareTicks, 3, 4, {
      showMinLabel: true,
      showMaxLabel: true
    })).toEqual(expect.arrayContaining([0, 6, 12]))
  })

  it('keeps the next day start over the previous day end when day boundary ticks are adjacent', () => {
    const timeShareTicks = Array.from({ length: 24 * 4 }, (_, index) => formatHHmm(index * 15))

    const indexes = selectTimeShareTickIndexes(timeShareTicks, 2, 200, {
      showMinLabel: true,
      showMaxLabel: true
    })

    expect(indexes).toEqual(expect.arrayContaining([0, timeShareTicks.length, timeShareTicks.length * 2 - 1]))
    expect(indexes).not.toContain(timeShareTicks.length - 1)
  })

  it('uses the same intraday ticks for each day in short multi-day time-share charts', () => {
    const timeShareTicks = ['09:30', '11:30', '13:00', '15:15']

    expect(selectTimeShareTickIndexes(timeShareTicks, 4, 20, {
      showMinLabel: true,
      showMaxLabel: true
    })).toEqual([
      0,
      1,
      4,
      5,
      8,
      9,
      12,
      13,
      15
    ])
  })

  it('uses day-level ticks instead of intraday session ticks in multi-day time-share charts', () => {
    const timeShareTicks = ['09:30', '11:30', '13:00', '15:15']
    const ticksPerDay = timeShareTicks.length
    const dayCount = 10

    expect(selectTimeShareTickIndexes(timeShareTicks, dayCount, 18, {
      showMinLabel: true,
      showMaxLabel: true
    })).toEqual([
      0,
      4,
      8,
      12,
      16,
      20,
      24,
      28,
      32,
      36,
      ticksPerDay * dayCount - 1
    ])
  })
})

describe('XAxisImp optimalTicks', () => {
  it('keeps dataZoom boundary ticks in regular charts', () => {
    const dataList: KLineData[] = [
      { timestamp: 1000, open: 1, high: 1, low: 1, close: 1 },
      { timestamp: 2000, open: 2, high: 2, low: 2, close: 2 }
    ]
    const xAxis = createTestXAxis(dataList)
    xAxis.setRange({
      from: 0,
      to: 2,
      domainFrom: 0,
      domainTo: 2
    })
    xAxis.runBuildTicks(true)

    expect(xAxis.getTicks().map(tick => tick.value)).toEqual([1000, 2000])
  })

  it('does not force the max label outside dataZoom when showMaxLabel is false', () => {
    const dataList: KLineData[] = [
      { timestamp: 1000, open: 1, high: 1, low: 1, close: 1 },
      { timestamp: 2000, open: 2, high: 2, low: 2, close: 2 }
    ]
    const xAxis = createTestXAxis(dataList, {
      dataZoomEnabled: false,
      showMinLabel: true,
      showMaxLabel: false,
      coordinateStep: 1
    })
    xAxis.setRange({
      from: 0,
      to: 2,
      domainFrom: 0,
      domainTo: 2
    })
    xAxis.runBuildTicks(true)

    expect(xAxis.getTicks().map(tick => tick.value)).toEqual([1000])
  })

  it('keeps the dataZoom max label when it overlaps the previous tick', () => {
    const dataList: KLineData[] = [
      { timestamp: 1000, open: 1, high: 1, low: 1, close: 1 },
      { timestamp: 2000, open: 2, high: 2, low: 2, close: 2 },
      { timestamp: 3000, open: 3, high: 3, low: 3, close: 3 },
      { timestamp: 4000, open: 4, high: 4, low: 4, close: 4 }
    ]
    const xAxis = createTestXAxis(dataList, {
      dataZoomEnabled: true,
      showMinLabel: false,
      showMaxLabel: false,
      coordinateStep: 8
    })
    xAxis.setRange({
      from: 0,
      to: 4,
      domainFrom: 0,
      domainTo: 4
    })
    xAxis.runBuildTicks(true)

    expect(xAxis.getTicks().map(tick => tick.value)).toEqual([1000, 3000, 4000])
  })

  it('keeps more regular ticks when labels are short', () => {
    const dataList = createSequentialDataList(40)
    const shortFormatDate = () => '1'
    const longFormatDate = () => '1234567890'

    const shortXAxis = createTestXAxis(dataList, { formatDate: shortFormatDate, coordinateStep: 5 })
    shortXAxis.setRange({
      from: 0,
      to: 40,
      domainFrom: 0,
      domainTo: 40
    })
    shortXAxis.runBuildTicks(true)

    const longXAxis = createTestXAxis(dataList, { formatDate: longFormatDate, coordinateStep: 5 })
    longXAxis.setRange({
      from: 0,
      to: 40,
      domainFrom: 0,
      domainTo: 40
    })
    longXAxis.runBuildTicks(true)

    expect(shortXAxis.getTicks().length).toBeGreaterThan(longXAxis.getTicks().length)
  })

  it('filters custom ticks returned from createTicks', () => {
    const dataList = createSequentialDataList(2)
    const xAxis = createTestXAxis(dataList, {
      dataZoomEnabled: false,
      showMinLabel: false,
      showMaxLabel: false,
      coordinateStep: 10,
      createTicks: () => [
        { text: 'custom-left', coord: 0, value: 'custom-left' },
        { text: 'custom-right', coord: 1, value: 'custom-right' }
      ]
    })
    xAxis.setRange({
      from: 0,
      to: 2,
      domainFrom: 0,
      domainTo: 2
    })
    xAxis.runBuildTicks(true)

    expect(xAxis.getTicks().map(tick => tick.text)).toEqual(['custom-left', ''])
  })
})

describe('XAxisImp optimalMinuteTicks', () => {
  it('accounts for clamped boundary labels when estimating time-share tick capacity', () => {
    const timeShareTicks = ['09:30', '09:45', '10:00', '10:15']
    const xAxis = createTestXAxis(createTimeShareDataList(timeShareTicks), {
      dataZoomEnabled: false,
      showMinLabel: true,
      showMaxLabel: true,
      timeShareTicks,
      width: 38
    })

    const ticks = xAxis.runOptimalMinuteTicks()

    expect(ticks.map(tick => tick.text)).toEqual([
      '09:30',
      '09:45',
      '10:00',
      '10:15'
    ])
  })

  it('merges configured time-share ticks with xAxis boundary labels', () => {
    const timeShareTicks = ['09:30', '10:00', '10:30', '11:00']
    const xAxis = createTestXAxis(createTimeShareDataList(timeShareTicks), {
      dataZoomEnabled: false,
      preferXTicks: ['10:00'],
      showMinLabel: true,
      showMaxLabel: true,
      timeShareTicks
    })

    const ticks = xAxis.runOptimalMinuteTicks()

    expect(ticks.map(tick => tick.text)).toEqual([
      '09:30',
      '10:00',
      '11:00'
    ])
  })

  it('adds day start ticks when preferXTicks is configured in multi-day time-share charts', () => {
    const timeShareTicks = ['09:30', '10:30', '11:30']
    const xAxis = createTestXAxis(createTimeShareDataList(timeShareTicks, 3), {
      dataZoomEnabled: false,
      preferXTicks: ['10:30'],
      showMinLabel: false,
      showMaxLabel: false,
      timeShareTicks,
      timeShareDays: 3
    })

    const ticks = xAxis.runOptimalMinuteTicks()

    expect(ticks.map(tick => tick.text)).toEqual([
      '2024-01-02',
      '10:30',
      '01-03',
      '10:30',
      '01-04',
      '10:30'
    ])
  })

  it('marks multi-day time-share day start ticks as primary grid lines', () => {
    const timeShareTicks = ['09:30', '10:30', '11:30']
    const xAxis = createTestXAxis(createTimeShareDataList(timeShareTicks, 3), {
      dataZoomEnabled: false,
      preferXTicks: ['10:30'],
      showMinLabel: false,
      showMaxLabel: false,
      timeShareTicks,
      timeShareDays: 3
    })

    const ticks = xAxis.runOptimalMinuteTicks()

    expect(ticks.map(tick => tick.gridLineLevel)).toEqual([
      undefined,
      undefined,
      GridLineLevel.Primary,
      undefined,
      GridLineLevel.Primary,
      undefined
    ])
  })

  it('keeps the last endpoint as time text when day start ticks already show dates', () => {
    const timeShareTicks = ['09:30', '10:30', '11:30']
    const xAxis = createTestXAxis(createTimeShareDataList(timeShareTicks, 3), {
      dataZoomEnabled: false,
      showMinLabel: true,
      showMaxLabel: true,
      timeShareTicks,
      timeShareDays: 3
    })

    const ticks = xAxis.runOptimalMinuteTicks()

    expect(ticks.map(tick => tick.text)).toEqual([
      '2024-01-02',
      '10:30',
      '01-03',
      '10:30',
      '01-04',
      '10:30',
      '11:30'
    ])
  })
})

class TestXAxis extends XAxisImp {
  private readonly _createTicks?: (params: AxisCreateTicksParams) => AxisTick[]

  constructor(parent: ConstructorParameters<typeof XAxisImp>[0], createTicks?: (params: AxisCreateTicksParams) => AxisTick[]) {
    super(parent)
    this._createTicks = createTicks
  }

  createTicks(params: AxisCreateTicksParams): AxisTick[] {
    return this._createTicks?.(params) ?? params.defaultTicks
  }

  runOptimalMinuteTicks(): AxisTick[] {
    return this.optimalMinuteTicks()
  }

  runBuildTicks(force: boolean): boolean {
    return this.buildTicks(force)
  }
}

function createTestXAxis(
  dataList: KLineData[],
  options: {
    dataZoomEnabled?: boolean
    showMinLabel?: boolean
    showMaxLabel?: boolean
    timeShareTicks?: string[]
    timeShareDays?: number
    preferXTicks?: string[]
    coordinateStep?: number
    width?: number
    formatDate?: FormatDate
    createTicks?: (params: AxisCreateTicksParams) => AxisTick[]
  } = {}
): TestXAxis {
  const styles = getDefaultStyles()
  styles.xAxis.showMinLabel = options.showMinLabel ?? styles.xAxis.showMinLabel
  styles.xAxis.showMaxLabel = options.showMaxLabel ?? styles.xAxis.showMaxLabel
  const customApi = getDefaultCustomApi()
  if (options.formatDate != null) {
    customApi.formatDate = options.formatDate
  }
  const coordinateStep = options.coordinateStep ?? 100
  const width = options.width ?? 200
  const chartStore = {
    getCustomApi: () => customApi,
    getDataList: () => dataList,
    getDataZoomEnabled: () => options.dataZoomEnabled ?? true,
    getIsTimeShare: () => false,
    getTimeShareTicks: () => options.timeShareTicks ?? [],
    getTimeShareDays: () => options.timeShareDays ?? 1,
    getPreferXTicks: () => options.preferXTicks,
    dataIndexToTimestamp: (dataIndex: number) => dataList[dataIndex]?.timestamp,
    getTimeScaleStore: () => ({
      dataIndexToCoordinate: (dataIndex: number) => dataIndex * coordinateStep,
      getBarSpace: () => ({
        bar: coordinateStep,
        halfBar: coordinateStep / 2,
        gapBar: coordinateStep,
        halfGapBar: coordinateStep / 2
      })
    })
  }
  const chart = {
    getChartStore: () => chartStore,
    getStyles: () => styles
  }
  const pane = {
    getChart: () => chart
  }
  const parent = {
    getPane: () => pane,
    getBounding: () => ({
      left: 0,
      top: 0,
      right: width,
      bottom: 20,
      width,
      height: 20
    })
  } as never

  return new TestXAxis(parent, options.createTicks)
}

function createSequentialDataList(length: number): KLineData[] {
  return Array.from({ length }, (_, index) => ({
    timestamp: new Date(2024, 0, 1, 9, 30).getTime() + index * 60_000,
    open: index,
    high: index,
    low: index,
    close: index
  }))
}

function createMinuteTimeRange(start: string, end: string): string[] {
  const values: string[] = []
  for (let minute = parseHHmm(start); minute <= parseHHmm(end); minute++) {
    values.push(formatHHmm(minute))
  }
  return values
}

function parseHHmm(text: string): number {
  const [hour, minute] = text.split(':').map(Number)
  return hour * 60 + minute
}

function formatHHmm(value: number): string {
  const hour = Math.floor(value / 60).toString().padStart(2, '0')
  const minute = (value % 60).toString().padStart(2, '0')
  return `${hour}:${minute}`
}

function createTimeShareDataList(timeShareTicks: string[], dayCount: number = 1): KLineData[] {
  return Array.from({ length: timeShareTicks.length * dayCount }, (_, index) => ({
    timestamp: new Date(2024, 0, 2 + Math.floor(index / timeShareTicks.length), 9, 30 + index % timeShareTicks.length).getTime(),
    open: index,
    high: index,
    low: index,
    close: index
  }))
}
