import type DeepPartial from '../common/DeepPartial'
import type PartialExcept from '../common/PartialExcept'
import type { IPoint, Point } from '../common/Point'
import type Coordinate from '../common/Coordinate'
import type Bounding from '../common/Bounding'
import type BarSpace from '../common/BarSpace'
import type Precision from '../common/Precision'
import { type OverlayStyle } from '../common/Styles'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { isNumber, isValid, merge } from '../common/utils/typeChecks'
import { type XAxis } from './XAxis'
import { type YAxis } from './YAxis'

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
   * 将内部 dataIndex 转换为外部 timestamp + offset
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

export enum OverlayState {
  CREATED = 'created',
  DRAWING = 'drawing',
  COMPLETED = 'completed'
}

export type FigureEventType = 'mouseClickEvent' | 'mouseDoubleClickEvent' | 'mouseRightClickEvent' | 'tapEvent' | 'doubleTapEvent' | 'mouseDownEvent' | 'touchStartEvent' | 'mouseMoveEvent' | 'touchMoveEvent'

export interface OverlayFigure {
  key?: string
  type: string
  attrs: object | object[]
  styles?: object
  ignoreEvent?: boolean | FigureEventType[]
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
  dateTimeFormat: Intl.DateTimeFormat
  defaultStyles: OverlayStyle
  xAxis?: XAxis
  yAxis?: YAxis
  isAlignLeft?: boolean
}

/** Overlay 绘制事件回调 */
export type OverlayDrawEventCallback<E = DefaultExtendData> = (event: OverlayMouseTouchEvent<E>) => void

/** Overlay 交互事件回调 */
export type OverlayEventCallback<E = DefaultExtendData> = (event: OverlayMouseTouchEvent<E>) => void

export type OverlayCreateFiguresCallback<E = DefaultExtendData> = (params: OverlayCreateFiguresCallbackParams<E>) => OverlayFigure | OverlayFigure[]

export interface OverlayEventHandlers<E = DefaultExtendData> {
  /** 当 overlay 实例被创建完毕时触发，不论是否已经绘制完成 */
  onCreated?: (this: Overlay<E>) => void
  onRemoved?: () => void

  /** 开始绘制（第一个点） */
  onDrawStart?: OverlayDrawEventCallback<E>
  /** 绘制中（每次添加点） */
  onDrawing?: OverlayDrawEventCallback<E>
  /** 绘制完成（最后一个点） */
  onDrawEnd?: OverlayDrawEventCallback<E>

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
  zLevel: number
  needDefaultPointFigure: boolean
  needDefaultXAxisFigure: boolean
  needDefaultYAxisFigure: boolean
  mode: OverlayMode
  modeSensitivity: number
  points: IPoint[]
  extendData: E
  styles?: DeepPartial<OverlayStyle>
  createFigures?: OverlayCreateFiguresCallback<E>
  createXAxisFigures?: OverlayCreateFiguresCallback<E>
  createYAxisFigures?: OverlayCreateFiguresCallback<E>
  /** 绘制点更新回调，可通过 this 访问 overlay 实例 */
  onDrawPointUpdate?: (this: Overlay<E>, points: IPoint[], updateIndex: number, point: IPoint) => void
  /** 控制点更新回调，可通过 this 访问 overlay 实例 */
  onControlPointUpdate?: (this: Overlay<E>, points: IPoint[], updateIndex: number, point: IPoint) => void
  /** 拖动 overlay 主体时的回调，可通过 this 访问 overlay 实例 */
  onBodyDrag?: (this: Overlay<E>, params: {
    point: IPoint
    prevPoint: IPoint
    prevPoints: IPoint[]
  }) => void
}

export type OverlayTemplate<E = DefaultExtendData> = PartialExcept<Omit<OverlayApi<E>, 'id' | 'groupId' | 'paneId' | 'points' | 'currentStep' | 'state'>, 'name'>

/** 外部 API 使用的 Overlay 创建类型，points 使用外部格式 (timestamp + offset + value) */
export type OverlayCreate<E = DefaultExtendData> = Omit<
  PartialExcept<Omit<OverlayApi<E>, 'currentStep' | 'totalStep' | 'state' | 'createFigures' | 'createXAxisFigures' | 'createYAxisFigures' | 'onBodyDrag' | 'onControlPointUpdate' | 'onDrawPointUpdate'>, 'name'>,
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

