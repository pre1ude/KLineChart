import type Bounding from '../common/Bounding'
import { type AxisStyle, type Styles } from '../common/Styles'
import { clamp } from '../common/utils/number'
import { type AxisTick } from '../component/Axis'
import { calcYAxisTickTextHeight } from '../component/YAxis'
import { type LineAttrs } from '../extension/figure/line'
import { type TextAttrs } from '../extension/figure/text'
import type YAxisWidget from '../widget/YAxisWidget'
import AxisView, { type AxisTickText } from './AxisView'

export function clampYAxisTickTextY(y: number, height: number, textHeight: number): number {
  if (height <= 0 || textHeight <= 0) {
    return y
  }
  if (height <= textHeight) {
    return height / 2
  }
  const halfTextHeight = textHeight / 2
  return clamp(y, halfTextHeight, height - halfTextHeight)
}

export default class YAxisView extends AxisView {
  override getAxisStyles(styles: Styles): AxisStyle {
    const baseStyles = styles.yAxis
    const widget = this.getWidget() as unknown as YAxisWidget
    const position = widget.getOptions().position
    const paneAxisOptions = widget.getPane().getOptions().axisOptions
    const tickTextColor = paneAxisOptions?.YAxis?.[position]?.axisStyle?.tickTextColor

    if (tickTextColor) {
      return {
        ...baseStyles,
        tickText: {
          ...baseStyles.tickText,
          color: tickTextColor
        }
      }
    }
    return baseStyles
  }

  override createAxisLine(bounding: Bounding, styles: AxisStyle): LineAttrs {
    const widget = this.getWidget() as unknown as YAxisWidget
    const isAlignLeft = widget.isAlignLeft()
    const size = styles.axisLine.size
    let x: number
    if (isAlignLeft) {
      x = 0
    } else {
      x = bounding.width - size
    }
    return {
      coordinates: [
        { x, y: 0 },
        { x, y: bounding.height }
      ]
    }
  }

  override createTickLines(ticks: AxisTick[], bounding: Bounding, styles: AxisStyle): LineAttrs[] {
    const widget = this.getWidget() as unknown as YAxisWidget
    const isAlignLeft = widget.isAlignLeft()
    const axisLineStyles = styles.axisLine
    const tickLineStyles = styles.tickLine

    let startX = 0
    let endX = 0
    if (isAlignLeft) {
      startX = 0
      if (axisLineStyles.show) {
        startX += axisLineStyles.size
      }
      endX = startX + tickLineStyles.length
    } else {
      startX = bounding.width
      if (axisLineStyles.show) {
        startX -= axisLineStyles.size
      }
      endX = startX - tickLineStyles.length
    }
    return ticks.map(tick => ({
      coordinates: [
        { x: startX, y: tick.coord },
        { x: endX, y: tick.coord }
      ]
    }))
  }

  override createTickTexts(ticks: AxisTick[], bounding: Bounding, styles: AxisStyle): AxisTickText[] {
    const widget = this.getWidget() as unknown as YAxisWidget
    const chartStore = widget.getPane().getChart().getChartStore()
    const isTimeShare = chartStore.getIsTimeShare()
    const isInCandle = widget.isInCandle()
    const height = widget?.getBounding().height ?? 0
    const axisTitle = widget.getOptions().axisTitle
    const isAlignLeft = widget.isAlignLeft()
    const axisLineStyles = styles.axisLine
    const tickLineStyles = styles.tickLine
    const tickTextStyles = styles.tickText
    const textHeight = tickTextStyles.size

    let x = 0
    if (isAlignLeft) {
      x = tickTextStyles.marginStart
      if (axisLineStyles.show) {
        x += axisLineStyles.size
      }
      if (tickLineStyles.show) {
        x += tickLineStyles.length
      }
    } else {
      x = bounding.width - tickTextStyles.marginEnd
      if (axisLineStyles.show) {
        x -= axisLineStyles.size
      }
      if (tickLineStyles.show) {
        x -= tickLineStyles.length
      }
    }

    let newTicks: AxisTickText[] = ticks.map(tick => ({ tick, attrs: createYAxisTextAttrs(tick, x, bounding.height, textHeight, isAlignLeft) }))
    if (isTimeShare && !isInCandle) {
      if (axisTitle?.length) {
        newTicks = [{
          attrs: createYAxisTextAttrs({
            coord: height - textHeight / 2,
            value: '--',
            text: axisTitle
          }, x, bounding.height, textHeight, isAlignLeft)
        }, ...newTicks]
      }
    }

    return newTicks
  }
}

function createYAxisTextAttrs(
  tick: AxisTick,
  x: number,
  height: number,
  textHeight: number,
  isAlignLeft: boolean
): TextAttrs {
  const tickTextHeight = calcYAxisTickTextHeight(textHeight)
  return {
    x,
    y: clampYAxisTickTextY(tick.coord, height, tickTextHeight),
    text: tick.text,
    align: isAlignLeft ? 'left' : 'right',
    baseline: 'middle'
  }
}
