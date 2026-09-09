import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, type GapStyle } from '../common/Styles'
import { type GapRecord } from '../component/Gap'
import { drawRect } from '../extension/figure/rect'
import GapView from './GapView'

vi.mock('../extension/figure/rect', () => ({
  drawRect: vi.fn()
}))

function gap(direction: 'up' | 'down', segments: GapRecord['segments']): GapRecord {
  return {
    id: `gap:${direction}:1`,
    direction,
    openIndex: 1,
    openTimestamp: 1,
    originalTop: 110,
    originalBottom: 100,
    status: segments[segments.length - 1]?.toIndex === undefined ? 'active' : 'closed',
    segments
  }
}

function createView(
  gaps: GapRecord[],
  convertY: (value: number) => number = value => value,
  enabled: boolean = true,
  gapStyles: GapStyle = getDefaultStyles().gap
) {
  const mainYAxis = { convertToPixel: vi.fn(convertY) }
  const leftYAxis = { convertToPixel: vi.fn(convertY) }
  const xAxis = { convertToPixel: vi.fn((index: number) => index * 10) }
  const gapStore = {
    isEnabled: () => enabled,
    getGaps: () => gaps
  }
  const chart = {
    getChartStore: () => ({
      getGapStore: () => gapStore,
      getStyles: () => ({ gap: gapStyles })
    }),
    getXAxisPane: () => ({
      getMainWidget: () => ({ getAxisComponent: () => xAxis })
    })
  }
  const pane = {
    getChart: () => chart,
    getDefaultYScale: () => ({ getComponent: () => mainYAxis }),
    getMainAxisWidget: () => ({ getAxisComponent: () => mainYAxis }),
    getYLeftAxisWidget: () => ({ getAxisComponent: () => leftYAxis })
  }
  const widget = {
    getPane: () => pane,
    getBounding: () => ({ width: 100, height: 120, left: 0, top: 0 })
  }

  return {
    view: new GapView(widget as never),
    mainYAxis,
    leftYAxis,
    xAxis
  }
}

describe('GapView', () => {
  beforeEach(() => {
    vi.mocked(drawRect).mockClear()
  })

  it('extends active segments to the widget right edge and ends closed segments at their data index', () => {
    const { view } = createView([
      gap('up', [{ fromIndex: 1, top: 80, bottom: 60 }]),
      gap('down', [{ fromIndex: 2, toIndex: 5, top: 50, bottom: 30 }])
    ])

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(drawRect).toHaveBeenCalledTimes(2)
    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 10, y: 60, width: 90, height: 20 }
    ])
    expect(vi.mocked(drawRect).mock.calls[1][1]).toEqual([
      { x: 20, y: 30, width: 31, height: 20 }
    ])
  })

  it('clips rectangles horizontally and vertically and supports reversed y coordinates', () => {
    const { view } = createView([
      gap('up', [{ fromIndex: -2, toIndex: 3, top: 130, bottom: 90 }])
    ], value => value)

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 0, y: 90, width: 31, height: 30 }
    ])
  })

  it('uses the configured main price axis instead of a fixed left axis', () => {
    const { view, mainYAxis, leftYAxis } = createView([
      gap('up', [{ fromIndex: 1, top: 80, bottom: 60 }])
    ])

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(mainYAxis.convertToPixel).toHaveBeenCalledWith(80)
    expect(mainYAxis.convertToPixel).toHaveBeenCalledWith(60)
    expect(leftYAxis.convertToPixel).not.toHaveBeenCalled()
  })

  it('uses gap appearance from the chart style tree', () => {
    const gapStyles: GapStyle = {
      up: { borderColor: '#ff0000', backgroundColor: '#ff000026' },
      down: { borderColor: '#00ff00', backgroundColor: '#00ff0026' }
    }
    const { view } = createView([
      gap('up', [{ fromIndex: 1, top: 80, bottom: 60 }])
    ], value => value, true, gapStyles)

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(vi.mocked(drawRect).mock.calls[0][2]).toMatchObject({
      color: '#ff000026',
      borderColor: '#ff0000',
      borderSize: undefined
    })
  })

  it('overlaps the shared border of consecutive segments for odd border widths', () => {
    const { view } = createView([
      gap('up', [
        { fromIndex: 1, toIndex: 2, top: 80, bottom: 60 },
        { fromIndex: 2, toIndex: 4, top: 70, bottom: 60 }
      ])
    ])

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 10, y: 60, width: 11, height: 20 },
      { x: 20, y: 60, width: 21, height: 10 }
    ])
  })

  it('snaps odd-width vertical borders to the candle wick pixel columns', () => {
    const { view, xAxis } = createView([
      gap('up', [{ fromIndex: 1, toIndex: 2, top: 80, bottom: 60 }])
    ])
    xAxis.convertToPixel.mockImplementation((index: number) => index * 10 + 0.4)

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 10, y: 60, width: 11, height: 20 }
    ])
  })

  it('keeps consecutive segment coordinates unchanged for even border widths', () => {
    const gapStyles = getDefaultStyles().gap
    gapStyles.up.borderSize = 2
    const { view } = createView([
      gap('up', [
        { fromIndex: 1, toIndex: 2, top: 80, bottom: 60 },
        { fromIndex: 2, toIndex: 4, top: 70, bottom: 60 }
      ])
    ], value => value, true, gapStyles)

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 10, y: 60, width: 10, height: 20 },
      { x: 20, y: 60, width: 20, height: 10 }
    ])
  })

  it('skips fully invisible segments and batches rectangles by direction', () => {
    const { view } = createView([
      gap('up', [{ fromIndex: 11, top: 80, bottom: 60 }]),
      gap('up', [{ fromIndex: 1, top: 70, bottom: 50 }]),
      gap('up', [{ fromIndex: 2, top: 60, bottom: 40 }])
    ])

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(drawRect).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawRect).mock.calls[0][1]).toHaveLength(2)
  })

  it('draws nothing when gaps are disabled or no gaps are detected', () => {
    const disabled = createView([
      gap('up', [{ fromIndex: 1, top: 80, bottom: 60 }])
    ], value => value, false)
    const empty = createView([])

    disabled.view.draw({ save: vi.fn(), restore: vi.fn() } as never)
    empty.view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(drawRect).not.toHaveBeenCalled()
  })
})
