
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'

export interface Layer {
  readonly name: string

  /**
   * 绘制主内容（在 main canvas 上）
   */
  drawMain?: (ctx: CanvasRenderingContext2D) => void

  /**
   * 绘制覆盖层内容（在 overlay canvas 上）
   */
  drawOverlay?: (ctx: CanvasRenderingContext2D) => void

  /**
   * Draw overlay content that is not present in the live Canvas composition.
   */
  drawOverlayForExport?: (ctx: CanvasRenderingContext2D) => void

  isTooltipIconHovered?: () => boolean

  destroy?: () => void
}

export interface LayerClass {
  new (widget: DrawWidget<DualYPane>): Layer
}
