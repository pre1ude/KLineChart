import { type OverlayTemplate } from '../../component/Overlay'
import { getParallelLines } from './parallelStraightLine'

const priceChannelLine: OverlayTemplate = {
  name: 'priceChannelLine',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates, bounding }) => {
    return [
      {
        type: 'line',
        attrs: getParallelLines(coordinates, bounding, 1)
      }
    ]
  }
}

export default priceChannelLine
