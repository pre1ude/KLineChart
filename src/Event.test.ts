import { describe, expect, it, vi } from 'vitest'

import Event from './Event'
import type MainWidget from './widget/MainWidget'
import { type MouseTouchEvent } from './common/SyntheticEvent'
import { WidgetNameConstants } from './widget/types'

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
  const pane = { getId: () => 'candle' }
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

describe('Event axis interaction', () => {
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

  it('mutates the targeted shared Y scale once during axis drag', () => {
    const { chartEvent, pane, axisWidget } = createPressedEventFixture()
    const setRange = vi.fn()
    const sharedScale = {
      getScrollZoomEnabled: () => true,
      convertToRealValue: (value: number) => value,
      setRange
    }
    const leftAxisWidget = {
      ...axisWidget,
      getName: () => WidgetNameConstants.Y_AXIS,
      getPane: () => pane,
      getScaleComponent: () => sharedScale
    }
    const rightAxisWidget = {
      ...leftAxisWidget,
      getScaleComponent: () => sharedScale
    }
    Reflect.set(pane, 'getVisibleYAxisWidgets', () => [leftAxisWidget, rightAxisWidget])
    Reflect.set(chartEvent, '_mouseDownWidget', leftAxisWidget)
    Reflect.set(chartEvent, '_prevYAxisRange', { from: 0, to: 10 })
    Reflect.set(chartEvent, '_yAxisStartScaleDistance', 100)
    Reflect.set(chartEvent, '_chart', { requestViewportLayout: vi.fn() })

    chartEvent.pressedMouseMoveEvent(createMouseEvent(0, 150))

    expect(setRange).toHaveBeenCalledOnce()
  })

  it('resets only the scale referenced by the targeted visual axis', () => {
    const event = Object.create(Event.prototype) as Event
    const sharedReset = vi.fn()
    const independentReset = vi.fn()
    const pane = { getId: () => 'candle' }
    const leftWidget = {
      getName: () => WidgetNameConstants.Y_AXIS,
      getPane: () => pane,
      getScaleComponent: () => ({ setAutoCalcTickFlag: sharedReset })
    }
    const independentWidget = {
      ...leftWidget,
      getScaleComponent: () => ({ setAutoCalcTickFlag: independentReset })
    }
    Reflect.set(pane, 'getVisibleYAxisWidgets', () => [leftWidget, independentWidget])
    Reflect.set(event, '_findWidgetByEvent', vi.fn(() => ({ widget: leftWidget })))
    Reflect.set(event, '_syncCursor', vi.fn())
    Reflect.set(event, '_chart', { requestViewportLayout: vi.fn() })

    event.mouseDoubleClickEvent(createMouseEvent(20, 10))

    expect(sharedReset).toHaveBeenCalledWith(true)
    expect(independentReset).not.toHaveBeenCalled()
  })

  it('wheel-zooms the targeted scale once', () => {
    const event = Object.create(Event.prototype) as Event
    const setRange = vi.fn()
    const scale = {
      getScrollZoomEnabled: () => true,
      getRange: () => ({ from: 0, to: 10 }),
      convertToRealValue: (value: number) => value,
      setRange
    }
    const widget = {
      getName: () => WidgetNameConstants.Y_AXIS,
      getPane: () => ({ getId: () => 'candle' }),
      getScaleComponent: () => scale
    }
    Reflect.set(event, '_findWidgetByEvent', vi.fn(() => ({ widget })))
    Reflect.set(event, '_makeWidgetEvent', vi.fn((mouseEvent: MouseTouchEvent) => mouseEvent))
    Reflect.set(event, '_chart', { requestViewportLayout: vi.fn() })

    expect(event.mouseWheelVertEvent(createMouseEvent(20, 10), 1)).toBe(true)
    expect(setRange).toHaveBeenCalledOnce()
    expect(setRange).toHaveBeenCalledWith({ from: -0.5, to: 10.5, domainFrom: -0.5, domainTo: 10.5 })
  })

  it('pans every pane scale once and respects each scale reverse mode', () => {
    const event = Object.create(Event.prototype) as Event
    const normalOffset = vi.fn()
    const reverseOffset = vi.fn()
    const pane = {
      getId: () => 'candle',
      getYScales: () => [
        { getComponent: () => ({ isReverse: () => false, offsetByPixel: normalOffset }) },
        { getComponent: () => ({ isReverse: () => true, offsetByPixel: reverseOffset }) }
      ]
    }
    const widget = {
      getName: () => WidgetNameConstants.MAIN,
      getPane: () => pane,
      getBounding: () => ({ height: 100 }),
      dispatchEvent: () => false
    }
    Reflect.set(event, '_mouseDownWidget', widget)
    Reflect.set(event, '_startScrollCoordinate', { x: 0, y: 10 })
    Reflect.set(event, '_findWidgetByEvent', vi.fn(() => ({ pane, widget })))
    Reflect.set(event, '_makeWidgetEvent', vi.fn(() => ({ x: 5, y: 30 })))
    Reflect.set(event, '_syncCursor', vi.fn())
    Reflect.set(event, '_chart', {
      getChartStore: () => ({
        getTimeScaleStore: () => ({ scroll: vi.fn() }),
        getTooltipStore: () => ({ setCrosshair: vi.fn() })
      })
    })

    event.pressedMouseMoveEvent(createMouseEvent(5, 30))

    expect(normalOffset).toHaveBeenCalledOnce()
    expect(normalOffset).toHaveBeenCalledWith(20, 100)
    expect(reverseOffset).toHaveBeenCalledOnce()
    expect(reverseOffset).toHaveBeenCalledWith(-20, 100)
  })
})
