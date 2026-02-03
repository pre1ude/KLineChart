import { type EllipseAttrs } from '@/extension/figure/ellipse'
import { type OverlayTemplate, type OverlayFigure } from '../../../component/Overlay'
import { type TextAttrs } from '../../figure/text'

const fibonacciCircle: OverlayTemplate = {
  name: 'fibonacciCircle',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const xDis = Math.abs(coordinates[0].x - coordinates[1].x)
      const yDis = Math.abs(coordinates[0].y - coordinates[1].y)
      const percents = [0.236, 0.382, 0.5, 0.618, 0.786, 1]
      const figures: OverlayFigure[] = []

      percents.forEach(percent => {
        const rx = xDis * percent
        const ry = yDis * percent
        const key = `fib_${percent}`
        const ellipseAttrs: EllipseAttrs = { ...coordinates[0], rx, ry }
        const textAttrs: TextAttrs = {
          x: coordinates[0].x,
          y: coordinates[0].y + ry + 6,
          text: `${(percent * 100).toFixed(1)}%`
        }
        figures.push(
          {
            key,
            type: 'ellipse',
            attrs: ellipseAttrs,
            styles: { style: 'stroke' }
          },
          {
            key: `${key}_text`,
            type: 'text',
            attrs: textAttrs
          }
        )
      })
      return figures
    }
    return []
  }
}

export default fibonacciCircle
