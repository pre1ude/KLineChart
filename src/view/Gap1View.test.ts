import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles, type GapStyle } from '../common/Styles'
import type { Gap1Record } from '../component/Gap1'
import { drawRect } from '../extension/figure/rect'
import Gap1View from './Gap1View'

vi.mock('../extension/figure/rect', () => ({
  drawRect: vi.fn()
}))

function gap1(direction: 'up' | 'down', fromIndex: number, top: number, bottom: number): Gap1Record {
  return {
    id: `gap1:${direction}:${fromIndex}`,
    direction,
    fromIndex,
    openIndex: fromIndex + 1,
    openTimestamp: fromIndex + 1,
    originalTop: top + 10,
    originalBottom: bottom,
    top,
    bottom
  }
}

function createView(
  gaps: Gap1Record[],
  convertY: (value: number) => number = value => value,
  enabled: boolean = true,
  gapStyles: GapStyle = getDefaultStyles().gap,
  showValue: boolean = false,
  pricePrecision: number = 2,
  xAxisTextColor: string = getDefaultStyles().xAxis.tickText.color,
  widgetWidth: number = 100,
  changeColors: { upColor: string, downColor: string } = getDefaultStyles().candle.bar
) {
  const mainYAxis = { convertToPixel: vi.fn(convertY) }
  const leftYAxis = { convertToPixel: vi.fn(convertY) }
  const xAxis = { convertToPixel: vi.fn((index: number) => index * 10) }
  const gap1Store = {
    isEnabled: () => enabled,
    getGaps: () => gaps,
    getOptions: () => ({ maxGapCount: 15, showValue })
  }
  const chart = {
    getChartStore: () => ({
      getGap1Store: () => gap1Store,
      getStyles: () => ({
        gap: gapStyles,
        xAxis: { tickText: { color: xAxisTextColor } },
        candle: { bar: changeColors }
      }),
      getPrecision: () => ({ price: pricePrecision, volume: 0 })
    }),
    getXAxisPane: () => ({
      getMainWidget: () => ({ getAxisComponent: () => xAxis })
    })
  }
  const pane = {
    getChart: () => chart,
    getMainAxisWidget: () => ({ getAxisComponent: () => mainYAxis }),
    getYLeftAxisWidget: () => ({ getAxisComponent: () => leftYAxis })
  }
  const widget = {
    getPane: () => pane,
    getBounding: () => ({ width: widgetWidth, height: 120, left: 0, top: 0 })
  }

  return {
    view: new Gap1View(widget as never),
    mainYAxis,
    leftYAxis,
    xAxis
  }
}

function createContext(): CanvasRenderingContext2D & { textCalls: Array<{ text: string, x: number, y: number, color: string, baseline: CanvasTextBaseline }> } {
  let fillStyle = ''
  const textCalls: Array<{ text: string, x: number, y: number, color: string, baseline: CanvasTextBaseline }> = []
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
    fillText: vi.fn((text: string, x: number, y: number) => {
      textCalls.push({ text, x, y, color: fillStyle, baseline: ctx.textBaseline })
    }),
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    font: '',
    textCalls
  }
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => fillStyle,
    set: value => { fillStyle = value }
  })
  return ctx as unknown as CanvasRenderingContext2D & { textCalls: typeof textCalls }
}

