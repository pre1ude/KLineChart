import type Coordinate from '../common/Coordinate'
import type Crosshair from '../common/Crosshair'
import type KLineData from '../common/KLineData'
import {
  getTooltipValueDirection,
  getTooltipDirectionVisual,
  type TooltipDirectionStyle,
  type TooltipDirectionVisual
} from '../common/TooltipDirection'
import type { TooltipIconIdentity } from '../common/Tooltip'
import {
  PolygonType,
  TooltipIconPosition,
  TooltipShowRule,
  type IndicatorStyle,
  type TooltipIconStyle,
  type TooltipLegend,
  type TooltipLegendChild,
  type TooltipStyle,
  type TooltipTextStyle
} from '../common/Styles'
import { type EventName, type MouseTouchEvent } from '../common/SyntheticEvent'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { isNumber, isObject, isString, isValid } from '../common/utils/typeChecks'
import { getFigureBaseStyles, getMergedDefaultStyles, isIndicatorCalcParamVisible, isIndicatorFigureLegendVisible, type Indicator, type IndicatorTooltipData } from '../component/Indicator'
import { createFigure, drawStaticFigure } from '../extension/figure'
import { type CustomApi } from '../Options'
import type DualYPane from '../pane/DualYPane'
import type XAxisWidget from '../widget/XAxisWidget'
import {
  type StandardTooltipBlock,
  type StandardTooltipContent,
  type TooltipRenderModel
} from './TooltipModel'
import TooltipModelBuilder from './TooltipModelBuilder'
import View from './View'

type StandardTooltipIconLayout = {
  type: 'icon'
  icon: TooltipIconStyle
  x: number
  y: number
}

type StandardTooltipLegendLayout = {
  type: 'legend'
  title: TooltipLegendChild
  value: TooltipLegendChild
  direction?: TooltipDirectionVisual
  x: number
  y: number
  titleTextWidth: number
  valueTextWidth: number
  styles: TooltipTextStyle
}

type StandardTooltipLayoutItem = StandardTooltipIconLayout | StandardTooltipLegendLayout

type StandardTooltipLineLayout = {
  x: number
  y: number
  width: number
  height: number
}

type StandardTooltipLayout = {
  coordinate: Coordinate
  prevRowHeight: number
  lines: StandardTooltipLineLayout[]
  items: StandardTooltipLayoutItem[]
}

export type { StandardTooltipContent } from './TooltipModel'

export default class IndicatorTooltipView extends View {
  private _hasHoverIcon = false
  private _startTop: number | null = null

  setHasHoverIcon(value: boolean): void {
    this._hasHoverIcon = value
  }

  /** 设置起始 top 位置，用于在 CandleTooltipView 之后绘制 */
  setStartTop(top: number | null): void {
    this._startTop = top
  }

  // View 本身不响应事件，让事件传递到子元素（Figure）
  // 当有 hover icon 时，View 响应 mouseMoveEvent 用于检测鼠标移出 icon
  override checkEventOn(_event: MouseTouchEvent, name: EventName): boolean {
    return name === 'mouseMoveEvent' && this._hasHoverIcon
  }

  override drawImp(ctx: CanvasRenderingContext2D): void {
    const model = this.buildRenderModel()
    this.drawModel(ctx, model, true, null)
  }

  buildRenderModel(): TooltipRenderModel {
    const model = TooltipModelBuilder.buildIndicator(this)
    if (this._startTop != null && model.blocks.length > 0) {
      model.blocks.forEach(block => { block.top = this._startTop! })
    }
    return model
  }

  drawModel(
    ctx: CanvasRenderingContext2D,
    model: TooltipRenderModel,
    interactive = true,
    hoveredIcon: TooltipIconIdentity | null = null
  ): void {
    if (interactive) {
      this.clear()
    }
    let top: number | undefined
    model.blocks.forEach(block => {
      if (block.type === 'standard') {
        top = this.drawStandardTooltip(
          ctx,
          hoveredIcon,
          block.contents,
          block.paneId,
          block.indicatorId,
          block.indicatorName,
          block.left,
          top ?? block.top,
          block.maxWidth,
          block.styles,
          interactive,
          model.directionStyle
        )
      }
    })
  }

