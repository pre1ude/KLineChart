import { beforeEach, describe, expect, it, vi } from 'vitest'

import type Chart from '../../Chart'
import type { IPoint, Point } from '../../common/Point'
import { LoadDataType } from '../../common/LoadDataCallback'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import { EventPhase } from '../../common/SyntheticEvent'
import { Overlay } from '../../component/Overlay'
import horizontalStraightLine from '../../extension/overlay/horizontalStraightLine'
import segment from '../../extension/overlay/segment'
import ChartStore from '../../store/ChartStore'
import { OverlayLayer } from './OverlayLayer'

const overlayViewMock = vi.hoisted(() => ({
  handlers: new Map<string, (event: MouseTouchEvent) => void>(),
  convert: undefined as ((event: MouseTouchEvent) => IPoint | undefined) | undefined
}))

vi.mock('../../view/OverlayView', () => ({
  default: class OverlayViewMock {
    private readonly _convert = overlayViewMock.convert
    addEventListener(name: string, callback: (event: MouseTouchEvent) => void): this {
      overlayViewMock.handlers.set(name, callback)
      return this
    }

    coordinateToPoint(_overlay: unknown, event: MouseTouchEvent): IPoint | undefined {
      if (this._convert) return this._convert(event)
      return { logicalIndex: event.x, value: event.y }
    }

    draw = vi.fn()
  }
}))

beforeEach(() => {
  overlayViewMock.handlers.clear()
  overlayViewMock.convert = undefined
})

describe('point notification commit boundary', () => {
  it.each(['click', 'drag'] as const)('finishes %s state before an observer removes the drawing', input => {
    const f = createStoredFixture([], [100, 200], 'horizontalStraightLine')
    const overlay = f.overlay
    const late = vi.fn()
    const states: Array<{ complete: boolean, selected?: string }> = []
    overlay.onDrawStart = late
    overlay.onDrawing = late
    overlay.onDrawEnd = late
    overlay.onPointsChange = () => {
      states.push({ complete: overlay.isCompleted(), selected: f.store.getOverlayStore().getSelectedInfo()?.overlay.id })
      f.store.getOverlayStore().removeInstance({ id: overlay.id })
    }
    if (input === 'click') overlayViewMock.handlers.get('mouseClickEvent')!(createEvent(0, 10))
    else {
      overlayViewMock.handlers.get('mouseDownEvent')!(createEvent(0, 10))
      overlayViewMock.handlers.get('pressedMouseMoveEvent')!(createEvent(1, 15))
    }
    expect(states).toEqual([{ complete: true, selected: overlay.id }])
    expect(f.store.getOverlayStore().getInstanceById(overlay.id)).toBeUndefined()
    expect(f.store.getOverlayStore().getSelectedInfo()).toBeUndefined()
    expect(f.store.getOverlayStore().isPressed()).toBe(false)
    expect(f.store.getOverlayStore().isDragging()).toBe(false)
    expect(late).not.toHaveBeenCalled()
    f.store.destroy()
  })

  it('does not continue notifications for an instance replaced under the same ID', () => {
    const f = createStoredFixture([], [100, 200], 'horizontalStraightLine')
    const overlay = f.overlay
    const late = vi.fn()
    overlay.onDrawEnd = late
    overlay.onPointsChange = () => {
      f.store.getOverlayStore().removeInstance({ id: overlay.id })
      f.store.getOverlayStore().addInstances([{ id: overlay.id, name: 'horizontalStraightLine', points: [{ timestamp: 200, value: 20 }] }])
    }
    overlayViewMock.handlers.get('mouseClickEvent')!(createEvent(0, 10))
    expect(f.store.getOverlayStore().getInstanceById(overlay.id)?.points).toEqual([{ timestamp: 200, value: 20 }])
    expect(f.store.getOverlayStore().getSelectedInfo()).toBeUndefined()
    expect(late).not.toHaveBeenCalled()
    f.store.destroy()
  })

  it('preserves synchronous drag cancellation', () => {
    const points = [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }]
    const f = createStoredFixture(points, [100, 200, 300])
    const before = f.overlay.points.map(point => ({ ...point }))
    f.overlay.onPressedMoving = event => { event.defaultPrevented = true }
    f.startDrag(0, 10)
    f.move(1, 15)
    expect(f.overlay.points).toEqual(before)
    f.release()
    f.store.destroy()
  })
})

