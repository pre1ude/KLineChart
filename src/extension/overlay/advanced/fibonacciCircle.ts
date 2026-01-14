import { type OverlayTemplate, type OverlayFigure } from '../../../component/Overlay'
import { type CircleAttrs } from '../../figure/circle'
import { type TextAttrs } from '../../figure/text'

const fibonacciCircle: OverlayTemplate = {
  name: 'fibonacciCircle',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const xDis = Math.abs(coordinates[0].x - coordinates[1].x)
      const yDis = Math.abs(coordinates[0].y - coordinates[1].y)
      const radius = Math.sqrt(xDis * xDis + yDis * yDis)
      const percents = [0.236, 0.382, 0.5, 0.618, 0.786, 1]
      const figures: OverlayFigure[] = []

      percents.forEach(percent => {
        const r = radius * percent
        const key = `fib_${percent}`
        const circleAttrs: CircleAttrs = { ...coordinates[0], r }
        const textAttrs: TextAttrs = {
          x: coordinates[0].x,
          y: coordinates[0].y + r + 6,
          text: `${(percent * 100).toFixed(1)}%`
        }
        figures.push(
          {
            key,
            type: 'circle',
            attrs: circleAttrs,
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
