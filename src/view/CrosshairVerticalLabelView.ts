

import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import { type CrosshairStyle, type CrosshairDirectionStyle, type StateTextStyle } from '../common/Styles'
import { isValid } from '../common/utils/typeChecks'
import { FormatDateType } from '../Options'
import type ChartStore from '../store/ChartStore'
import CrosshairLabelView from './CrosshairLabelView'
import { type TextAttrs } from '../extension/figure/text'
import { genTimeStamp, getDateTimeFormat } from '../common/utils/dateTimeFormat'

export default class CrosshairVerticalLabelView extends CrosshairLabelView {
  override compare (crosshair: Crosshair): boolean {
    const chartStore = this.getWidget().getPane().getChart().getChartStore()
    const isTimeShare = chartStore.getIsTimeShare()

    if (isTimeShare) {
      // 分时图模式下，检查是否在时间轴范围内（而不是实际数据范围）
      const timeShareTicks = chartStore.getTimeShareTicks()
      const totalBarCount = chartStore.getDataList().length
      const validDays = Math.floor((totalBarCount - 1) / timeShareTicks.length) + 1
      const realIndex = crosshair.realDataIndex ?? -1
      // 不能超出可预知的时间范围
      if (realIndex < 0 || realIndex >= timeShareTicks.length * validDays) {
        return false
      }
      return true
    }

    return isValid(crosshair.kLineData) && crosshair.dataIndex === crosshair.realDataIndex
  }

  override getDirectionStyles (styles: CrosshairStyle): CrosshairDirectionStyle {
    return styles.vertical
  }

  override getText (crosshair: Crosshair, chartStore: ChartStore): string {
    const isTimeShare = chartStore.getIsTimeShare()

    let timestamp = crosshair.kLineData?.timestamp
    if (isTimeShare) {
      const timeShareTicks = chartStore.getTimeShareTicks()
      const realIndex = crosshair.realDataIndex ?? 0

      // 获取时间文本
      const text = timeShareTicks[realIndex % timeShareTicks.length]

      timestamp = timestamp ? genTimeStamp(text, timestamp) : undefined
    }
    if (!timestamp) {
      return ''
    }

    const dateTimeFormat = getDateTimeFormat()
    return chartStore.getCustomApi().formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm', FormatDateType.Crosshair)
  }

  // todo need optimize
  override getTextAttrs (text: string, textWidth: number, crosshair: Crosshair, bounding: Bounding, styles: StateTextStyle): TextAttrs {
    const x = crosshair.realX!
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
    return { x: optimalX, y: 0, text, align, baseline: 'top' }
  }
}
