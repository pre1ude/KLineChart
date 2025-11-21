

import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import GridView from '../../view/GridView'

/**
 * 网格图层
 * 负责绘制图表的网格线
 */
export class GridLayer implements Layer {
  readonly name = 'grid'
  private _gridView?: GridView

  init = (widget: DrawWidget<DualYPane>): void => {
    this._gridView = new GridView(widget)
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    this._gridView?.draw(ctx)
  }

  destroy = (): void => {
    this._gridView = undefined
  }
}
