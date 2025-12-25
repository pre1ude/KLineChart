import { type OverlayTemplate } from '../../component/Overlay'
import { formatThousands, formatFoldDecimal } from '../../common/utils/format'

const priceLine: OverlayTemplate = {
  name: 'priceLine',
  totalStep: 1,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates, bounding, precision, overlay, thousandsSeparator, decimalFoldThreshold, yAxis }) => {
    const { value = 0 } = (overlay.points)[0]
    const currentPrecision = (yAxis?.isInCandle() ?? true) ? precision.price : precision.excludePriceVolumeMax
    return [
      {
        key: 'line',
        type: 'line',
        attrs: { coordinates: [coordinates[0], { x: bounding.width, y: coordinates[0].y }] }
      },
      {
        key: 'label',
        type: 'text',
        ignoreEvent: true,
        attrs: {
          x: coordinates[0].x,
          y: coordinates[0].y,
          text: formatFoldDecimal(formatThousands(value.toFixed(currentPrecision), thousandsSeparator), decimalFoldThreshold),
          baseline: 'bottom'
        }
      }
    ]
  }
}

export default priceLine
