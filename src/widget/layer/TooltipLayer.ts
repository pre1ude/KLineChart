import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import IndicatorTooltipView from '../../view/IndicatorTooltipView'
import CandleTooltipView from '../../view/CandleTooltipView'

export class IndicatorTooltipLayer implements Layer {
  readonly name = 'indiatorTooltip'
  private _tooltipView: IndicatorTooltipView

  constructor(widget: DrawWidget<DualYPane>) {
    this._tooltipView = new IndicatorTooltipView(widget)
    // TooltipView 需要添加到 widget 的 children 中以接收事件
    widget.addChild(this._tooltipView)
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._tooltipView?.draw(ctx)
  }
}

export class CandleTooltipLayer implements Layer {
  readonly name = 'candleTooltip'
  private _tooltipView: CandleTooltipView

  constructor(widget: DrawWidget<DualYPane>) {
    this._tooltipView = new CandleTooltipView(widget)
    // TooltipView 需要添加到 widget 的 children 中以接收事件
    widget.addChild(this._tooltipView)
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._tooltipView?.draw(ctx)
  }
}
