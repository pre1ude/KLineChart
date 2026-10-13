import type BarSpace from '../common/BarSpace'
import type Bounding from '../common/Bounding'
import type Coordinate from '../common/Coordinate'
import type DeepPartial from '../common/DeepPartial'
import type PartialExcept from '../common/PartialExcept'
import { copyPoint, isValidPointOffset, type IPoint, type Point } from '../common/Point'
import type Precision from '../common/Precision'
import { type OverlayStyle } from '../common/Styles'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import type { DateTimeFormat } from '../common/utils/dateTimeFormat'
import { clone, isValid, merge } from '../common/utils/typeChecks'
import { logWarn } from '../common/utils/logger'
import { type XAxis } from './XAxis'
import { type YScale } from './YScale'

// 默认的 extendData 类型，允许任意属性
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DefaultExtendData = Record<string, any>

/**
 * Overlay 事件的附加数据
 */
export interface OverlayEventData<E = DefaultExtendData> {
  /** Overlay 实例 */
  overlay: Overlay<E>
  /** 所在 pane 的 ID */
  paneId: string
  /** 交互类型：控制点或主体 */
  interactType: 'control-point' | 'body'
  /** Figure 的 key */
  figureKey: string
  /** Figure 索引 */
  figureIndex: number
  /** attrs 索引 */
  attrsIndex: number
  /** 绘制点索引（仅绘制事件） */
  pointIndex?: number
  /**
   * 将内部 logicalIndex 转换为外部 timestamp + offset
   */
  internalToExternal: (point: IPoint) => Partial<Point>
}

/**
 * Overlay 事件回调的事件类型
 * 扩展 MouseTouchEvent，明确 overlayData 的类型
 */
export type OverlayMouseTouchEvent<E = DefaultExtendData> = Omit<MouseTouchEvent, 'overlayData'> & {
  overlayData: OverlayEventData<E>
}

export type OverlayMode = 'normal' | 'weak_magnet' | 'strong_magnet'

export type OverlayControlPointVisibility = 'auto' | 'always'

export enum OverlayState {
  CREATED = 'created',
  DRAWING = 'drawing',
  COMPLETED = 'completed'
}

export type FigureEventType = 'mouseClickEvent' | 'mouseDoubleClickEvent' | 'mouseRightClickEvent' | 'contextMenuEvent' | 'tapEvent' | 'doubleTapEvent' | 'mouseDownEvent' | 'touchStartEvent' | 'mouseMoveEvent' | 'touchMoveEvent'

export interface OverlayFigure {
  key?: string
  type: string
  attrs: object | object[]
  styles?: object
  ignoreEvent?: boolean | FigureEventType[]
}

export interface OverlayControlPoint {
  key: string
  coordinate: Coordinate
}

export type InteractType = 'control-point' | 'body'

export interface OverlayFigureData {
  overlayId: string      // Overlay ID（避免循环引用）
  interactType: InteractType
  figureKey: string
  figureIndex: number
  attrsIndex: number
}

export interface EventOverlayInfo {
  overlay: Overlay       // 事件处理时才需要完整的 overlay 引用
  paneId: string
  interactType: InteractType
  figureKey: string
  figureIndex: number
  attrsIndex: number
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
  dateTimeFormat: DateTimeFormat
  defaultStyles: OverlayStyle
  xAxis?: XAxis
  yScale?: YScale
  /** Format a canonical Y value for the current visual axis. */
  formatLabel?: (value: number, fallback: string) => string
  isAlignLeft?: boolean
}

export interface OverlayCreateControlPointsCallbackParams<E = DefaultExtendData> {
  overlay: Overlay<E>
  coordinates: Coordinate[]
}

/** Overlay 交互事件回调 */
export type OverlayEventCallback<E = DefaultExtendData> = (event: OverlayMouseTouchEvent<E>) => void

export type OverlayCreateFiguresCallback<E = DefaultExtendData> = (params: OverlayCreateFiguresCallbackParams<E>) => OverlayFigure | OverlayFigure[]

export type OverlayCreateControlPointsCallback<E = DefaultExtendData> = (params: OverlayCreateControlPointsCallbackParams<E>) => OverlayControlPoint[]

export interface OverlayPointsChangeEvent<E = DefaultExtendData> {
  overlay: Overlay<E>
  source: 'draw' | 'body' | 'control-point' | 'api'
  previousPoints: Point[]
  points: Point[]
}

