
import type Nullable from '../common/Nullable'
import type DeepPartial from '../common/DeepPartial'
import type ExcludePickPartial from '../common/ExcludePickPartial'
import type Point from '../common/Point'
import type Coordinate from '../common/Coordinate'
import type Bounding from '../common/Bounding'
import type BarSpace from '../common/BarSpace'
import type Precision from '../common/Precision'
import { type OverlayStyle } from '../common/Styles'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { clone, isArray, isNumber, isString, isValid, merge } from '../common/utils/typeChecks'
import { type XAxis } from './XAxis'
import { type YAxis } from './YAxis'
import type ChartStore from '../store/ChartStore'

export type OverlayMode = 'normal' | 'weak_magnet' | 'strong_magnet'

export interface OverlayPerformEventParams {
  currentStep: number
  mode: OverlayMode
  points: Array<Partial<Point>>
  performPointIndex: number
  performPoint: Partial<Point>
}

export type OverlayFigureIgnoreEventType = 'mouseClickEvent' | 'mouseDoubleClickEvent' | 'mouseRightClickEvent' | 'tapEvent' | 'doubleTapEvent' | 'mouseDownEvent' | 'touchStartEvent' | 'mouseMoveEvent' | 'touchMoveEvent'

export const getAllOverlayFigureIgnoreEventTypes = (): OverlayFigureIgnoreEventType[] => [
  'mouseClickEvent', 'mouseDoubleClickEvent', 'mouseRightClickEvent',
  'tapEvent', 'doubleTapEvent', 'mouseDownEvent', 'touchStartEvent',
  'mouseMoveEvent', 'touchMoveEvent'
]

export interface OverlayFigure {
  key?: string
  type: string
  // todo fix type here
  attrs: any
  styles?: object
  ignoreEvent?: boolean | OverlayFigureIgnoreEventType[]
}

export interface OverlayPrecision extends Precision {
  max: number
  min: number
  excludePriceVolumeMax: number
  excludePriceVolumeMin: number
  [key: string]: number
}

export interface OverlayCreateFiguresCallbackParams<E = unknown> {
  overlay: Overlay<E>
  coordinates: Coordinate[]
  bounding: Bounding
  barSpace: BarSpace
  precision: OverlayPrecision
  thousandsSeparator: string
  decimalFoldThreshold: number
  dateTimeFormat: Intl.DateTimeFormat
  defaultStyles: OverlayStyle
  xAxis: Nullable<XAxis>
  yAxis: Nullable<YAxis>
  isAlignLeft?: boolean
}

export interface OverlayEvent<E = unknown> extends Partial<MouseTouchEvent> {
  figureKey?: string
  figureIndex?: number
  overlay: Overlay<E>
}

export type OverlayEventCallback<E = unknown> = (event: OverlayEvent<E>) => boolean
export type OverlayCreateFiguresCallback<E = unknown> = (params: OverlayCreateFiguresCallbackParams<E>) => OverlayFigure | OverlayFigure[]

export interface OverlayEventHandlers<E = unknown> {
  onDrawStart: Nullable<OverlayEventCallback<E>>
  onDrawing: Nullable<OverlayEventCallback<E>>
  onDrawEnd: Nullable<OverlayEventCallback<E>>
  onClick: Nullable<OverlayEventCallback<E>>
  onDoubleClick: Nullable<OverlayEventCallback<E>>
  onRightClick: Nullable<OverlayEventCallback<E>>
  onPressedMoveStart: Nullable<OverlayEventCallback<E>>
  onPressedMoving: Nullable<OverlayEventCallback<E>>
  onPressedMoveEnd: Nullable<OverlayEventCallback<E>>
  onMouseEnter: Nullable<OverlayEventCallback<E>>
  onMouseLeave: Nullable<OverlayEventCallback<E>>
  onRemoved: Nullable<OverlayEventCallback<E>>
  onSelected: Nullable<OverlayEventCallback<E>>
  onDeselected: Nullable<OverlayEventCallback<E>>
}

export interface OverlayApi<E = unknown> extends OverlayEventHandlers<E> {
  id: string
  groupId: string
  paneId: string
  name: string
  totalStep: number
  currentStep: number
  lock: boolean
  visible: boolean
  zLevel: number
  needDefaultPointFigure: boolean
  needDefaultXAxisFigure: boolean
  needDefaultYAxisFigure: boolean
  mode: OverlayMode
  modeSensitivity: number
  points: Array<Partial<Point>>
  extendData: E
  styles: Nullable<DeepPartial<OverlayStyle>>
  createPointFigures: Nullable<OverlayCreateFiguresCallback<E>>
  createXAxisFigures: Nullable<OverlayCreateFiguresCallback<E>>
  createYAxisFigures: Nullable<OverlayCreateFiguresCallback<E>>
  performEventPressedMove: Nullable<(params: OverlayPerformEventParams) => void>
  performEventMoveForDrawing: Nullable<(params: OverlayPerformEventParams) => void>
}

