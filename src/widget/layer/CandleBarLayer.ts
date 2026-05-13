import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import CandleBarView from '../../view/CandleBarView'
import { ActionType } from '../../common/Action'
import { PaneIdConstants } from '../../pane/types'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'

export class CandleBarLayer implements Layer {
  readonly name = 'candleBar'

  private readonly _widget: DrawWidget<DualYPane>
  private readonly _candleBarView: CandleBarView

  constructor(widget: DrawWidget<DualYPane>) {
    this._widget = widget
    this._candleBarView = new CandleBarView(widget)

    this._initEvent()
    widget.addChild(this._candleBarView)
  }

  private _initEvent(): void {
    const pane = this._widget.getPane()
    if (pane.getId() !== PaneIdConstants.CANDLE) {
      return
    }

    this._candleBarView.addEventListener('mouseClickEvent', (e: MouseTouchEvent) => {
      const chart = pane.getChart()
      const dataIndex = chart.coordinateToDataIndex(e.x)
      const data = chart.getDataByDataIndex(dataIndex)
      chart.getChartStore().getActionStore().execute(ActionType.OnCandleBarClick, { ...e, data, dataIndex })
    })

    this._candleBarView.addEventListener('contextMenuEvent', (e: MouseTouchEvent) => {
      const chart = pane.getChart()
      const dataIndex = chart.coordinateToDataIndex(e.x)
      const data = chart.getDataByDataIndex(dataIndex)
      chart.getChartStore().getActionStore().execute(ActionType.OnCandleBarRightClick, { ...e, data, dataIndex })
    })
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    this._candleBarView.draw(ctx)
  }
}
