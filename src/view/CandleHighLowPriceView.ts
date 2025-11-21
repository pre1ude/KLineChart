

import type Coordinate from '../common/Coordinate'
import type VisibleData from '../common/VisibleData'
import type BarSpace from '../common/BarSpace'
import { type CandleHighLowPriceMarkStyle } from '../common/Styles'
import type DualYPane from '../pane/DualYPane'
import View from './View'
import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import { isValid } from '../common/utils/typeChecks'
import { drawStaticFigure } from '../extension/figure'

export type EachChildCallback = (
  data: VisibleData,
  barSpace: BarSpace,
  index: number
) => void

export default class CandleHighLowPriceView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const chartStore = pane.getChart().getChartStore()
    const priceMarkStyles = chartStore.getStyles().candle.priceMark
    const highPriceMarkStyles = priceMarkStyles.high
    const lowPriceMarkStyles = priceMarkStyles.low
    if (priceMarkStyles.show && (highPriceMarkStyles.show || lowPriceMarkStyles.show)) {
      const thousandsSeparator = chartStore.getThousandsSeparator()
      const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
      const precision = chartStore.getPrecision()
      const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
      let high = Number.MIN_SAFE_INTEGER
      let highX = 0
      let low = Number.MAX_SAFE_INTEGER
      let lowX = 0
      const visibleDataList = chartStore.getVisibleDataList()

      // todo should not calc min max here
      visibleDataList.forEach((data: VisibleData) => {
        const { data: kLineData, x } = data
        if (isValid(kLineData)) {
          if (high < kLineData.high) {
            high = kLineData.high
            highX = x
          }
          if (low > kLineData.low) {
            low = kLineData.low
            lowX = x
          }
        }
      })
      const highY = yAxis.convertToPixel(high)
      const lowY = yAxis.convertToPixel(low)
      if (highPriceMarkStyles.show && high !== Number.MIN_SAFE_INTEGER) {
        this._drawMark(
          ctx,
          formatFoldDecimal(formatThousands(formatPrecision(high, precision.price), thousandsSeparator), decimalFoldThreshold),
          { x: highX, y: highY },
          highY < lowY ? [-2, -5] : [2, 5],
          highPriceMarkStyles
        )
      }
      if (lowPriceMarkStyles.show && low !== Number.MAX_SAFE_INTEGER) {
        this._drawMark(
          ctx,
          formatFoldDecimal(formatThousands(formatPrecision(low, precision.price), thousandsSeparator), decimalFoldThreshold),
          { x: lowX, y: lowY },
          highY < lowY ? [2, 5] : [-2, -5],
          lowPriceMarkStyles
        )
      }
    }
  }

  private _drawMark (
    ctx: CanvasRenderingContext2D,
    text: string,
    coordinate: Coordinate,
    offsets: number[],
    styles: CandleHighLowPriceMarkStyle
  ): void {
    const startX = coordinate.x
    const startY = coordinate.y + offsets[0]
    drawStaticFigure(ctx, 'line', {
      attrs: {
        coordinates: [
          { x: startX - 2, y: startY + offsets[0] },
          { x: startX, y: startY },
          { x: startX + 2, y: startY + offsets[0] }
        ]
      },
      styles: { color: styles.color }
    })

    let lineEndX: number
    let textStartX: number
    let textAlign: string
    const { width } = this.getWidget().getBounding()
    if (startX > width / 2) {
      lineEndX = startX - 5
      textStartX = lineEndX - styles.textOffset
      textAlign = 'right'
    } else {
      lineEndX = startX + 5
      textAlign = 'left'
      textStartX = lineEndX + styles.textOffset
    }

    const y = startY + offsets[1]
    drawStaticFigure(ctx, 'line', {
      attrs: {
        coordinates: [
          { x: startX, y: startY },
          { x: startX, y },
          { x: lineEndX, y }
        ]
      },
      styles: { color: styles.color }
    })
    drawStaticFigure(ctx, 'text', {
      attrs: {
        x: textStartX,
        y,
        text,
        align: textAlign,
        baseline: 'middle'
      },
      styles: {
        color: styles.color,
        size: styles.textSize,
        family: styles.textFamily,
        weight: styles.textWeight
      }
    })
  }
}
