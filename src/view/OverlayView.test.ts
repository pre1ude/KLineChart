import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import type Coordinate from '../common/Coordinate'
import type Chart from '../Chart'
import { Overlay } from '../component/Overlay'
import { createFigure, drawStaticFigure } from '../extension/figure'
import rect from '../extension/overlay/advanced/rect'
import simpleTag from '../extension/overlay/simpleTag'
import OverlayView from './OverlayView'
import ChartStore from '../store/ChartStore'
import { LoadDataType } from '../common/LoadDataCallback'
import { TimeScaleModeKind } from '../store/time-scale'

const figureMock = vi.hoisted(() => {
  const instance = {
    setAttrs: vi.fn(),
    setStyles: vi.fn(),
    setData: vi.fn(),
    setIgnoreEvent: vi.fn(),
    draw: vi.fn()
  }
  instance.setAttrs.mockReturnValue(instance)
  instance.setStyles.mockReturnValue(instance)
  instance.setData.mockReturnValue(instance)
  instance.setIgnoreEvent.mockReturnValue(instance)
  return instance
})

vi.mock('../extension/figure', () => ({
  createFigure: vi.fn(() => figureMock),
  drawStaticFigure: vi.fn()
}))

class TestOverlayView extends OverlayView {
  drawControlPoints(overlay: Overlay, coordinates: Coordinate[], bindEvent: boolean): void {
    this.drawDefaultFigures(
      {} as CanvasRenderingContext2D,
      overlay,
      coordinates,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      '',
      0,
      getDefaultStyles().overlay,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      bindEvent
    )
  }

  getEventChildCount(): number {
    return this.getChildren().length
  }
}

function createView(): TestOverlayView {
  const chartStore = {
    getStyleTheme: () => 'light'
  }
  const widget = {
    getPane: () => ({
      getChart: () => ({ getChartStore: () => chartStore })
    })
  }
  return new TestOverlayView(widget as never)
}

function createRectOverlay(): Overlay {
  return new Overlay(rect, {
    id: 'overlay_rect',
    groupId: 'overlay_rect',
    paneId: 'candle',
    points: [
      { timestamp: 10, value: 100 },
      { timestamp: 20, value: 200 }
    ],
    controlPointVisibility: 'always'
  })
}

beforeEach(() => {
  vi.mocked(createFigure).mockClear()
  vi.mocked(drawStaticFigure).mockClear()
  Object.values(figureMock).forEach(mock => mock.mockClear())
})

