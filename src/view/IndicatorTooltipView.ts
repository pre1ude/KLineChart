import type Coordinate from '../common/Coordinate'
import type Crosshair from '../common/Crosshair'
import type KLineData from '../common/KLineData'
import { TooltipIconPosition, TooltipShowRule, type IndicatorStyle, type TooltipIconStyle, type TooltipLegend, type TooltipLegendChild, type TooltipStyle, type TooltipTextStyle } from '../common/Styles'
import { type EventName, type MouseTouchEvent } from '../common/SyntheticEvent'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { isNumber, isObject, isString, isValid } from '../common/utils/typeChecks'
import { getFigureBaseStyles, getMergedDefaultStyles, isIndicatorFigureVisible, type Indicator, type IndicatorTooltipData } from '../component/Indicator'
import { createFigure, drawStaticFigure } from '../extension/figure'
import { type CustomApi } from '../Options'
import type DualYPane from '../pane/DualYPane'
import { type TooltipIcon } from '../store/TooltipStore'
import type XAxisWidget from '../widget/XAxisWidget'
import View from './View'

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
    const widget = this.getWidget()
    const pane = widget.getPane()
    const chartStore = pane.getChart().getChartStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    if (isValid(crosshair.kLineData)) {
      const bounding = widget.getBounding()
      const customApi = chartStore.getCustomApi()
      const thousandsSeparator = chartStore.getThousandsSeparator()
      const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
      const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
      const activeIcon = chartStore.getTooltipStore().getActiveIcon()
      const defaultStyles = chartStore.getStyles().indicator
      const { offsetLeft, offsetTop, offsetRight } = defaultStyles.tooltip
      // 如果设置了 startTop，使用它；否则使用默认的 offsetTop
      const top = this._startTop ?? offsetTop
      this.drawIndicatorTooltip(
        ctx, pane.getId(), chartStore.getDataList(),
        crosshair, activeIcon, indicators, customApi,
        thousandsSeparator, decimalFoldThreshold,
        offsetLeft, top,
        bounding.width - offsetRight, defaultStyles
      )
    }
  }

  protected drawIndicatorTooltip(
    ctx: CanvasRenderingContext2D,
    paneId: string,
    dataList: KLineData[],
    crosshair: Crosshair,
    activeTooltipIcon: TooltipIcon | null,
    indicators: Indicator[],
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    left: number,
    top: number,
    maxWidth: number,
    styles: IndicatorStyle
  ): number {
    const tooltipStyles = styles.tooltip
    if (this.isDrawTooltip(crosshair, tooltipStyles)) {
      const tooltipTextStyles = tooltipStyles.text
      indicators.forEach(indicator => {
        let prevRowHeight = 0
        const coordinate = { x: left, y: top }
        const { name, calcParamsText, values: legends, icons } = this.getIndicatorTooltipData(dataList, crosshair, indicator, customApi, thousandsSeparator, decimalFoldThreshold, styles)
        const nameValid = name.length > 0
        const legendValid = legends.length > 0
        if (nameValid || legendValid) {
          const [leftIcons, middleIcons, rightIcons] = this.classifyTooltipIcons(icons)
          prevRowHeight = this.drawStandardTooltipIcons(
            ctx, activeTooltipIcon, leftIcons,
            coordinate, paneId, indicator.id, indicator.name,
            left, prevRowHeight, maxWidth
          )

          if (nameValid) {
            let text = name
            if (calcParamsText.length > 0) {
              text = `${text}${calcParamsText}`
            }
            prevRowHeight = this.drawStandardTooltipLegends(
              ctx,
              [
                {
                  title: { text: '', color: tooltipTextStyles.color },
                  value: { text, color: tooltipTextStyles.color }
                }
              ],
              coordinate, left, prevRowHeight, maxWidth, tooltipTextStyles
            )
          }

          prevRowHeight = this.drawStandardTooltipIcons(
            ctx, activeTooltipIcon, middleIcons,
            coordinate, paneId, indicator.id, indicator.name,
            left, prevRowHeight, maxWidth
          )

          if (legendValid) {
            prevRowHeight = this.drawStandardTooltipLegends(
              ctx, legends, coordinate,
              left, prevRowHeight, maxWidth, tooltipStyles.text
            )
          }

          // draw right icons
          prevRowHeight = this.drawStandardTooltipIcons(
            ctx, activeTooltipIcon, rightIcons,
            coordinate, paneId, indicator.id, indicator.name,
            left, prevRowHeight, maxWidth
          )
          top = coordinate.y + prevRowHeight
        }
      })
    }
    return top
  }

  // todo need optimize
  protected drawStandardTooltipIcons(
    ctx: CanvasRenderingContext2D,
    activeIcon: TooltipIcon | null,
    icons: TooltipIconStyle[],
    coordinate: Coordinate,
    paneId: string,
    indicatorId: string,
    indicatorName: string,
    left: number,
    prevRowHeight: number,
    maxWidth: number
  ): number {
    if (icons.length > 0) {
      let width = 0
      let height = 0
      icons.forEach(icon => {
        const {
          marginLeft = 0, marginTop = 0, marginRight = 0, marginBottom = 0,
          paddingLeft = 0, paddingTop = 0, paddingRight = 0, paddingBottom = 0,
          size, fontFamily, icon: text
        } = icon
        const font = createFont(size, 'normal', fontFamily)
        width += (marginLeft + paddingLeft + calcTextWidth(text, font) + paddingRight + marginRight)
        height = Math.max(height, marginTop + paddingTop + size + paddingBottom + marginBottom)
      })
      if (coordinate.x + width > maxWidth) {
        coordinate.x = left
        coordinate.y += prevRowHeight
        prevRowHeight = height
      } else {
        prevRowHeight = Math.max(prevRowHeight, height)
      }
      icons.forEach(icon => {
        const {
          marginLeft = 0, marginTop = 0, marginRight = 0,
          paddingLeft = 0, paddingTop = 0, paddingRight = 0, paddingBottom = 0,
          color, activeColor, size, fontFamily, icon: text,
          backgroundColor, activeBackgroundColor
        } = icon
        const active = activeIcon?.paneId === paneId && activeIcon?.indicatorId === indicatorId && activeIcon?.iconId === icon.id
        const iconFigure = createFigure('text')
          .setAttrs({ text, x: coordinate.x + marginLeft, y: coordinate.y + marginTop })
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

        this.addChild(iconFigure)

        const font = createFont(size, 'normal', fontFamily)
        coordinate.x += (marginLeft + paddingLeft + calcTextWidth(text, font) + paddingRight + marginRight)
      })
    }
    return prevRowHeight
  }

  protected drawStandardTooltipLegends(
    ctx: CanvasRenderingContext2D,
    legends: TooltipLegend[],
    coordinate: Coordinate,
    left: number,
    prevRowHeight: number,
    maxWidth: number,
    styles: TooltipTextStyle
  ): number {
    if (legends.length > 0) {
      const { marginLeft, marginTop, marginRight, marginBottom, size, fontFamily, weight } = styles
      const font = createFont(size, weight, fontFamily)
      legends.forEach(data => {
        const title = data.title as TooltipLegendChild
        const value = data.value as TooltipLegendChild
        const titleTextWidth = calcTextWidth(title.text, font)
        const valueTextWidth = calcTextWidth(value.text, font)
        const totalTextWidth = titleTextWidth + valueTextWidth
        const h = marginTop + size + marginBottom
        if (coordinate.x + marginLeft + totalTextWidth + marginRight > maxWidth) {
          coordinate.x = left
          coordinate.y += prevRowHeight
          prevRowHeight = h
        } else {
          prevRowHeight = Math.max(prevRowHeight, h)
        }
        if (title.text.length > 0) {
          drawStaticFigure(ctx, 'text', {
            attrs: { x: coordinate.x + marginLeft, y: coordinate.y + marginTop, text: title.text },
            styles: { color: title.color, size, fontFamily, weight }
          })
        }
        drawStaticFigure(ctx, 'text', {
          attrs: { x: coordinate.x + marginLeft + titleTextWidth, y: coordinate.y + marginTop, text: value.text },
          styles: { color: value.color, size, fontFamily, weight }
        })
        coordinate.x += (marginLeft + totalTextWidth + marginRight)
      })
    }
    return prevRowHeight
  }

  protected isDrawTooltip(crosshair: Crosshair, styles: TooltipStyle): boolean {
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
      const visibleParams = calcParams.filter((_, index) => {
        const figureStaticStyles = indicator.styles?.figures?.[`${indicator.name.toLowerCase()}${index + 1}`]
        return figureStaticStyles?.visible !== false
      })
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
        if (isString(figure.title) && isIndicatorFigureVisible(indicator, figure)) {
          const figureStaticStyles = indicator.styles?.figures?.[figure.key] ?? {}

          const figureBaseStyles = getFigureBaseStyles(figure.type ?? 'line', figureIndex, mergedDefaultStyles)
          const figureDynamicStyles = figure.styles?.(dataIndex, indicator, dataList, mergedDefaultStyles)
          const figureStyles = { ...figureBaseStyles, ...figureStaticStyles, ...figureDynamicStyles }
          // tooltip 颜色只支持字符串，CanvasGradient 回退到默认颜色
          const figureColor = figureStyles.color
          const color = (typeof figureColor === 'string' ? figureColor : null) ?? mergedDefaultStyles.tooltip.text.color

          let value = (indicatorData as Record<string, unknown>)[figure.key] ?? tooltipStyles.defaultValue
          if (isNumber(value)) {
            value = formatPrecision(value, indicator.precision)
            if (indicator.shouldFormatBigNumber) {
              value = customApi.formatBigNumber(value as string)
            }
            value = formatFoldDecimal(formatThousands(value as string, thousandsSeparator), decimalFoldThreshold)
          }
          legends.push({ title: { text: figure.title, color }, value: { text: value as string, color } })
        }
      })
      tooltipData.values = legends
    }

    if (indicator.createTooltipDataSource) {
      const widget = this.getWidget()
      const pane = widget.getPane()
      const chartStore = pane.getChart().getChartStore()
      const xAxis = (pane.getChart().getXAxisPane().getMainWidget() as XAxisWidget).getAxisComponent()
      const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
      const { name: customName, calcParamsText: customCalcParamsText, values: customLegends, icons: customIcons } = indicator.createTooltipDataSource({
        kLineDataList: dataList,
        indicator,
        visibleRange: chartStore.getTimeScaleStore().getVisibleRange(),
        bounding: widget.getBounding(),
        crosshair,
        defaultStyles: mergedDefaultStyles,
        xAxis,
        yAxis
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
          optimizedLegends.push({ title, value })
        })
        tooltipData.values = optimizedLegends
      }
    }
    return tooltipData
  }

  protected classifyTooltipIcons(icons: TooltipIconStyle[]): TooltipIconStyle[][] {
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
