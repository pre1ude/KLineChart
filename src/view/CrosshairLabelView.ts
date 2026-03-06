import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import { type CrosshairDirectionStyle, type CrosshairStyle, type StateTextStyle } from '../common/Styles'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { isString } from '../common/utils/typeChecks'
import { drawStaticFigure } from '../extension/figure'
import { type TextAttrs } from '../extension/figure/text'
import type ChartStore from '../store/ChartStore'
import View from './View'

/**
 * 十字光标标签视图抽象基类
 * 提供通用的绘制框架，子类实现具体的标签逻辑
 */
export default abstract class CrosshairLabelView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = widget.getPane().getChart().getChartStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    const styles = chartStore.getStyles().crosshair
    if (isString(crosshair.paneId) && this.compare(crosshair, pane.getId())) {
      if (styles.show) {
        const directionStyles = this.getDirectionStyles(styles)
        const textStyles = { ...directionStyles.text }
        if (directionStyles.show && textStyles.show) {
          const text = this.getText(crosshair, chartStore)
          const textWidth = calcTextWidth(text, createFont(textStyles.size, textStyles.weight, textStyles.fontFamily))
          drawStaticFigure(ctx, 'text', {
            attrs: this.getTextAttrs(text, textWidth, crosshair, bounding, textStyles),
            styles: textStyles
          })
        }
      }
    }
  }

  /**
   * 比较十字光标是否应该在当前面板显示
   */
  protected abstract compare(crosshair: Crosshair, paneId: string): boolean

  /**
   * 获取方向样式（水平或垂直）
   */
  protected abstract getDirectionStyles(styles: CrosshairStyle): CrosshairDirectionStyle

  /**
   * 获取要显示的文本内容
   */
  protected abstract getText(crosshair: Crosshair, chartStore: ChartStore): string

  /**
   * 获取文本绘制属性
   */
  protected abstract getTextAttrs(text: string, textWidth: number, crosshair: Crosshair, bounding: Bounding, styles: StateTextStyle): TextAttrs
}
