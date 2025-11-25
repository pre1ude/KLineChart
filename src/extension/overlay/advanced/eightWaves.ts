import { type OverlayTemplate } from '../../../component/Overlay'

const eightWaves: OverlayTemplate = {
  name: 'eightWaves',
  totalStep: 9,
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
        type: 'line',
        attrs: { coordinates }
      },
      {
        type: 'text',
        ignoreEvent: false,
        attrs: texts
      }
    ]
  }
}

export default eightWaves
