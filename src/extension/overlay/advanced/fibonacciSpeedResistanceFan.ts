import { type OverlayTemplate, type OverlayFigure } from '../../../component/Overlay'
import { type LineAttrs } from '../../figure/line'
import { type TextAttrs } from '../../figure/text'
import { getRayLine } from './utils'

const fibonacciSpeedResistanceFan: OverlayTemplate = {
  name: 'fibonacciSpeedResistanceFan',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return []

    const figures: OverlayFigure[] = []
    const xDistance = coordinates[1].x - coordinates[0].x
    const yDistance = coordinates[1].y - coordinates[0].y

    // 判断拖拽方向
    const isDownward = yDistance > 0  // 从上往下拉
    const isRightward = xDistance > 0 // 从左往右拉

    // 文字偏移：根据方向调整
    const xOffset = isRightward ? -38 : 4
    const yTextOffset = isDownward ? -2 : 2  // 上方或下方
    const yTextBaseline = isDownward ? 'bottom' : 'top'

    const percents = [1, 0.75, 0.618, 0.5, 0.382, 0.25, 0]

    percents.forEach(percent => {
      const key = `fib_${percent}`
      const x = coordinates[1].x - xDistance * percent
      const y = coordinates[1].y - yDistance * percent

      // 垂直网格线
      const vLineAttrs: LineAttrs = {
        coordinates: [
          { x, y: coordinates[0].y },
          { x, y: coordinates[1].y }
        ]
      }
      figures.push({ key: `${key}_vline`, type: 'line', attrs: vLineAttrs })

      // 水平网格线
      const hLineAttrs: LineAttrs = {
        coordinates: [
          { x: coordinates[0].x, y },
          { x: coordinates[1].x, y }
        ]
      }
      figures.push({ key: `${key}_hline`, type: 'line', attrs: hLineAttrs })

      // 射线（从原点到底边）
      const ray1 = getRayLine([coordinates[0], { x, y: coordinates[1].y }], bounding)
      const ray1Array = Array.isArray(ray1) ? ray1 : [ray1]
      ray1Array.forEach((attrs, i) => {
        figures.push({ key: `${key}_ray1_${i}`, type: 'line', attrs })
      })

      // 射线（从原点到右边）
      const ray2 = getRayLine([coordinates[0], { x: coordinates[1].x, y }], bounding)
      const ray2Array = Array.isArray(ray2) ? ray2 : [ray2]
      ray2Array.forEach((attrs, i) => {
        figures.push({ key: `${key}_ray2_${i}`, type: 'line', attrs })
      })

      // Y轴文字标签（紧贴水平线）
      const textYAttrs: TextAttrs = {
        x: coordinates[0].x + xOffset,
        y: y + yTextOffset,
        text: `${percent.toFixed(3)}`,
        baseline: yTextBaseline
      }
      figures.push({ key: `${key}_text_y`, type: 'text', attrs: textYAttrs })

      // X轴文字标签
      const textXAttrs: TextAttrs = {
        x: x - 18,
        y: coordinates[0].y + (isDownward ? -2 : 2),
        text: `${percent.toFixed(3)}`,
        baseline: isDownward ? 'bottom' : 'top'
      }
      figures.push({ key: `${key}_text_x`, type: 'text', attrs: textXAttrs })
    })

    return figures
  }
}

export default fibonacciSpeedResistanceFan
