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

import type Nullable from '../common/Nullable'
import { type EventHandler, type EventName } from '../common/SyntheticEvent'
import Eventful from '../common/Eventful'
import { isValid } from '../common/utils/typeChecks'
import type Figure from '../component/Figure'
import { type FigureCreate } from '../component/Figure'
import { getInnerFigureClass } from '../extension/figure/index'
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

  protected createFigure (figure: FigureCreate, eventHandler?: EventHandler): Nullable<Figure> {
    const FigureClazz = getInnerFigureClass(figure.name)
    if (FigureClazz !== null) {
      const instance = new FigureClazz(figure)
      if (isValid(eventHandler)) {
        for (const key in eventHandler) {
          // eslint-disable-next-line no-prototype-builtins
          if (eventHandler.hasOwnProperty(key)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            instance.registerEvent(key as EventName, eventHandler[key])
          }
        }
        this.addChild(instance)
      }
      return instance
    }
    return null
  }

  draw (ctx: CanvasRenderingContext2D): void {
    this.clear()
    this.drawImp(ctx)
  }

  protected abstract drawImp (ctx: CanvasRenderingContext2D): void
}
