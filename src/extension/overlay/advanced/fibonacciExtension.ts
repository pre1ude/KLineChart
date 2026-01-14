import { formatThousands, formatFoldDecimal } from '../../../common/utils/format'
import { isNumber } from '../../../common/utils/typeChecks'
import { type OverlayTemplate, type OverlayFigure } from '../../../component/Overlay'
import { type LineAttrs } from '../../figure/line'
import { type TextAttrs } from '../../figure/text'

const fibonacciExtension: OverlayTemplate = {
  name: 'fibonacciExtension',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates, overlay, precision, thousandsSeparator, decimalFoldThreshold, yAxis }) => {
    const figures: OverlayFigure[] = []

    // 连接线（虚线）
    if (coordinates.length > 0) {
      const connectLineAttrs: LineAttrs = { coordinates }
      figures.push({ key: 'trendLine', type: 'line', attrs: connectLineAttrs, styles: { style: 'dashed' } })
    }

    if (coordinates.length > 2) {
      const points = overlay.points
      if (!isNumber(points[0].value) || !isNumber(points[1].value) || !isNumber(points[2].value)) {
        return figures
      }

      const currentPrecision = (yAxis?.isInCandle() ?? true) ? precision.price : precision.excludePriceVolumeMax
      const valueDif = points[1].value - points[0].value
      const yDif = coordinates[1].y - coordinates[0].y
      const percents = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
      const textX = coordinates[2].x > coordinates[1].x ? coordinates[1].x : coordinates[2].x

      percents.forEach(percent => {
        const key = `fib_${percent}`
        const y = coordinates[2].y + yDif * percent
        const price = formatFoldDecimal(formatThousands(((points[2].value ?? 0) + valueDif * percent).toFixed(currentPrecision), thousandsSeparator), decimalFoldThreshold)

        const lineAttrs: LineAttrs = {
          coordinates: [
            { x: coordinates[1].x, y },
            { x: coordinates[2].x, y }
          ]
        }
        const textAttrs: TextAttrs = {
          x: textX,
          y,
          text: `${price} (${(percent * 100).toFixed(1)}%)`,
          baseline: 'bottom'
        }

        figures.push(
          { key, type: 'line', attrs: lineAttrs },
          { key: `${key}_text`, type: 'text', ignoreEvent: true, attrs: textAttrs }
        )
      })
    }

    return figures
  }
}

export default fibonacciExtension
