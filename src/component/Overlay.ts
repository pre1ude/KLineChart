/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
import { clone, isArray, isBoolean, isNumber, isString, isValid, merge } from '../common/utils/typeChecks'
import type TimeScaleStore from '../store/TimeScaleStore'
import { type XAxis } from './XAxis'
import { type YAxis } from './YAxis'

export enum OverlayMode {
  Normal = 'normal',
  WeakMagnet = 'weak_magnet',
  StrongMagnet = 'strong_magnet'
}

export interface OverlayPerformEventParams {
  currentStep: number
  mode: OverlayMode
  points: Array<Partial<Point>>
  performPointIndex: number
  performPoint: Partial<Point>
}

export type OverlayFigureIgnoreEventType = 'mouseClickEvent' | 'mouseRightClickEvent' | 'tapEvent' | 'doubleTapEvent' | 'mouseDownEvent' | 'touchStartEvent' | 'mouseMoveEvent' | 'touchMoveEvent' | 'mouseDoubleClickEvent'

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
  styles?: any
  ignoreEvent?: boolean | OverlayFigureIgnoreEventType[]
}

export interface OverlayPrecision extends Precision {
  max: number
  min: number
  excludePriceVolumeMax: number
  excludePriceVolumeMin: number
  [key: string]: number
}

export interface OverlayCreateFiguresCallbackParams {
  overlay: Overlay
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

export interface OverlayEvent extends Partial<MouseTouchEvent> {
  figureKey?: string
  figureIndex?: number
  overlay: Overlay
}

export type OverlayEventCallback = (event: OverlayEvent) => boolean
export type OverlayCreateFiguresCallback = (params: OverlayCreateFiguresCallbackParams) => OverlayFigure | OverlayFigure[]

interface OverlayEventHandlers {
  onDrawStart: Nullable<OverlayEventCallback>
  onDrawing: Nullable<OverlayEventCallback>
  onDrawEnd: Nullable<OverlayEventCallback>
  onClick: Nullable<OverlayEventCallback>
  onDoubleClick: Nullable<OverlayEventCallback>
  onRightClick: Nullable<OverlayEventCallback>
  onPressedMoveStart: Nullable<OverlayEventCallback>
  onPressedMoving: Nullable<OverlayEventCallback>
  onPressedMoveEnd: Nullable<OverlayEventCallback>
  onMouseEnter: Nullable<OverlayEventCallback>
  onMouseLeave: Nullable<OverlayEventCallback>
  onRemoved: Nullable<OverlayEventCallback>
  onSelected: Nullable<OverlayEventCallback>
  onDeselected: Nullable<OverlayEventCallback>
}

export interface OverlayApi extends OverlayEventHandlers {
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
  extendData: any
  styles: Nullable<DeepPartial<OverlayStyle>>
  createPointFigures: Nullable<OverlayCreateFiguresCallback>
  createXAxisFigures: Nullable<OverlayCreateFiguresCallback>
  createYAxisFigures: Nullable<OverlayCreateFiguresCallback>
  performEventPressedMove: Nullable<(params: OverlayPerformEventParams) => void>
  performEventMoveForDrawing: Nullable<(params: OverlayPerformEventParams) => void>
}

export type OverlayTemplate = ExcludePickPartial<Omit<OverlayApi, 'id' | 'groupId' | 'paneId' | 'points' | 'currentStep'>, 'name'>
export type OverlayCreate = ExcludePickPartial<Omit<OverlayApi, 'paneId' | 'currentStep' | 'totalStep' | 'createPointFigures' | 'createXAxisFigures' | 'createYAxisFigures' | 'performEventPressedMove' | 'performEventMoveForDrawing'>, 'name'>
export type OverlayRemove = Partial<Pick<OverlayApi, 'id' | 'groupId' | 'name'>>

enum OverlayDrawStep {
  START = 1,
  FINISHED = -1
}

export const OVERLAY_ID_PREFIX = 'overlay_'
export const OVERLAY_FIGURE_KEY_PREFIX = 'overlay_figure_'

const defaultTemplate: OverlayTemplate = {
  name: '',
  totalStep: 1,
  lock: false,
  visible: true,
  zLevel: 0,
  mode: OverlayMode.Normal,
  modeSensitivity: 8,
  extendData: undefined,
  styles: undefined,

  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,

  createPointFigures: null,
  createXAxisFigures: null,
  createYAxisFigures: null,

  performEventPressedMove: null,
  performEventMoveForDrawing: null,

  onDrawStart: null,
  onDrawing: null,
  onDrawEnd: null,
  onClick: null,
  onDoubleClick: null,
  onRightClick: null,
  onPressedMoveStart: null,
  onPressedMoving: null,
  onPressedMoveEnd: null,
  onMouseEnter: null,
  onMouseLeave: null,
  onRemoved: null,
  onSelected: null,
  onDeselected: null
}

export class Overlay implements OverlayApi {
  id: string
  groupId: string
  paneId: string
  currentStep: number = OverlayDrawStep.START
  points: Array<Partial<Point>> = []

  name: string
  totalStep: number
  lock: boolean
  visible: boolean
  zLevel: number
  mode: OverlayMode
  modeSensitivity: number
  extendData: any
  styles: Nullable<DeepPartial<OverlayStyle>>

  needDefaultPointFigure: boolean
  needDefaultXAxisFigure: boolean
  needDefaultYAxisFigure: boolean

