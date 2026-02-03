import { type OverlayTemplate } from '../../component/Overlay'

const verticalStraightLine: OverlayTemplate = {
  name: 'verticalStraightLine',
  totalStep: 1,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates, bounding }) => {
    return [
      {
        key: 'line',
        type: 'line',
        attrs: {
          coordinates: [
            {
              x: coordinates[0].x,
              y: 0
            }, {
              x: coordinates[0].x,
              y: bounding.height
            }
          ]
        }
      }
    ]
  }
}

export default verticalStraightLine
