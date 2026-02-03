import { type OverlayTemplate } from '../../component/Overlay'
import { getParallelLines } from './parallelStraightLine'

const priceChannelLine: OverlayTemplate = {
  name: 'priceChannelLine',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createFigures: ({ coordinates, bounding }) => {
    const attrArray = getParallelLines(coordinates, bounding, 1)
    return attrArray.map((attr, i) => ({
      key: `line${i}`,
      type: 'line',
      attrs: attr
    }))
  }
}

export default priceChannelLine
