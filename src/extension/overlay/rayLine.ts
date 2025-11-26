import type Coordinate from '../../common/Coordinate'
import type Bounding from '../../common/Bounding'
import { type OverlayTemplate } from '../../component/Overlay'
import { getLinearYFromCoordinates, type LineAttrs } from '../figure/line'

export function getRayLine(coordinates: Coordinate[], bounding: Bounding): LineAttrs | LineAttrs[] {
  if (coordinates.length > 1) {
    let coordinate: Coordinate
    if (coordinates[0].x === coordinates[1].x && coordinates[0].y !== coordinates[1].y) {
      if (coordinates[0].y < coordinates[1].y) {
        coordinate = {
          x: coordinates[0].x,
          y: bounding.height
        }
      } else {
        coordinate = {
          x: coordinates[0].x,
          y: 0
        }
      }
    } else if (coordinates[0].x > coordinates[1].x) {
      coordinate = {
        x: 0,
        y: getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: 0, y: coordinates[0].y })
      }
    } else {
      coordinate = {
        x: bounding.width,
        y: getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: bounding.width, y: coordinates[0].y })
      }
    }
    return { coordinates: [coordinates[0], coordinate] }
  }
  return []
}

const rayLine: OverlayTemplate = {
  name: 'rayLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates, bounding }) => {
    return [
      {
        type: 'line',
        attrs: getRayLine(coordinates, bounding)
      }
    ]
  }
}

export default rayLine