export interface OverlayEventHandlers<E = DefaultExtendData> {
  /** Optional observation of an already committed points state. */
  onPointsChange?: (event: OverlayPointsChangeEvent<E>) => void
  /** 当 overlay 实例被创建完毕时触发，不论是否已经绘制完成 */
  onCreated?: (this: Overlay<E>) => void
  onRemoved?: () => void

  /** 开始绘制（第一个点） */
  onDrawStart?: OverlayEventCallback<E>
  /** 绘制中（每次添加点） */
  onDrawing?: OverlayEventCallback<E>
  /** 绘制完成（最后一个点） */
  onDrawEnd?: OverlayEventCallback<E>

  onClick?: OverlayEventCallback<E>
  onDoubleClick?: OverlayEventCallback<E>
  onRightClick?: OverlayEventCallback<E>
  onPressedMoveStart?: OverlayEventCallback<E>
  onPressedMoving?: OverlayEventCallback<E>
  onPressedMoveEnd?: OverlayEventCallback<E>
  onMouseEnter?: OverlayEventCallback<E>
  onMouseLeave?: OverlayEventCallback<E>
  onSelected?: OverlayEventCallback<E>
  onDeselected?: OverlayEventCallback<E>
}

export interface OverlayBodyDragParams {
  point: Point
  prevPoint: Point
  prevPoints: Point[]
  /** Proposed time points after translating the press-time geometry. */
  movedPoints: Point[]
}

export interface OverlayApi<E = DefaultExtendData> extends OverlayEventHandlers<E> {
  id: string
  groupId: string
  paneId: string
  name: string
  state: OverlayState
  totalStep: number
  currentStep: number
  lock: boolean
  visible: boolean
  zLevel?: number
  needDefaultPointFigure: boolean
  needDefaultXAxisFigure: boolean
  needDefaultYAxisFigure: boolean
  mode: OverlayMode
  modeSensitivity: number
  controlPointVisibility: OverlayControlPointVisibility
  points: Point[]
  extendData: E
  styles?: DeepPartial<OverlayStyle>
  createFigures?: OverlayCreateFiguresCallback<E>
  createXAxisFigures?: OverlayCreateFiguresCallback<E>
  createYAxisFigures?: OverlayCreateFiguresCallback<E>
  createControlPoints?: OverlayCreateControlPointsCallback<E>
  /** 绘制点更新回调，可通过 this 访问 overlay 实例 */
  onDrawPointUpdate?: (this: Overlay<E>, points: Point[], updateIndex: number, point: Point) => void
  /** 控制点更新回调，可通过 this 访问 overlay 实例 */
  onControlPointUpdate?: (this: Overlay<E>, points: Point[], updateIndex: number, point: Point, controlPointKey?: string) => void
  /** 拖动 overlay 主体时的回调，可通过 this 访问 overlay 实例 */
  onBodyDrag?: (this: Overlay<E>, params: OverlayBodyDragParams) => void
}

export type OverlayTemplate<E = DefaultExtendData> = PartialExcept<Omit<OverlayApi<E>, 'id' | 'groupId' | 'paneId' | 'points' | 'currentStep' | 'state'>, 'name'>

/** 外部 API 使用的 Overlay 创建类型，points 使用外部格式 (timestamp + offset + value) */
export type OverlayCreate<E = DefaultExtendData> = Omit<
  PartialExcept<Omit<OverlayApi<E>, 'currentStep' | 'totalStep' | 'state' | 'createFigures' | 'createXAxisFigures' | 'createYAxisFigures' | 'createControlPoints' | 'onBodyDrag' | 'onControlPointUpdate' | 'onDrawPointUpdate'>, 'name'>,
  'points'
> & {
  /** 外部格式的点数据 (timestamp + offset + value) */
  points?: Point[]
}

export interface OverlayFilter {
  id?: string
  groupId?: string
  name?: string
  paneId?: string
}

export type OverlayProps = Omit<OverlayCreate, keyof OverlayFilter>

// Runtime allowlist: spreading an instance must not update template methods or
// import private/cache/service fields into the time-point model.
const EDITABLE_OVERLAY_FIELDS = [
  'zLevel', 'lock', 'visible', 'mode', 'modeSensitivity', 'controlPointVisibility',
  'needDefaultPointFigure', 'needDefaultXAxisFigure', 'needDefaultYAxisFigure', 'extendData',
  'onCreated', 'onRemoved', 'onDrawStart', 'onDrawing', 'onDrawEnd', 'onClick',
  'onDoubleClick', 'onRightClick', 'onPressedMoveStart', 'onPressedMoving', 'onPressedMoveEnd',
  'onMouseEnter', 'onMouseLeave', 'onSelected', 'onDeselected', 'onPointsChange'
] as const satisfies ReadonlyArray<keyof OverlayProps>

