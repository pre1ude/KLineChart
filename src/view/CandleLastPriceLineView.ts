

import type DualYPane from '../pane/DualYPane'
import { drawStaticFigure } from '../extension/figure'
import View from './View'

export default class CandleLastPriceView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const priceMarkStyles = chartStore.getStyles().candle.priceMark
    const lastPriceMarkStyles = priceMarkStyles.last
    const lastPriceMarkLineStyles = lastPriceMarkStyles.line
    if (priceMarkStyles.show && lastPriceMarkStyles.show && lastPriceMarkLineStyles.show) {
      const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
      const dataList = chartStore.getDataList()
      const data = dataList[dataList.length - 1]
      if (data != null) {
        const { close, open } = data
        const priceY = yAxis.convertToNicePixel(close)
        let color: string
        if (close > open) {
          color = lastPriceMarkStyles.upColor
        } else if (close < open) {
          color = lastPriceMarkStyles.downColor
        } else {
          color = lastPriceMarkStyles.noChangeColor
        }
        drawStaticFigure(ctx, 'line', {
          attrs: {
            coordinates: [
              { x: 0, y: priceY },
              { x: bounding.width, y: priceY }
            ]
          },
          styles: {
            style: lastPriceMarkLineStyles.style,
            color,
            size: lastPriceMarkLineStyles.size,
            dashedValue: lastPriceMarkLineStyles.dashedValue
          }
        })
      }
    }
  }
}
