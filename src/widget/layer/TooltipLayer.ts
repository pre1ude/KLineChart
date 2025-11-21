

import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import IndicatorTooltipView from '../../view/IndicatorTooltipView'
import CandleTooltipView from '../../view/CandleTooltipView'

/**
 * 提示信息图层
 * 负责显示提示信息（Tooltip）
 */
export class TooltipLayer implements Layer {
  readonly name = 'tooltip'
  private _tooltipView?: IndicatorTooltipView | CandleTooltipView

  constructor (private readonly _type: 'candle' | 'indicator' = 'indicator') {}

  init = (widget: DrawWidget<DualYPane>): void => {
    if (this._type === 'candle') {
      this._tooltipView = new CandleTooltipView(widget)
    } else {
      this._tooltipView = new IndicatorTooltipView(widget)
    }
    // TooltipView 需要添加到 widget 的 children 中以接收事件
    widget.addChild(this._tooltipView)
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._tooltipView?.draw(ctx)
  }

  destroy = (): void => {
    this._tooltipView = undefined
  }
}
