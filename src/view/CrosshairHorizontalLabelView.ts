import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import { YAxisType, type CrosshairDirectionStyle, type CrosshairStyle, type StateTextStyle } from '../common/Styles'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { type TextAttrs } from '../extension/figure/text'
import type ChartStore from '../store/ChartStore'
import type YAxisWidget from '../widget/YAxisWidget'
import CrosshairLabelView from './CrosshairLabelView'
import { calculateYAxisLabelLayout } from './utils/labelPosition'

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
    const axisType = widget.getAxisType()
    const yAxis = widget.getAxisComponent()
    if (!yAxis.hasValidData()) {
      return ''
    }
    if (!crosshair.y) {
      return ''
    }
    const value = yAxis.convertFromPixel(crosshair.y)
    let text: string

    if (axisType === YAxisType.Percentage || axisType === YAxisType.MinutePercentage) {
      if (axisType === YAxisType.MinutePercentage) {
        // 分钟百分比模式：使用统一的基准价格方法
        const basisPrice = chartStore.getMinutePercentageBasis()
        if (basisPrice > 0) {
          text = `${((value - basisPrice) / basisPrice * 100).toFixed(2)}%`
        } else {
          text = '0.00%'
        }
      } else {
        // 普通百分比模式：使用第一个数据的 close
        const fromData = chartStore.getVisibleFirstData()
        if (fromData && fromData.close > 0) {
          text = `${((value - fromData.close) / fromData.close * 100).toFixed(2)}%`
        } else {
          text = '0.00%'
        }
      }
    } else {
      const indicators = chartStore.getIndicatorStore().getInstances(crosshair.paneId ?? '')
      let precision = 0
      let shouldFormatBigNumber = false
      if (yAxis.isInCandle()) {
        precision = chartStore.getPrecision().price
      } else {
        indicators.forEach(indicator => {
          precision = Math.max(indicator.precision, precision)
          if (!shouldFormatBigNumber) {
            shouldFormatBigNumber = indicator.shouldFormatBigNumber
          }
        })
      }
      text = formatPrecision(value, precision)
      if (shouldFormatBigNumber) {
        text = chartStore.getCustomApi().formatBigNumber(text)
      }
    }
    return formatFoldDecimal(formatThousands(text, chartStore.getThousandsSeparator()), chartStore.getDecimalFoldThreshold())
  }

  protected getTextAttrs(text: string, _textWidth: number, crosshair: Crosshair, bounding: Bounding, styles: StateTextStyle): TextAttrs {
    const widget = this.getWidget() as unknown as YAxisWidget
    const chartStore = widget.getPane().getChart().getChartStore()
    const yAxisStyles = chartStore.getStyles().yAxis
    const isAlignLeft = widget.isAlignLeft()
    const layout = calculateYAxisLabelLayout(bounding, yAxisStyles, styles, isAlignLeft)
    styles.paddingLeft = layout.paddingLeft
    styles.paddingRight = layout.paddingRight

    return { x: layout.x, y: crosshair.y ?? 0, text, align: layout.align, baseline: 'middle' }
  }
}
