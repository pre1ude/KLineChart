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

import { type MouseTouchEventCallback, type EventHandler, type EventName } from '../common/SyntheticEvent'
import Eventful from '../common/Eventful'
import type DrawWidget from '../widget/DrawWidget'
import type Pane from '../pane/Pane'

export default abstract class View extends Eventful {
  /**
   * Parent widget
   */
  private readonly _widget: DrawWidget<Pane>

  constructor (widget: DrawWidget<Pane>) {
    super()
    this._widget = widget
  }

  getWidget (): DrawWidget<Pane> { return this._widget }

  bindFigureEvent (eventful: Eventful, events: EventHandler): void {
    for (const name in events) {
      if (Object.prototype.hasOwnProperty.call(events, name)) {
        eventful.registerEvent(name as EventName, events[name] as MouseTouchEventCallback)
      }
    }
    this.addChild(eventful)
  }

  draw (ctx: CanvasRenderingContext2D): void {
    this.clear()
    this.drawImp(ctx)
  }

  protected abstract drawImp (ctx: CanvasRenderingContext2D): void
}
