import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultStyles } from '../common/Styles'
import type Coordinate from '../common/Coordinate'
import { Overlay } from '../component/Overlay'
import { createFigure, drawStaticFigure } from '../extension/figure'
import rect from '../extension/overlay/advanced/rect'
import simpleTag from '../extension/overlay/simpleTag'
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

describe('Overlay Y-axis label projection', () => {
  it('lets simpleTag project its fallback value through the visual axis', () => {
    const figure = simpleTag.createYAxisFigures?.({
      overlay: new Overlay(simpleTag, {
        id: 'tag',
        groupId: 'tag',
        paneId: 'candle',
        points: [{ dataIndex: 0, value: 110 }]
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