describe('OverlayLayer progress drawing interaction', () => {
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
      { timestamp: 10, value: 10 },
      { timestamp: 20, value: 20 }
    ])
    expect(overlay.currentStep).toBe(1)
    expect(overlay.isDrawing()).toBe(true)
    expect(onDrawStart).toHaveBeenCalledTimes(1)
    expect(onDrawing).toHaveBeenCalledTimes(1)

    fixture.handler('mouseUpEvent')?.(createEvent(20, 20))

    expect(overlay.points).toEqual([
      { timestamp: 10, value: 10 },
      { timestamp: 20, value: 20 }
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

    expect(overlay.points).toEqual([{ timestamp: 10, value: 10 }])
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

    expect(overlay.points).toEqual([{ timestamp: 10, value: 10 }])
    expect(overlay.currentStep).toBe(1)
    expect(overlay.isCompleted()).toBe(true)
    expect(fixture.progressOverlayComplete).toHaveBeenCalledTimes(1)
    expect(onDrawEnd).toHaveBeenCalledTimes(1)
  })
})

describe('OverlayLayer time-point editing', () => {
  const anchors = [{ timestamp: 100, offset: -1, value: 10 }, { timestamp: 200, offset: 2, value: 20 }]

  it('does not start a drag with unresolved drawing anchors', () => {
    const { store, overlay, startDrag, move } = createStoredFixture([{ timestamp: 100, value: 10 }, { timestamp: 300, value: 20 }], [100, 200])
    const onStart = vi.fn()
    overlay.onPressedMoveStart = onStart
    startDrag(0, 10)
    expect(store.getOverlayStore().isPressed()).toBe(false)
    move(1, 15)
    expect(onStart).not.toHaveBeenCalled()
    expect(overlay.points).toEqual([{ timestamp: 100, value: 10 }, { timestamp: 300, value: 20 }])
  })

  it('uses logical pointer coordinates directly while retaining time-point callbacks', () => {
    const { store, overlay, startDrag, move } = createStoredFixture([{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }], [100, 200, 300, 400])
    const lookup = vi.spyOn(store, 'externalToInternal')
    const commit = vi.spyOn(overlay, 'onDragMoveBody')
    startDrag(1, 10)
    lookup.mockClear()
    move(2, 15)
    expect(lookup).not.toHaveBeenCalled()
    expect(commit.mock.calls[0][0].point).toEqual({ timestamp: 300, offset: 0, value: 15 })
    expect(overlay.points).toEqual([{ timestamp: 200, offset: 0, value: 15 }, { timestamp: 300, offset: 0, value: 25 }])
  })

  it('retries a failed timeline reprojection without partially replacing the drag snapshot', () => {
    const points = [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }]
    const { store, overlay, startDrag, move } = createStoredFixture(points, [100, 200, 300])
    startDrag(1, 10)
    store.replaceData(data([300, 400]))
    move(0, 15)
    expect(overlay.points).toEqual(points)
    store.replaceData(data([50, 100, 200, 300]))
    move(3, 20)
    expect(overlay.points).toEqual([{ timestamp: 200, offset: 0, value: 20 }, { timestamp: 300, offset: 0, value: 30 }])
  })

  it('keeps both time expressions during a pure vertical body drag', () => {
    const { overlay, startDrag, move } = createStoredFixture(anchors, [100, 200, 300, 400])
    startDrag(1, 10)
    move(1, 15)
    expect(overlay.points).toEqual(anchors.map(point => ({ ...point, value: point.value + 5 })))
  })

  it('keeps logical press-time anchors when history is loaded during a drag', () => {
    const { store, overlay, startDrag, move } = createStoredFixture(anchors, [100, 200, 300, 400])
    const project = vi.spyOn(store.getOverlayStore(), 'getProjectedPoints')
    startDrag(1, 10)
    project.mockClear()
    store.addData(data([50]), LoadDataType.Backward)
    move(2, 15)
    expect(overlay.points).toEqual(anchors.map(point => ({ ...point, value: point.value + 5 })))
    move(3, 20)
    expect(overlay.points).toEqual([{ timestamp: 100, offset: 0, value: 20 }, { timestamp: 400, offset: 1, value: 30 }])
    expect(project).not.toHaveBeenCalled()
  })

  it('retains logical drag anchors through an extending snapshot and price refresh', () => {
    const { store, overlay, startDrag, move } = createStoredFixture(anchors, [100, 200, 300, 400])
    const project = vi.spyOn(store.getOverlayStore(), 'getProjectedPoints')
    startDrag(1, 10)
    project.mockClear()
    store.replaceData(data([50, 100, 200, 300, 400, 500]))
    store.replaceData(store.getDataList().map(bar => ({ ...bar, close: 16 })))
    move(2, 15)
    expect(overlay.points).toEqual(anchors.map(point => ({ ...point, value: point.value + 5 })))
    move(3, 20)
    expect(overlay.points).toEqual([{ timestamp: 100, offset: 0, value: 20 }, { timestamp: 500, offset: 0, value: 30 }])
    expect(project).not.toHaveBeenCalled()
  })

  it.each(['insert', 'delete'] as const)('reanchors a drag by timestamp when a replacement does an internal %s', change => {
    const points = [{ timestamp: 200, value: 10 }, { timestamp: 400, value: 20 }]
    const { store, overlay, startDrag, move } = createStoredFixture(points, [100, 200, 300, 400, 500])
    const project = vi.spyOn(store.getOverlayStore(), 'getProjectedPoints')
    startDrag(1, 10)
    store.addData(data([50]), LoadDataType.Backward)
    project.mockClear()
    store.replaceData(data(change === 'insert' ? [50, 100, 150, 200, 300, 400, 500] : [50, 100, 200, 400, 500]))
    move(store.timestampToDataIndex(200)!, 15)
    expect(overlay.points).toEqual(points.map(point => ({ ...point, value: point.value + 5 })))
    move(store.timestampToDataIndex(200)! + 1, 20)
    expect(overlay.points).toEqual([
      { timestamp: change === 'insert' ? 300 : 400, offset: 0, value: 20 },
      { timestamp: 500, offset: 0, value: 30 }
    ])
    expect(project).toHaveBeenCalledOnce()
  })

  it('cancels a drag after applying a new dataset even if the timestamps match', () => {
    const { store, overlay, startDrag, move } = createStoredFixture(anchors, [100, 200, 300, 400])
    startDrag(1, 10)
    store.applyDataSnapshot(data([100, 200, 300, 400]))
    move(2, 15)
    expect(overlay.points).toEqual(anchors)
    expect(store.getOverlayStore().isDragging()).toBe(false)
    expect(store.getOverlayStore().isPressed()).toBe(false)
  })

  it('reuses press-time logical indices on price updates and reprojects on coordinate configuration changes', () => {
    const { store, overlay, startDrag, move } = createStoredFixture(anchors, [100, 200, 300, 400])
    const project = vi.spyOn(store.getOverlayStore(), 'getProjectedPoints')
    startDrag(1, 10)
    project.mockClear()
    store.addData({ ...store.getDataList()[3], close: 25 })
    move(1, 15)
    expect(project).not.toHaveBeenCalled()
    store.setOptions({ isTimeShare: false })
    move(1, 20)
    expect(project).toHaveBeenCalledOnce()
    expect(overlay.points).toEqual(anchors.map(point => ({ ...point, value: point.value + 10 })))
  })

  it('translates by bar positions across unequal timestamp intervals', () => {
    const { overlay, startDrag, move } = createStoredFixture([{ timestamp: 100, value: 10 }, { timestamp: 200, offset: 1, value: 20 }], [100, 200, 500, 900])
    startDrag(1, 10)
    move(2, 15)
    expect(overlay.points).toEqual([{ timestamp: 200, offset: 0, value: 15 }, { timestamp: 900, offset: 0, value: 25 }])
  })

  it('preserves the original offset when a control point only changes price', () => {
    const { overlay, startDrag, move } = createStoredFixture(anchors, [100, 200, 300, 400])
    startDrag(3, 20, 1)
    move(3, 25)
    expect(overlay.points).toEqual([anchors[0], { ...anchors[1], value: 25 }])
  })

  it('moves both vertical anchors horizontally and preserves them on a later price edit', () => {
    const { store, overlay, startDrag, move, release } = createStoredFixture([{ timestamp: 100, value: 10 }, { timestamp: 100, value: 20 }], [100, 200], 'verticalSegment')
    startDrag(0, 10, 0)
    move(3, 30)
    release()
    expect(overlay.points).toEqual([{ timestamp: 200, offset: 2, value: 30 }, { timestamp: 200, offset: 2, value: 20 }])
    store.addData(data([300, 400]), LoadDataType.Forward)
    startDrag(3, 30, 0)
    move(3, 35)
    expect(overlay.points).toEqual([{ timestamp: 200, offset: 2, value: 35 }, { timestamp: 200, offset: 2, value: 20 }])
  })

  it('preserves a rectangle anchor when its virtual corner only changes price', () => {
    const { overlay, startDrag, move } = createStoredFixture(anchors, [100, 200, 300, 400], 'rect')
    startDrag(3, 10, 1, 'corner_10')
    move(3, 50)
    expect(overlay.points).toEqual([{ ...anchors[0], value: 50 }, anchors[1]])
  })

  it('lets a custom body drag use translated time points for just one anchor', () => {
    const { overlay, startDrag, move } = createStoredFixture([{ timestamp: 100, value: 10 }, { timestamp: 200, offset: 1, value: 20 }], [100, 200, 500, 900], 'textLog')
    startDrag(1, 10)
    move(2, 15)
    expect(overlay.points).toEqual([{ timestamp: 100, value: 10 }, { timestamp: 900, offset: 0, value: 25 }])
  })

  it('discards a finished drag and takes a new time-point snapshot on the next press', () => {
    const { overlay, startDrag, move, release } = createStoredFixture([{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }], [100, 200, 300, 400])
    startDrag(0, 10)
    move(1, 15)
    release()
    const afterRelease = overlay.points.map(point => ({ ...point }))
    move(2, 20)
    expect(overlay.points).toEqual(afterRelease)
    startDrag(1, 15)
    move(2, 20)
    expect(overlay.points).toEqual([{ timestamp: 300, offset: 0, value: 20 }, { timestamp: 400, offset: 0, value: 30 }])
    expect(() => JSON.stringify(overlay)).not.toThrow()
  })

  it('does not let template mutations change the layer drag snapshot', () => {
    const { overlay, startDrag, move } = createStoredFixture([{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }], [100, 200, 300, 400])
    overlay.onBodyDrag = function ({ prevPoint, prevPoints, movedPoints }) {
      this.points = movedPoints
      prevPoint.timestamp = 999
      prevPoints[0].timestamp = 999
    }
    startDrag(0, 10)
    move(1, 15)
    move(2, 20)
    expect(overlay.points).toEqual([{ timestamp: 300, offset: 0, value: 20 }, { timestamp: 400, offset: 0, value: 30 }])
  })
})

