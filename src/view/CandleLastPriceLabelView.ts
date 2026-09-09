import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { isNumber, isValid } from '../common/utils/typeChecks'
import { drawStaticFigure } from '../extension/figure'
import type YAxisWidget from '../widget/YAxisWidget'
import { calculateYAxisLabelLayout, calcYAxisLabelHeight, clampYAxisLabelY } from './utils/labelPosition'
import View from './View'

export default class CandleLastPriceLabelView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget() as unknown as YAxisWidget
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const priceMarkStyles = chartStore.getStyles().candle.priceMark
    const lastPriceMarkStyles = priceMarkStyles.last
    const lastPriceMarkTextStyles = { ...lastPriceMarkStyles.text }

    if (priceMarkStyles.show && lastPriceMarkStyles.show && lastPriceMarkTextStyles.show) {
      const precision = chartStore.getPrecision()
      const dataList = chartStore.getDataList()
      const data = dataList[dataList.length - 1]

      if (isValid(data) && isNumber(data.close) && isNumber(data.open)) {
        const { close, open } = data
        const yScale = widget.getScaleComponent()
        const y0 = yScale.convertToPixel(close)
        if (y0 < 0 || y0 > bounding.height) {
          return
        }
        const y = clampYAxisLabelY(y0, bounding.height, calcYAxisLabelHeight(lastPriceMarkTextStyles))

        let backgroundColor: string
        if (close > open) {
          backgroundColor = lastPriceMarkStyles.upColor
        } else if (close < open) {
          backgroundColor = lastPriceMarkStyles.downColor
        } else {
          backgroundColor = lastPriceMarkStyles.noChangeColor
        }

        const formatter = widget.getScale().getOptions().formatter
        let text: string

        text = formatter?.(close) ?? formatPrecision(close, precision.price)

        if (!formatter) {
          text = formatFoldDecimal(formatThousands(text, chartStore.getThousandsSeparator()), chartStore.getDecimalFoldThreshold())
        }
        text = widget.formatLabel(close, text)

        const isAlignLeft = widget.isAlignLeft()
        const yAxisStyles = chartStore.getStyles().yAxis
        const layout = calculateYAxisLabelLayout(bounding, yAxisStyles, lastPriceMarkTextStyles, isAlignLeft)
        lastPriceMarkTextStyles.paddingLeft = layout.paddingLeft
        lastPriceMarkTextStyles.paddingRight = layout.paddingRight

        drawStaticFigure(ctx, 'text', {
          attrs: {
            x: layout.x,
            y,
            text,
            align: layout.align,
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
