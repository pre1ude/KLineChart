import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import { CandleType } from '../../common/Styles'
import CandleLastPriceLineView from '../../view/CandleLastPriceLineView'
import CandleZeroPriceLineView from '../../view/CandleZeroPriceLineView'
import { CandleAreaLayer } from './CandleAreaLayer'
import { CandleBarLayer } from './CandleBarLayer'
import { CandleHighLowPriceLayer } from './CandleHighLowPriceLayer'

/**
 * 主图图层路由
 * 按分时 / K 线模式切换模式专属绘制
 */
export class CandleLayer implements Layer {
  readonly name = 'candle'

  private readonly _widget: DrawWidget<DualYPane>
  private readonly _candleBarLayer: CandleBarLayer
  private readonly _candleAreaLayer: CandleAreaLayer
  private readonly _candleHighLowPriceLayer: CandleHighLowPriceLayer
  private readonly _candleLastPriceLineView: CandleLastPriceLineView
  private readonly _candleZeroPriceLineView: CandleZeroPriceLineView

  constructor(widget: DrawWidget<DualYPane>) {
    this._widget = widget
    this._candleBarLayer = new CandleBarLayer(widget)
    this._candleAreaLayer = new CandleAreaLayer(widget)
    this._candleHighLowPriceLayer = new CandleHighLowPriceLayer(widget)
    this._candleLastPriceLineView = new CandleLastPriceLineView(widget)
    this._candleZeroPriceLineView = new CandleZeroPriceLineView(widget)
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    const chartStore = this._widget.getPane().getChart().getChartStore()
    this._drawSeries(ctx)
    if (chartStore.getIsTimeShare()) {
      this._candleZeroPriceLineView.draw(ctx)
      return
    }
    this._candleLastPriceLineView.draw(ctx)
  }

  private _drawSeries(ctx: CanvasRenderingContext2D): void {
    const candleType = this._widget.getPane().getChart().getStyles().candle.type
    if (candleType === CandleType.Area) {
      this._candleAreaLayer.drawMain(ctx)
      return
    }

    this._candleBarLayer.drawMain(ctx)
    this._candleHighLowPriceLayer.drawMain(ctx)
    this._candleAreaLayer.stopAnimation()
  }
}
