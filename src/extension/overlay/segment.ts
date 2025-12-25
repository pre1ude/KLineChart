import { type OverlayTemplate } from '../../component/Overlay'

const segment: OverlayTemplate = {
  name: 'segment',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
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
  }
}

export default segment
