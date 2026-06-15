import { drawStaticFigure } from '../extension/figure'
import type DualYPane from '../pane/DualYPane'
import View from './View'
import { getPrimaryGridLineStyle } from './utils/gridLineStyle'

/** 分时 0% 的线 */
export default class CandleTimeShareZeroLineView extends View {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const bounding = widget.getBounding()
    const chartStore = pane.getChart().getChartStore()

    // 只在分时图模式下显示
    if (!chartStore.getIsTimeShare()) {
      return
    }

    const styles = chartStore.getStyles()
    const gridStyles = styles.grid
    const primaryGridStyles = getPrimaryGridLineStyle(gridStyles.horizontal)

    if (gridStyles.show && gridStyles.horizontal.show && primaryGridStyles.show) {
      const yAxis = (pane as DualYPane).getMainAxisWidget().getAxisComponent()

      // 使用 getTimeShareBasisPrice 获取基准价格
      const basisPrice = chartStore.getTimeShareBasisPrice()

      if (basisPrice > 0) {
        const yPos = yAxis.convertToPixel(basisPrice)
        drawStaticFigure(ctx, 'line', {
          attrs: {
            coordinates: [
              { x: 0, y: yPos },
              { x: bounding.width, y: yPos }
            ]
          },
          styles: {
            style: primaryGridStyles.style,
            color: primaryGridStyles.color,
            size: primaryGridStyles.size,
            dashedValue: primaryGridStyles.dashedValue
          }
        })
      }
    }
  }
}