  createPointFigures: Nullable<OverlayCreateFiguresCallback>
  createXAxisFigures: Nullable<OverlayCreateFiguresCallback>
  createYAxisFigures: Nullable<OverlayCreateFiguresCallback>

  performEventPressedMove: Nullable<(params: OverlayPerformEventParams) => void>
  performEventMoveForDrawing: Nullable<(params: OverlayPerformEventParams) => void>

  // Event callbacks
  onDrawStart: Nullable<OverlayEventCallback>
  onDrawing: Nullable<OverlayEventCallback>
  onDrawEnd: Nullable<OverlayEventCallback>
  onClick: Nullable<OverlayEventCallback>
  onDoubleClick: Nullable<OverlayEventCallback>
  onRightClick: Nullable<OverlayEventCallback>
  onPressedMoveStart: Nullable<OverlayEventCallback>
  onPressedMoving: Nullable<OverlayEventCallback>
  onPressedMoveEnd: Nullable<OverlayEventCallback>
  onMouseEnter: Nullable<OverlayEventCallback>
  onMouseLeave: Nullable<OverlayEventCallback>
  onRemoved: Nullable<OverlayEventCallback>
  onSelected: Nullable<OverlayEventCallback>
  onDeselected: Nullable<OverlayEventCallback>

  private _prevPressedPoint: Nullable<Partial<Point>> = null
  private _prevPressedPoints: Array<Partial<Point>> = []

  constructor (overlay: OverlayTemplate) {
    Object.assign(this, defaultTemplate, overlay)
  }

  setPoints (points: Array<Partial<Point>>): void {
    if (points.length === 0) return

    this.points = [...points]
    const repeatTotalStep = Math.min(points.length, Math.max(0, this.totalStep - 1))

    this.currentStep = points.length >= this.totalStep - 1
      ? OverlayDrawStep.FINISHED
      : points.length + 1

    // Handle drawing events
    if (this.performEventMoveForDrawing) {
      for (let i = 0; i < repeatTotalStep; i++) {
        this.performEventMoveForDrawing({
          currentStep: i + 2,
          mode: this.mode,
          points: this.points,
          performPointIndex: i,
          performPoint: this.points[i]
        })
      }
    }

    if (this.currentStep === OverlayDrawStep.FINISHED && this.performEventPressedMove) {
      this.performEventPressedMove({
        currentStep: this.currentStep,
        mode: this.mode,
        points: this.points,
        performPointIndex: this.points.length - 1,
        performPoint: this.points[this.points.length - 1]
      })
    }
  }

  get isDrawing (): boolean {
    return this.currentStep !== OverlayDrawStep.FINISHED
  }

  get isStart (): boolean {
    return this.currentStep === OverlayDrawStep.START
  }

  nextStep (): void {
    this.currentStep = this.currentStep === this.totalStep - 1
      ? OverlayDrawStep.FINISHED
      : this.currentStep + 1
  }

  forceComplete (): void {
    this.currentStep = OverlayDrawStep.FINISHED
  }

  eventMoveForDrawing (point: Partial<Point>): void {
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

  eventPressedPointMove (point: Partial<Point>, pointIndex: number): void {
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

  startPressedMove (point: Partial<Point>): void {
    this._prevPressedPoint = { ...point }
    this._prevPressedPoints = clone(this.points)
  }

  eventPressedOtherMove (point: Partial<Point>, timeScaleStore: TimeScaleStore): void {
    if (!this._prevPressedPoint) return

    const difDataIndex = isNumber(point.dataIndex) && isNumber(this._prevPressedPoint.dataIndex)
      ? point.dataIndex - this._prevPressedPoint.dataIndex
      : undefined

    const difValue = isNumber(point.value) && isNumber(this._prevPressedPoint.value)
      ? point.value - this._prevPressedPoint.value
      : undefined

    this.points = this._prevPressedPoints.map(p => {
      if (isNumber(p.timestamp)) {
        p.dataIndex = timeScaleStore.timestampToDataIndex(p.timestamp)
      }

      const newPoint = { ...p }

      if (isNumber(difDataIndex) && isNumber(p.dataIndex)) {
        newPoint.dataIndex = p.dataIndex + difDataIndex
        newPoint.timestamp = timeScaleStore.dataIndexToTimestamp(newPoint.dataIndex) ?? undefined
      }

      if (isNumber(difValue) && isNumber(p.value)) {
        newPoint.value = p.value + difValue
      }

      return newPoint
    })
  }

  shouldUpdate (next: Partial<OverlayCreate>): [boolean, boolean] {
    const needSort = shouldSort(next)
    const needUpdate = shouldUpdate(next)

    function shouldUpdate (next: Partial<OverlayCreate>): boolean {
      return (
        needSort ||
        (isBoolean(next.visible) && this.visible !== next.visible) ||
        (isArray(next.points) && JSON.stringify(this.points) !== JSON.stringify(next.points)) ||
        (isValid(next.styles) && this.styles !== next.styles) ||
        (isValid(next.extendData) && JSON.stringify(this.extendData) !== JSON.stringify(next.extendData))
      )
    }
    function shouldSort (next: Partial<OverlayCreate>): boolean {
      return (
        (isNumber(next.zLevel) && this.zLevel !== next.zLevel)
      )
    }

    return [needUpdate, needSort]
  }

  overrideOverlay (next: Partial<Overlay>): void {
    const {
      id, name, currentStep: _, points, styles, ...others
    } = next

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

    this.setPoints(points ?? [])

    merge(this, others)
  }
}