function pickEditableProperties(overlay: Partial<Record<typeof EDITABLE_OVERLAY_FIELDS[number], unknown>>): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  for (const key of EDITABLE_OVERLAY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(overlay, key)) properties[key] = overlay[key]
  }
  return properties
}

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
  points?: Point[]
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
  points: Point[] = []

  name: string = ''
  totalStep: number = 999 // 默认无限制步骤数(适用于anywave)
  lock: boolean = false
  visible: boolean = true
  zLevel?: number
  mode: OverlayMode = 'normal'
  modeSensitivity: number = 8
  controlPointVisibility: OverlayControlPointVisibility = 'auto'
  extendData: E = undefined as E
  styles?: DeepPartial<OverlayStyle>

  needDefaultPointFigure: boolean = false
  needDefaultXAxisFigure: boolean = false
  needDefaultYAxisFigure: boolean = false

  createFigures?: OverlayCreateFiguresCallback<E>
  createXAxisFigures?: OverlayCreateFiguresCallback<E>
  createYAxisFigures?: OverlayCreateFiguresCallback<E>
  createControlPoints?: OverlayCreateControlPointsCallback<E>

  onDrawPointUpdate?: (this: Overlay<E>, points: Point[], updateIndex: number, point: Point) => void
  onControlPointUpdate?: (this: Overlay<E>, points: Point[], updateIndex: number, point: Point, controlPointKey?: string) => void
  onBodyDrag?: (this: Overlay<E>, params: OverlayBodyDragParams) => void

  // Event callbacks
  onPointsChange?: (event: OverlayPointsChangeEvent<E>) => void
  onCreated?: (this: Overlay<E>) => void
  onRemoved?: () => void

  onDrawStart?: OverlayEventCallback<E>
  onDrawing?: OverlayEventCallback<E>
  onDrawEnd?: OverlayEventCallback<E>

  onClick?: OverlayEventCallback<E>
  onDoubleClick?: OverlayEventCallback<E>
  onRightClick?: OverlayEventCallback<E>
  onPressedMoveStart?: OverlayEventCallback<E>
  onPressedMoving?: OverlayEventCallback<E>
  onPressedMoveEnd?: OverlayEventCallback<E>
  onMouseEnter?: OverlayEventCallback<E>
  onMouseLeave?: OverlayEventCallback<E>
  onSelected?: OverlayEventCallback<E>
  onDeselected?: OverlayEventCallback<E>

  constructor(
    template: OverlayTemplate<E>,
    { id, groupId, paneId, zLevel, points, ...rest }: OverlayInitOption
  ) {
    if (points?.some(point => !isValidPointOffset(point))) {
      throw new RangeError('Overlay point offset must be an integer.')
    }
    Object.assign(this, template)
    this.styles = clone(this.styles)

    this.id = id
    this.groupId = groupId
    this.paneId = paneId
    if (isValid(zLevel)) {
      this.zLevel = zLevel
    }

    if (points && points.length > 0) {
      this._applyPoints(points)
    }

    const { styles, ...otherRest } = rest
    Object.assign(this, pickEditableProperties(otherRest))
    if (isValid(styles)) {
      this.styles ??= {}
      merge(this.styles, styles)
    }

  }

  getControlPoints(coordinates: Coordinate[]): OverlayControlPoint[] {
    return this.createControlPoints?.({ overlay: this, coordinates }) ?? coordinates.map((coordinate, index) => ({
      key: `${OVERLAY_FIGURE_KEY_PREFIX}point_${index}`,
      coordinate
    }))
  }

  update(overlay: Partial<OverlayCreate<E>>): void {
    if (overlay.points?.some(point => !isValidPointOffset(point))) {
      logWarn('Overlay.update', 'points.offset', 'offset must be an integer.')
      return
    }
    const { groupId, points, styles } = overlay
    merge(this, pickEditableProperties(overlay))

    // groupId 可以修改（用于重新分组）
    if (isValid(groupId)) {
      this.groupId = groupId
    }

    if (isValid(styles)) {
      // 对于 figures，直接覆盖而不是合并，方便 reset
      if (styles.figures !== undefined) {
        const { figures: newFigures, ...otherStyles } = styles
        this.styles ??= {}
        merge(this.styles, otherStyles)
        this.styles.figures = newFigures
      } else {
        this.styles ??= {}
        merge(this.styles, styles)
      }
    }

    if (points) {
      if (this.isDrawing()) {
        this._applyCommittedPoints(points)
      } else {
        this._applyPoints(points)
      }
    }
  }

  private _applyCommittedPoints(points: Point[]) {
    const committedCount = this.currentStep
    const drawingPoint = this.points[committedCount]

    const committedPoints = points.slice(0, committedCount).map(copyPoint)
    this.points = [...committedPoints]

    if (isValid(drawingPoint)) {
      this.points[committedCount] = drawingPoint
    }

    for (let i = 0; i < committedCount; i++) {
      this.onDrawPointUpdate?.(this.points, i, this.points[i])
    }
  }

  private _applyPoints(points: Point[]) {
    const _points = points.slice(0, this.totalStep).map(copyPoint)

    this.currentStep = _points.length

    if (this.currentStep === 0) {
      this.state = OverlayState.CREATED
    } else if (this.currentStep >= this.totalStep) {
      // 达到或超过 totalStep
      this.state = OverlayState.COMPLETED
    } else if (this.totalStep >= 999) {
      // 无限步骤图形（如任意浪）：有点就认为是完成状态
      this.state = OverlayState.COMPLETED
    } else {
      this.state = OverlayState.DRAWING
    }

    this.points = _points
    for (let i = 0; i < this.currentStep; i++) {
      this.onDrawPointUpdate?.(this.points, i, this.points[i])
    }
  }

  shouldUpdate(nextProps: Partial<OverlayProps>): ChangeInfo {
    const changes: string[] = []
    for (const key of [...EDITABLE_OVERLAY_FIELDS, 'points', 'styles'] as const) {
      if (isValid(nextProps[key]) && nextProps[key] !== this[key]) changes.push(key)
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

  /**
   * 重置到初始状态（CREATED）
   * 用于正在绘制时取消/删除操作，使 overlay 回到最初状态
   */
  reset(): void {
    this.currentStep = 0
    this.points = []
    this.state = OverlayState.CREATED
  }

  /**
   * 智能完成：根据图形特性决定是否允许提前完成
   * - 无限步骤图形（anyWaves等）：任意步骤都可完成
   * - 固定步骤图形：只有达到 totalStep 才能完成，保证图形完整性
   */
  smartComplete(): boolean {
    // 对于无限步骤的图形（totalStep >= 999），允许任意步骤完成
    if (this.totalStep >= 999) {
      this.forceComplete()
      return true
    }

    // 对于固定步骤的图形，必须完成所有步骤才能完成
    // 这确保了图形的完整性和用户期望的一致性
    if (this.currentStep >= this.totalStep) {
      this.forceComplete()
      return true
    }

    return false
  }

  updateDrawPoint(point: Point): void {
    if (!isValidPointOffset(point)) {
      logWarn('Overlay.updateDrawPoint', 'point.offset', 'offset must be an integer.')
      return
    }
    const nextPoint = copyPoint(point)
    if (this.onDrawPointUpdate) {
      this.onDrawPointUpdate(this.points, this.currentStep, nextPoint)
      return
    }
    this.points[this.currentStep] = nextPoint
  }

  onDragMoveControlPoint(point: Point, pointIndex: number, controlPointKey?: string): void {
    if (!isValidPointOffset(point)) {
      logWarn('Overlay.onDragMoveControlPoint', 'point.offset', 'offset must be an integer.')
      return
    }
    const nextPoint = copyPoint(point)
    if (this.onControlPointUpdate) {
      this.onControlPointUpdate(this.points, pointIndex, nextPoint, controlPointKey)
    } else if (this.points[pointIndex]) {
      this.points[pointIndex] = nextPoint
    }
  }

  /** Apply an interaction's proposed time points without querying chart data. */
  onDragMoveBody(params: OverlayBodyDragParams): void {
    if (params.movedPoints.some(point => !isValidPointOffset(point))) {
      logWarn('Overlay.onDragMoveBody', 'movedPoints.offset', 'offset must be an integer.')
      return
    }
    const movedPoints = params.movedPoints.map(copyPoint)
    if (this.onBodyDrag) {
      this.onBodyDrag({
        point: { ...params.point },
        prevPoint: { ...params.prevPoint },
        prevPoints: params.prevPoints.map(copyPoint),
        movedPoints
      })
    } else {
      this.points = movedPoints
    }
  }
}