/** 内部使用的 Props 类型，points 使用内部格式 (dataIndex + value) */
export type InternalOverlayProps = Omit<OverlayProps, 'points'> & { points?: IPoint[] }

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
  points?: IPoint[]
  rawPoints?: Point[]
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
  points: IPoint[] = []
  rawPoints?: Point[]

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

  onDrawPointUpdate?: (this: Overlay<E>, points: IPoint[], updateIndex: number, point: IPoint) => void
  onControlPointUpdate?: (this: Overlay<E>, points: IPoint[], updateIndex: number, point: IPoint) => void
  onBodyDrag?: (this: Overlay<E>, params: {
    point: IPoint
    prevPoint: IPoint
    prevPoints: IPoint[]
  }) => void

  // Event callbacks
  onCreated?: (this: Overlay<E>) => void
  onRemoved?: () => void

  onDrawStart?: OverlayDrawEventCallback<E>
  onDrawing?: OverlayDrawEventCallback<E>
  onDrawEnd?: OverlayDrawEventCallback<E>

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

  private _skipDraw: boolean = false
  private _originalZLevel: number = 0
  private _prevPressedPoint?: IPoint
  private _prevPressedPoints: IPoint[] = []

  constructor(template: OverlayTemplate<E>, { id, groupId, paneId, zLevel, points, rawPoints, ...rest }: OverlayInitOption) {
    Object.assign(this, template)

    this.id = id
    this.groupId = groupId
    this.paneId = paneId
    if (isValid(zLevel)) {
      this.zLevel = zLevel
    }

    // 保存原始点数据
    if (rawPoints && rawPoints.length > 0) {
      this.rawPoints = rawPoints
    }

    // 应用内部格式的点
    if (points && points.length > 0) {
      this._applyPoints(points)
    } else if (rawPoints && rawPoints.length > 0) {
      // 有 rawPoints 但没有 points（转换失败），根据 rawPoints 设置状态
      this._applyStateFromRawPoints(rawPoints.length)
    }

    Object.assign(this, rest)

    this.onCreated?.()
  }

  getSkipDraw(): boolean {
    return this._skipDraw
  }

  setSkipDraw(skip: boolean): void {
    this._skipDraw = skip
  }

  updateInternalPoints(points: IPoint[]): void {
    this.points = points
    this._skipDraw = false
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

  private _applyCommittedPoints(points: IPoint[]) {
    const committedCount = this.currentStep
    const drawingPoint = this.points[committedCount]

    const committedPoints = points.slice(0, committedCount)
    this.points = [...committedPoints]

    if (isValid(drawingPoint)) {
      this.points[committedCount] = drawingPoint
    }

    for (let i = 0; i < committedCount; i++) {
      this.onDrawPointUpdate?.(this.points, i, this.points[i])
    }
  }

  private _applyPoints(points: IPoint[]) {
    const _points = points.length > this.totalStep ? points.slice(0, this.totalStep) : points

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

  /**
   * 根据 rawPoints 数量设置状态（用于转换失败时）
   * 不设置 points，只设置 state 和 currentStep
   */
  private _applyStateFromRawPoints(rawPointsCount: number) {
    const count = Math.min(rawPointsCount, this.totalStep)
    this.currentStep = count

    if (count === 0) {
      this.state = OverlayState.CREATED
    } else if (count >= this.totalStep || this.totalStep >= 999) {
      this.state = OverlayState.COMPLETED
    } else {
      this.state = OverlayState.DRAWING
    }
  }

  shouldUpdate(nextProps: Partial<InternalOverlayProps>): ChangeInfo {
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

    if (nextProps.styles !== this.styles) {
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

  updateDrawPoint(point: IPoint): void {
    if (this.onDrawPointUpdate) {
      this.onDrawPointUpdate(this.points, this.currentStep, point)
      return
    }
    this._updatePoint(this.points[this.currentStep] ??= ({} as unknown as IPoint), point)
  }

  onDragMoveControlPoint(point: IPoint, pointIndex: number): void {
    if (this.onControlPointUpdate) {
      this.onControlPointUpdate(this.points, pointIndex, point)
      return
    }
    this._updatePoint(this.points[pointIndex], point)
  }

  private _updatePoint(p: IPoint, np: IPoint) {
    p.dataIndex = np.dataIndex
    p.value = np.value
  }

  startPressedMove(point: IPoint): void {
    this._prevPressedPoint = { ...point }
    this._prevPressedPoints = this.points.map(p => ({ ...p }))
  }

  onDragMoveBody(point: IPoint): void {
    if (!this._prevPressedPoint) return

    if (this.onBodyDrag) {
      this.onBodyDrag({
        point,
        prevPoint: this._prevPressedPoint,
        prevPoints: this._prevPressedPoints
      })
      return
    }

    // 内部使用 dataIndex，计算简单直接
    const difDataIndex = isNumber(point.dataIndex) && isNumber(this._prevPressedPoint.dataIndex)
      ? point.dataIndex - this._prevPressedPoint.dataIndex
      : 0

    const difValue = isNumber(point.value) && isNumber(this._prevPressedPoint.value)
      ? point.value - this._prevPressedPoint.value
      : 0

    this.points = this._prevPressedPoints.map((p) => ({
      dataIndex: p.dataIndex + difDataIndex,
      value: p.value + difValue
    }))
  }
}
