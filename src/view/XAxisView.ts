
import type Bounding from '../common/Bounding'
import { type AxisStyle, type Styles } from '../common/Styles'
import { type LineAttrs } from '../extension/figure/line'
import { type TextAttrs } from '../extension/figure/text'
import { type AxisTick } from '../component/Axis'
import AxisView from './AxisView'
import { calcTextWidth, createFont } from '../common/utils/canvas'

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
      let x = tick.coord
      const labelWidth = calcTextWidth(tick.text, createFont(tickTickStyles.size, tickTickStyles.weight, tickTickStyles.family))
      if (i === 0) {
        const delta = x - labelWidth / 2
        if (delta < 0) {
          x -= delta
        }
      } else if (i === ticks.length - 1) {
        const delta = x + labelWidth / 2 - _bounding.width
        if (delta > 0) {
          x -= delta
        }
      }

      return {
        x,
        y: axisLineSize + tickLineLength + tickTickStyles.marginStart,
        text: tick.text,
        align: 'center',
        baseline: 'top'
      }
    })
  }
}
