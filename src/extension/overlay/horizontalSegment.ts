import { type OverlayTemplate } from '../../component/Overlay'
import { type LineAttrs } from '../figure/line'

const horizontalSegment: OverlayTemplate = {
  name: 'horizontalSegment',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates }) => {
    const lines: LineAttrs[] = []
    if (coordinates.length === 2) {
      lines.push({ coordinates })
    }
    return [
      {
        key: 'line',
        type: 'line',
        attrs: lines
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

export default horizontalSegment
