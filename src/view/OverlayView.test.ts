import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import type Coordinate from '../common/Coordinate'
import { Overlay } from '../component/Overlay'
import { createFigure, drawStaticFigure } from '../extension/figure'
import rect from '../extension/overlay/advanced/rect'
import OverlayView from './OverlayView'

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
      { dataIndex: 10, value: 100 },
      { dataIndex: 20, value: 200 }
    ],
    controlPointVisibility: 'always'
  })
}

interface OverlayViewDrawSpy {
  _drawOverlay: (...args: unknown[]) => void
}

function createDrawView(overlays: Overlay[], hoveredOverlay?: Overlay, selectedOverlay?: Overlay): TestOverlayView {
  const overlayStore = {
    getHoverInfo: () => hoveredOverlay == null ? undefined : { overlay: hoveredOverlay },
    getSelectedInfo: () => selectedOverlay == null ? undefined : { overlay: selectedOverlay },
    getInstances: () => overlays,
    getProgressOverlay: () => undefined
  }
  const chartStore = {
    getCustomApi: () => ({}),
    getThousandsSeparator: () => ',',
    getDecimalFoldThreshold: () => 0,
    getTimeScaleStore: () => ({ getBarSpace: () => ({}) }),
    getPrecision: () => ({ price: 2, volume: 0 }),
    getStyles: () => getDefaultStyles(),
    getOverlayStore: () => overlayStore,
    getTooltipStore: () => ({ getCrosshair: () => ({}) }),
    getIndicatorStore: () => ({ getInstances: () => [] })
  }
  const chart = {
    getChartStore: () => chartStore,
    getXAxisPane: () => ({
      getMainWidget: () => ({ getAxisComponent: () => ({}) })
    })
  }
  const pane = {
    getId: () => 'candle',
    getChart: () => chart,
    getYLeftAxisWidget: () => ({ getAxisComponent: () => ({}) })
  }
  const widget = {
    getPane: () => pane,
    getName: () => 'main',
    getBounding: () => ({})
  }
  return new TestOverlayView(widget as never)
}

function getDrawCalls(view: TestOverlayView): Array<{ id: string, bindEvent: boolean }> {
  const drawOverlay = vi.spyOn(
    view as unknown as OverlayViewDrawSpy,
    '_drawOverlay'
  ).mockImplementation(() => {})

  view.drawImp({} as CanvasRenderingContext2D)

  return drawOverlay.mock.calls.map(call => ({
    id: (call[1] as Overlay).id,
    bindEvent: call[14] as boolean
  }))
}

beforeEach(() => {
  vi.mocked(createFigure).mockClear()
  vi.mocked(drawStaticFigure).mockClear()
  Object.values(figureMock).forEach(mock => mock.mockClear())
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

describe('OverlayView selected overlay ordering', () => {
  function createOverlays(): Overlay[] {
    return ['first', 'hovered', 'last'].map(id => new Overlay(rect, {
      id,
      groupId: id,
      paneId: 'candle',
      points: [
        { dataIndex: 10, value: 100 },
        { dataIndex: 20, value: 200 }
      ]
    }))
  }

  it('draws a different hovered overlay visual-only before the selected overlay', () => {
    const overlays = createOverlays()

    const calls = getDrawCalls(createDrawView(overlays, overlays[1], overlays[0]))

    expect(calls).toEqual([
      { id: 'hovered', bindEvent: true },
      { id: 'last', bindEvent: true },
      { id: 'hovered', bindEvent: false },
      { id: 'first', bindEvent: true }
    ])
  })

  it('draws and binds an overlay once when it is both hovered and selected', () => {
    const overlays = createOverlays()

    const calls = getDrawCalls(createDrawView(overlays, overlays[0], overlays[0]))

    expect(calls).toEqual([
      { id: 'hovered', bindEvent: true },
      { id: 'last', bindEvent: true },
      { id: 'first', bindEvent: true }
    ])
  })

  it('restores persisted ordering after selection is cleared', () => {
    const overlays = createOverlays()

    const calls = getDrawCalls(createDrawView(overlays))

    expect(calls).toEqual([
      { id: 'first', bindEvent: true },
      { id: 'hovered', bindEvent: true },
      { id: 'last', bindEvent: true }
    ])
  })
})
