

import { formatPrecision } from '../../common/utils/format'

import { type OverlayTemplate } from '../../component/Overlay'

import { isFunction, isNumber, isValid } from '../../common/utils/typeChecks'

import { LineType } from '../../common/Styles'

const simpleTag: OverlayTemplate = {
  name: 'simpleTag',
  totalStep: 2,
  styles: {
    line: { style: LineType.Dashed }
  },
  createPointFigures: ({ bounding, coordinates }) => {
    return {
      type: 'line',
      attrs: {
        coordinates: [
          { x: 0, y: coordinates[0].y },
          { x: bounding.width, y: coordinates[0].y }
        ]
      },
      ignoreEvent: true
    }
  },
  createYAxisFigures: ({ overlay, coordinates, bounding, isAlignLeft = false, precision }) => {
    const align = isAlignLeft ? 'left' : 'right'
    let text
    if (isValid(overlay.extendData)) {
      if (!isFunction(overlay.extendData)) {
        text = overlay.extendData ?? ''
      } else {
        text = overlay.extendData(overlay)
      }
    }
    if (!isValid(text) && isNumber(overlay.points[0].value)) {
      text = formatPrecision(overlay.points[0].value, precision.price)
    }
    return { type: 'text', attrs: { x: bounding.width * (1 - +isAlignLeft), y: coordinates[0].y, text: text ?? '', align, baseline: 'middle' } }
  }
}

export default simpleTag