  buildIndicatorTooltipBlocks(
    paneId: string,
    dataList: KLineData[],
    crosshair: Crosshair,
    left: number,
    top: number,
    maxWidth: number,
    styles: IndicatorStyle
  ): StandardTooltipBlock[] {
    const tooltipStyles = styles.tooltip
    if (!this.isDrawTooltip(crosshair, tooltipStyles)) {
      return []
    }
    const chartStore = this.getWidget().getPane().getChart().getChartStore()
    const customApi = chartStore.getCustomApi()
    const thousandsSeparator = chartStore.getThousandsSeparator()
    const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
    const blocks: StandardTooltipBlock[] = []
    const indicators = chartStore.getIndicatorStore().getInstances(paneId)
    const tooltipTextStyles = tooltipStyles.text
    indicators.forEach(indicator => {
      const { name, calcParamsText, values: legends, icons } = this.getIndicatorTooltipData(
        dataList, crosshair, indicator, customApi, thousandsSeparator, decimalFoldThreshold, styles
      )
      const nameValid = name.length > 0
      const legendValid = legends.length > 0
      if (nameValid || legendValid) {
        const [leftIcons, middleIcons, rightIcons] = this.classifyTooltipIcons(icons)
        const contents: StandardTooltipContent[] = [
          { type: 'icons', icons: leftIcons }
        ]
        if (nameValid) {
          let text = name
          if (calcParamsText.length > 0) {
            text = `${text}${calcParamsText}`
          }
          contents.push({
            type: 'legends',
            legends: [{ title: { text: '', color: tooltipTextStyles.color }, value: { text, color: tooltipTextStyles.color } }],
            styles: tooltipTextStyles
          })
        }
        contents.push({ type: 'icons', icons: middleIcons })
        if (legendValid) {
          contents.push({ type: 'legends', legends, styles: tooltipStyles.text })
        }
        contents.push({ type: 'icons', icons: rightIcons })
        blocks.push({
          type: 'standard',
          paneId,
          indicatorId: indicator.id,
          indicatorName: indicator.name,
          left,
          top,
          maxWidth,
          styles: tooltipStyles,
          contents
        })
      }
    })
    return blocks
  }

  protected drawStandardTooltip(
    ctx: CanvasRenderingContext2D,
    hoveredIcon: TooltipIconIdentity | null,
    contents: StandardTooltipContent[],
    paneId: string,
    indicatorId: string,
    indicatorName: string,
    left: number,
    top: number,
    maxWidth: number,
    styles: TooltipStyle,
    interactive = true,
    directionStyle?: TooltipDirectionStyle
  ): number {
    const layout = this.createStandardTooltipLayout(left, top)
    contents.forEach(content => {
      switch (content.type) {
        case 'icons': {
          this.layoutStandardTooltipIcons(layout, content.icons, left, maxWidth)
          break
        }
        case 'legends': {
          this.layoutStandardTooltipLegends(layout, content.legends, left, maxWidth, content.styles, directionStyle)
          break
        }
      }
    })
    this.drawStandardTooltipLineBackgrounds(ctx, layout.lines, styles)
    this.drawStandardTooltipItems(ctx, layout.items, hoveredIcon, paneId, indicatorId, indicatorName, interactive)
    return layout.coordinate.y + layout.prevRowHeight
  }

  private createStandardTooltipLayout(left: number, top: number): StandardTooltipLayout {
    return {
      coordinate: { x: left, y: top },
      prevRowHeight: 0,
      lines: [],
      items: []
    }
  }

