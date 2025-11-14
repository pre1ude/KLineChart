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
import IndicatorTooltipView from '../../view/IndicatorTooltipView'
import CandleTooltipView from '../../view/CandleTooltipView'

/**
 * 提示信息图层
 * 负责显示提示信息（Tooltip）
 */
export class TooltipLayer implements Layer {
  readonly name = 'tooltip'
  private _tooltipView?: IndicatorTooltipView | CandleTooltipView

  constructor (private readonly _type: 'candle' | 'indicator' = 'indicator') {}

  init = (widget: DrawWidget<DualYPane>): void => {
    if (this._type === 'candle') {
      this._tooltipView = new CandleTooltipView(widget)
    } else {
      this._tooltipView = new IndicatorTooltipView(widget)
    }
    // TooltipView 需要添加到 widget 的 children 中以接收事件
    widget.addChild(this._tooltipView)
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._tooltipView?.draw(ctx)
  }

  destroy = (): void => {
    this._tooltipView = undefined
  }
}
