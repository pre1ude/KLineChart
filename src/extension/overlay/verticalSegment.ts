import { type OverlayTemplate } from '../../component/Overlay'

const verticalSegment: OverlayTemplate = {
  name: 'verticalSegment',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      return [
        {
          key: 'line',
          type: 'line',
          attrs: { coordinates }
        }
      ]
    }
    return []
  },
  onControlPointUpdate: (points, index, point) => {
    points[index] = point
    // 垂直线：所有点共享相同的 dataIndex
    points[0].dataIndex = point.dataIndex
    points[1].dataIndex = point.dataIndex
  },
  onDrawPointUpdate: (points, index, point) => {
    points[index] = point
    if (index === 1) {
      points[0].dataIndex = point.dataIndex
    }
  }
}

export default verticalSegment
