import { type OverlayTemplate } from '../../../component/Overlay'
import { type LineAttrs } from '../../figure/line'
import { type PolygonAttrs } from '../../figure/polygon'

const xabcd: OverlayTemplate = {
  name: 'xabcd',
  totalStep: 5,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates }) => {
    const dashedLines: LineAttrs[] = []
    const polygons: PolygonAttrs[] = []
    const tags = ['X', 'A', 'B', 'C', 'D']
    const texts = coordinates.map((coordinate, i) => ({
      ...coordinate,
      baseline: 'bottom',
      text: `(${tags[i]})`
    }))
    if (coordinates.length > 2) {
      dashedLines.push({ coordinates: [coordinates[0], coordinates[2]] })
      polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] })
      if (coordinates.length > 3) {
        dashedLines.push({ coordinates: [coordinates[1], coordinates[3]] })
        if (coordinates.length > 4) {
          dashedLines.push({ coordinates: [coordinates[2], coordinates[4]] })
          polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] })
        }
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
        attrs: dashedLines,
        styles: { style: 'dashed' }
      },
      {
        key: 'bg',
        type: 'polygon',
        attrs: polygons
      },
      {
        key: 'label',
        type: 'text',
        attrs: texts
      }
    ]
  }
}

export default xabcd
