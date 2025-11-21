
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
