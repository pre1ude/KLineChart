import { type OverlayTemplate } from '../../../component/Overlay'

const parallelogram: OverlayTemplate = {
  name: 'parallelogram',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      return [
        {
          type: 'line',
          attrs: { coordinates }
        }
      ]
    }
    if (coordinates.length === 3) {
      const coordinate = { x: coordinates[0].x + (coordinates[2].x - coordinates[1].x), y: coordinates[2].y }
      return [
        {
          key: 'shape',
          type: 'polygon',
          attrs: { coordinates: [coordinates[0], coordinates[1], coordinates[2], coordinate] },
          styles: { style: 'stroke_fill' }
        }
      ]
    }
    return []
  }
}

export default parallelogram
