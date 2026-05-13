import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import CandleHighLowPriceView from '../../view/CandleHighLowPriceView'

export class CandleHighLowPriceLayer implements Layer {
  readonly name = 'candleHighLowPrice'

  private readonly _candleHighLowPriceView: CandleHighLowPriceView

  constructor(widget: DrawWidget<DualYPane>) {
    this._candleHighLowPriceView = new CandleHighLowPriceView(widget)
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    this._candleHighLowPriceView.draw(ctx)
  }
}
