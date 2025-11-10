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

import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import { type CrosshairStyle, type CrosshairDirectionStyle, type StateTextStyle } from '../common/Styles'
import { isValid } from '../common/utils/typeChecks'
import { FormatDateType } from '../Options'
import type ChartStore from '../store/ChartStore'
import CrosshairLabelView from './CrosshairLabelView'
import { type TextAttrs } from '../extension/figure/text'
import { genTimeStamp, getDateTimeFormat } from '../common/utils/dateTimeFormat'

export default class CrosshairVerticalLabelView extends CrosshairLabelView {
  override compare (crosshair: Crosshair): boolean {
    const isTimeShare = this.getWidget().getPane().getChart().getChartStore().getIsTimeShare()
    if (isTimeShare) return true
    return isValid(crosshair.kLineData) && crosshair.dataIndex === crosshair.realDataIndex
  }

  override getDirectionStyles (styles: CrosshairStyle): CrosshairDirectionStyle {
    return styles.vertical
  }

  override getText (crosshair: Crosshair, chartStore: ChartStore): string {
    const hintTs = crosshair.kLineData?.timestamp
    let timestamp = hintTs
    const isTimeShare = chartStore.getIsTimeShare()
    if (isTimeShare) {
      if (crosshair.realDataIndex !== crosshair.dataIndex) {
        const timeShareTicks = chartStore.getTimeShareTicks()
        const realIndex = crosshair.realDataIndex ?? 0
        if (realIndex < 0 || realIndex >= timeShareTicks.length) {
          return ''
        }
        const text = timeShareTicks[realIndex]
        timestamp = genTimeStamp(text, hintTs!)
      }
    }

    const dateTimeFormat = getDateTimeFormat()
    return chartStore.getCustomApi().formatDate(dateTimeFormat, timestamp!, 'YYYY-MM-DD HH:mm', FormatDateType.Crosshair)
  }

  override getTextAttrs (text: string, textWidth: number, crosshair: Crosshair, bounding: Bounding, styles: StateTextStyle): TextAttrs {
    const x = crosshair.realX!
    let optimalX: number
    let align: CanvasTextAlign = 'center'
    if (x - textWidth / 2 - styles.paddingLeft < 0) {
      optimalX = 0
      align = 'left'
    } else if (x + textWidth / 2 + styles.paddingRight > bounding.width) {
      optimalX = bounding.width
      align = 'right'
    } else {
      optimalX = x
    }
    return { x: optimalX, y: 0, text, align, baseline: 'top' }
  }
}
