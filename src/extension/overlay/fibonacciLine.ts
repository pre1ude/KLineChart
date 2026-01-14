import { formatThousands, formatFoldDecimal } from '../../common/utils/format'
import { isNumber } from '../../common/utils/typeChecks'
import { type OverlayTemplate, type OverlayFigure } from '../../component/Overlay'
import { type LineAttrs } from '../figure/line'
import { type TextAttrs } from '../figure/text'

const fibonacciLine: OverlayTemplate = {
  name: 'fibonacciLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates, bounding, overlay, precision, thousandsSeparator, decimalFoldThreshold, yAxis }) => {
    const points = overlay.points
    if (coordinates.length > 0) {
      const currentPrecision = (yAxis?.isInCandle() ?? true) ? precision.price : precision.excludePriceVolumeMax
      const figures: OverlayFigure[] = []
      const startX = 0
      const endX = bounding.width
      if (coordinates.length > 1 && isNumber(points[0].value) && isNumber(points[1].value)) {
        const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0]
        const yDif = coordinates[0].y - coordinates[1].y
        const valueDif = points[0].value - points[1].value
        percents.forEach(percent => {
          const y = coordinates[1].y + yDif * percent
          const value = formatFoldDecimal(formatThousands(((points[1].value ?? 0) + valueDif * percent).toFixed(currentPrecision), thousandsSeparator), decimalFoldThreshold)
          const key = `fib_${percent}`
          const lineAttrs: LineAttrs = { coordinates: [{ x: startX, y }, { x: endX, y }] }
          const textAttrs: TextAttrs = {
            x: startX,
            y,
            text: `${value} (${(percent * 100).toFixed(1)}%)`,
            baseline: 'bottom'
          }
          figures.push(
            {
              key,
              type: 'line',
              attrs: lineAttrs
            },
            {
              key: `${key}_text`,
              type: 'text',
              attrs: textAttrs
            }
          )
        })
      }
      return figures
    }
    return []
  }
}

export default fibonacciLine
