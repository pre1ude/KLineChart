import { type OverlayTemplate } from '../../../component/Overlay'

const triangle: OverlayTemplate = {
  name: 'triangle',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates }) => {
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
