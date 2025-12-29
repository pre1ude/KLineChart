
import type Bounding from '../common/Bounding'
import { type AxisStyle, type Styles } from '../common/Styles'
import { type LineAttrs } from '../extension/figure/line'
import { type TextAttrs } from '../extension/figure/text'
import { type AxisTick } from '../component/Axis'
import type XAxisWidget from '../widget/XAxisWidget'
import type YAxisWidget from '../widget/YAxisWidget'
import View from './View'
import { drawStaticFigure } from '../extension/figure'
import { PaneIdConstants } from '../pane/types'

export default abstract class AxisView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget() as XAxisWidget | YAxisWidget
    const pane = widget.getPane()
    const chartStore = pane.getChart().getChartStore()
    const bounding = widget.getBounding()
    const axis = widget.getAxisComponent()
    const chartStyles = pane.getChart().getStyles()
    const styles: AxisStyle = this.getAxisStyles(chartStyles)
    if (styles.show) {
      if (styles.axisLine.show) {
        drawStaticFigure(ctx, 'line', {
          attrs: this.createAxisLine(bounding, styles),
          styles: styles.axisLine
        })
      }
      // todo should know if it is in indicator pane
      // todo the ticks need generate accord the axisOptions
      const ticks = axis.getTicks()
      if (styles.tickLine.show) {
        const lines = this.createTickLines(ticks, bounding, styles)
        lines.forEach(line => {
          drawStaticFigure(ctx, 'line', {
            attrs: line,
            styles: styles.tickLine
          })
        })
      }
      if (styles.tickText.show) {
        const isTimeShare = chartStore.getIsTimeShare()
        const isMainPane = pane.getId() === PaneIdConstants.CANDLE
        const tickHasColor = isTimeShare && isMainPane
        if (tickHasColor) {
          const barStyles = chartStore.getStyles().candle.bar
          const tickTexts = this.createTickTexts(ticks, bounding, styles)
          tickTexts.forEach((text, index) => {
            const colorHint = ticks[index].colorHint
            drawStaticFigure(ctx, 'text', {
              attrs: text,
              styles: {
                ...styles.tickText,
                color: colorHint === 1 ? barStyles.upColor : colorHint === -1 ? barStyles.downColor : styles.tickText.color
              }
            })
          })
        } else if (isTimeShare && !isMainPane) {
          const tickTexts = this.createTickTexts(ticks, bounding, styles)
          let color = styles.tickText.color
          const customColor = this.getCustomYAxisColor()
          if (customColor) {
            color = customColor
          }
          drawStaticFigure(ctx, 'text', {
            attrs: tickTexts,
            styles: { ...styles.tickText, color }
          })
        } else {
          const tickTexts = this.createTickTexts(ticks, bounding, styles)
          drawStaticFigure(ctx, 'text', {
            attrs: tickTexts,
            styles: styles.tickText
          })
        }
      }
    }
  }

  protected abstract getAxisStyles(styles: Styles): AxisStyle
  protected abstract getCustomYAxisColor(): string | undefined

  protected abstract createAxisLine(bounding: Bounding, styles: AxisStyle): LineAttrs
  protected abstract createTickLines(ticks: AxisTick[], bounding: Bounding, styles: AxisStyle): LineAttrs[]
  protected abstract createTickTexts(tick: AxisTick[], bounding: Bounding, styles: AxisStyle): TextAttrs[]
}