function data(timestamps: number[]) {
  return timestamps.map(timestamp => ({ timestamp, open: 10, high: 20, low: 5, close: 15 }))
}

function createStoredFixture(points: Point[], timestamps: number[], name = 'segment') {
  const chart = { refreshViewportLayout: vi.fn(), updatePane: vi.fn(), syncOverlayCursor: vi.fn(), getChartStore: () => store }
  const store = new ChartStore(chart as unknown as Chart)
  store.addData(data(timestamps), LoadDataType.Init)
  const [id] = store.getOverlayStore().addInstances([{ name, paneId: 'candle', points }])
  const overlay = store.getOverlayStore().getInstanceById(id!)!
  overlayViewMock.convert = event => ({ logicalIndex: store.getTimeIndex().dataIndexToLogical(event.x), value: event.y })
  new OverlayLayer({ getPane: () => ({ getId: () => 'candle', getChart: () => chart }), addChild: vi.fn() } as never)
  const handlers = new Map(overlayViewMock.handlers)
  return {
    store,
    get overlay() { return overlay },
    startDrag(x: number, value: number, controlIndex?: number, controlKey = '') {
      const event = createEvent(x, value)
      event.target = { data: { overlayId: id, interactType: controlIndex === undefined ? 'body' : 'control-point', figureIndex: controlIndex ?? 0, figureKey: controlKey, attrsIndex: 0 } } as never
      handlers.get('mouseDownEvent')?.(event)
    },
    move(x: number, value: number) { handlers.get('pressedMouseMoveEvent')?.(createEvent(x, value)) },
    release() { handlers.get('mouseUpEvent')?.(createEvent(0, 0)) }
  }
}

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
    getInstanceById: (id: string) => id === overlay.id ? overlay : undefined,
    getProgressOverlayPaneId: () => 'candle',
    updateProgressOverlayPane: vi.fn(),
    progressOverlayComplete,
    setPressed: vi.fn(),
    setDragging: vi.fn(),
    getSelectedInfo: vi.fn(),
    setSelectedInfo: vi.fn(),
    clearHoverInfo: vi.fn(),
    notifyPointsChange: vi.fn()
  }
  const chartStore = {
    batchEffects: (commit: () => void) => commit(),
    dispatchEffect: (effect: () => void) => effect(),
    getOverlayStore: () => overlayStore,
    internalToExternal: (point: { logicalIndex?: number, value?: number }) => ({ timestamp: point.logicalIndex, value: point.value })
  }
  const chart = { getChartStore: () => chartStore, updatePane }
  const widget = {
    getPane: () => ({ getId: () => 'candle', getChart: () => chart }),
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
