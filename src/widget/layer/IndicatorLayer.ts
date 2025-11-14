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

import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import IndicatorView from '../../view/IndicatorView'

/**
 * 指标图层
 * 负责绘制所有指标
 */
export class IndicatorLayer implements Layer {
  readonly name = 'indicator'
  private _indicatorView?: IndicatorView

  init = (widget: DrawWidget<DualYPane>): void => {
    this._indicatorView = new IndicatorView(widget)
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    this._indicatorView?.draw(ctx)
  }

  destroy = (): void => {
    this._indicatorView = undefined
  }
}
