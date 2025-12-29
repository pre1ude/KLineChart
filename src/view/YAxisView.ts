
import type Bounding from '../common/Bounding'
import { type AxisStyle, type Styles } from '../common/Styles'
import { type LineAttrs } from '../extension/figure/line'
import { type TextAttrs } from '../extension/figure/text'
import { type AxisTick } from '../component/Axis'
import AxisView from './AxisView'
import type YAxisWidget from '../widget/YAxisWidget'

export default class YAxisView extends AxisView {
  override getAxisStyles(styles: Styles): AxisStyle {
    return styles.yAxis
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

  override createTickTexts(ticks: AxisTick[], bounding: Bounding, styles: AxisStyle): TextAttrs[] {
    const widget = this.getWidget() as unknown as YAxisWidget
    const isAlignLeft = widget.isAlignLeft()
    const axisLineStyles = styles.axisLine
    const tickLineStyles = styles.tickLine
    const tickTextStyles = styles.tickText

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

    const align = isAlignLeft ? 'left' : 'right'
    return ticks.map(tick => ({
      x,
      y: tick.coord,
      text: tick.text,
      align,
      baseline: 'middle'
    }))
  }

  override getCustomYAxisColor() {
    const styles = this.getWidget().getPane().getChart().getStyles()
    const position = (this.getWidget() as YAxisWidget).getOptions().position
    return styles.indicator?.yAxisTextTickColor ? styles.indicator?.yAxisTextTickColor(position) : undefined
  }
}
