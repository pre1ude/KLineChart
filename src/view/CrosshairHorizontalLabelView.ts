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
import { type CrosshairStyle, type CrosshairDirectionStyle, YAxisType, type StateTextStyle } from '../common/Styles'
import { isString } from '../common/utils/typeChecks'
import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import { createFont } from '../common/utils/canvas'
import { type TextAttrs } from '../extension/figure/text'
import type ChartStore from '../store/ChartStore'
import View from './View'
import type YAxisWidget from '../widget/YAxisWidget'
import { drawStaticFigure } from '../extension/figure'

export default class CrosshairHorizontalLabelView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = widget.getPane().getChart().getChartStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    const styles = chartStore.getStyles().crosshair
    if (isString(crosshair.paneId) && this.compare(crosshair, pane.getId())) {
      if (styles.show) {
        const directionStyles = this.getDirectionStyles(styles)
        const textStyles = directionStyles.text
        if (directionStyles.show && textStyles.show) {
          const text = this.getText(crosshair, chartStore)
          ctx.font = createFont(textStyles.size, textStyles.weight, textStyles.family)
          drawStaticFigure(ctx, 'text', {
            attrs: this.getTextAttrs(text, ctx.measureText(text).width, crosshair, bounding, textStyles),
            styles: textStyles
          })
        }
      }
    }
  }

  protected compare (crosshair: Crosshair, paneId: string): boolean {
    return crosshair.paneId === paneId
  }

  protected getDirectionStyles (styles: CrosshairStyle): CrosshairDirectionStyle {
    return styles.horizontal
  }

  protected getText (crosshair: Crosshair, chartStore: ChartStore): string {
    const widget = this.getWidget() as unknown as YAxisWidget
    const axisType = widget.getAxisType()
    const yAxis = widget.getAxisComponent()
    const value = yAxis.convertFromPixel(crosshair.y!)
    let text: string
    if (axisType === YAxisType.Percentage || axisType === YAxisType.MinutePercentage) {
      const fromData = chartStore.getVisibleFirstData()
      if (!fromData) {
        text = ''
      } else {
        if (axisType === YAxisType.MinutePercentage) {
          text = `${((value - fromData.prevClose) / fromData.prevClose * 100).toFixed(2)}%`
        } else {
          text = `${((value - fromData.close) / fromData.close * 100).toFixed(2)}%`
        }
      }
    } else {
      const indicators = chartStore.getIndicatorStore().getInstances(crosshair.paneId!)
      let precision = 0
      let shouldFormatBigNumber = false
      if (yAxis.isInCandle()) {
        precision = chartStore.getPrecision().price
      } else {
        indicators.forEach(indicator => {
          precision = Math.max(indicator.precision, precision)
          if (!shouldFormatBigNumber) {
            shouldFormatBigNumber = indicator.shouldFormatBigNumber
          }
        })
      }
      text = formatPrecision(value, precision)
      if (shouldFormatBigNumber) {
        text = chartStore.getCustomApi().formatBigNumber(text)
      }
    }
    return formatFoldDecimal(formatThousands(text, chartStore.getThousandsSeparator()), chartStore.getDecimalFoldThreshold())
  }

  protected getTextAttrs (text: string, _textWidth: number, crosshair: Crosshair, bounding: Bounding, _styles: StateTextStyle): TextAttrs {
    const widget = this.getWidget() as unknown as YAxisWidget
    const isAlignLeft = widget.isAlignLeft()
    const align = isAlignLeft ? 'left' : 'right'

    return { x: bounding.width * (1 - +isAlignLeft), y: crosshair.y!, text, align, baseline: 'middle' }
  }
}
