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
import { clone, isNumber, merge } from '../common/utils/typeChecks'
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

export interface Overlay {
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
}

export type OverlayTemplate = ExcludePickPartial<Omit<Overlay, 'id' | 'groupId' | 'paneId' | 'points' | 'currentStep'>, 'name'>
export type OverlayCreate = ExcludePickPartial<Omit<Overlay, 'paneId' | 'currentStep' | 'totalStep' | 'createPointFigures' | 'createXAxisFigures' | 'createYAxisFigures' | 'performEventPressedMove' | 'performEventMoveForDrawing'>, 'name'>
export type OverlayRemove = Partial<Pick<Overlay, 'id' | 'groupId' | 'name'>>

const OVERLAY_DRAW_STEP_START = 1
const OVERLAY_DRAW_STEP_FINISHED = -1

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

export class Overlay {
  id: string
  groupId: string
  paneId: string
  currentStep: number = OVERLAY_DRAW_STEP_START
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

  setId (id: string): void { this.id = id }
  setGroupId (groupId: string): void { this.groupId = groupId }
  setPaneId (paneId: string): void { this.paneId = paneId }
  setLock (lock: boolean): void { this.lock = lock }

  setMode (mode: OverlayMode): void { this.mode = mode }
  setModeSensitivity (modeSensitivity: number): void { this.modeSensitivity = modeSensitivity }

  setOnDrawStart (cb: Nullable<OverlayEventCallback>): void { this.onDrawStart = cb }
  setOnDrawing (cb: Nullable<OverlayEventCallback>): void { this.onDrawing = cb }
  setOnDrawEnd (cb: Nullable<OverlayEventCallback>): void { this.onDrawEnd = cb }
  setOnClick (cb: Nullable<OverlayEventCallback>): void { this.onClick = cb }
  setOnDoubleClick (cb: Nullable<OverlayEventCallback>): void { this.onDoubleClick = cb }
  setOnRightClick (cb: Nullable<OverlayEventCallback>): void { this.onRightClick = cb }
  setOnPressedMoveStart (cb: Nullable<OverlayEventCallback>): void { this.onPressedMoveStart = cb }
  setOnPressedMoving (cb: Nullable<OverlayEventCallback>): void { this.onPressedMoving = cb }
  setOnPressedMoveEnd (cb: Nullable<OverlayEventCallback>): void { this.onPressedMoveEnd = cb }
  setOnMouseEnter (cb: Nullable<OverlayEventCallback>): void { this.onMouseEnter = cb }
  setOnMouseLeave (cb: Nullable<OverlayEventCallback>): void { this.onMouseLeave = cb }
  setOnRemoved (cb: Nullable<OverlayEventCallback>): void { this.onRemoved = cb }
  setOnSelected (cb: Nullable<OverlayEventCallback>): void { this.onSelected = cb }
  setOnDeselected (cb: Nullable<OverlayEventCallback>): void { this.onDeselected = cb }

  setPoints (points: Array<Partial<Point>>): boolean {
    if (points.length === 0) return false

    this.points = [...points]
    const repeatTotalStep = Math.min(points.length, this.totalStep - 1)

    this.currentStep = points.length >= this.totalStep - 1
      ? OVERLAY_DRAW_STEP_FINISHED
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

    if (this.currentStep === OVERLAY_DRAW_STEP_FINISHED && this.performEventPressedMove) {
      this.performEventPressedMove({
        currentStep: this.currentStep,
        mode: this.mode,
        points: this.points,
        performPointIndex: this.points.length - 1,
        performPoint: this.points[this.points.length - 1]
      })
    }

    return true
  }

  setStyles (styles: DeepPartial<OverlayStyle>): boolean {
    merge(this.styles, styles)
    return true
  }

  setVisible (visible: boolean): boolean {
    if (visible !== this.visible) {
      this.visible = visible
      return true
    }
    return false
  }

  setZLevel (zLevel: number): boolean {
    if (zLevel !== this.zLevel) {
      this.zLevel = zLevel
      return true
    }
    return false
  }

  setExtendData (extendData: any): boolean {
    if (extendData !== this.extendData) {
      this.extendData = extendData
      return true
    }
    return false
  }

  nextStep (): void {
    this.currentStep = this.currentStep === this.totalStep - 1
      ? OVERLAY_DRAW_STEP_FINISHED
      : this.currentStep + 1
  }

  forceComplete (): void {
    this.currentStep = OVERLAY_DRAW_STEP_FINISHED
  }

  isDrawing (): boolean {
    return this.currentStep !== OVERLAY_DRAW_STEP_FINISHED
  }

  isStart (): boolean {
    return this.currentStep === OVERLAY_DRAW_STEP_START
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
}
