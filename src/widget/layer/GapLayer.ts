import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import GapView from '../../view/GapView'
import type { Layer } from './Layer'

export class GapLayer implements Layer {
  readonly name = 'gap'
  private readonly _gapView: GapView

  constructor(widget: DrawWidget<DualYPane>) {
    this._gapView = new GapView(widget)
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    this._gapView.draw(ctx)
  }
}