describe('OverlayView logical pointer picking', () => {
  it.each([TimeScaleModeKind.KLine, TimeScaleModeKind.DataZoom, TimeScaleModeKind.TimeShare])('agrees with data and crosshair picking at bar boundaries in %s mode', mode => {
    const store = new ChartStore({ refreshViewportLayout: vi.fn(), updatePane: vi.fn(), onCrosshairChange: vi.fn() } as unknown as Chart)
    store.mainWidth = 160
    const bars = (count: number, start: number) => Array.from({ length: count }, (_, i) => ({ timestamp: start + i * 100, open: 10, high: 20, low: 5, close: 15 }))
    store.applyDataSnapshot(bars(10, 1000))
    store.addData(bars(8, 200), LoadDataType.Backward)
    const scale = store.getTimeScaleStore()
    if (mode === TimeScaleModeKind.TimeShare) store.setOptions({ isTimeShare: true, timeShareTicks: ['09:30', '09:31', '09:32', '09:33'], timeShareDays: 5 })
    else scale.setMode(mode)
    scale.adjustVisibleRange()
    const pane = {
      getId: () => 'candle_pane',
      getChart: () => ({ getChartStore: () => store }),
      getDefaultYScale: () => ({ getComponent: () => ({ convertFromPixel: (y: number) => y }) })
    }
    const view = new OverlayView({ getPane: () => pane } as never)
    const overlay = createRectOverlay()
    for (const spacing of [8, 3.3, 8.8]) {
      scale.setBarSpace(spacing)
      scale.alignLeft()
      for (const left of [-7, -1, 0, 1, 7]) {
        for (const delta of [-1e-7, 0, 1e-7]) {
          const x = scale.logicalToCoordinate(left + 0.5 + delta)
          const expectedLogical = delta < 0 ? left : left + 1
          const expectedIndex = store.getTimeIndex().logicalToDataIndex(expectedLogical)
          const picked = view.coordinateToPoint(overlay, { x, y: 12 })!
          expect(picked.logicalIndex, `spacing=${spacing}, left=${left}, delta=${delta}`).toBe(expectedLogical)
          expect(scale.coordinateToDataIndex(x)).toBe(expectedIndex)
          store.getTooltipStore().setCrosshair({ x, y: 12 })
          expect(store.getTooltipStore().getCrosshair().kLineData?.timestamp).toBe(store.getDataList()[expectedIndex].timestamp)
        }
      }
    }
  })

  it.each(['normal', 'strong_magnet'] as const)('returns complete internal points without a timestamp round trip in %s mode', mode => {
    const store = new ChartStore({ refreshViewportLayout: vi.fn(), updatePane: vi.fn() } as unknown as Chart)
    store.mainWidth = 160
    store.applyDataSnapshot([100, 200].map(timestamp => ({ timestamp, open: 10, high: 20, low: 5, close: 15 })))
    const overlay = createRectOverlay()
    overlay.mode = mode
    const pane = {
      getId: () => 'candle_pane',
      getChart: () => ({ getChartStore: () => store }),
      getDefaultYScale: () => ({ getComponent: () => ({ convertFromPixel: (y: number) => y }) })
    }
    const view = new OverlayView({ getPane: () => pane } as never)
    const convert = vi.spyOn(store, 'internalToExternal')
    const coordinate = { x: store.getTimeScaleStore().logicalToCoordinate(1), y: 22 }
    expect(view.coordinateToPoint(overlay, coordinate)).toEqual({ logicalIndex: 1, value: mode === 'normal' ? 22 : 20 })
    expect(convert).not.toHaveBeenCalled()
    expect(view.coordinateToPoint(overlay, { x: Infinity, y: 22 })).toBeUndefined()
    store.clear()
    expect(view.coordinateToPoint(overlay, coordinate)).toBeUndefined()
  })
})

describe('OverlayView control-point event binding', () => {
  const coordinates = [
    { x: 10, y: 20 },
    { x: 30, y: 40 }
  ]

  it('renders visual controls without hit figures on a visual-only redraw', () => {
    const view = createView()

    view.drawControlPoints(createRectOverlay(), coordinates, false)

    expect(drawStaticFigure).toHaveBeenCalledTimes(8)
    expect(createFigure).not.toHaveBeenCalled()
    expect(view.getEventChildCount()).toBe(0)
  })

  it('registers one hit figure per control point on the normal draw', () => {
    const view = createView()

    view.drawControlPoints(createRectOverlay(), coordinates, true)

    expect(drawStaticFigure).toHaveBeenCalledTimes(8)
    expect(createFigure).toHaveBeenCalledTimes(4)
    expect(view.getEventChildCount()).toBe(4)
  })
})

describe('Overlay Y-axis label projection', () => {
  it('lets simpleTag project its fallback value through the visual axis', () => {
    const figure = simpleTag.createYAxisFigures?.({
      overlay: new Overlay(simpleTag, {
        id: 'tag',
        groupId: 'tag',
        paneId: 'candle',
        points: [{ timestamp: 0, value: 110 }]
      }),
      coordinates: [{ x: 0, y: 20 }],
      bounding: { width: 100, height: 100, left: 0, top: 0 },
      barSpace: {} as never,
      precision: { price: 2, volume: 0, max: 2, min: 0, excludePriceVolumeMax: 2, excludePriceVolumeMin: 0 },
      thousandsSeparator: ',',
      decimalFoldThreshold: 0,
      dateTimeFormat: {} as never,
      defaultStyles: getDefaultStyles().overlay,
      isAlignLeft: false,
      formatLabel: (_value, fallback) => `${fallback}%`
    })

    expect((figure as { attrs: { text: string } }).attrs.text).toBe('110.00%')
  })
})
