

import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import { isNumber, isValid } from '../common/utils/typeChecks'
import View from './View'
import type YAxisWidget from '../widget/YAxisWidget'
import { drawStaticFigure } from '../extension/figure'
import { getFigureBaseStyles, getMergedDefaultStyles } from '../component/Indicator'

export default class IndicatorLastValueView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget() as unknown as YAxisWidget
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const customApi = chartStore.getCustomApi()
    const defaultStyles = chartStore.getStyles().indicator
    const lastValueMarkStyles = defaultStyles.lastValueMark
    const lastValueMarkTextStyles = lastValueMarkStyles.text
    if (lastValueMarkStyles.show) {
      const yAxis = widget.getAxisComponent()
      const dataList = chartStore.getDataList()
      const dataIndex = dataList.length - 1
      const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
      const thousandsSeparator = chartStore.getThousandsSeparator()
      const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
      indicators.forEach(indicator => {
        const result = indicator.result
        const indicatorData = result[dataIndex]
        if (isValid(indicatorData) && indicator.visible) {
          const precision = indicator.precision
          const mergedDefaultStyles = getMergedDefaultStyles(indicator, defaultStyles)

          indicator.figures.forEach((figure, figureIndex) => {
            const value = indicatorData[figure.key]
            if (isNumber(value)) {
              const figureBaseStyles = getFigureBaseStyles(figure.type ?? 'line', figureIndex, mergedDefaultStyles)
              const customStyles = figure.styles?.(dataIndex, indicator, dataList, mergedDefaultStyles)
              const figureStyles = customStyles ? { ...figureBaseStyles, ...customStyles } : figureBaseStyles
              const color = figureStyles.color ?? mergedDefaultStyles.lastValueMark.text.color

              const y = yAxis.convertToNicePixel(value)
              let text = formatPrecision(value, precision)
              if (indicator.shouldFormatBigNumber) {
                text = customApi.formatBigNumber(text)
              }
              text = formatFoldDecimal(formatThousands(text, thousandsSeparator), decimalFoldThreshold)

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
                  ...lastValueMarkTextStyles,
                  backgroundColor: color
                }
              })
            }
          })
        }
      })
    }
  }
}
