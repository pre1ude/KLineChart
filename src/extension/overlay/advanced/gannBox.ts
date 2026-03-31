import { type OverlayTemplate } from '../../../component/Overlay'
import { type LineAttrs } from '../../figure/line'

const yPercents = [0.25, 0.5, 0.75]
const xPercents = [0.236, 0.5]

const gannBox: OverlayTemplate = {
  name: 'gannBox',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return []

    const [p0, p1] = coordinates
    const xDis = p1.x - p0.x
    const yDis = p1.y - p0.y
    const topRight = { x: p1.x, y: p0.y }
    const bottomLeft = { x: p0.x, y: p1.y }

    const borderAttrs: LineAttrs[] = [
      { coordinates: [p0, topRight] },
      { coordinates: [topRight, p1] },
      { coordinates: [p1, bottomLeft] },
      { coordinates: [bottomLeft, p0] }
    ]

    const dashedAttrs: LineAttrs[] = []
    yPercents.forEach(percent => {
      const y = p0.y + yDis * percent
      if (percent >= 0.5) {
        dashedAttrs.push({ coordinates: [p0, { x: p1.x, y }] })
      }
      if (percent <= 0.5) {
        dashedAttrs.push({ coordinates: [bottomLeft, { x: p1.x, y }] })
      }
    })

    xPercents.forEach(percent => {
      const x = p0.x + xDis * percent
      dashedAttrs.push({ coordinates: [p0, { x, y: p1.y }] })
      dashedAttrs.push({ coordinates: [bottomLeft, { x, y: p0.y }] })
    })

    const solidAttrs: LineAttrs[] = [
      { coordinates: [p0, p1] },
      { coordinates: [bottomLeft, topRight] }
    ]

    return [
      { key: 'border', type: 'line', attrs: borderAttrs },
      {
        key: 'fill',
        type: 'polygon',
        attrs: {
          coordinates: [p0, topRight, p1, bottomLeft]
        },
        styles: { style: 'fill' }
      },
      { key: 'dashed', type: 'line', attrs: dashedAttrs, styles: { style: 'dashed' } },
      { key: 'solid', type: 'line', attrs: solidAttrs }
    ]
  }
}

export default gannBox
