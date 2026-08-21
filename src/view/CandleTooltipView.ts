import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import type KLineData from '../common/KLineData'
import type Precision from '../common/Precision'
import {
  type TooltipIconIdentity
} from '../common/Tooltip'
import { getTooltipDirectionVisual, type TooltipDirectionStyle } from '../common/TooltipDirection'
import {
  type CandleStyle,
  type CandleTooltipCustomCallbackData,
  CandleTooltipRectPosition,
  PolygonType,
  type Styles,
  type TooltipLegend, type TooltipLegendChild
} from '../common/Styles'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { type DateTimeFormat, getDateTimeFormat } from '../common/utils/dateTimeFormat'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { isFunction, isObject } from '../common/utils/typeChecks'
import type { Indicator } from '../component/Indicator'
import { drawStaticFigure } from '../extension/figure'
import { i18n } from '../extension/i18n/index'
import { type CustomApi, FormatDateType } from '../Options'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'
import IndicatorTooltipView from './IndicatorTooltipView'
import {
  type RectTooltipBlock,
  type TooltipRenderModel
} from './TooltipModel'
import TooltipModelBuilder from './TooltipModelBuilder'

export default class CandleTooltipView extends IndicatorTooltipView {
  override buildRenderModel(): TooltipRenderModel {
    return TooltipModelBuilder.buildCandle(this)
  }

  override drawImp(ctx: CanvasRenderingContext2D): void {
    const model = this.buildRenderModel()
    this.drawModel(ctx, model, true, null)
  }