  private layoutStandardTooltipIcons(
    layout: StandardTooltipLayout,
    icons: TooltipIconStyle[],
    left: number,
    maxWidth: number
  ): void {
    if (icons.length > 0) {
      const iconLayouts = icons.map(icon => {
        const {
          marginLeft = 0, marginTop = 0, marginRight = 0, marginBottom = 0,
          paddingLeft = 0, paddingTop = 0, paddingRight = 0, paddingBottom = 0,
          size, fontFamily, icon: text
        } = icon
        const font = createFont(size, 'normal', fontFamily)
        const textWidth = calcTextWidth(text, font)
        return {
          icon,
          width: marginLeft + paddingLeft + textWidth + paddingRight + marginRight,
          height: marginTop + paddingTop + size + paddingBottom + marginBottom
        }
      })
      const width = iconLayouts.reduce((total, iconLayout) => total + iconLayout.width, 0)
      const height = iconLayouts.reduce((max, iconLayout) => Math.max(max, iconLayout.height), 0)
      this.prepareStandardTooltipLine(layout, width, height, left, maxWidth)

      let x = layout.coordinate.x
      const y = layout.coordinate.y
      iconLayouts.forEach(({ icon, width }) => {
        layout.items.push({ type: 'icon', icon, x, y })
        x += width
      })
      this.extendStandardTooltipLine(layout.lines, layout.coordinate.x, y, width, layout.prevRowHeight)
      layout.coordinate.x += width
    }
  }

  private layoutStandardTooltipLegends(
    layout: StandardTooltipLayout,
    legends: TooltipLegend[],
    left: number,
    maxWidth: number,
    styles: TooltipTextStyle,
    directionStyle?: TooltipDirectionStyle
  ): void {
    if (legends.length > 0) {
      const { marginLeft, marginTop, marginRight, marginBottom, size, fontFamily, weight } = styles
      const font = createFont(size, weight, fontFamily)
      legends.forEach(data => {
        const title = this.getTooltipLegendChild(data.title, styles.color)
        const value = this.getTooltipLegendChild(data.value, styles.color)
        const direction = getTooltipDirectionVisual(data.direction, directionStyle)
        const titleTextWidth = calcTextWidth(title.text, font)
        const valueTextWidth = calcTextWidth(value.text, font)
        const directionTextWidth = direction == null ? 0 : calcTextWidth(direction.text, font)
        const totalTextWidth = titleTextWidth + valueTextWidth + directionTextWidth
        const width = marginLeft + totalTextWidth + marginRight
        const height = marginTop + size + marginBottom
        this.prepareStandardTooltipLine(layout, width, height, left, maxWidth)
        layout.items.push({
          type: 'legend',
          title,
          value,
          direction,
          x: layout.coordinate.x,
          y: layout.coordinate.y,
          titleTextWidth,
          valueTextWidth,
          styles
        })
        this.extendStandardTooltipLine(layout.lines, layout.coordinate.x, layout.coordinate.y, width, layout.prevRowHeight)
        layout.coordinate.x += width
      })
    }
  }

  private prepareStandardTooltipLine(
    layout: StandardTooltipLayout,
    width: number,
    height: number,
    left: number,
    maxWidth: number
  ): void {
    if (layout.coordinate.x + width > maxWidth) {
      layout.coordinate.x = left
      layout.coordinate.y += layout.prevRowHeight
      layout.prevRowHeight = height
    } else {
      layout.prevRowHeight = Math.max(layout.prevRowHeight, height)
    }
  }

