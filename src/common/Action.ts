
import { isFunction } from './utils/typeChecks'

export type ActionCallback = (data?: any) => void

export enum ActionType {
  OnDataReady = 'onDataReady',
  OnZoom = 'onZoom',
  OnScroll = 'onScroll',
  OnVisibleRangeChange = 'onVisibleRangeChange',
  OnTooltipIconClick = 'onTooltipIconClick',
  OnCrosshairChange = 'onCrosshairChange',
  OnCandleBarClick = 'onCandleBarClick',
  OnPaneDrag = 'onPaneDrag'
}

export default class Delegate {
  private _callbacks: ActionCallback[] = []

  subscribe(callback: ActionCallback): void {
    const index = this._callbacks.indexOf(callback) ?? -1
    if (index < 0) {
      this._callbacks.push(callback)
    }
  }

  unsubscribe(callback?: ActionCallback): void {
    if (isFunction(callback)) {
      const index = this._callbacks.indexOf(callback) ?? -1
      if (index > -1) {
        this._callbacks.splice(index, 1)
      }
    } else {
      this._callbacks = []
    }
  }

  execute(data?: any): void {
    this._callbacks.forEach(callback => {
      callback(data)
    })
  }

  isEmpty(): boolean {
    return this._callbacks.length === 0
  }
}
