import type Coordinate from '../common/Coordinate'
import { CandleType, PolygonType, type CrosshairDirectionStyle } from '../common/Styles'
import { isNumber, isString } from '../common/utils/typeChecks'
import { drawStaticFigure } from '../extension/figure'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'
import View from './View'

export default class CrosshairLineView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const isMain = pane.getId() === PaneIdConstants.CANDLE
    const bounding = widget.getBounding()
    const chart = pane.getChart()
    const chartStore = chart.getChartStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    const styles = chartStore.getStyles()
    const crosshairStyles = styles.crosshair
    if (isString(crosshair.paneId) && crosshairStyles.show) {
      if (crosshair.paneId === pane.getId() && isNumber(crosshair.y)) {
        const y = crosshair.y
        this._drawLine(
          ctx,
          [
            { x: 0, y },
            { x: bounding.width, y }
          ],
          crosshairStyles.horizontal
        )
      }
      if (isNumber(crosshair.realX)) {
        const x = crosshair.realX
        this._drawLine(
          ctx,
          [
            { x, y: 0 },
            { x, y: bounding.height }
          ],
          crosshairStyles.vertical
        )
      }
    }
    const candleStyles = styles.candle
    const candleAreaStyle = candleStyles.area
    if (isMain && candleStyles.type === CandleType.Area) {
      // draw dot
      const chartStore = chart.getChartStore()
      // const barSpace = chartStore.getTimeScaleStore().getBarSpace()
      const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()

      const crosshair = chartStore.getTooltipStore().getCrosshair()

      if (crosshair.kLineData && crosshair.dataIndex === crosshair.realDataIndex && crosshair.paneId != null) {
        const x = crosshair.realX
        const value = crosshair.kLineData?.[candleAreaStyle.value]

        if (isNumber(value)) {
          const y = yAxis.convertToPixel(value)
          const r = 3
          drawStaticFigure(ctx, 'circle', {
            attrs: { x, y, r },
            styles: { color: '#fff', borderColor: candleAreaStyle.lineColor, style: PolygonType.StrokeFill, borderSize: candleAreaStyle.lineSize }
          })
        }
      }
    }
  }

  private _drawLine(ctx: CanvasRenderingContext2D, coordinates: Coordinate[], styles: CrosshairDirectionStyle): void {
    if (styles.show) {
      const lineStyles = styles.line
      if (lineStyles.show) {
        drawStaticFigure(ctx, 'line', {
          attrs: { coordinates },
          styles: lineStyles
        })
      }
    }
  }
}
