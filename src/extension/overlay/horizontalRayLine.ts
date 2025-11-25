import { isValid } from '../../common/utils/typeChecks'
import { type OverlayTemplate } from '../../component/Overlay'

const horizontalRayLine: OverlayTemplate = {
  name: 'horizontalRayLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createFigures: ({ coordinates, bounding }) => {
    const coordinate = { x: 0, y: coordinates[0].y }
    if (isValid(coordinates[1]) && coordinates[0].x < coordinates[1].x) {
      coordinate.x = bounding.width
    }
    return [
      {
        type: 'line',
        attrs: { coordinates: [coordinates[0], coordinate] }
      }
    ]
  },
  onControlPointUpdate: (points, index, point) => {
    points[index] = point
    points[0].value = point.value
    points[1].value = point.value
  },
  onDrawPointUpdate: (points, index, point) => {
    points[index] = point
    if (index === 1) {
      points[0].value = point.value
    }
  }
}

export default horizontalRayLine
