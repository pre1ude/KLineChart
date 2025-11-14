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

import { type EventName, type MouseTouchEvent, type MouseTouchEventCallback } from './SyntheticEvent'

export default abstract class Eventful {
  private readonly _children: Eventful[] = []

  private readonly _callbacks = new Map<EventName, MouseTouchEventCallback>()

  registerEvent (name: EventName, callback: MouseTouchEventCallback): this {
    this._callbacks.set(name, callback)
    return this
  }

  onEvent (name: EventName, event: MouseTouchEvent, other?: number): boolean {
    const callback = this._callbacks.get(name)
    if (callback != null && this.checkEventOn(event)) {
      if (event.path == null) {
        event.path = []
      }
      event.path.push(this)
      return callback(event, other)
    }
    return false
  }

  checkEventOn (event: MouseTouchEvent): boolean {
    for (let i = this._children.length - 1; i >= 0; i--) {
      if (this._children[i].checkEventOn(event)) {
        if (event.path == null) {
          event.path = []
        }
        event.path.push(this._children[i])
        return true
      }
    }
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
