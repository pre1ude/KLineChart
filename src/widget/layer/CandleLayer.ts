import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import CandleBarView from '../../view/CandleBarView'
import CandleAreaView from '../../view/CandleAreaView'
import CandleHighLowPriceView from '../../view/CandleHighLowPriceView'
import CandleLastPriceLineView from '../../view/CandleLastPriceLineView'
import CandleZeroPriceLineView from '../../view/CandleZeroPriceLineView'
import { CandleType } from '../../common/Styles'
import { ActionType } from '../../common/Action'
import { PaneIdConstants } from '../../pane/types'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import type { Figure } from '../../component/Figure'
import type KLineData from '../../common/KLineData'

/**
 * 蜡烛图图层
 * 负责绘制蜡烛图相关的所有内容
 */
export class CandleLayer implements Layer {
  readonly name = 'candle'
  private _widget: DrawWidget<DualYPane>
  private _candleBarView: CandleBarView
  private _candleAreaView: CandleAreaView
  private _candleHighLowPriceView: CandleHighLowPriceView
  private _candleLastPriceLineView: CandleLastPriceLineView
  private _candleZeroPriceLineView: CandleZeroPriceLineView

  constructor(widget: DrawWidget<DualYPane>) {
    this._widget = widget
    this._candleBarView = new CandleBarView(widget)
    this._candleAreaView = new CandleAreaView(widget)
    this._candleHighLowPriceView = new CandleHighLowPriceView(widget)
    this._candleLastPriceLineView = new CandleLastPriceLineView(widget)
    this._candleZeroPriceLineView = new CandleZeroPriceLineView(widget)

    // 初始化事件处理
    this._initEvent()

    widget.addChild(this._candleBarView)
  }

  private _initEvent(): void {
    const pane = this._widget.getPane()
    if (pane.getId() === PaneIdConstants.CANDLE) {
      this._candleBarView.addEventListener('mouseClickEvent', (e: MouseTouchEvent) => {
        const chartStore = pane.getChart().getChartStore()
        const dataList = chartStore.getDataList()
        const target = e.target

        let data: KLineData | undefined
        if (target != null) {
          const dataIndex = (target as Figure<any, any, number>).data
          if (dataIndex != null) {
            data = dataList[dataIndex]
          }
        }

        if (data == null) {
          console.warn('Candle bar click data should not be null')
        }

        chartStore.getActionStore().execute(ActionType.OnCandleBarClick, data)
        return false
      })
    }
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    if (this._widget == null) return

    const chart = this._widget.getPane().getChart()
    const chartStore = chart.getChartStore()
    const candleStyles = chart.getStyles().candle

    if (candleStyles.type !== CandleType.Area) {
      this._candleBarView.draw(ctx)
      this._candleHighLowPriceView.draw(ctx)
      this._candleAreaView.stopAnimation()
    } else {
      this._candleAreaView.draw(ctx)
    }

    if (chartStore.getIsTimeShare()) {
      this._candleZeroPriceLineView.draw(ctx)
    } else {
      this._candleLastPriceLineView.draw(ctx)
    }
  }
}