describe('Gap1View', () => {
  beforeEach(() => {
    vi.mocked(drawRect).mockClear()
  })

  it('draws one current-state rectangle per gap from formation to the widget right edge', () => {
    const { view } = createView([
      gap1('up', 1, 70, 60),
      gap1('down', 2, 50, 30)
    ])

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(drawRect).toHaveBeenCalledTimes(2)
    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 10, y: 60, width: 90, height: 10 }
    ])
    expect(vi.mocked(drawRect).mock.calls[1][1]).toEqual([
      { x: 20, y: 30, width: 80, height: 20 }
    ])
  })

  it('clips rectangles and batches visible records by direction', () => {
    const { view } = createView([
      gap1('up', -2, 130, 90),
      gap1('up', 2, 80, 60),
      gap1('up', 11, 70, 50)
    ])

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(drawRect).toHaveBeenCalledTimes(1)
    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 0, y: 90, width: 100, height: 30 },
      { x: 20, y: 60, width: 80, height: 20 }
    ])
  })

  it('uses the configured main price axis', () => {
    const { view, mainYAxis, leftYAxis } = createView([
      gap1('up', 1, 70, 60)
    ])

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(mainYAxis.convertToPixel).toHaveBeenCalledWith(70)
    expect(mainYAxis.convertToPixel).toHaveBeenCalledWith(60)
    expect(leftYAxis.convertToPixel).not.toHaveBeenCalled()
  })

  it('uses the shared gap appearance', () => {
    const styles: GapStyle = {
      up: { backgroundColor: '#ff000026', borderColor: '#ff0000', borderSize: 2 },
      down: { backgroundColor: '#00ff0026', borderColor: '#00ff00' }
    }
    const { view } = createView([gap1('up', 1, 70, 60)], value => value, true, styles)

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(vi.mocked(drawRect).mock.calls[0][2]).toMatchObject({
      color: '#ff000026',
      borderColor: '#ff0000',
      borderSize: 2
    })
  })

  it('snaps the formation boundary to the candle wick pixel column', () => {
    const { view, xAxis } = createView([gap1('up', 1, 70, 60)])
    xAxis.convertToPixel.mockImplementation((index: number) => index * 10 + 0.4)

    view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(vi.mocked(drawRect).mock.calls[0][1]).toEqual([
      { x: 10, y: 60, width: 90, height: 10 }
    ])
  })

  it('draws nothing when disabled or empty', () => {
    const disabled = createView([gap1('up', 1, 70, 60)], value => value, false)
    const empty = createView([])

    disabled.view.draw({ save: vi.fn(), restore: vi.fn() } as never)
    empty.view.draw({ save: vi.fn(), restore: vi.fn() } as never)

    expect(drawRect).not.toHaveBeenCalled()
  })

  it('draws precision-aware value labels with candle direction colors for the change text', () => {
    const styles: GapStyle = {
      up: { backgroundColor: '#0000ff26', borderColor: '#0000ff', borderSize: 1 },
      down: { backgroundColor: '#ffff0026', borderColor: '#ffff00', borderSize: 1 }
    }
    const changeColors = { upColor: '#ff0000', downColor: '#00ff00' }
    const { view } = createView([
      gap1('up', 1, 106.005, 105.955),
      gap1('down', 2, 109.45, 109.41)
    ], value => value, true, styles, true, 3, '#123456', 220, changeColors)
    const ctx = createContext()

    view.draw(ctx)

    expect(ctx.textCalls.map(({ y, ...call }) => call)).toEqual([
      { text: '105.955-106.005', x: 14, color: '#123456', baseline: 'top' },
      { text: '+0.047%(+0.050)', x: 110, color: '#ff0000', baseline: 'top' },
      { text: '109.450-109.410', x: 24, color: '#123456', baseline: 'bottom' },
      { text: '-0.037%(-0.040)', x: 120, color: '#00ff00', baseline: 'bottom' }
    ])
    expect(ctx.textCalls[0].y).toBeCloseTo(110.005)
    expect(ctx.textCalls[1].y).toBeCloseTo(110.005)
    expect(ctx.textCalls[2].y).toBeCloseTo(105.41)
    expect(ctx.textCalls[3].y).toBeCloseTo(105.41)
  })

  it('shifts a value label left when its full width would exceed the widget right edge', () => {
    const styles: GapStyle = {
      up: { backgroundColor: '#ff000026', borderColor: '#ff0000', borderSize: 1 },
      down: { backgroundColor: '#00ff0026', borderColor: '#00ff00', borderSize: 1 }
    }
    const { view } = createView([
      gap1('up', 8, 106.005, 105.955)
    ], value => value, true, styles, true, 3, '#123456', 220)
    const ctx = createContext()

    view.draw(ctx)

    expect(ctx.textCalls.map(({ y, ...call }) => call)).toEqual([
      { text: '105.955-106.005', x: 34, color: '#123456', baseline: 'top' },
      { text: '+0.047%(+0.050)', x: 130, color: getDefaultStyles().candle.bar.upColor, baseline: 'top' }
    ])
  })

  it('does not draw value text when showValue is false', () => {
    const { view } = createView([gap1('up', 1, 70, 60)])
    const ctx = createContext()

    view.draw(ctx)

    expect(ctx.textCalls).toEqual([])
  })

  it('keeps value colors when the fill-only border size is zero', () => {
    const styles: GapStyle = {
      up: { borderColor: '#ff0000', backgroundColor: '#ff000026', borderSize: 0 },
      down: { borderColor: '#00ff00', backgroundColor: '#00ff0026', borderSize: 0 }
    }
    const { view } = createView([gap1('up', 1, 70, 60)], value => value, true, styles, true)
    const ctx = createContext()

    view.draw(ctx)

    expect(vi.mocked(drawRect).mock.calls[0][2]).toMatchObject({ borderSize: 0 })
    expect(ctx.textCalls[1].color).toBe(getDefaultStyles().candle.bar.upColor)
  })
})
