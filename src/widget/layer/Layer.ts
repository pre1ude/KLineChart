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

import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'

/**
 * Layer 接口 - 图层抽象
 *
 * 每个 Layer 负责绘制特定的内容（如网格、指标、蜡烛图等）
 * 通过组合多个 Layer 来构建完整的 Widget
 */
export interface Layer {
  /**
   * 图层名称（用于调试和识别）
   */
  readonly name: string

  /**
   * 初始化图层
   * 在 Widget 创建时调用，用于创建 View 实例、注册事件等
   */
  init?: (widget: DrawWidget<DualYPane>) => void

  /**
   * 绘制主内容（在 main canvas 上）
   */
  drawMain?: (ctx: CanvasRenderingContext2D) => void

  /**
   * 绘制覆盖层内容（在 overlay canvas 上）
   */
  drawOverlay?: (ctx: CanvasRenderingContext2D) => void

  /**
   * 清理资源
   * 在 Widget 销毁时调用
   */
  destroy?: () => void
}
