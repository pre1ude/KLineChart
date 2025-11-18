import { type OverlayTemplate } from '../../../component/Overlay'

const triangle: OverlayTemplate = {
  name: 'triangle',
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick: function () {
    return true
  },
  createPointFigures: ({ coordinates }) => {
    return [
      {
        type: 'polygon',
        attrs: { coordinates },
        styles: { style: 'stroke_fill' }
      }
    ]
  }
}

export default triangle
