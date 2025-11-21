
import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import CrosshairLineView from '../../view/CrosshairLineView'

/**
 * 十字线图层
 * 负责绘制十字线
 */
export class CrosshairLayer implements Layer {
  readonly name = 'crosshair'
  private _crosshairLineView?: CrosshairLineView

  init = (widget: DrawWidget<DualYPane>): void => {
    this._crosshairLineView = new CrosshairLineView(widget)
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._crosshairLineView?.draw(ctx)
  }

  destroy = (): void => {
    this._crosshairLineView = undefined
  }
}