  private extendStandardTooltipLine(
    lines: StandardTooltipLineLayout[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (width <= 0 || height <= 0) {
      return
    }
    const line = lines[lines.length - 1]
    if (isValid(line) && line.y === y) {
      const left = Math.min(line.x, x)
      const right = Math.max(line.x + line.width, x + width)
      line.x = left
      line.width = right - left
      line.height = Math.max(line.height, height)
      return
    }
    lines.push({ x, y, width, height })
  }

  private drawStandardTooltipLineBackgrounds(
    ctx: CanvasRenderingContext2D,
    lines: StandardTooltipLineLayout[],
    styles: TooltipStyle
  ): void {
    if (!styles.showBackground) {
      return
    }

    const { backgroundColor } = styles
    const rects = lines
      .filter(line => line.width > 0 && line.height > 0)
      .map(line => ({
        x: line.x,
        y: line.y,
        width: line.width,
        height: line.height
      }))

    if (rects.length > 0) {
      drawStaticFigure(ctx, 'rect', {
        attrs: rects,
        styles: {
          style: PolygonType.Fill,
          color: backgroundColor
        }
      })
    }
  }

  private drawStandardTooltipItems(
    ctx: CanvasRenderingContext2D,
    items: StandardTooltipLayoutItem[],
    hoveredIcon: TooltipIconIdentity | null,
    paneId: string,
    indicatorId: string,
    indicatorName: string,
    interactive: boolean
  ): void {
    items.forEach(item => {
      if (item.type === 'icon') {
        const { icon } = item
        const {
          marginLeft = 0, marginTop = 0,
          paddingLeft = 0, paddingTop = 0, paddingRight = 0, paddingBottom = 0,
          color, activeColor, size, fontFamily, icon: text,
          backgroundColor, activeBackgroundColor
        } = icon
        const active = hoveredIcon?.paneId === paneId && hoveredIcon?.indicatorId === indicatorId && hoveredIcon?.iconId === icon.id
        const iconFigure = createFigure('text')
          .setAttrs({ text, x: item.x + marginLeft, y: item.y + marginTop })
          .setStyles({
            paddingLeft,
            paddingTop,
            paddingRight,
            paddingBottom,
            color: active ? activeColor : color,
            size,
            fontFamily,
            backgroundColor: active ? activeBackgroundColor : backgroundColor
          })
          .setData({ paneId, indicatorId, indicatorName, iconId: icon.id })

        iconFigure.draw(ctx)

        if (interactive) {
          this.addChild(iconFigure)
        }

        return
      }
      const { title, value, direction, titleTextWidth, valueTextWidth, styles } = item
      const { marginLeft, marginTop, size, fontFamily, weight } = styles
      if (title.text.length > 0) {
        drawStaticFigure(ctx, 'text', {
          attrs: { x: item.x + marginLeft, y: item.y + marginTop, text: title.text },
          styles: { color: title.color, size, fontFamily, weight }
        })
      }
      drawStaticFigure(ctx, 'text', {
        attrs: { x: item.x + marginLeft + titleTextWidth, y: item.y + marginTop, text: value.text },
        styles: { color: value.color, size, fontFamily, weight }
      })
      if (direction != null) {
        drawStaticFigure(ctx, 'text', {
          attrs: {
            x: item.x + marginLeft + titleTextWidth + valueTextWidth,
            y: item.y + marginTop,
            text: direction.text
          },
          styles: { color: direction.color, size, fontFamily, weight }
        })
      }
    })
  }

  private getTooltipLegendChild(value: string | TooltipLegendChild, color: string): TooltipLegendChild {
    if (isString(value)) {
      return { text: value, color }
    }
    return value
  }

  isDrawTooltip(crosshair: Crosshair, styles: TooltipStyle): boolean {
    const showRule = styles.showRule
    return showRule === TooltipShowRule.Always ||
      (showRule === TooltipShowRule.FollowCross && isString(crosshair.paneId))
  }

  protected getIndicatorTooltipData(
    dataList: KLineData[],
    crosshair: Crosshair,
    indicator: Indicator,
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    styles: IndicatorStyle
  ): IndicatorTooltipData {
    const mergedDefaultStyles = getMergedDefaultStyles(indicator, styles)
    const tooltipStyles = mergedDefaultStyles.tooltip
    const dataIndex = crosshair.dataIndex ?? 0
    const name = tooltipStyles.showName ? indicator.shortName : ''
    let calcParamsText = ''
    const calcParams = indicator.calcParams
    if (calcParams.length > 0 && tooltipStyles.showParams) {
      const visibleParams = calcParams.filter((param, index) => (
        isValid(param) && isIndicatorCalcParamVisible(indicator, index)
      ))
      if (visibleParams.length > 0) {
        calcParamsText = `(${visibleParams.join(',')})`
      }
    }

    const tooltipData: IndicatorTooltipData = { name, calcParamsText, values: [], icons: tooltipStyles.icons }

    const result = indicator.result ?? []

    const legends: TooltipLegend[] = []
    if (indicator.visible) {
      const indicatorData = result[dataIndex] ?? {}

      indicator.figures.forEach((figure, figureIndex) => {
        if (isString(figure.title) && isIndicatorFigureLegendVisible(indicator, figure)) {
          const figureStaticStyles = indicator.styles?.figures?.[figure.key] ?? {}

          const figureBaseStyles = getFigureBaseStyles(figure.type ?? 'line', figureIndex, mergedDefaultStyles)
          const figureDynamicStyles = figure.styles?.(dataIndex, indicator, dataList, mergedDefaultStyles)
          const figureStyles = { ...figureBaseStyles, ...figureStaticStyles, ...figureDynamicStyles }
          // tooltip 颜色只支持字符串，CanvasGradient 回退到默认颜色
          const figureColor = figureStyles.color
          const color = (typeof figureColor === 'string' ? figureColor : null) ?? mergedDefaultStyles.tooltip.text.color

          const rawValue = (indicatorData as Record<string, unknown>)[figure.key]
          let value = rawValue ?? tooltipStyles.defaultValue
          if (isNumber(value)) {
            value = formatPrecision(value, indicator.precision)
            if (indicator.shouldFormatBigNumber) {
              value = customApi.formatBigNumber(value as string)
            }
            value = formatFoldDecimal(formatThousands(value as string, thousandsSeparator), decimalFoldThreshold)
          }
          legends.push({
            title: { text: figure.title, color },
            value: { text: value as string, color },
            direction: getTooltipValueDirection(
              rawValue,
              (result[dataIndex - 1] as Record<string, unknown> | undefined)?.[figure.key]
            )
          })
        }
      })
      tooltipData.values = legends
    }

    if (indicator.createTooltipDataSource) {
      const widget = this.getWidget()
      const pane = widget.getPane()
      const chartStore = pane.getChart().getChartStore()
      const xAxis = (pane.getChart().getXAxisPane().getMainWidget() as XAxisWidget).getAxisComponent()
      const dualYPane = pane as DualYPane
      const yScale = dualYPane.getYScaleById(dualYPane.resolveIndicatorYScaleId(indicator))?.getComponent() ??
        dualYPane.getDefaultYScale().getComponent()
      const { name: customName, calcParamsText: customCalcParamsText, values: customLegends, icons: customIcons } = indicator.createTooltipDataSource({
        kLineDataList: dataList,
        indicator,
        visibleRange: chartStore.getTimeScaleStore().getVisibleRange(),
        bounding: widget.getBounding(),
        crosshair,
        defaultStyles: mergedDefaultStyles,
        xAxis,
        yScale
      })
      if (isString(customName) && tooltipStyles.showName) {
        tooltipData.name = customName
      }
      if (isString(customCalcParamsText) && tooltipStyles.showParams) {
        tooltipData.calcParamsText = customCalcParamsText
      }
      if (isValid(customIcons)) {
        tooltipData.icons = customIcons
      }
      if (isValid(customLegends) && indicator.visible) {
        const optimizedLegends: TooltipLegend[] = []
        const color = mergedDefaultStyles.tooltip.text.color
        customLegends.forEach(data => {
          let title = { text: '', color }
          if (isObject(data.title)) {
            title = data.title
          } else {
            title.text = data.title
          }
          let value = { text: '', color }
          if (isObject(data.value)) {
            value = data.value
          } else {
            value.text = data.value ?? tooltipStyles.defaultValue
          }
          if (isNumber(value.text)) {
            let text = formatPrecision(value.text, indicator.precision)
            if (indicator.shouldFormatBigNumber) {
              text = customApi.formatBigNumber(text)
            }
            text = formatFoldDecimal(formatThousands(text, thousandsSeparator), decimalFoldThreshold)
            value.text = text
          }
          optimizedLegends.push({ title, value, direction: data.direction })
        })
        tooltipData.values = optimizedLegends
      }
    }
    return tooltipData
  }

  classifyTooltipIcons(icons: TooltipIconStyle[]): TooltipIconStyle[][] {
    const leftIcons: TooltipIconStyle[] = []
    const middleIcons: TooltipIconStyle[] = []
    const rightIcons: TooltipIconStyle[] = []
    icons.forEach(icon => {
      switch (icon.position) {
        case TooltipIconPosition.Left: {
          leftIcons.push(icon)
          break
        }
        case TooltipIconPosition.Middle: {
          middleIcons.push(icon)
          break
        }
        case TooltipIconPosition.Right: {
          rightIcons.push(icon)
          break
        }
      }
    })
    return [leftIcons, middleIcons, rightIcons]
  }
}
