import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import CandleAreaView from '../../view/CandleAreaView'

export class CandleAreaLayer implements Layer {
  readonly name = 'candleArea'

  private readonly _candleAreaView: CandleAreaView

  constructor(widget: DrawWidget<DualYPane>) {
    this._candleAreaView = new CandleAreaView(widget)
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    this._candleAreaView.draw(ctx)
  }

  stopAnimation(): void {
    this._candleAreaView.stopAnimation()
  }
}
