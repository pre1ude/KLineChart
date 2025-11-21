import { type OverlayTemplate } from '../../../component/Overlay'

import { getDistance } from './utils'

const circle: OverlayTemplate = {
  name: 'circle',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const radius = getDistance(coordinates[0], coordinates[1])
      return {
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
