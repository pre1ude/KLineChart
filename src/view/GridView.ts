/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { drawStaticFigure } from '../extension/figure'
import { type LineAttrs } from '../extension/figure/line'
import type DualYPane from '../pane/DualYPane'
import type XAxisWidget from '../widget/XAxisWidget'
import View from './View'

export default class GridView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
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
        const chartStore = chart.getChartStore()
        const isTimeShare = chartStore.getIsTimeShare()
        const timeShareDays = chartStore.getTimeShareDays()
        const attrs: LineAttrs[] = xAxis.getTicks().map(tick => ({
          coordinates: [
            { x: tick.coord, y: 0 },
            { x: tick.coord, y: bounding.height }
          ]
        }))
        if (isTimeShare && timeShareDays > 1) {
          // N日分时跳过第一根线绘制
          attrs.shift()
        }
        drawStaticFigure(ctx, 'line', {
          attrs,
          styles: verticalStyles
        })
      }
      ctx.restore()
    }
  }
}
