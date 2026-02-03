import { type OverlayTemplate } from '../../../component/Overlay'
import { getDistance } from './utils'

const circle: OverlayTemplate = {
  name: 'circle',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const radius = getDistance(coordinates[0], coordinates[1])
      return {
        key: 'shape',
        type: 'circle',
        attrs: {
          ...coordinates[0],
          r: radius
        },
        styles: { style: 'stroke_fill' }
      }
    }
    return []
  }
}

export default circle
