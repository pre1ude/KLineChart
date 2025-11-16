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

import { EventPhase, type EventName, type MouseTouchEvent, type MouseTouchEventCallback } from './SyntheticEvent'

export default abstract class Eventful {
  private readonly _children: Eventful[] = []
  private readonly _bubbleCallbacks = new Map<EventName, MouseTouchEventCallback[]>()
  private readonly _captureCallbacks = new Map<EventName, MouseTouchEventCallback[]>()

  addEventListener (name: EventName, callback: MouseTouchEventCallback, useCapture = false): this {
    const callbacks = useCapture ? this._captureCallbacks : this._bubbleCallbacks
    if (!callbacks.has(name)) {
      callbacks.set(name, [])
    }
    callbacks.get(name)!.push(callback)
    return this
  }

  removeEventListener (name: EventName, callback: MouseTouchEventCallback, useCapture = false): this {
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

  dispatchEvent (name: EventName, event: MouseTouchEvent, other?: unknown): boolean {
    return this._dispatchEvent([], name, event, other)
  }

  private _dispatchEvent (path: Eventful[], name: EventName, event: MouseTouchEvent, other?: unknown): boolean {
    path.push(this)

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

    // 叶子节点：检查自己是否命中
    if (this.checkEventOn(event)) {
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

  private triggerCallbacks (
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

  checkEventOn (_event: MouseTouchEvent): boolean {
    return false
  }

  addChild (eventful: Eventful): this {
    this._children.push(eventful)
    return this
  }

  clear (): void {
    this._children.length = 0
  }

  protected getChildren (): Eventful[] {
    return this._children
  }
}
