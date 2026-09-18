import { type OverlayTemplate } from '../../../component/Overlay'

const controlPointKeys = [
  'corner_00',
  'corner_10',
  'corner_11',
  'corner_01'
] as const

const rect: OverlayTemplate = {
  name: 'rect',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createControlPoints: ({ coordinates }) => {
    if (coordinates.length === 0) return []
    if (coordinates.length === 1) {
      return [{ key: controlPointKeys[0], coordinate: coordinates[0] }]
    }
    return [
      { key: controlPointKeys[0], coordinate: coordinates[0] },
      { key: controlPointKeys[1], coordinate: { x: coordinates[1].x, y: coordinates[0].y } },
      { key: controlPointKeys[2], coordinate: coordinates[1] },
      { key: controlPointKeys[3], coordinate: { x: coordinates[0].x, y: coordinates[1].y } }
    ]
  },
  onControlPointUpdate: (points, index, point, controlPointKey) => {
    const key = controlPointKey ?? controlPointKeys[index]
    switch (key) {
      case 'corner_00':
        points[0].timestamp = point.timestamp
        points[0].offset = point.offset
        points[0].value = point.value
        break
      case 'corner_10':
        points[1].timestamp = point.timestamp
        points[1].offset = point.offset
        points[0].value = point.value
        break
      case 'corner_11':
        points[1].timestamp = point.timestamp
        points[1].offset = point.offset
        points[1].value = point.value
        break
      case 'corner_01':
        points[0].timestamp = point.timestamp
        points[0].offset = point.offset
        points[1].value = point.value
        break
    }
  },
  createFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      return [
        {
          key: 'shape',
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
