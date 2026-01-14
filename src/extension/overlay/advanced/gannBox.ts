import { type OverlayTemplate, type OverlayFigure } from '../../../component/Overlay'
import { type LineAttrs } from '../../figure/line'

const percents = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]

const gannBox: OverlayTemplate = {
  name: 'gannBox',
  totalStep: 2,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  onRightClick() {
    return true
  },
  createFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return []

    const [p0, p1] = coordinates
    const xDis = p1.x - p0.x
    const yDis = p1.y - p0.y
    const figures: OverlayFigure[] = []

    // 矩形边框
    const borderAttrs: LineAttrs[] = [
      { coordinates: [p0, { x: p1.x, y: p0.y }] },
      { coordinates: [{ x: p1.x, y: p0.y }, p1] },
      { coordinates: [p1, { x: p0.x, y: p1.y }] },
      { coordinates: [{ x: p0.x, y: p1.y }, p0] }
    ]
    figures.push({ key: 'border', type: 'line', attrs: borderAttrs })

    // 填充区域
    figures.push({
      key: 'fill',
      type: 'polygon',
      attrs: {
        coordinates: [p0, { x: p1.x, y: p0.y }, p1, { x: p0.x, y: p1.y }]
      },
      styles: { style: 'fill' }
    })

    // 网格线和扇形线
    percents.forEach(percent => {
      const key = `gann_${percent}`
      const x = p0.x + xDis * percent
      const y = p0.y + yDis * percent

      // 垂直网格线（跳过边界 0 和 1）
      if (percent > 0 && percent < 1) {
        const vLineAttrs: LineAttrs = { coordinates: [{ x, y: p0.y }, { x, y: p1.y }] }
        figures.push({ key: `${key}_vline`, type: 'line', attrs: vLineAttrs, styles: { style: 'dashed' } })
      }

      // 水平网格线（跳过边界 0 和 1）
      if (percent > 0 && percent < 1) {
        const hLineAttrs: LineAttrs = { coordinates: [{ x: p0.x, y }, { x: p1.x, y }] }
        figures.push({ key: `${key}_hline`, type: 'line', attrs: hLineAttrs, styles: { style: 'dashed' } })
      }

      // 从左上角出发的扇形线
      const fanLine1Attrs: LineAttrs = { coordinates: [p0, { x: p1.x, y }] }
      figures.push({ key: `${key}_fan1`, type: 'line', attrs: fanLine1Attrs, styles: { style: 'dashed' } })

      // 从左下角出发的扇形线
      const fanLine2Attrs: LineAttrs = { coordinates: [{ x: p0.x, y: p1.y }, { x: p1.x, y: p0.y + yDis * (1 - percent) }] }
      figures.push({ key: `${key}_fan2`, type: 'line', attrs: fanLine2Attrs, styles: { style: 'dashed' } })
    })

    // 主对角线（实线）
    const diag1Attrs: LineAttrs = { coordinates: [p0, p1] }
    figures.push({ key: 'diagonal1', type: 'line', attrs: diag1Attrs })

    // 副对角线（实线）
    const diag2Attrs: LineAttrs = { coordinates: [{ x: p0.x, y: p1.y }, { x: p1.x, y: p0.y }] }
    figures.push({ key: 'diagonal2', type: 'line', attrs: diag2Attrs })

    return figures
  }
}

export default gannBox
