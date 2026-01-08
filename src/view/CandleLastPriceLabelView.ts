
import { YAxisType } from '../common/Styles'
import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import { isValid, isNumber } from '../common/utils/typeChecks'
import View from './View'
import type YAxisWidget from '../widget/YAxisWidget'
import { drawStaticFigure } from '../extension/figure'
import { clamp } from '@/common/utils/number'

export default class CandleLastPriceLabelView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget() as unknown as YAxisWidget
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const priceMarkStyles = chartStore.getStyles().candle.priceMark
    const lastPriceMarkStyles = priceMarkStyles.last
    const lastPriceMarkTextStyles = lastPriceMarkStyles.text

    if (priceMarkStyles.show && lastPriceMarkStyles.show && lastPriceMarkTextStyles.show) {
      const precision = chartStore.getPrecision()
      const yAxis = widget.getAxisComponent()
      const dataList = chartStore.getDataList()
      const data = dataList[dataList.length - 1]

      if (isValid(data) && isNumber(data.close) && isNumber(data.open)) {
        const { close, open } = data
        const y0 = yAxis.convertToPixel(close)
        const y = clamp(y0, 10, bounding.height - 10)

        let backgroundColor: string
        if (close > open) {
          backgroundColor = lastPriceMarkStyles.upColor
        } else if (close < open) {
          backgroundColor = lastPriceMarkStyles.downColor
        } else {
          backgroundColor = lastPriceMarkStyles.noChangeColor
        }

        let text: string
        const axisType = widget.getAxisType()

        if (axisType === YAxisType.MinutePercentage) {
          const basisPrice = chartStore.getMinutePercentageBasis()
          if (basisPrice > 0) {
            text = `${((close - basisPrice) / basisPrice * 100).toFixed(2)}%`
          } else {
            text = '0.00%'
          }
        } else if (axisType === YAxisType.Percentage) {
          const fromData = chartStore.getVisibleFirstData()
          if (isValid(fromData) && isNumber(fromData.close)) {
            text = `${((close - fromData.close) / fromData.close * 100).toFixed(2)}%`
          } else {
            text = '0.00%'
          }
        } else {
          text = formatPrecision(close, precision.price)
        }

        text = formatFoldDecimal(formatThousands(text, chartStore.getThousandsSeparator()), chartStore.getDecimalFoldThreshold())

        const isAlignLeft = widget.isAlignLeft()
        const align = isAlignLeft ? 'left' : 'right'
        drawStaticFigure(ctx, 'text', {
          attrs: {
            x: bounding.width * (1 - +isAlignLeft),
            y,
            text,
            align,
            baseline: 'middle'
          },
          styles: {
            ...lastPriceMarkTextStyles,
            backgroundColor
          }
        })
      }
    }
  }
}