export type OverlayTemplate<E = unknown> = ExcludePickPartial<Omit<OverlayApi<E>, 'id' | 'groupId' | 'paneId' | 'points' | 'currentStep'>, 'name'>
export type OverlayCreate<E = unknown> = ExcludePickPartial<Omit<OverlayApi<E>, 'currentStep' | 'totalStep' | 'createPointFigures' | 'createXAxisFigures' | 'createYAxisFigures' | 'performEventPressedMove' | 'performEventMoveForDrawing'>, 'name'>
export type OverlayFilter<E = unknown> = Partial<Pick<OverlayApi<E>, 'id' | 'groupId' | 'name' | 'paneId'>>

enum OverlayDrawStep {
  START = 1,
  FINISHED = -1
}

export const OVERLAY_ID_PREFIX = 'overlay_'
export const OVERLAY_FIGURE_KEY_PREFIX = 'overlay_figure_'

export class Overlay<E = unknown> implements OverlayApi<E> {
  id: string = ''
  groupId: string = ''
  paneId: string = ''
  currentStep: number = OverlayDrawStep.START
  points: Array<Partial<Point>> = []

  name: string = ''
  totalStep: number = 1
  lock: boolean = false
  visible: boolean = true
  zLevel: number = 0
  mode: OverlayMode = 'normal'
  modeSensitivity: number = 8
  extendData: E = undefined as E
  styles: Nullable<DeepPartial<OverlayStyle>> = null

  needDefaultPointFigure: boolean = false
  needDefaultXAxisFigure: boolean = false
  needDefaultYAxisFigure: boolean = false

  createPointFigures: Nullable<OverlayCreateFiguresCallback<E>> = null
  createXAxisFigures: Nullable<OverlayCreateFiguresCallback<E>> = null
  createYAxisFigures: Nullable<OverlayCreateFiguresCallback<E>> = null

  performEventPressedMove: Nullable<(params: OverlayPerformEventParams) => void> = null
  performEventMoveForDrawing: Nullable<(params: OverlayPerformEventParams) => void> = null

  // Event callbacks
  onDrawStart: Nullable<OverlayEventCallback<E>> = null
  onDrawing: Nullable<OverlayEventCallback<E>> = null
  onDrawEnd: Nullable<OverlayEventCallback<E>> = null
  onClick: Nullable<OverlayEventCallback<E>> = null
  onDoubleClick: Nullable<OverlayEventCallback<E>> = null
  onRightClick: Nullable<OverlayEventCallback<E>> = null
  onPressedMoveStart: Nullable<OverlayEventCallback<E>> = null
  onPressedMoving: Nullable<OverlayEventCallback<E>> = null
  onPressedMoveEnd: Nullable<OverlayEventCallback<E>> = null
  onMouseEnter: Nullable<OverlayEventCallback<E>> = null
  onMouseLeave: Nullable<OverlayEventCallback<E>> = null
  onRemoved: Nullable<OverlayEventCallback<E>> = null
  onSelected: Nullable<OverlayEventCallback<E>> = null
  onDeselected: Nullable<OverlayEventCallback<E>> = null

  private _prevOverlay: Nullable<Overlay<E>> = null
  private _prevZLevel: number = 0
  private _prevPressedPoint: Nullable<Partial<Point>> = null
  private _prevPressedPoints: Array<Partial<Point>> = []

  constructor(overlay: OverlayTemplate) {
    Object.assign(this, overlay)
  }

  getPrevZLevel(): number {
    return this._prevZLevel
  }

  setPrevZLevel(zLevel: number): void {
    this._prevZLevel = zLevel
  }

