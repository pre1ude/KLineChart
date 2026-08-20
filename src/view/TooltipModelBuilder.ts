import { TooltipShowType } from '../common/Styles'
import { getDateTimeFormat } from '../common/utils/dateTimeFormat'
import type DualYPane from '../pane/DualYPane'
import type CandleTooltipView from './CandleTooltipView'
import type IndicatorTooltipView from './IndicatorTooltipView'
import type { RectTooltipBlock, StandardTooltipBlock, StandardTooltipContent, TooltipRenderModel } from './TooltipModel'

/**
 * Builds the renderer-neutral tooltip model. Formatting remains owned by the
 * tooltip Views; this class only determines block order and visibility.
 */
export default class TooltipModelBuilder {
  static buildIndicator(view: IndicatorTooltipView): TooltipRenderModel {
    const widget = view.getWidget()
    const pane = widget.getPane()
    const chartStore = pane.getChart().getChartStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    const bounding = widget.getBounding()
    if (!crosshair.kLineData) {
      return { visible: false, paneId: pane.getId(), bounding, blocks: [] }
    }

    const styles = chartStore.getStyles().indicator
    const { offsetLeft, offsetTop, offsetRight } = styles.tooltip
    const blocks = view.buildIndicatorTooltipBlocks(
      pane.getId(), chartStore.getDataList(), crosshair,
      offsetLeft, offsetTop, bounding.width - offsetRight, styles
    )
    return { visible: blocks.length > 0, paneId: pane.getId(), bounding, blocks }
  }

  static buildCandle(view: CandleTooltipView): TooltipRenderModel {
    const widget = view.getWidget()
    const pane = widget.getPane() as DualYPane
    const chartStore = pane.getChart().getChartStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    const bounding = widget.getBounding()
    if (!crosshair.kLineData) {
      return { visible: false, paneId: pane.getId(), bounding, blocks: [] }
    }

    const dataList = chartStore.getDataList()
    const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
    const styles = chartStore.getStyles()
    const candleStyles = styles.candle
    const indicatorStyles = styles.indicator
    const { offsetLeft, offsetTop, offsetRight } = candleStyles.tooltip
    const maxWidth = bounding.width - offsetRight
    const candleRect = candleStyles.tooltip.showType === TooltipShowType.Rect
    const indicatorRect = indicatorStyles.tooltip.showType === TooltipShowType.Rect
    const blocks: Array<StandardTooltipBlock | RectTooltipBlock> = []

    const candleStandard = (): StandardTooltipBlock => {
      const dataIndex = crosshair.dataIndex ?? 0
      const legends = view.getCandleTooltipLegends(
        { prev: dataList[dataIndex - 1] ?? null, current: crosshair.kLineData!, next: dataList[dataIndex + 1] ?? null },
        chartStore.getPrecision(), getDateTimeFormat(), chartStore.getLocale(), chartStore.getCustomApi(),
        chartStore.getThousandsSeparator(), chartStore.getDecimalFoldThreshold(), candleStyles
      )
      const [leftIcons, middleIcons, rightIcons] = view.classifyTooltipIcons(candleStyles.tooltip.icons)
      const contents: StandardTooltipContent[] = [
        { type: 'icons', icons: leftIcons },
        { type: 'icons', icons: middleIcons }
      ]
      if (legends.length > 0) {
        contents.push({ type: 'legends', legends, styles: candleStyles.tooltip.text })
      }
      contents.push({ type: 'icons', icons: rightIcons })
      return {
        type: 'standard', paneId: pane.getId(), indicatorId: '', indicatorName: '',
        left: offsetLeft, top: offsetTop, maxWidth, styles: candleStyles.tooltip, contents
      }
    }

    const candleShown = view.isDrawTooltip(crosshair, candleStyles.tooltip)
    const indicatorShown = view.isDrawTooltip(crosshair, indicatorStyles.tooltip)
    if (!candleRect && candleShown) {
      const block = candleStandard()
      const hasContent = block.contents.some(content => (
        content.type === 'icons' ? content.icons.length > 0 : content.legends.length > 0
      ))
      if (hasContent) {
        blocks.push(block)
      }
    }
    if (!indicatorRect && indicatorShown) {
      blocks.push(...view.buildIndicatorTooltipBlocks(
        pane.getId(), dataList, crosshair, offsetLeft, offsetTop, maxWidth, indicatorStyles
      ))
    }
    if (candleRect || indicatorRect) {
      const rectBlock = view.buildRectTooltipBlock(
        dataList, indicators, bounding, crosshair,
        candleShown && candleRect, indicatorShown && indicatorRect,
        offsetTop, styles
      )
      if (rectBlock !== null) {
        if (candleRect && indicatorRect) {
          blocks.unshift(rectBlock)
        } else {
          blocks.push(rectBlock)
        }
      }
    }
    return { visible: blocks.length > 0, paneId: pane.getId(), bounding, blocks }
  }
}
