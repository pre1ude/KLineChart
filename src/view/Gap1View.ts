import { LineType, PolygonType } from '../common/Styles'
import { createFont } from '../common/utils/canvas'
import { formatPrecision } from '../common/utils/format'
import { drawRect, type RectAttrs } from '../extension/figure/rect'
import type DualYPane from '../pane/DualYPane'
import type XAxisWidget from '../widget/XAxisWidget'
import { pixelSnapBarCenter } from './utils/barPixel'
import View from './View'

const GAP1_LABEL_FONT_SIZE = 12
const GAP1_LABEL_OFFSET = 4

interface Gap1Label {
  x: number
  y: number
  baseline: CanvasTextBaseline
  priceText: string
  changeText: string
  changeColor: string
}

export default class Gap1View extends View {
  protected override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane() as DualYPane
    const chart = pane.getChart()
    const gap1Store = chart.getChartStore().getGap1Store()
    if (!gap1Store.isEnabled()) return

    const chartStore = chart.getChartStore()
    const bounding = widget.getBounding()
    const xAxis = (chart.getXAxisPane().getMainWidget() as XAxisWidget).getAxisComponent()
    const yAxis = pane.getDefaultYScale().getComponent()
    const chartStyles = chartStore.getStyles()
    const styles = chartStyles.gap
    const priceTextColor = chartStyles.xAxis.tickText.color
    const changeColors = chartStyles.candle.bar
    const options = gap1Store.getOptions()
    const pricePrecision = chartStore.getPrecision().price
    const upRects: RectAttrs[] = []
    const downRects: RectAttrs[] = []
    const labels: Gap1Label[] = []

    gap1Store.getGaps().forEach(gap => {
      const x = Math.max(0, pixelSnapBarCenter(xAxis.convertToPixel(gap.fromIndex)))
      if (bounding.width <= x) return

      const topY = yAxis.convertToPixel(gap.top)
      const bottomY = yAxis.convertToPixel(gap.bottom)
      const y = Math.max(0, Math.min(topY, bottomY))
      const bottom = Math.min(bounding.height, Math.max(topY, bottomY))
      if (bottom <= y) return

      const rect = { x, y, width: bounding.width - x, height: bottom - y }
      if (gap.direction === 'up') {
        upRects.push(rect)
      } else {
        downRects.push(rect)
      }

      if (options.showValue) {
        const isUp = gap.direction === 'up'
        const start = isUp ? gap.bottom : gap.top
        const end = isUp ? gap.top : gap.bottom
        const change = end - start
        const sign = change > 0 ? '+' : ''
        const percentage = change / start * 100
        const defaultText = {
          priceText: `${formatPrecision(start, pricePrecision)}-${formatPrecision(end, pricePrecision)}`,
          percentageText: `${sign}${percentage.toFixed(3)}%`,
          widthText: `${sign}${formatPrecision(change, pricePrecision)}`
        }
        const formattedText = options.valueFormatter?.({
          direction: gap.direction,
          start,
          end,
          change,
          percentage,
          pricePrecision,
          ...defaultText
        })
        labels.push({
          x: rect.x + GAP1_LABEL_OFFSET,
          y: isUp
            ? rect.y + rect.height + GAP1_LABEL_OFFSET
            : rect.y - GAP1_LABEL_OFFSET,
          baseline: isUp ? 'top' : 'bottom',
          priceText: formattedText?.priceText ?? defaultText.priceText,
          changeText: `${formattedText?.percentageText ?? defaultText.percentageText}(${formattedText?.widthText ?? defaultText.widthText})`,
          changeColor: isUp ? changeColors.upColor : changeColors.downColor
        })
      }
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
    if (labels.length > 0) {
      ctx.font = createFont(GAP1_LABEL_FONT_SIZE)
      ctx.textAlign = 'left'
      labels.forEach(label => {
        ctx.textBaseline = label.baseline
        const priceTextWidth = ctx.measureText(`${label.priceText} `).width
        const changeTextWidth = ctx.measureText(label.changeText).width
        const labelX = Math.max(0, Math.min(label.x, bounding.width - priceTextWidth - changeTextWidth))
        ctx.fillStyle = priceTextColor
        ctx.fillText(label.priceText, labelX, label.y)
        const changeX = labelX + priceTextWidth
        ctx.fillStyle = label.changeColor
        ctx.fillText(label.changeText, changeX, label.y)
      })
    }
    ctx.restore()
  }
}
