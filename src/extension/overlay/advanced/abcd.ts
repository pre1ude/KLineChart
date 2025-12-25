import type Coordinate from '../../../common/Coordinate'
import { type OverlayTemplate } from '../../../component/Overlay'

const abcd: OverlayTemplate = {
  name: 'abcd',
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates }) => {
    let acLineCoordinates: Coordinate[] = []
    let bdLineCoordinates: Coordinate[] = []

    const tags = ['A', 'B', 'C', 'D']
    const texts = coordinates.map((coordinate, i) => ({
      ...coordinate,
      baseline: 'bottom',
      text: `(${tags[i]})`
    }))
    if (coordinates.length > 2) {
      acLineCoordinates = [coordinates[0], coordinates[2]]
      if (coordinates.length > 3) {
        bdLineCoordinates = [coordinates[1], coordinates[3]]
      }
    }
    return [
      {
        key: 'line',
        type: 'line',
        attrs: { coordinates }
      },
      {
        type: 'line',
        attrs: [{ coordinates: acLineCoordinates }, { coordinates: bdLineCoordinates }],
        styles: { style: 'dashed' }
      },
      {
        key: 'label',
        type: 'text',
        ignoreEvent: false,
        attrs: texts
      }
    ]
  }
}

export default abcd
