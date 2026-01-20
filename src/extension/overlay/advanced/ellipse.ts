import { type OverlayTemplate } from '../../../component/Overlay'

const ellipse: OverlayTemplate = {
  name: 'ellipse',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const rx = Math.abs(coordinates[1].x - coordinates[0].x)
      const ry = Math.abs(coordinates[1].y - coordinates[0].y)
      return {
        key: 'shape',
        type: 'ellipse',
        attrs: {
          ...coordinates[0],
          rx,
          ry
        },
        styles: { style: 'stroke_fill' }
      }
    }
    return []
  }
}

export default ellipse
