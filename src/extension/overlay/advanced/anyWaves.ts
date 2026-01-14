import { type OverlayTemplate } from '../../../component/Overlay'

const anyWaves: OverlayTemplate = {
  name: 'anyWaves',
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates }) => {
    const texts = coordinates.map((coordinate, i) => ({
      ...coordinate,
      text: `(${i})`,
      baseline: 'bottom'
    }))
    return [
      {
        key: 'line',
        type: 'line',
        attrs: { coordinates }
      },
      {
        key: 'label',
        type: 'text',
        attrs: texts
      }
    ]
  }
}

export default anyWaves
