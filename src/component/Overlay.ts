import type DeepPartial from '../common/DeepPartial'
import type PartialExcept from '../common/PartialExcept'
import type Point from '../common/Point'
import type Coordinate from '../common/Coordinate'
import type Bounding from '../common/Bounding'
import type BarSpace from '../common/BarSpace'
import type Precision from '../common/Precision'
import { type OverlayStyle } from '../common/Styles'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { clone, isNumber, isValid, merge } from '../common/utils/typeChecks'
import { type XAxis } from './XAxis'
import { type YAxis } from './YAxis'
import type ChartStore from '../store/ChartStore'

// 辅助类型：表示数组索引访问总是返回非 undefined 的值
type NonUndefinedArray<T> = ReadonlyArray<T> & { [K in number]: T }

// 默认的 extendData 类型，允许任意属性
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultExtendData = Record<string, any>

export type OverlayMode = 'normal' | 'weak_magnet' | 'strong_magnet'

export enum OverlayState {
  CREATED = 'created',
  DRAWING = 'drawing',
  COMPLETED = 'completed'
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
  attrs: object | object[]
  styles?: object
  ignoreEvent?: boolean | OverlayFigureIgnoreEventType[]
}

export type InteractType = 'control-point' | 'body'

export interface OverlayFigureData {
  overlay: Overlay
  interactType: InteractType
  figureKey: string
  figureIndex: number
  attrsIndex: number
}

export interface EventOverlayInfo extends OverlayFigureData {
  paneId: string
}

export interface OverlayPrecision extends Precision {
  max: number
  min: number
  excludePriceVolumeMax: number
  excludePriceVolumeMin: number
  [key: string]: number
}

export interface OverlayCreateFiguresCallbackParams<E = DefaultExtendData> {
  overlay: Overlay<E>
  coordinates: Coordinate[]
  bounding: Bounding
  barSpace: BarSpace
  precision: OverlayPrecision
  thousandsSeparator: string
  decimalFoldThreshold: number
  dateTimeFormat: Intl.DateTimeFormat
  defaultStyles: OverlayStyle
  xAxis?: XAxis
  yAxis?: YAxis
  isAlignLeft?: boolean
}

export interface OverlayEvent<E = DefaultExtendData> extends Partial<MouseTouchEvent> {
  figureKey?: string
  figureIndex?: number
  overlay: Overlay<E>
}

interface DrawParams {
  figureKey: string
  pointIndex: number
}

export type DefaultCallback = () => void
export type OverlayDrawEventCallback = (event: MouseTouchEvent, params: DrawParams) => void

export type OverlayEventCallback = (event: MouseTouchEvent, params: EventOverlayInfo) => boolean

export type OverlayCreateFiguresCallback<E = DefaultExtendData> = (params: OverlayCreateFiguresCallbackParams<E>) => OverlayFigure | OverlayFigure[]

export interface OverlayEventHandlers {
  onDrawStart?: DefaultCallback
  onDrawing?: OverlayDrawEventCallback
  onDrawEnd?: OverlayDrawEventCallback

  onClick?: OverlayEventCallback
  onDoubleClick?: OverlayEventCallback
  onRightClick?: OverlayEventCallback
  onPressedMoveStart?: OverlayEventCallback
  onPressedMoving?: OverlayEventCallback
  onPressedMoveEnd?: OverlayEventCallback
  onMouseEnter?: OverlayEventCallback
  onMouseLeave?: OverlayEventCallback
  onSelected?: OverlayEventCallback
  onDeselected?: OverlayEventCallback

  onRemoved?: DefaultCallback
}

export interface OverlayApi<E = DefaultExtendData> extends OverlayEventHandlers {
  id: string
  groupId: string
  paneId: string
  name: string
  state: OverlayState
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
  styles?: DeepPartial<OverlayStyle>
  createFigures?: OverlayCreateFiguresCallback<E>
  createXAxisFigures?: OverlayCreateFiguresCallback<E>
  createYAxisFigures?: OverlayCreateFiguresCallback<E>
  onControlPointUpdate?: (points: Array<Partial<Point>>, updateIndex: number, point: Partial<Point>) => void
  onDrawPointUpdate?: (points: Array<Partial<Point>>, updateIndex: number, point: Partial<Point>) => void
  onBodyDrag?: (this: Overlay<E>, params: {
    point: Required<Point>
    prevPoint: Required<Point>
    prevPoints: NonUndefinedArray<Readonly<Required<Point>>>
    chartStore: ChartStore
  }) => void
}

