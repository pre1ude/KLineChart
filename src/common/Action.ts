import { type TooltipIcon } from '../store/TooltipStore'
import type Crosshair from './Crosshair'
import type KLineData from './KLineData'
import { type MouseTouchEvent } from './SyntheticEvent'
import { isFunction } from './utils/typeChecks'

export type ActionCallback<T = unknown> = (data: T) => void

export enum ActionType {
  OnDataReady = 'onDataReady',
  OnZoom = 'onZoom',
  OnScroll = 'onScroll',
  OnVisibleRangeChange = 'onVisibleRangeChange',
  OnTooltipIconClick = 'onTooltipIconClick',
  OnCrosshairChange = 'onCrosshairChange',
  OnCandleBarClick = 'onCandleBarClick',
  OnCandleBarRightClick = 'onCandleBarRightClick',
  OnRightClick = 'onRightClick',
  OnDblClick = 'onDblClick',
  OnPaneDrag = 'onPaneDrag'
}

/** 点击事件数据 */
export interface ClickEventData extends MouseTouchEvent {
  dataIndex: number
  data: KLineData | undefined
}

/** 缩放事件数据 */
export interface ZoomEventData {
  scale: number
}

/** 滚动事件数据 */
export interface ScrollEventData {
  distance: number
}

/** 可见范围变化事件数据 */
export interface VisibleRangeChangeEventData {
  from: number
  to: number
}

/** Tooltip 图标点击事件数据 */
export type TooltipIconClickEventData = TooltipIcon

/** 十字光标变化事件数据 */
export interface CrosshairChangeEventData extends Crosshair {
  indicatorData: Record<string, Record<string, unknown>>
}

/** 窗格拖拽事件数据 */
export interface PaneDragEventData {
  paneId: string
}

/** 各 ActionType 对应的回调参数类型映射 */
export interface ActionCallbackParams {
  [ActionType.OnDataReady]: undefined
  [ActionType.OnZoom]: ZoomEventData
  [ActionType.OnScroll]: ScrollEventData
  [ActionType.OnVisibleRangeChange]: VisibleRangeChangeEventData
  [ActionType.OnTooltipIconClick]: TooltipIconClickEventData
  [ActionType.OnCrosshairChange]: CrosshairChangeEventData
  [ActionType.OnCandleBarClick]: ClickEventData
  [ActionType.OnCandleBarRightClick]: ClickEventData
  [ActionType.OnRightClick]: ClickEventData
  [ActionType.OnDblClick]: ClickEventData
  [ActionType.OnPaneDrag]: PaneDragEventData
}

/**
 * 泛型 Action 类，提供类型安全的事件订阅
 */
export default class Action<T = unknown> {
  private _callbacks: Array<ActionCallback<T>> = []

  subscribe(callback: ActionCallback<T>): void {
    const index = this._callbacks.indexOf(callback)
    if (index < 0) {
      this._callbacks.push(callback)
    }
  }

  unsubscribe(callback?: ActionCallback<T>): void {
    if (isFunction(callback)) {
      const index = this._callbacks.indexOf(callback)
      if (index > -1) {
        this._callbacks.splice(index, 1)
      }
    } else {
      this._callbacks = []
    }
  }

  execute(data: T): void {
    this._callbacks.forEach(callback => {
      callback(data)
    })
  }

  isEmpty(): boolean {
    return this._callbacks.length === 0
  }
}
