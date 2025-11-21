import { type OverlayTemplate } from '../../../component/Overlay'

const parallelogram: OverlayTemplate = {
  name: 'parallelogram',
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      return [
        {
          type: 'line',
          ignoreEvent: true,
          attrs: { coordinates }
        }
      ]
    }
    if (coordinates.length === 3) {
      const coordinate = { x: coordinates[0].x + (coordinates[2].x - coordinates[1].x), y: coordinates[2].y }
      return [
        {
          type: 'polygon',
          attrs: { coordinates: [coordinates[0], coordinates[1], coordinates[2], coordinate] },
          styles: { style: 'stroke_fill' }
        }
      ]
    }
    return []
  },
  performEventPressedMove: ({ points, performPointIndex, performPoint }) => {
    if (performPointIndex < 2) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      points[0].price = performPoint.price
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      points[1].price = performPoint.price
    }
  },
  performEventMoveForDrawing: ({ currentStep, points, performPoint }) => {
    if (currentStep === 2) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      points[0].price = performPoint.price
    }
  }
}

export default parallelogram
