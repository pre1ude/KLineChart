
import { EventPhase, type EventName, type MouseTouchEvent, type MouseTouchEventCallback } from './SyntheticEvent'

export default abstract class Eventful {
  private readonly _children: Eventful[] = []
  private readonly _bubbleCallbacks = new Map<EventName, MouseTouchEventCallback[]>()
  private readonly _captureCallbacks = new Map<EventName, MouseTouchEventCallback[]>()

  addEventListener(name: EventName, callback: MouseTouchEventCallback, useCapture = false): this {
    const callbacks = useCapture ? this._captureCallbacks : this._bubbleCallbacks
    let handlers = callbacks.get(name)
    if (handlers == null) {
      handlers = []
      callbacks.set(name, handlers)
    }
    handlers.push(callback)
    return this
  }

  removeEventListener(name: EventName, callback: MouseTouchEventCallback, useCapture = false): this {
    const callbacks = useCapture ? this._captureCallbacks : this._bubbleCallbacks
    const handlers = callbacks.get(name)
    if (handlers) {
      const index = handlers.indexOf(callback)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
    return this
  }

  dispatchEvent(name: EventName, event: MouseTouchEvent, other?: unknown): boolean {
    return this._dispatchEvent([], name, event, other)
  }

  private _dispatchEvent(path: Eventful[], name: EventName, event: MouseTouchEvent, other?: unknown): boolean {
    path.push(this)

    // 检查是否需要遍历子元素（性能优化）
    if (this.shouldCheckChildren(name)) {
      // 递归查找命中的子元素
      for (let i = this._children.length - 1; i >= 0; i--) {
        if (this._children[i]._dispatchEvent(path, name, event, other)) {
          // 子元素命中了，触发冒泡阶段
          if (event.propagationStopped) {
            return true
          }
          event.eventPhase = EventPhase.BUBBLING_PHASE
          event.currentTarget = this
          this.triggerCallbacks(this._bubbleCallbacks, name, event, other)
          return true
        }
      }
    }

    // 叶子节点：检查自己是否命中
    if (this.checkEventOn(event, name, other)) {
      // 设置目标元素
      event.target = this

      // 捕获阶段：从根到目标触发所有捕获回调
      for (let i = 0; i < path.length; i++) {
        if (event.propagationStopped) {
          return true
        }
        const isTarget = path[i] === this
        event.eventPhase = isTarget ? EventPhase.AT_TARGET : EventPhase.CAPTURING_PHASE
        event.currentTarget = path[i]
        this.triggerCallbacks(path[i]._captureCallbacks, name, event, other)
      }

      if (event.propagationStopped) {
        return true
      }
      event.eventPhase = EventPhase.AT_TARGET
      event.currentTarget = this
      this.triggerCallbacks(this._bubbleCallbacks, name, event, other)
      return true
    }

    path.pop()
    return false
  }

  private triggerCallbacks(
    callbacksMap: Map<EventName, MouseTouchEventCallback[]>,
    name: EventName,
    event: MouseTouchEvent,
    other?: unknown
  ): void {
    const callbacks = callbacksMap.get(name)
    if (callbacks && callbacks.length > 0) {
      for (const callback of callbacks) {
        if (event.isImmediate && event.propagationStopped) {
          return
        }
        callback(event, other)
      }
    }
  }

  checkEventOn(_event: MouseTouchEvent, _name: EventName, _other?: unknown): boolean {
    return false
  }

  /**
   * 是否需要遍历子元素来检查事件命中
   * 子类可以覆盖此方法来优化性能，跳过不需要的事件类型
   * 默认返回 true（总是遍历子元素）
   */
  shouldCheckChildren(_name: EventName): boolean {
    return true
  }

  addChild(eventful: Eventful): this {
    this._children.push(eventful)
    return this
  }

  clear(): void {
    this._children.length = 0
  }

  protected getChildren(): Eventful[] {
    return this._children
  }
}
