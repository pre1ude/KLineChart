import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import { EventPhase } from '../../common/SyntheticEvent'
import { Overlay } from '../../component/Overlay'
import horizontalStraightLine from '../../extension/overlay/horizontalStraightLine'
import segment from '../../extension/overlay/segment'
import { OverlayLayer } from './OverlayLayer'

const overlayViewMock = vi.hoisted(() => ({
  handlers: new Map<string, (event: MouseTouchEvent) => void>()
}))

vi.mock('../../view/OverlayView', () => ({
  default: class OverlayViewMock {
    addEventListener(name: string, callback: (event: MouseTouchEvent) => void): this {
      overlayViewMock.handlers.set(name, callback)
      return this
    }

    coordinateToPoint(_overlay: unknown, event: MouseTouchEvent): { dataIndex: number, value: number } {
      return { dataIndex: event.x, value: event.y }
    }

    draw = vi.fn()
  }
}))

describe('OverlayLayer progress drawing interaction', () => {
  beforeEach(() => {
    overlayViewMock.handlers.clear()
  })

  it('previews the next point while the first point is held and moved', () => {
    const onDrawStart = vi.fn()
    const onDrawing = vi.fn()
    const overlay = new Overlay({ ...segment, onDrawStart, onDrawing }, {
      id: 'overlay_segment',
      groupId: 'overlay_segment',
      paneId: 'candle'
    })
    const fixture = createFixture(overlay)

    fixture.handler('mouseDownEvent')?.(createEvent(10, 10))
    fixture.handler('pressedMouseMoveEvent')?.(createEvent(20, 20))

    expect(overlay.points).toEqual([
      { dataIndex: 10, value: 10 },
      { dataIndex: 20, value: 20 }
    ])
    expect(overlay.currentStep).toBe(1)
    expect(overlay.isDrawing()).toBe(true)
    expect(onDrawStart).toHaveBeenCalledTimes(1)
    expect(onDrawing).toHaveBeenCalledTimes(1)

    fixture.handler('mouseUpEvent')?.(createEvent(20, 20))

    expect(overlay.points).toEqual([
      { dataIndex: 10, value: 10 },
      { dataIndex: 20, value: 20 }
    ])
  })

  it('keeps the click-based commit flow when the pointer does not move', () => {
    const overlay = new Overlay(segment, {
      id: 'overlay_segment',
      groupId: 'overlay_segment',
      paneId: 'candle'
    })
    const fixture = createFixture(overlay)
    const event = createEvent(10, 10)

    fixture.handler('mouseDownEvent')?.(event)
    fixture.handler('mouseUpEvent')?.(event)
    fixture.handler('mouseClickEvent')?.(event)

    expect(overlay.points).toEqual([{ dataIndex: 10, value: 10 }])
    expect(overlay.currentStep).toBe(1)
    expect(overlay.isDrawing()).toBe(true)
  })

  it('does not append a preview point after completing a single-point overlay', () => {
    const onDrawEnd = vi.fn()
    const overlay = new Overlay({ ...horizontalStraightLine, onDrawEnd }, {
      id: 'overlay_horizontal_line',
      groupId: 'overlay_horizontal_line',
      paneId: 'candle'
    })
    const fixture = createFixture(overlay)

    fixture.handler('mouseDownEvent')?.(createEvent(10, 10))
    fixture.handler('pressedMouseMoveEvent')?.(createEvent(20, 20))

    expect(overlay.points).toEqual([{ dataIndex: 10, value: 10 }])
    expect(overlay.currentStep).toBe(1)
    expect(overlay.isCompleted()).toBe(true)
    expect(fixture.progressOverlayComplete).toHaveBeenCalledTimes(1)
    expect(onDrawEnd).toHaveBeenCalledTimes(1)
  })
})

function createFixture(overlay: Overlay): {
  handler: (name: string) => ((event: MouseTouchEvent) => void) | undefined
  progressOverlayComplete: ReturnType<typeof vi.fn>
} {
  const updatePane = vi.fn()
  let progressOverlay: Overlay | undefined = overlay
  const progressOverlayComplete = vi.fn(() => {
    progressOverlay = undefined
  })
  const overlayStore = {
    getProgressOverlay: () => progressOverlay,
    getProgressOverlayPaneId: () => 'candle',
    updateProgressOverlayPane: vi.fn(),
    progressOverlayComplete,
    setPressed: vi.fn(),
    setDragging: vi.fn(),
    getSelectedInfo: vi.fn(),
    setSelectedInfo: vi.fn(),
    clearHoverInfo: vi.fn()
  }
  const chartStore = {
    getOverlayStore: () => overlayStore,
    internalToExternal: (point: { dataIndex?: number, value?: number }) => point
  }
  const chart = {
    getChartStore: () => chartStore,
    updatePane
  }
  const pane = {
    getId: () => 'candle',
    getChart: () => chart
  }
  const widget = {
    getPane: () => pane,
    addChild: vi.fn()
  }

  new OverlayLayer(widget as never)

  return {
    handler: name => overlayViewMock.handlers.get(name),
    progressOverlayComplete
  }
}

function createEvent(x: number, y: number): MouseTouchEvent {
  return {
    x,
    y,
    pageX: x,
    pageY: y,
    nativeEvent: {} as MouseEvent,
    eventPhase: EventPhase.AT_TARGET,
    propagationStopped: false,
    isImmediate: false,
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn()
  }
}
