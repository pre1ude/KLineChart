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

import type DualYPane from '../pane/DualYPane'
import { drawStaticFigure } from '../extension/figure'
import View from './View'

// todo draw the zero line for 0% percentage
// 主轴一定是百分比轴
export default class CandleZeroPriceLineView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()
    const priceMarkStyles = chartStore.getStyles().candle.priceMark
    const lastPriceMarkStyles = priceMarkStyles.last
    const lastPriceMarkLineStyles = lastPriceMarkStyles.line
    if (priceMarkStyles.show && lastPriceMarkStyles.show && lastPriceMarkLineStyles.show) {
      const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
      const dataList = chartStore.getDataList()
      const firstData = dataList[0]
      const prevClose: number | undefined = firstData?.prevClose
      if (prevClose != null) {
        const yPos = yAxis.convertToNicePixel(prevClose)
        drawStaticFigure(ctx, 'line', {
          attrs: {
            coordinates: [
              { x: 0, y: yPos },
              { x: bounding.width, y: yPos }
            ]
          },
          styles: {
            style: lastPriceMarkLineStyles.style,
            color: lastPriceMarkStyles.noChangeColor,
            size: lastPriceMarkLineStyles.size,
            dashedValue: lastPriceMarkLineStyles.dashedValue
          }
        })
      }
    }
  }
}
