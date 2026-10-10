import Action, { type ActionType, type ActionCallback, type ActionCallbackParams } from '../common/Action'
import { isValid } from '../common/utils/typeChecks'

export default class ActionStore {
  private readonly _actions = new Map<ActionType, Action<unknown>>()
  private readonly _notifications = new Map<ActionType, object>()

  constructor(private readonly _dispatch?: (effect: () => void, key: unknown) => void, private readonly _getRevision?: () => number) {}

  execute<T extends ActionType>(type: T, data: ActionCallbackParams[T]): void {
    const revision = this._getRevision?.()
    const notification = {}
    this._notifications.set(type, notification)
    const effect = (): void => { this._actions.get(type)?.execute(data, () => revision === this._getRevision?.() && this._notifications.get(type) === notification) }
    if (this._dispatch) this._dispatch(effect, type)
    else effect()
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
        this._notifications.delete(type)
      }
    }
  }

  has(type: ActionType): boolean {
    const action = this._actions.get(type)
    return isValid(action) && !action.isEmpty()
  }
}