  override(overlay: Partial<Overlay<E>>): void {
    // Save previous state for change detection
    this._prevOverlay = clone({ ...this, _prevOverlay: null })

    const {
      id,
      name,
      currentStep: _,
      points,
      styles,
      ...others
    } = overlay

    merge(this, others)

    if (!isString(this.name)) {
      this.name = name ?? ''
    }

    if (!isString(this.id) && isString(id)) {
      this.id = id
    }

    if (isValid(styles)) {
      this.styles ??= {}
      merge(this.styles, styles)
    }

    // Handle points update
    if (isArray(points) && points.length > 0) {
      let repeatTotalStep = 0
      this.points = [...points]

      if (points.length >= this.totalStep - 1) {
        this.currentStep = OverlayDrawStep.FINISHED
        repeatTotalStep = this.totalStep - 1
      } else {
        this.currentStep = points.length + 1
        repeatTotalStep = points.length
      }

      // Prevent wrong drawing due to wrong points
      for (let i = 0; i < repeatTotalStep; i++) {
        this.performEventMoveForDrawing?.({
          currentStep: i + 2,
          mode: this.mode,
          points: this.points,
          performPointIndex: i,
          performPoint: this.points[i]
        })
      }

      if (this.currentStep === OverlayDrawStep.FINISHED) {
        this.performEventPressedMove?.({
          currentStep: this.currentStep,
          mode: this.mode,
          points: this.points,
          performPointIndex: this.points.length - 1,
          performPoint: this.points[this.points.length - 1]
        })
      }
    }
  }

  shouldUpdate(): { draw: boolean, sort: boolean } {
    if (this._prevOverlay === null) {
      return { draw: true, sort: false }
    }

    const sort = this._prevOverlay.zLevel !== this.zLevel
    const draw = sort ||
      JSON.stringify(this._prevOverlay.points) !== JSON.stringify(this.points) ||
      this._prevOverlay.visible !== this.visible ||
      this._prevOverlay.extendData !== this.extendData ||
      this._prevOverlay.styles !== this.styles

    return { sort, draw }
  }

  isDrawing(): boolean {
    return this.currentStep !== OverlayDrawStep.FINISHED
  }

  isStart(): boolean {
    return this.currentStep === OverlayDrawStep.START
  }

  nextStep(): void {
    this.currentStep = this.currentStep === this.totalStep - 1
      ? OverlayDrawStep.FINISHED
      : this.currentStep + 1
  }

  forceComplete(): void {
    this.currentStep = OverlayDrawStep.FINISHED
  }

  eventMoveForDrawing(point: Partial<Point>): void {
    const pointIndex = this.currentStep - 1
    const newPoint: Partial<Point> = {}

    // Copy valid properties
    if (isNumber(point.timestamp)) newPoint.timestamp = point.timestamp
    if (isNumber(point.dataIndex)) newPoint.dataIndex = point.dataIndex
    if (isNumber(point.value)) newPoint.value = point.value

    this.points[pointIndex] = newPoint
    this.performEventMoveForDrawing?.({
      currentStep: this.currentStep,
      mode: this.mode,
      points: this.points,
      performPointIndex: pointIndex,
      performPoint: newPoint
    })
  }

  eventPressedPointMove(point: Partial<Point>, pointIndex: number): void {
    const targetPoint = this.points[pointIndex]

    if (isNumber(point.dataIndex)) {
      targetPoint.dataIndex = point.dataIndex
      targetPoint.timestamp = point.timestamp
    }
    if (isNumber(point.value)) {
      targetPoint.value = point.value
    }

    this.performEventPressedMove?.({
      currentStep: this.currentStep,
      points: this.points,
      mode: this.mode,
      performPointIndex: pointIndex,
      performPoint: targetPoint
    })
  }

  startPressedMove(point: Partial<Point>): void {
    this._prevPressedPoint = { ...point }
    this._prevPressedPoints = clone(this.points)
  }

  eventPressedOtherMove(point: Partial<Point>, chartStore: ChartStore): void {
    if (!this._prevPressedPoint) return

    const difDataIndex = isNumber(point.dataIndex) && isNumber(this._prevPressedPoint.dataIndex)
      ? point.dataIndex - this._prevPressedPoint.dataIndex
      : undefined

    const difValue = isNumber(point.value) && isNumber(this._prevPressedPoint.value)
      ? point.value - this._prevPressedPoint.value
      : undefined

    this.points = this._prevPressedPoints.map(p => {
      if (isNumber(p.timestamp)) {
        p.dataIndex = chartStore.timestampToDataIndex(p.timestamp)
      }

      const newPoint = { ...p }

      if (isNumber(difDataIndex) && isNumber(p.dataIndex)) {
        newPoint.dataIndex = p.dataIndex + difDataIndex
        newPoint.timestamp = chartStore.dataIndexToTimestamp(newPoint.dataIndex) ?? undefined
      }

      if (isNumber(difValue) && isNumber(p.value)) {
        newPoint.value = p.value + difValue
      }

      return newPoint
    })
  }
}
