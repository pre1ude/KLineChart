import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import { type CrosshairDirectionStyle, type CrosshairStyle, type StateTextStyle } from '../common/Styles'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { type TextAttrs } from '../extension/figure/text'
import type ChartStore from '../store/ChartStore'
import type DualYPane from '../pane/DualYPane'
import type YAxisWidget from '../widget/YAxisWidget'
import CrosshairLabelView from './CrosshairLabelView'
import { calculateYAxisLabelLayout, calcYAxisLabelHeight, clampYAxisLabelY } from './utils/labelPosition'

export default class CrosshairHorizontalLabelView extends CrosshairLabelView {
  protected compare(crosshair: Crosshair, paneId: string): boolean {
    // 当没有有效数据时（kLineData 为 undefined），不显示水平标签
    if (crosshair.kLineData === undefined) {
      return false
    }
    return crosshair.paneId === paneId
  }

  protected getDirectionStyles(styles: CrosshairStyle): CrosshairDirectionStyle {
    return styles.horizontal
  }

  protected getText(crosshair: Crosshair, chartStore: ChartStore): string {
    const widget = this.getWidget() as unknown as YAxisWidget
    const yScale = widget.getScaleComponent()
    if (!yScale.hasValidData()) {
      return ''
    }
    if (crosshair.y == null) {
      return ''
    }
    const value = yScale.convertFromPixel(crosshair.y)
    const formatter = widget.getScale().getOptions().formatter
    if (formatter) {
      return widget.formatLabel(value, formatter(value))
    }
    const pane: DualYPane = widget.getPane()
    const indicators = chartStore.getIndicatorStore().getInstances(crosshair.paneId ?? '').filter(indicator => (
      pane.resolveIndicatorYScaleId(indicator) === widget.getOptions().yScaleId
    ))
    let precision = 0
    let shouldFormatBigNumber = false
    if (yScale.isInCandle()) {
      precision = chartStore.getPrecision().price
    } else {
      indicators.forEach(indicator => {
        precision = Math.max(indicator.precision, precision)
        if (!shouldFormatBigNumber) {
          shouldFormatBigNumber = indicator.shouldFormatBigNumber
        }
      })
    }
    let text = formatPrecision(value, precision)
    if (shouldFormatBigNumber) {
      text = chartStore.getCustomApi().formatBigNumber(text)
    }
    text = formatFoldDecimal(formatThousands(text, chartStore.getThousandsSeparator()), chartStore.getDecimalFoldThreshold())
    return widget.formatLabel(value, text)
  }

  protected getTextAttrs(text: string, _textWidth: number, crosshair: Crosshair, bounding: Bounding, styles: StateTextStyle): TextAttrs {
    const widget = this.getWidget() as unknown as YAxisWidget
    const chartStore = widget.getPane().getChart().getChartStore()
    const yAxisStyles = chartStore.getStyles().yAxis
    const isAlignLeft = widget.isAlignLeft()
    const layout = calculateYAxisLabelLayout(bounding, yAxisStyles, styles, isAlignLeft)
    styles.paddingLeft = layout.paddingLeft
    styles.paddingRight = layout.paddingRight

    const y = clampYAxisLabelY(crosshair.y ?? 0, bounding.height, calcYAxisLabelHeight(styles))
    return { x: layout.x, y, text, align: layout.align, baseline: 'middle' }
  }
}
