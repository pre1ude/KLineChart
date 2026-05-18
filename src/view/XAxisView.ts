import type Bounding from '../common/Bounding'
import { type AxisStyle, type Styles } from '../common/Styles'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { type AxisTick } from '../component/Axis'
import { calcXAxisTickTextX } from '../component/x-axis/tickLayout'
import { type LineAttrs } from '../extension/figure/line'
import { type TextAttrs } from '../extension/figure/text'
import AxisView from './AxisView'

export default class XAxisView extends AxisView {
  override getAxisStyles(styles: Styles): AxisStyle {
    return styles.xAxis
  }

  override createAxisLine(bounding: Bounding): LineAttrs {
    return {
      coordinates: [
        { x: 0, y: 0 },
        { x: bounding.width, y: 0 }
      ]
    }
  }

  override createTickLines(ticks: AxisTick[], _bounding: Bounding, styles: AxisStyle): LineAttrs[] {
    const tickLineStyles = styles.tickLine
    const axisLineSize = styles.axisLine.size
    return ticks.map(tick => ({
      coordinates: [
        { x: tick.coord, y: 0 },
        { x: tick.coord, y: axisLineSize + tickLineStyles.length }
      ]
    }))
  }

  override createTickTexts(ticks: AxisTick[], _bounding: Bounding, styles: AxisStyle): TextAttrs[] {
    const tickTickStyles = styles.tickText
    const axisLineSize = styles.axisLine.size
    const tickLineLength = styles.tickLine.length

    return ticks.map((tick, i) => {
      const labelWidth = calcTextWidth(tick.text, createFont(tickTickStyles.size, tickTickStyles.weight, tickTickStyles.fontFamily))
      return {
        x: calcXAxisTickTextX(tick, labelWidth, i, ticks.length, _bounding.width),
        y: axisLineSize + tickLineLength + tickTickStyles.marginStart,
        text: tick.text,
        align: 'center',
        baseline: 'top'
      }
    })
  }
}
