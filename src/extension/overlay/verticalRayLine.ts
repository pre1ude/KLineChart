import { type OverlayTemplate } from '../../component/Overlay'

const verticalRayLine: OverlayTemplate = {
  name: 'verticalRayLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createFigures: ({ coordinates, bounding }) => {
    if (coordinates.length === 2) {
      const coordinate = { x: coordinates[0].x, y: 0 }
      if (coordinates[0].y < coordinates[1].y) {
        coordinate.y = bounding.height
      }
      return [
        {
          type: 'line',
          attrs: { coordinates: [coordinates[0], coordinate] }
        }
      ]
    }
    return []
  },
  onControlPointUpdate: (points, index, point) => {
    points[index] = point
    points[0].timestamp = point.timestamp
    points[0].dataIndex = point.dataIndex
    points[1].timestamp = point.timestamp
    points[1].dataIndex = point.dataIndex
  },
  onDrawPointUpdate: (points, index, point) => {
    points[index] = point
    if (index === 1) {
      points[0].timestamp = point.timestamp
      points[0].dataIndex = point.dataIndex
    }
  }
}

export default verticalRayLine