export type OverlayTemplate<E = DefaultExtendData> = PartialExcept<Omit<OverlayApi<E>, 'id' | 'groupId' | 'paneId' | 'points' | 'currentStep' | 'state'>, 'name'>
export type OverlayCreate<E = DefaultExtendData> = PartialExcept<Omit<OverlayApi<E>, 'currentStep' | 'totalStep' | 'state' | 'createFigures' | 'createXAxisFigures' | 'createYAxisFigures' | 'performEventPressedMove' | 'onDrawingPointUpdate'>, 'name'>

export interface OverlayFilter {
  id?: string
  groupId?: string
  name?: string
  paneId?: string
}

export type OverlayProps = Omit<OverlayCreate, keyof OverlayFilter>

export interface ChangeInfo {
  sort: boolean
  draw: boolean
  fields: string[]
}

interface OverlayInitOption {
  id: string
  groupId: string
  paneId: string
  zLevel?: number
  points?: Partial<Point>[]
  [key: string]: unknown
}

export const OVERLAY_ID_PREFIX = 'overlay_'
export const OVERLAY_FIGURE_KEY_PREFIX = 'overlay_figure_'

export class Overlay<E = DefaultExtendData> implements OverlayApi<E> {
  id: string
  groupId: string
  paneId: string
  state: OverlayState = OverlayState.CREATED
  currentStep: number = 0
  points: Array<Partial<Point>> = []

  name: string = ''
  totalStep: number = 999 // 默认无限制步骤数(适用于anywave)
  lock: boolean = false
  visible: boolean = true
  zLevel: number = 0
  mode: OverlayMode = 'normal'
  modeSensitivity: number = 8
  extendData: E = undefined as E
  styles?: DeepPartial<OverlayStyle>

  needDefaultPointFigure: boolean = false
  needDefaultXAxisFigure: boolean = false
  needDefaultYAxisFigure: boolean = false

  createFigures?: OverlayCreateFiguresCallback<E>
  createXAxisFigures?: OverlayCreateFiguresCallback<E>
  createYAxisFigures?: OverlayCreateFiguresCallback<E>

  onControlPointUpdate?: (points: Array<Partial<Point>>, updateIndex: number, point: Partial<Point>) => void
  onDrawPointUpdate?: (points: Array<Partial<Point>>, updateIndex: number, point: Partial<Point>) => void
  onBodyDrag?: (this: Overlay<E>, params: {
    point: Required<Point>
    prevPoint: Required<Point>
    prevPoints: NonUndefinedArray<Readonly<Required<Point>>>
    chartStore: ChartStore
  }) => void

  // Event callbacks
  onDrawStart?: DefaultCallback
  onDrawing?: OverlayDrawEventCallback
  onDrawEnd?: OverlayDrawEventCallback

  onClick?: OverlayEventCallback
  onDoubleClick?: OverlayEventCallback
  /** 仅当返回 Truthy 值时阻止右键点击删除 */
  onRightClick?: OverlayEventCallback
  onPressedMoveStart?: OverlayEventCallback
  // 返回 Truthy 表示阻止原有的默认拖动行为
  onPressedMoving?: OverlayEventCallback
  onPressedMoveEnd?: OverlayEventCallback
  onMouseEnter?: OverlayEventCallback
  onMouseLeave?: OverlayEventCallback
  onSelected?: OverlayEventCallback
  onDeselected?: OverlayEventCallback

  onRemoved?: DefaultCallback

  private _originalZLevel: number = 0
  private _prevPressedPoint?: Partial<Point>
  private _prevPressedPoints: Array<Partial<Point>> = []

  constructor(template: OverlayTemplate<E>, { id, groupId, paneId, zLevel, points, ...rest }: OverlayInitOption) {
    Object.assign(this, template)

    this.id = id
    this.groupId = groupId
    this.paneId = paneId
    if (isValid(zLevel)) {
      this.zLevel = zLevel
    }
    if (points) {
      this._applyPoints(points)
    }

    Object.assign(this, rest)
  }

  setOriginalZLevel(zLevel: number): void {
    this._originalZLevel = zLevel
  }

  getOriginalZLevel(): number {
    return this._originalZLevel
  }

