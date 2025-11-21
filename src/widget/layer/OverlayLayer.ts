
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
