import type Bounding from '../common/Bounding'
import { type AxisStyle, type Styles } from '../common/Styles'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { clamp } from '../common/utils/number'
import { type AxisTick } from '../component/Axis'
import { calcXAxisTickTextX } from '../component/x-axis/tickLayout'
import { type LineAttrs } from '../extension/figure/line'
import AxisView, { type AxisTickText } from './AxisView'

export function clampXAxisTickLineX(x: number, width: number, lineSize: number): number {
  if (width <= 0 || lineSize <= 0) {
    return x
  }
  const alignedX = Math.round(x)
  const correction = lineSize % 2 === 1 ? 0.5 : 0
  const halfLineSize = lineSize / 2
  return clamp(alignedX, halfLineSize - correction, width - halfLineSize - correction)
}

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

  override createTickLines(ticks: AxisTick[], bounding: Bounding, styles: AxisStyle): LineAttrs[] {
    const tickLineStyles = styles.tickLine
    const axisLineSize = styles.axisLine.size
    return ticks.map(tick => {
      const x = clampXAxisTickLineX(tick.coord, bounding.width, tickLineStyles.size)
      return {
        coordinates: [
          { x, y: 0 },
          { x, y: axisLineSize + tickLineStyles.length }
        ]
      }
    })
  }

  override createTickTexts(ticks: AxisTick[], _bounding: Bounding, styles: AxisStyle): AxisTickText[] {
    const tickTickStyles = styles.tickText
    const axisLineSize = styles.axisLine.size
    const tickLineLength = styles.tickLine.length
    const textTicks = ticks.filter(tick => tick.text !== '')

    return textTicks.map((tick, i) => {
      const labelWidth = calcTextWidth(tick.text, createFont(tickTickStyles.size, tickTickStyles.weight, tickTickStyles.fontFamily))
      return {
        attrs: {
          x: calcXAxisTickTextX(tick, labelWidth, i, textTicks.length, _bounding.width),
          y: axisLineSize + tickLineLength + tickTickStyles.marginStart,
          text: tick.text,
          align: 'center',
          baseline: 'top'
        },
        tick
      }
    })
  }
}
