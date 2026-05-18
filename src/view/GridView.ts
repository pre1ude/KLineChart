import { drawStaticFigure } from '../extension/figure'
import { GridLineLevel, type GridLineStyle } from '../common/Styles'
import { type LineAttrs } from '../extension/figure/line'
import type DualYPane from '../pane/DualYPane'
import type XAxisWidget from '../widget/XAxisWidget'
import View from './View'

export default class GridView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = this.getWidget().getPane()
    const chart = pane.getChart()
    const bounding = widget.getBounding()

    const gridStyles = chart.getStyles().grid
    const show = gridStyles.show

    if (show) {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      const horizontalStyles = gridStyles.horizontal
      const horizontalShow = horizontalStyles.show
      if (horizontalShow) {
        const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
        const attrs: LineAttrs[] = yAxis.getTicks().map(tick => ({
          coordinates: [
            { x: 0, y: tick.coord },
            { x: bounding.width, y: tick.coord }
          ]
        }))
        drawStaticFigure(ctx, 'line', {
          attrs,
          styles: horizontalStyles
        })
      }
      const verticalStyles = gridStyles.vertical
      const verticalShow = verticalStyles.show
      if (verticalShow) {
        const xAxis = (chart.getXAxisPane().getMainWidget() as XAxisWidget).getAxisComponent()
        const attrs: LineAttrs[] = []
        const primaryAttrs: LineAttrs[] = []
        xAxis.getTicks().forEach(tick => {
          const attr = {
            coordinates: [
              { x: tick.coord, y: 0 },
              { x: tick.coord, y: bounding.height }
            ]
          }
          if (tick.gridLineLevel === GridLineLevel.Primary) {
            primaryAttrs.push(attr)
          } else {
            attrs.push(attr)
          }
        })
        if (attrs.length > 0) {
          drawStaticFigure(ctx, 'line', {
            attrs,
            styles: verticalStyles
          })
        }
        const primaryStyles = getPrimaryGridLineStyle(verticalStyles)
        if (primaryAttrs.length > 0 && primaryStyles.show) {
          drawStaticFigure(ctx, 'line', {
            attrs: primaryAttrs,
            styles: primaryStyles
          })
        }
      }
      ctx.restore()
    }
  }
}

function getPrimaryGridLineStyle(styles: GridLineStyle): GridLineStyle {
  return {
    ...styles,
    ...styles.primary
  }
}
