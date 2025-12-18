import Action, { type ActionType, type ActionCallback, type ActionCallbackParams } from '../common/Action'
import { isValid } from '../common/utils/typeChecks'

export default class ActionStore {
  private readonly _actions = new Map<ActionType, Action<unknown>>()

  execute<T extends ActionType>(type: T, data: ActionCallbackParams[T]): void {
    this._actions.get(type)?.execute(data)
  }

  subscribe<T extends ActionType>(type: T, callback: ActionCallback<ActionCallbackParams[T]>): void {
    if (!this._actions.has(type)) {
      this._actions.set(type, new Action<ActionCallbackParams[T]>() as Action<unknown>)
    }
    (this._actions.get(type) as Action<ActionCallbackParams[T]>).subscribe(callback)
  }

  unsubscribe<T extends ActionType>(type: T, callback?: ActionCallback<ActionCallbackParams[T]>): void {
    const action = this._actions.get(type) as Action<ActionCallbackParams[T]> | undefined
    if (isValid(action)) {
      action.unsubscribe(callback)
      if (action.isEmpty()) {
        this._actions.delete(type)
      }
    }
  }

  has(type: ActionType): boolean {
    const action = this._actions.get(type)
    return isValid(action) && !action.isEmpty()
  }
}
