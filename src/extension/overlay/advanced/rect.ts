import { type OverlayTemplate } from '../../../component/Overlay'

const rect: OverlayTemplate = {
  name: 'rect',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick: function () {
    return true
  },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      return [
        {
          type: 'polygon',
          attrs: {
            coordinates: [
              coordinates[0],
              { x: coordinates[1].x, y: coordinates[0].y },
              coordinates[1],
              { x: coordinates[0].x, y: coordinates[1].y }
            ]
          },
          styles: { style: 'stroke_fill' }
        }
      ]
    }
    return []
  }
}

export default rect
