

import Action, { type ActionType, type ActionCallback } from '../common/Action'
import { isValid } from '../common/utils/typeChecks'

export default class ActionStore {
  /**
   * Chart action map
   */
  private readonly _actions = new Map<ActionType, Action>()

  execute (type: ActionType, data?: any): void {
    this._actions.get(type)?.execute(data)
  }

  subscribe (type: ActionType, callback: ActionCallback): void {
    if (!this._actions.has(type)) {
      this._actions.set(type, new Action())
    }
    this._actions.get(type)?.subscribe(callback)
  }

  /**
   * 取消事件订阅
   * @param type
   * @param callback
   * @return {boolean}
   */
  unsubscribe (type: ActionType, callback?: ActionCallback): void {
    const action = this._actions.get(type)
    if (isValid(action)) {
      action.unsubscribe(callback)
      if (action.isEmpty()) {
        this._actions.delete(type)
      }
    }
  }

  has (type: ActionType): boolean {
    const action = this._actions.get(type)
    return isValid(action) && !action.isEmpty()
  }
}
