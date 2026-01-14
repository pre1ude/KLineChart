import { type OverlayTemplate } from '../../../component/Overlay'

const threeWaves: OverlayTemplate = {
  name: 'threeWaves',
  totalStep: 4,
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

export default threeWaves
