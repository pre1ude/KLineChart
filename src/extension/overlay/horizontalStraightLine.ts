import { type OverlayTemplate } from '../../component/Overlay'

const horizontalStraightLine: OverlayTemplate = {
  name: 'horizontalStraightLine',
  totalStep: 1,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates, bounding }) => {
    return [{
      type: 'line',
      attrs: {
        coordinates: [
          {
            x: 0,
            y: coordinates[0].y
          }, {
            x: bounding.width,
            y: coordinates[0].y
          }
        ]
      }
    }]
  }
}

export default horizontalStraightLine
