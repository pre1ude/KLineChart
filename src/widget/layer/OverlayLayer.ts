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
import OverlayView from '../../view/OverlayView'

/**
 * 覆盖物图层
 * 负责绘制用户绘制的覆盖物（画线工具等）
 */
export class OverlayLayer implements Layer {
  readonly name = 'overlay'
  private _overlayView?: OverlayView

  init = (widget: DrawWidget<DualYPane>): void => {
    this._overlayView = new OverlayView(widget)
    // OverlayView 需要添加到 widget 的 children 中以接收事件
    widget.addChild(this._overlayView)
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._overlayView?.draw(ctx)
  }

  destroy = (): void => {
    this._overlayView = undefined
  }
}
