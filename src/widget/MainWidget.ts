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

import type DualYPane from '../pane/DualYPane'
import { WidgetNameConstants } from './types'
import DrawWidget from './DrawWidget'
import type { Layer } from './layer/Layer'

/**
 * 主 Widget - 使用 Layer 组合模式
 *
 * 通过组合不同的 Layer 来构建功能完整的 Widget
 * 替代了之前的 IndicatorWidget 和 CandleWidget 的继承关系
 */
export default class MainWidget extends DrawWidget<DualYPane> {
  private readonly _layers: Layer[] = []

  constructor (
    rootContainer: HTMLElement,
    pane: DualYPane,
    layers: Layer[]
  ) {
    super(rootContainer, pane)
    this._layers = layers

    // 初始化所有 layers
    this._layers.forEach(layer => {
      layer.init?.(this)
    })

    // 设置通用样式和事件
    this.getContainer().style.cursor = 'crosshair'
    this.addEventListener('mouseMoveEvent', () => {
      pane.getChart().getChartStore().getTooltipStore().setActiveIcon()
      return false
    })
  }

  getName (): string {
    return WidgetNameConstants.MAIN
  }

  protected updateMain (ctx: CanvasRenderingContext2D): void {
    // 按顺序绘制所有 main layers
    this._layers.forEach(layer => {
      layer.drawMain?.(ctx)
    })
  }

  protected updateOverlay (ctx: CanvasRenderingContext2D): void {
    // 按顺序绘制所有 overlay layers
    this._layers.forEach(layer => {
      layer.drawOverlay?.(ctx)
    })
  }

  override destroy (): void {
    // 清理所有 layers
    this._layers.forEach(layer => {
      layer.destroy?.()
    })
    super.destroy()
  }
}
