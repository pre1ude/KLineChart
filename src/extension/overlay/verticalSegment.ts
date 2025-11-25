import { type OverlayTemplate } from '../../component/Overlay'

const verticalSegment: OverlayTemplate = {
  name: 'verticalSegment',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      return [
        {
          type: 'line',
          attrs: { coordinates }
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

export default verticalSegment
