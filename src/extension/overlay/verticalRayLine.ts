import { type OverlayTemplate } from '../../component/Overlay'

const verticalRayLine: OverlayTemplate = {
  name: 'verticalRayLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates, bounding }) => {
    if (coordinates.length === 2) {
      const coordinate = { x: coordinates[0].x, y: 0 }
      if (coordinates[0].y < coordinates[1].y) {
        coordinate.y = bounding.height
      }
      return [
        {
          key: 'line',
          type: 'line',
          attrs: { coordinates: [coordinates[0], coordinate] }
        }
      ]
    }
    return []
  },
  onControlPointUpdate: (points, index, point) => {
    points[index] = point
    // 垂直线：所有点共享相同的时间锚点
    points[0].timestamp = point.timestamp
    points[0].offset = point.offset
    points[1].timestamp = point.timestamp
    points[1].offset = point.offset
  },
  onDrawPointUpdate: (points, index, point) => {
    points[index] = point
    if (index === 1) {
      points[0].timestamp = point.timestamp
      points[0].offset = point.offset
    }
  }
}

export default verticalRayLine
