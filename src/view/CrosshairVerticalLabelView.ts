import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import { type CrosshairDirectionStyle, type CrosshairStyle, type StateTextStyle } from '../common/Styles'
import { getDateTimeFormat } from '../common/utils/dateTimeFormat'
import { isValid } from '../common/utils/typeChecks'
import { type TextAttrs } from '../extension/figure/text'
import { FormatDateType } from '../Options'
import type ChartStore from '../store/ChartStore'
import CrosshairLabelView from './CrosshairLabelView'
import { calculateXAxisLabelLayout } from './utils/labelPosition'

export default class CrosshairVerticalLabelView extends CrosshairLabelView {
  override compare(crosshair: Crosshair): boolean {
    const chartStore = this.getWidget().getPane().getChart().getChartStore()
    const isTimeShare = chartStore.getIsTimeShare()

    if (isTimeShare) {
      const realIndex = crosshair.realDataIndex
      return realIndex != null && realIndex >= 0
    }

    return isValid(crosshair.kLineData) && crosshair.dataIndex === crosshair.realDataIndex
  }

  override getDirectionStyles(styles: CrosshairStyle): CrosshairDirectionStyle {
    return styles.vertical
  }

  override getText(crosshair: Crosshair, chartStore: ChartStore): string {
    const isTimeShare = chartStore.getIsTimeShare()
    let timestamp = crosshair.kLineData?.timestamp
    if (isTimeShare) {
      const realIndex = crosshair.realDataIndex
      if (realIndex == null) {
        timestamp = undefined
      } else if (realIndex !== crosshair.dataIndex) {
        timestamp = chartStore.dataIndexToTimestamp(realIndex)
      }
    }

    if (timestamp == null) {
      return ''
    }

    const dateTimeFormat = getDateTimeFormat()
    return chartStore.getCustomApi().formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm', FormatDateType.Crosshair)
  }

  // todo need optimize
  override getTextAttrs(text: string, textWidth: number, crosshair: Crosshair, bounding: Bounding, styles: StateTextStyle): TextAttrs {
    const chartStore = this.getWidget().getPane().getChart().getChartStore()
    const xAxisStyles = chartStore.getStyles().xAxis
    const layout = calculateXAxisLabelLayout(xAxisStyles, styles)
    styles.paddingTop = layout.paddingTop
    styles.paddingBottom = layout.paddingBottom

    const x = crosshair.realX ?? 0
    let optimalX: number
    let align: CanvasTextAlign = 'center'
    if (x - textWidth / 2 - styles.paddingLeft < 0) {
      optimalX = 0
      align = 'left'
    } else if (x + textWidth / 2 + styles.paddingRight > bounding.width) {
      optimalX = bounding.width
      align = 'right'
    } else {
      optimalX = x
    }
    return { x: optimalX, y: layout.y, text, align, baseline: layout.baseline }
  }
}