  update(overlay: Partial<Overlay<E>>): void {
    const {
      id,           // 不可修改 - 唯一标识符
      paneId,       // 不可修改 - 会导致数据不一致
      name,         // 不可修改 - overlay 类型
      state,        // 不可修改 - 由内部状态机管理
      currentStep,  // 不可修改 - 由 nextStep 管理
      groupId,      // 可修改 - 允许重新分组
      points,       // 特殊处理
      styles,       // 特殊处理
      ...others     // 其他属性可修改
    } = overlay

    // 合并其他可修改的属性
    merge(this, others)

    // groupId 可以修改（用于重新分组）
    if (isValid(groupId)) {
      this.groupId = groupId
    }

    if (isValid(styles)) {
      this.styles ??= {}
      merge(this.styles, styles)
    }

    if (points) {
      this._applyPoints(points)
    }
  }

  private _applyPoints(points: Partial<Point>[]) {
    const _points = points.length > this.totalStep ? points.slice(0, this.totalStep) : points

    this.currentStep = _points.length
    this.state = this.currentStep === this.totalStep
      ? OverlayState.COMPLETED
      : this.currentStep === 0
        ? OverlayState.CREATED
        : OverlayState.DRAWING

    this.points = _points
    for (let i = 0; i < this.currentStep; i++) {
      this.onDrawPointUpdate?.(this.points, i, this.points[i])
    }
  }

  shouldUpdate(nextProps: Partial<OverlayProps>): ChangeInfo {
    const changes: string[] = []

    // 检测每个属性的变化
    if (nextProps.zLevel !== undefined && nextProps.zLevel !== this.zLevel) {
      changes.push('zLevel')
    }

    if (nextProps.visible !== undefined && nextProps.visible !== this.visible) {
      changes.push('visible')
    }

    if (nextProps.points !== undefined && nextProps.points !== this.points) {
      changes.push('points')
    }

    if (nextProps.extendData !== undefined && nextProps.extendData !== this.extendData) {
      changes.push('extendData')
    }

    if (nextProps.points !== undefined && nextProps.styles !== this.styles) {
      changes.push('styles')
    }

    return {
      sort: changes.includes('zLevel'),
      draw: changes.length > 0,
      fields: changes
    }
  }

  isDrawing(): boolean {
    return this.state === OverlayState.DRAWING
  }

  isCreated(): boolean {
    return this.state === OverlayState.CREATED
  }

  isCompleted(): boolean {
    return this.state === OverlayState.COMPLETED
  }

  nextStep(): void {
    if (this.state === OverlayState.CREATED) {
      this.state = OverlayState.DRAWING
    }

    this.currentStep++

    if (this.currentStep >= this.totalStep) {
      this.state = OverlayState.COMPLETED
    }
  }

  forceComplete(): void {
    this.currentStep = this.totalStep
    this.state = OverlayState.COMPLETED
  }

  updateDrawPoint(point: Partial<Point>): void {
    if (this.onDrawPointUpdate) {
      this.onDrawPointUpdate(this.points, this.currentStep, point)
      return
    }
    this._updatePoint(this.points[this.currentStep] ??= {}, point)
  }

  onDragMoveControlPoint(point: Partial<Point>, pointIndex: number): void {
    if (this.onControlPointUpdate) {
      this.onControlPointUpdate(this.points, pointIndex, point)
      return
    }
    this._updatePoint(this.points[pointIndex], point)
  }

  private _updatePoint(p: Partial<Point>, np: Partial<Point>) {
    if (isNumber(np.timestamp)) p.timestamp = np.timestamp
    if (isNumber(np.dataIndex)) p.dataIndex = np.dataIndex
    if (isNumber(np.value)) p.value = np.value
    // if (isNumber(np.dataKey)) p.dataKey = np.dataKey
  }

  startPressedMove(point: Partial<Point>): void {
    this._prevPressedPoint = { ...point }
    this._prevPressedPoints = clone(this.points)
  }

  onDragMoveBody(point: Partial<Point>, chartStore: ChartStore): void {
    if (!this._prevPressedPoint) return

    if (this.onBodyDrag) {
      // todo here is unsafe as
      this.onBodyDrag({
        point: point as Required<Point>,
        prevPoint: this._prevPressedPoint as Required<Point>,
        prevPoints: this._prevPressedPoints as NonUndefinedArray<Readonly<Required<Point>>>,
        chartStore
      })
      return
    }
    const difDataIndex = isNumber(point.dataIndex) && isNumber(this._prevPressedPoint.dataIndex)
      ? point.dataIndex - this._prevPressedPoint.dataIndex
      : undefined

    const difValue = isNumber(point.value) && isNumber(this._prevPressedPoint.value)
      ? point.value - this._prevPressedPoint.value
      : undefined

    this.points = this._prevPressedPoints.map((p) => {
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
