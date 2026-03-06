
import { clamp } from '@/common/utils/number'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { isNumber, isValid } from '../common/utils/typeChecks'
import { getFigureBaseStyles, getMergedDefaultStyles } from '../component/Indicator'
import { drawStaticFigure } from '../extension/figure'
import type YAxisWidget from '../widget/YAxisWidget'
import { calculateYAxisLabelLayout } from './utils/labelPosition'
import View from './View'

export default class IndicatorLastValueView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget() as unknown as YAxisWidget
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const customApi = chartStore.getCustomApi()
    const defaultStyles = chartStore.getStyles().indicator
    const lastValueMarkStyles = defaultStyles.lastValueMark
    const lastValueMarkTextStyles = { ...lastValueMarkStyles.text }
    if (lastValueMarkStyles.show) {
      const yAxis = widget.getAxisComponent()
      const dataList = chartStore.getDataList()
      const dataIndex = dataList.length - 1
      const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
      const thousandsSeparator = chartStore.getThousandsSeparator()
      const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()

      const isAlignLeft = widget.isAlignLeft()
      const yAxisStyles = chartStore.getStyles().yAxis
      const layout = calculateYAxisLabelLayout(bounding, yAxisStyles, lastValueMarkTextStyles, isAlignLeft)
      lastValueMarkTextStyles.paddingLeft = layout.paddingLeft
      lastValueMarkTextStyles.paddingRight = layout.paddingRight

      indicators.forEach(indicator => {
        const result = indicator.result
        const indicatorData = result[dataIndex]
        if (isValid(indicatorData) && indicator.visible) {
          const precision = indicator.precision
          const mergedDefaultStyles = getMergedDefaultStyles(indicator, defaultStyles)

          indicator.figures.forEach((figure, figureIndex) => {
            const value = (indicatorData as Record<string, unknown>)[figure.key]
            if (isNumber(value)) {
              const figureBaseStyles = getFigureBaseStyles(figure.type ?? 'line', figureIndex, mergedDefaultStyles)
              const customStyles = figure.styles?.(dataIndex, indicator, dataList, mergedDefaultStyles)
              const figureStyles = customStyles ? { ...figureBaseStyles, ...customStyles } : figureBaseStyles
              const color = figureStyles.color ?? mergedDefaultStyles.lastValueMark.text.color

              const y0 = yAxis.convertToPixel(value)
              const y = clamp(y0, 10, bounding.height - 10)

              let text = formatPrecision(value, precision)
              if (indicator.shouldFormatBigNumber) {
                text = customApi.formatBigNumber(text)
              }
              text = formatFoldDecimal(formatThousands(text, thousandsSeparator), decimalFoldThreshold)

              drawStaticFigure(ctx, 'text', {
                attrs: {
                  x: layout.x,
                  y,
                  text,
                  align: layout.align,
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
