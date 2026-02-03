import { getLinearYFromCoordinates } from '../figure/line'
import { type OverlayTemplate } from '../../component/Overlay'

const straightLine: OverlayTemplate = {
  name: 'straightLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates, bounding }) => {
    if (coordinates.length === 2) {
      if (coordinates[0].x === coordinates[1].x) {
        return [
          {
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
      return [
        {
          key: 'line',
          type: 'line',
          attrs: {
            coordinates: [
              {
                x: 0,
                y: getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: 0, y: coordinates[0].y })
              }, {
                x: bounding.width,
                y: getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: bounding.width, y: coordinates[0].y })
              }
            ]
          }
        }
      ]
    }
    return []
  }
}

export default straightLine
