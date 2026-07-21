import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import GapView from '../../view/GapView'
import Gap1View from '../../view/Gap1View'
import type { Layer } from './Layer'

export class GapLayer implements Layer {
  readonly name = 'gap'
  private readonly _gapView: GapView
  private readonly _gap1View: Gap1View

  constructor(widget: DrawWidget<DualYPane>) {
    this._gapView = new GapView(widget)
    this._gap1View = new Gap1View(widget)
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    this._gapView.draw(ctx)
    this._gap1View.draw(ctx)
  }
}