  override drawModel(
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
          block.indicatorId.length > 0 ? model.directionStyle : undefined
        )
      } else {
        this._drawRectTooltipBlock(ctx, block, top ?? block.top, model.directionStyle)
      }
    })
  }

  buildRectTooltipBlock(
    dataList: KLineData[],
    indicators: Indicator[],
    bounding: Bounding,
    crosshair: Crosshair,
    drawCandle: boolean,
    drawIndicator: boolean,
    top: number,
    styles: Styles
  ): RectTooltipBlock | null {
    const dataIndex = crosshair.dataIndex ?? 0
    const kLineData = crosshair.kLineData
    if (!kLineData || (!drawCandle && !drawIndicator)) {
      return null
    }
    const chartStore = this.getWidget().getPane().getChart().getChartStore()
    const candleLegends = drawCandle
      ? this.getCandleTooltipLegends(
        { prev: dataList[dataIndex - 1] ?? null, current: kLineData, next: dataList[dataIndex + 1] ?? null },
        chartStore.getPrecision(), getDateTimeFormat(), chartStore.getLocale(), chartStore.getCustomApi(),
        chartStore.getThousandsSeparator(), chartStore.getDecimalFoldThreshold(), styles.candle
      )
      : []
    const indicatorLegends = drawIndicator
      ? indicators.map(indicator => this.getIndicatorTooltipData(
        dataList, crosshair, indicator, chartStore.getCustomApi(),
        chartStore.getThousandsSeparator(), chartStore.getDecimalFoldThreshold(), styles.indicator
      ).values ?? [])
      : []
    if (candleLegends.length === 0 && indicatorLegends.every(legends => legends.length === 0)) {
      return null
    }
    const pane = this.getWidget().getPane() as DualYPane
    return {
      type: 'rect',
      top,
      bounding,
      yLeftAxisWidth: pane.getYLeftAxisWidget().getBounding().width,
      yRightAxisWidth: pane.getYRightAxisWidget().getBounding().width,
      crosshair,
      styles,
      drawCandle,
      drawIndicator,
      candleLegends,
      indicatorLegends
    }
  }

  private _drawRectTooltipBlock(
    ctx: CanvasRenderingContext2D,
    block: RectTooltipBlock,
    top: number,
    directionStyle?: TooltipDirectionStyle
  ): void {
    const { bounding, crosshair, styles } = block
    const candleStyles = styles.candle
    const indicatorStyles = styles.indicator
    const candleTooltipStyles = candleStyles.tooltip
    const indicatorTooltipStyles = indicatorStyles.tooltip
    const candleLegends = block.candleLegends
    const indicatorLegendsArray = block.indicatorLegends
    const {
      offsetLeft, offsetTop, offsetRight, offsetBottom,
      text: {
        marginLeft: baseTextMarginLeft,
        marginRight: baseTextMarginRight,
        marginTop: baseTextMarginTop,
        marginBottom: baseTextMarginBottom,
        size: baseTextSize,
        weight: baseTextWeight,
        fontFamily: baseFontFamily
      },
      rect: {
        position: rectPosition,
        paddingLeft: rectPaddingLeft,
        paddingRight: rectPaddingRight,
        paddingTop: rectPaddingTop,
        paddingBottom: rectPaddingBottom,
        offsetLeft: rectOffsetLeft,
        offsetRight: rectOffsetRight,
        offsetTop: rectOffsetTop,
        offsetBottom: rectOffsetBottom,
        borderSize: rectBorderSize,
        borderRadius: rectBorderRadius,
        borderColor: rectBorderColor,
        color: rectBackgroundColor
      }
    } = candleTooltipStyles
    const {
      marginLeft: indicatorTextMarginLeft,
      marginRight: indicatorTextMarginRight,
      marginTop: indicatorTextMarginTop,
      marginBottom: indicatorTextMarginBottom,
      size: indicatorTextSize,
      weight: indicatorTextWeight,
      fontFamily: indicatorFontFamily
    } = indicatorTooltipStyles.text

    let maxTextWidth = 0
    let rectHeight = 0
    if (block.drawCandle) {
      const font = createFont(baseTextSize, baseTextWeight, baseFontFamily)
      candleLegends.forEach(data => {
        const title = data.title as TooltipLegendChild
        const value = data.value as TooltipLegendChild
        maxTextWidth = Math.max(maxTextWidth, calcTextWidth(`${title.text}${value.text}`, font) + baseTextMarginLeft + baseTextMarginRight)
        rectHeight += baseTextMarginBottom + baseTextMarginTop + baseTextSize
      })
    }
    if (block.drawIndicator) {
      const font = createFont(indicatorTextSize, indicatorTextWeight, indicatorFontFamily)
      indicatorLegendsArray.forEach(legends => legends.forEach(data => {
        const title = data.title as TooltipLegendChild
        const value = data.value as TooltipLegendChild
        const direction = getTooltipDirectionVisual(data.direction, directionStyle)
        maxTextWidth = Math.max(maxTextWidth, calcTextWidth(`${title.text}${value.text}${direction?.text ?? ''}`, font) + indicatorTextMarginLeft + indicatorTextMarginRight)
        rectHeight += indicatorTextMarginTop + indicatorTextMarginBottom + indicatorTextSize
      }))
    }
    if (maxTextWidth === 0 || rectHeight === 0) {
      return
    }

    const rectWidth = maxTextWidth + rectBorderSize * 2 + rectPaddingLeft + rectPaddingRight
    const rectTotalHeight = rectHeight + rectBorderSize * 2 + rectPaddingTop + rectPaddingBottom
    const centerX = bounding.width / 2
    const isPointer = rectPosition === CandleTooltipRectPosition.Pointer && crosshair.paneId === PaneIdConstants.CANDLE
    const isLeft = (crosshair.realX ?? 0) > centerX
    let rectX: number
    if (isPointer) {
      const realX = crosshair.realX ?? 0
      rectX = isLeft ? realX - rectOffsetRight - rectWidth : realX + rectOffsetLeft
    } else if (isLeft) {
      rectX = rectOffsetLeft + offsetLeft + (styles.yAxis.inside ? block.yLeftAxisWidth : 0)
    } else {
      rectX = bounding.width - rectOffsetRight - rectWidth - offsetRight - (styles.yAxis.inside ? block.yRightAxisWidth : 0)
    }

    let rectY = top + rectOffsetTop
    if (isPointer) {
      rectY = (crosshair.y ?? 0) - rectTotalHeight / 2
      if (rectY + rectTotalHeight > bounding.height - rectOffsetBottom - offsetBottom) {
        rectY = bounding.height - rectOffsetBottom - rectTotalHeight - offsetBottom
      }
      if (rectY < top + rectOffsetTop) {
        rectY = top + rectOffsetTop + offsetTop
      }
    }

    drawStaticFigure(ctx, 'rect', {
      attrs: { x: rectX, y: rectY, width: rectWidth, height: rectTotalHeight },
      styles: {
        style: PolygonType.StrokeFill,
        color: rectBackgroundColor,
        borderColor: rectBorderColor,
        borderSize: rectBorderSize,
        borderRadius: rectBorderRadius
      }
    })

    let textY = rectY + rectBorderSize + rectPaddingTop
    if (block.drawCandle) {
      const candleTextX = rectX + rectBorderSize + rectPaddingLeft + baseTextMarginLeft
      candleLegends.forEach(data => {
        textY += baseTextMarginTop
        const title = data.title as TooltipLegendChild
        drawStaticFigure(ctx, 'text', {
          attrs: { x: candleTextX, y: textY, text: title.text },
          styles: { color: title.color, size: baseTextSize, fontFamily: baseFontFamily, weight: baseTextWeight }
        })
        const value = data.value as TooltipLegendChild
        drawStaticFigure(ctx, 'text', {
          attrs: { x: rectX + rectWidth - rectBorderSize - baseTextMarginRight - rectPaddingRight, y: textY, text: value.text, align: 'right' },
          styles: { color: value.color, size: baseTextSize, fontFamily: baseFontFamily, weight: baseTextWeight }
        })
        textY += baseTextSize + baseTextMarginBottom
      })
    }
    if (block.drawIndicator) {
      const indicatorTextX = rectX + rectBorderSize + rectPaddingLeft + indicatorTextMarginLeft
      indicatorLegendsArray.forEach(legends => legends.forEach(data => {
        textY += indicatorTextMarginTop
        const title = data.title as TooltipLegendChild
        drawStaticFigure(ctx, 'text', {
          attrs: { x: indicatorTextX, y: textY, text: title.text },
          styles: { color: title.color, size: indicatorTextSize, fontFamily: indicatorFontFamily, weight: indicatorTextWeight }
        })
        const value = data.value as TooltipLegendChild
        const direction = getTooltipDirectionVisual(data.direction, directionStyle)
        const directionWidth = direction == null ? 0 : calcTextWidth(direction.text, createFont(indicatorTextSize, indicatorTextWeight, indicatorFontFamily))
        const valueRight = rectX + rectWidth - rectBorderSize - indicatorTextMarginRight - rectPaddingRight
        drawStaticFigure(ctx, 'text', {
          attrs: { x: valueRight - directionWidth, y: textY, text: value.text, align: 'right' },
          styles: { color: value.color, size: indicatorTextSize, fontFamily: indicatorFontFamily, weight: indicatorTextWeight }
        })
        if (direction != null) {
          drawStaticFigure(ctx, 'text', {
            attrs: { x: valueRight, y: textY, text: direction.text, align: 'right' },
            styles: {
              color: direction.color,
              size: indicatorTextSize,
              fontFamily: indicatorFontFamily,
              weight: indicatorTextWeight
            }
          })
        }
        textY += indicatorTextSize + indicatorTextMarginBottom
      }))
    }
  }

  getCandleTooltipLegends(
    data: CandleTooltipCustomCallbackData,
    precision: Precision,
    dateTimeFormat: DateTimeFormat,
    locale: string,
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    styles: CandleStyle
  ): TooltipLegend[] {
    const tooltipStyles = styles.tooltip
    const textColor = tooltipStyles.text.color
    const current = data.current

    // 获取基准价格：使用统一的 getMinutePercentageBasis 方法
    const widget = this.getWidget()
    const chartStore = widget.getPane().getChart().getChartStore()
    const isTimeShare = chartStore.getIsTimeShare()

    let basisPrice: number
    if (isTimeShare) {
      basisPrice = chartStore.getMinutePercentageBasis()
    } else {
      basisPrice = data.prev?.close ?? current.close
    }

    const changeValue = current.close - basisPrice
    const { price: pricePrecision, volume: volumePrecision } = precision
    const mapping: Record<string, string> = {
      '{time}': customApi.formatDate(dateTimeFormat, current.timestamp, 'YYYY-MM-DD HH:mm', FormatDateType.Tooltip),
      '{open}': formatFoldDecimal(formatThousands(formatPrecision(current.open, pricePrecision), thousandsSeparator), decimalFoldThreshold),
      '{high}': formatFoldDecimal(formatThousands(formatPrecision(current.high, pricePrecision), thousandsSeparator), decimalFoldThreshold),
      '{low}': formatFoldDecimal(formatThousands(formatPrecision(current.low, pricePrecision), thousandsSeparator), decimalFoldThreshold),
      '{close}': formatFoldDecimal(formatThousands(formatPrecision(current.close, pricePrecision), thousandsSeparator), decimalFoldThreshold),
      '{volume}': formatFoldDecimal(formatThousands(
        customApi.formatBigNumber(formatPrecision(current.volume ?? tooltipStyles.defaultValue, volumePrecision)),
        thousandsSeparator
      ), decimalFoldThreshold),
      '{turnover}': formatFoldDecimal(formatThousands(
        formatPrecision(current.turnover ?? tooltipStyles.defaultValue, pricePrecision),
        thousandsSeparator
      ), decimalFoldThreshold),
      '{change}': basisPrice === 0 ? tooltipStyles.defaultValue : `${formatThousands(formatPrecision(changeValue / basisPrice * 100), thousandsSeparator)}%`
    }
    const legends = (
      isFunction(tooltipStyles.custom)
        ? tooltipStyles.custom(data, styles)
        : tooltipStyles.custom
    ) ?? []
    return legends.map(({ title, value }) => {
      let t: TooltipLegendChild = { text: '', color: '' }
      if (isObject(title)) {
        t = { ...title }
      } else {
        t.text = title
        t.color = textColor
      }
      t.text = i18n(t.text, locale)
      let v: TooltipLegendChild = { text: tooltipStyles.defaultValue, color: '' }
      if (isObject(value)) {
        v = { ...value }
      } else {
        v.text = value
        v.color = textColor
      }
      const match = v.text.match(/{(\S*)}/)
      if (match && match.length > 1) {
        const key = `{${match[1]}}`
        v.text = v.text.replace(key, mapping[key] ?? tooltipStyles.defaultValue)
        if (key === '{change}') {
          v.color = changeValue === 0 ? styles.priceMark.last.noChangeColor : (changeValue > 0 ? styles.priceMark.last.upColor : styles.priceMark.last.downColor)
        }
      }
      return { title: t, value: v }
    })
  }
}
