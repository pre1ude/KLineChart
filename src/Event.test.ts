import { describe, expect, it, vi } from 'vitest'

import Event from './Event'
import type MainWidget from './widget/MainWidget'
import { type MouseTouchEvent } from './common/SyntheticEvent'
import { WidgetNameConstants } from './widget/types'

describe('Event tooltip cursor resolution', () => {
  it('uses the current main widget tooltip layer instead of TooltipStore state', () => {
    const event = Object.create(Event.prototype) as Event
    const overlayStore = {
      isDragging: () => false,
      getProgressOverlay: () => undefined,
      getHoverInfo: () => undefined
    }
    Reflect.set(event, '_chart', {
      getChartStore: () => ({ getOverlayStore: () => overlayStore })
    })
    const widget = {
      getPane: () => ({ getId: () => 'candle' }),
      isTooltipIconHovered: () => true
    } as unknown as MainWidget
    const resolveMainCursor = Reflect.get(event, '_resolveMainCursor') as (widget: MainWidget) => string

    expect(resolveMainCursor.call(event, widget)).toBe('pointer')
  })
})

function createMouseEvent(pageX: number, pageY: number): MouseTouchEvent {
  return {
    x: 0,
    y: 0,
    pageX,
    pageY,
    nativeEvent: {} as MouseEvent,
    eventPhase: 0,
    propagationStopped: false,
    isImmediate: false,
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn()
  }
}

function createPressedEventFixture() {
  const chartEvent = Object.create(Event.prototype) as Event
  const pane = {
    getId: () => 'candle',
    getYLeftAxisWidget: vi.fn(),
    getYRightAxisWidget: vi.fn()
  }
  const axisWidget = {
    getName: () => WidgetNameConstants.X_AXIS,
    getPane: () => pane,
    dispatchEvent: vi.fn(() => false),
    getAxisComponent: vi.fn()
  }

  Reflect.set(chartEvent, '_mouseDownWidget', axisWidget)
  Reflect.set(chartEvent, '_findWidgetByEvent', vi.fn(() => ({})))
  Reflect.set(chartEvent, '_makeWidgetEvent', vi.fn((event: MouseTouchEvent) => event))
  Reflect.set(chartEvent, '_syncCursor', vi.fn())

  return { chartEvent, pane, axisWidget }
}

describe('Event axis drag', () => {
  it('continues x-axis zoom after the pointer leaves the chart', () => {
    const { chartEvent, axisWidget } = createPressedEventFixture()
    const zoom = vi.fn()
    axisWidget.getAxisComponent.mockReturnValue({ getScrollZoomEnabled: () => true })
    Reflect.set(chartEvent, '_xAxisStartScaleDistance', 100)
    Reflect.set(chartEvent, '_xAxisStartScaleCoordinate', { x: 20, y: 0 })
    Reflect.set(chartEvent, '_xAxisScale', 1)
    Reflect.set(chartEvent, '_chart', {
      getChartStore: () => ({ getTimeScaleStore: () => ({ zoom }) })
    })

    chartEvent.pressedMouseMoveEvent(createMouseEvent(50, 0))

    expect(zoom).toHaveBeenCalledWith(1, 20, true)
  })

  it('continues y-axis zoom after the pointer leaves the chart', () => {
    const { chartEvent, pane, axisWidget } = createPressedEventFixture()
    const currentAxis = {
      getScrollZoomEnabled: () => true,
      convertToRealValue: (value: number) => value,
      setRange: vi.fn()
    }
    const otherAxis = {
      getScrollZoomEnabled: () => true,
      convertToRealValue: (value: number) => value,
      setRange: vi.fn()
    }
    const yAxisWidget = {
      ...axisWidget,
      getName: () => WidgetNameConstants.Y_AXIS,
      getAxisComponent: () => currentAxis
    }
    pane.getYLeftAxisWidget.mockReturnValue({ getAxisComponent: () => currentAxis })
    pane.getYRightAxisWidget.mockReturnValue({ getAxisComponent: () => otherAxis })
    Reflect.set(chartEvent, '_mouseDownWidget', yAxisWidget)
    Reflect.set(chartEvent, '_prevYAxisRange', { from: 0, to: 10 })
    Reflect.set(chartEvent, '_prevOtherYAxisRange', { from: 100, to: 200 })
    Reflect.set(chartEvent, '_yAxisStartScaleDistance', 100)
    Reflect.set(chartEvent, '_chart', { requestViewportLayout: vi.fn() })

    chartEvent.pressedMouseMoveEvent(createMouseEvent(0, 150))

    expect(currentAxis.setRange).toHaveBeenCalled()
    expect(otherAxis.setRange).toHaveBeenCalled()
  })
})

describe('Event axis double click', () => {
  it('resets the time scale when the x-axis is double-clicked', () => {
    const event = Object.create(Event.prototype) as Event
    const resetTimeScale = vi.fn()
    const xAxisWidget = {
      getName: () => WidgetNameConstants.X_AXIS,
      getPane: () => ({ getId: () => 'x_axis' }),
      dispatchEvent: vi.fn()
    }
    Reflect.set(event, '_findWidgetByEvent', vi.fn(() => ({ widget: xAxisWidget })))
    Reflect.set(event, '_makeWidgetEvent', vi.fn((mouseEvent: MouseTouchEvent) => mouseEvent))
    Reflect.set(event, '_syncCursor', vi.fn())
    Reflect.set(event, '_chart', {
      getChartStore: () => ({
        getTimeScaleStore: () => ({ resetTimeScale }),
        getActionStore: () => ({ execute: vi.fn() })
      })
    })

    event.mouseDoubleClickEvent(createMouseEvent(20, 10))

    expect(resetTimeScale).toHaveBeenCalledOnce()
  })
})
