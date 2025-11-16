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

import type Coordinate from '../common/Coordinate'
import { CandleType, PolygonType, type CrosshairDirectionStyle } from '../common/Styles'
import { isNumber, isString } from '../common/utils/typeChecks'
import { drawStaticFigure } from '../extension/figure'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'
import View from './View'

export default class CrosshairLineView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
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
      if (crosshair.paneId === pane.getId()) {
        const y = crosshair.y!
        this._drawLine(
          ctx,
          [
            { x: 0, y },
            { x: bounding.width, y }
          ],
          crosshairStyles.horizontal
        )
      }
      const x = crosshair.realX!
      this._drawLine(
        ctx,
        [
          { x, y: 0 },
          { x, y: bounding.height }
        ],
        crosshairStyles.vertical
      )
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
        const x = crosshair.realX!
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

  private _drawLine (ctx: CanvasRenderingContext2D, coordinates: Coordinate[], styles: CrosshairDirectionStyle): void {
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
