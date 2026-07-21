import { LineType, PolygonType } from '../common/Styles'
import { drawRect, type RectAttrs } from '../extension/figure/rect'
import type DualYPane from '../pane/DualYPane'
import type XAxisWidget from '../widget/XAxisWidget'
import { pixelSnapBarCenter } from './utils/barPixel'
import View from './View'

export default class GapView extends View {
  protected override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane() as DualYPane
    const chart = pane.getChart()
    const gapStore = chart.getChartStore().getGapStore()
    if (!gapStore.isEnabled()) return

    const bounding = widget.getBounding()
    const xAxis = (chart.getXAxisPane().getMainWidget() as XAxisWidget).getAxisComponent()
    const yAxis = pane.getMainAxisWidget().getAxisComponent()
    const styles = chart.getChartStore().getStyles().gap
    const upRects: RectAttrs[] = []
    const downRects: RectAttrs[] = []

    gapStore.getGaps().forEach(gap => {
      const directionStyles = gap.direction === 'up' ? styles.up : styles.down
      const borderSize = directionStyles.borderSize ?? 1
      const endCorrection = borderSize % 2 === 1 ? 1 : 0
      gap.segments.forEach(segment => {
        const leftX = pixelSnapBarCenter(xAxis.convertToPixel(segment.fromIndex))
        const rightX = segment.toIndex === undefined
          ? bounding.width
          : pixelSnapBarCenter(xAxis.convertToPixel(segment.toIndex)) + endCorrection
        const x = Math.max(0, leftX)
        const right = Math.min(bounding.width, rightX)
        if (right <= x) return

        const topY = yAxis.convertToPixel(segment.top)
        const bottomY = yAxis.convertToPixel(segment.bottom)
        const y = Math.max(0, Math.min(topY, bottomY))
        const bottom = Math.min(bounding.height, Math.max(topY, bottomY))
        if (bottom <= y) return

        const rect = { x, y, width: right - x, height: bottom - y }
        if (gap.direction === 'up') {
          upRects.push(rect)
        } else {
          downRects.push(rect)
        }
      })
    })

    ctx.save()
    if (upRects.length > 0) {
      drawRect(ctx, upRects, {
        style: PolygonType.StrokeFill,
        color: styles.up.backgroundColor,
        borderColor: styles.up.borderColor,
        borderSize: styles.up.borderSize,
        borderStyle: LineType.Solid,
        borderDashedValue: [],
        borderRadius: 0
      })
    }
    if (downRects.length > 0) {
      drawRect(ctx, downRects, {
        style: PolygonType.StrokeFill,
        color: styles.down.backgroundColor,
        borderColor: styles.down.borderColor,
        borderSize: styles.down.borderSize,
        borderStyle: LineType.Solid,
        borderDashedValue: [],
        borderRadius: 0
      })
    }
    ctx.restore()
  }
}
