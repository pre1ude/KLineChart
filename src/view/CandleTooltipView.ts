
import type Nullable from '../common/Nullable'
import type Bounding from '../common/Bounding'
import type KLineData from '../common/KLineData'
import type Precision from '../common/Precision'
import type Crosshair from '../common/Crosshair'
import {
  type Styles, type CandleStyle, type TooltipLegend, type TooltipLegendChild, TooltipShowType, CandleTooltipRectPosition,
  type CandleTooltipCustomCallbackData, PolygonType
} from '../common/Styles'
import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { isFunction, isObject, isValid } from '../common/utils/typeChecks'
import { type CustomApi, FormatDateType } from '../Options'
import { PaneIdConstants } from '../pane/types'
import type { Indicator } from '../component/Indicator'
import IndicatorTooltipView from './IndicatorTooltipView'
import { type TooltipIcon } from '../store/TooltipStore'
import { i18n } from '../extension/i18n/index'
import type DualYPane from '../pane/DualYPane'
import { drawStaticFigure } from '../extension/figure'
import { getDateTimeFormat } from '../common/utils/dateTimeFormat'

export default class CandleTooltipView extends IndicatorTooltipView {
  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const paneId = pane.getId()
    const chartStore = pane.getChart().getChartStore()
    const crosshair = chartStore.getTooltipStore().getCrosshair()
    if (isValid(crosshair.kLineData)) {
      const bounding = widget.getBounding()
      // todo check
      const yLeftAxisBounding = (pane as DualYPane).getYLeftAxisWidget().getBounding()
      const yRightAxisBounding = (pane as DualYPane).getYRightAxisWidget().getBounding()
      // const yAxisBounding = pane.getYAxisWidget()!.getBounding()
      const dataList = chartStore.getDataList()
      const precision = chartStore.getPrecision()
      const locale = chartStore.getLocale()
      const customApi = chartStore.getCustomApi()
      const thousandsSeparator = chartStore.getThousandsSeparator()
      const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
      const activeIcon = chartStore.getTooltipStore().getActiveIcon()
      const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
      const dateTimeFormat = getDateTimeFormat()
      const styles = chartStore.getStyles()
      const candleStyles = styles.candle
      const indicatorStyles = styles.indicator
      if (
        candleStyles.tooltip.showType === TooltipShowType.Rect &&
        indicatorStyles.tooltip.showType === TooltipShowType.Rect
      ) {
        const isDrawCandleTooltip = this.isDrawTooltip(crosshair, candleStyles.tooltip)
        const isDrawIndicatorTooltip = this.isDrawTooltip(crosshair, indicatorStyles.tooltip)
        this._drawRectTooltip(
          ctx, dataList, indicators,
          bounding, yLeftAxisBounding, yRightAxisBounding,
          crosshair, precision,
          dateTimeFormat, locale, customApi, thousandsSeparator, decimalFoldThreshold,
          isDrawCandleTooltip, isDrawIndicatorTooltip,
          candleStyles.tooltip.offsetTop, styles
        )
      } else if (
        candleStyles.tooltip.showType === TooltipShowType.Standard &&
        indicatorStyles.tooltip.showType === TooltipShowType.Standard
      ) {
        const { offsetLeft, offsetTop, offsetRight } = candleStyles.tooltip
        const maxWidth = bounding.width - offsetRight
        const top = this._drawCandleStandardTooltip(
          ctx, dataList, paneId, crosshair, activeIcon, precision,
          dateTimeFormat, locale, customApi, thousandsSeparator, decimalFoldThreshold,
          offsetLeft, offsetTop, maxWidth, candleStyles
        )
        this.drawIndicatorTooltip(
          ctx, paneId, dataList, crosshair,
          activeIcon, indicators, customApi,
          thousandsSeparator, decimalFoldThreshold,
          offsetLeft, top, maxWidth, indicatorStyles
        )
      } else if (
        candleStyles.tooltip.showType === TooltipShowType.Rect &&
        indicatorStyles.tooltip.showType === TooltipShowType.Standard
      ) {
        const { offsetLeft, offsetTop, offsetRight } = candleStyles.tooltip
        const maxWidth = bounding.width - offsetRight
        const top = this.drawIndicatorTooltip(
          ctx, paneId, dataList, crosshair,
          activeIcon, indicators, customApi,
          thousandsSeparator, decimalFoldThreshold,
          offsetLeft, offsetTop, maxWidth, indicatorStyles
        )
        const isDrawCandleTooltip = this.isDrawTooltip(crosshair, candleStyles.tooltip)
        this._drawRectTooltip(
          ctx, dataList, indicators,
          bounding, yLeftAxisBounding, yRightAxisBounding,
          crosshair, precision, dateTimeFormat,
          locale, customApi, thousandsSeparator, decimalFoldThreshold,
          isDrawCandleTooltip, false, top, styles
        )
      } else {
        const { offsetLeft, offsetTop, offsetRight } = candleStyles.tooltip
        const maxWidth = bounding.width - offsetRight
        const top = this._drawCandleStandardTooltip(
          ctx, dataList, paneId, crosshair, activeIcon, precision,
          dateTimeFormat, locale, customApi, thousandsSeparator, decimalFoldThreshold,
          offsetLeft, offsetTop, maxWidth, candleStyles
        )
        const isDrawIndicatorTooltip = this.isDrawTooltip(crosshair, indicatorStyles.tooltip)
        this._drawRectTooltip(
          ctx, dataList, indicators,
          bounding, yLeftAxisBounding, yRightAxisBounding,
          crosshair, precision, dateTimeFormat,
          locale, customApi, thousandsSeparator, decimalFoldThreshold,
          false, isDrawIndicatorTooltip, top, styles
        )
      }
    }
  }

  private _drawCandleStandardTooltip(
    ctx: CanvasRenderingContext2D,
    dataList: KLineData[],
    paneId: string,
    crosshair: Crosshair,
    activeTooltipIcon: Nullable<TooltipIcon>,
    precision: Precision,
    dateTimeFormat: Intl.DateTimeFormat,
    locale: string,
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    left: number,
    top: number,
    maxWidth: number,
    styles: CandleStyle
  ): number {
    const tooltipStyles = styles.tooltip
    const tooltipTextStyles = tooltipStyles.text
    let prevRowHeight = 0
    const coordinate = { x: left, y: top }
    if (this.isDrawTooltip(crosshair, tooltipStyles)) {
      const dataIndex = crosshair.dataIndex ?? 0
      const legends = this._getCandleTooltipLegends(
        { prev: dataList[dataIndex - 1] ?? null, current: crosshair.kLineData!, next: dataList[dataIndex + 1] ?? null },
        precision, dateTimeFormat, locale, customApi, thousandsSeparator, decimalFoldThreshold, styles
      )

      const [leftIcons, middleIcons, rightIcons] = this.classifyTooltipIcons(tooltipStyles.icons)

      prevRowHeight = this.drawStandardTooltipIcons(
        ctx, activeTooltipIcon, leftIcons, coordinate,
        paneId, '', left, prevRowHeight, maxWidth
      )

      prevRowHeight = this.drawStandardTooltipIcons(
        ctx, activeTooltipIcon, middleIcons, coordinate,
        paneId, '', left, prevRowHeight, maxWidth
      )

      if (legends.length > 0) {
        prevRowHeight = this.drawStandardTooltipLegends(
          ctx, legends, coordinate, left,
          prevRowHeight, maxWidth, tooltipTextStyles
        )
      }

      prevRowHeight = this.drawStandardTooltipIcons(
        ctx, activeTooltipIcon, rightIcons, coordinate,
        paneId, '', left, prevRowHeight, maxWidth
      )
    }
    return coordinate.y + prevRowHeight
  }

  private _drawRectTooltip(
    ctx: CanvasRenderingContext2D,
    dataList: KLineData[],
    indicators: Indicator[],
    bounding: Bounding,
    // yAxisBounding: Bounding,
    yLeftAxisBounding: Bounding, yRightAxisBounding: Bounding,
    crosshair: Crosshair,
    precision: Precision,
    dateTimeFormat: Intl.DateTimeFormat,
    locale: string,
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    isDrawCandleTooltip: boolean,
    isDrawIndicatorTooltip: boolean,
    top: number,
    styles: Styles
  ): void {
    const candleStyles = styles.candle
    const indicatorStyles = styles.indicator
    const candleTooltipStyles = candleStyles.tooltip
    const indicatorTooltipStyles = indicatorStyles.tooltip
    if (isDrawCandleTooltip || isDrawIndicatorTooltip) {
      const dataIndex = crosshair.dataIndex ?? 0
      const candleLegends = this._getCandleTooltipLegends(
        { prev: dataList[dataIndex - 1] ?? null, current: crosshair.kLineData!, next: dataList[dataIndex + 1] ?? null },
        precision, dateTimeFormat, locale, customApi, thousandsSeparator, decimalFoldThreshold, candleStyles
      )

      const { offsetLeft, offsetTop, offsetRight, offsetBottom } = candleTooltipStyles

      const {
        marginLeft: baseTextMarginLeft,
        marginRight: baseTextMarginRight,
        marginTop: baseTextMarginTop,
        marginBottom: baseTextMarginBottom,
        size: baseTextSize,
        weight: baseTextWeight,
        family: baseTextFamily
      } = candleTooltipStyles.text

      const {
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
      } = candleTooltipStyles.rect

      let maxTextWidth = 0
      let rectWidth = 0
      let rectHeight = 0
      if (isDrawCandleTooltip) {
        const font = createFont(baseTextSize, baseTextWeight, baseTextFamily)
        candleLegends.forEach(data => {
          const title = data.title as TooltipLegendChild
          const value = data.value as TooltipLegendChild
          const text = `${title.text}${value.text}`
          const textWidth = calcTextWidth(text, font)
          const labelWidth = textWidth + baseTextMarginLeft + baseTextMarginRight
          maxTextWidth = Math.max(maxTextWidth, labelWidth)
        })
        rectHeight += ((baseTextMarginBottom + baseTextMarginTop + baseTextSize) * candleLegends.length)
      }

      const {
        marginLeft: indicatorTextMarginLeft,
        marginRight: indicatorTextMarginRight,
        marginTop: indicatorTextMarginTop,
        marginBottom: indicatorTextMarginBottom,
        size: indicatorTextSize,
        weight: indicatorTextWeight,
        family: indicatorTextFamily
      } = indicatorTooltipStyles.text
      const indicatorLegendsArray: TooltipLegend[][] = []
      if (isDrawIndicatorTooltip) {
        const font = createFont(indicatorTextSize, indicatorTextWeight, indicatorTextFamily)
        indicators.forEach(indicator => {
          const tooltipDataValues = this.getIndicatorTooltipData(dataList, crosshair, indicator, customApi, thousandsSeparator, decimalFoldThreshold, indicatorStyles).values ?? []
          indicatorLegendsArray.push(tooltipDataValues)
          tooltipDataValues.forEach(data => {
            const title = data.title as TooltipLegendChild
            const value = data.value as TooltipLegendChild
            const text = `${title.text}${value.text}`
            const textWidth = calcTextWidth(text, font) + indicatorTextMarginLeft + indicatorTextMarginRight
            maxTextWidth = Math.max(maxTextWidth, textWidth)
            rectHeight += (indicatorTextMarginTop + indicatorTextMarginBottom + indicatorTextSize)
          })
        })
      }
      rectWidth += maxTextWidth
      if (rectWidth !== 0 && rectHeight !== 0) {
        rectWidth += (rectBorderSize * 2 + rectPaddingLeft + rectPaddingRight)
        rectHeight += (rectBorderSize * 2 + rectPaddingTop + rectPaddingBottom)
        const centerX = bounding.width / 2
        const isPointer = rectPosition === CandleTooltipRectPosition.Pointer && crosshair.paneId === PaneIdConstants.CANDLE
        const isLeft = (crosshair.realX ?? 0) > centerX
        let rectX: number = 0
        if (isPointer) {
          const realX = crosshair.realX!
          if (isLeft) {
            rectX = realX - rectOffsetRight - rectWidth
          } else {
            rectX = realX + rectOffsetLeft
          }
        } else if (isLeft) {
          rectX = rectOffsetLeft + offsetLeft
          if (styles.yAxis.inside) {
            rectX += yLeftAxisBounding.width
          }
        } else {
          rectX = bounding.width - rectOffsetRight - rectWidth - offsetRight
          if (styles.yAxis.inside) {
            rectX -= yRightAxisBounding.width
          }
        }

        let rectY = top + rectOffsetTop
        if (isPointer) {
          const y = crosshair.y!
          rectY = y - rectHeight / 2
          if (rectY + rectHeight > bounding.height - rectOffsetBottom - offsetBottom) {
            rectY = bounding.height - rectOffsetBottom - rectHeight - offsetBottom
          }
          if (rectY < top + rectOffsetTop) {
            rectY = top + rectOffsetTop + offsetTop
          }
        }
        drawStaticFigure(ctx, 'rect', {
          attrs: {
            x: rectX,
            y: rectY,
            width: rectWidth,
            height: rectHeight
          },
          styles: {
            style: PolygonType.StrokeFill,
            color: rectBackgroundColor,
            borderColor: rectBorderColor,
            borderSize: rectBorderSize,
            borderRadius: rectBorderRadius
          }
        })
        const candleTextX = rectX + rectBorderSize + rectPaddingLeft + baseTextMarginLeft
        let textY = rectY + rectBorderSize + rectPaddingTop
        if (isDrawCandleTooltip) {
          // render candle texts
          candleLegends.forEach(data => {
            textY += baseTextMarginTop
            const title = data.title as TooltipLegendChild
            drawStaticFigure(ctx, 'text', {
              attrs: {
                x: candleTextX,
                y: textY,
                text: title.text
              },
              styles: {
                color: title.color,
                size: baseTextSize,
                family: baseTextFamily,
                weight: baseTextWeight
              }
            })
            const value = data.value as TooltipLegendChild
            drawStaticFigure(ctx, 'text', {
              attrs: {
                x: rectX + rectWidth - rectBorderSize - baseTextMarginRight - rectPaddingRight,
                y: textY,
                text: value.text,
                align: 'right'
              },
              styles: {
                color: value.color,
                size: baseTextSize,
                family: baseTextFamily,
                weight: baseTextWeight
              }
            })
            textY += (baseTextSize + baseTextMarginBottom)
          })
        }
        if (isDrawIndicatorTooltip) {
          // render indicator texts
          const indicatorTextX = rectX + rectBorderSize + rectPaddingLeft + indicatorTextMarginLeft
          indicatorLegendsArray.forEach(legends => {
            legends.forEach(data => {
              textY += indicatorTextMarginTop
              const title = data.title as TooltipLegendChild
              const value = data.value as TooltipLegendChild
              drawStaticFigure(ctx, 'text', {
                attrs: {
                  x: indicatorTextX,
                  y: textY,
                  text: title.text
                },
                styles: {
                  color: title.color,
                  size: indicatorTextSize,
                  family: indicatorTextFamily,
                  weight: indicatorTextWeight
                }
              })

              drawStaticFigure(ctx, 'text', {
                attrs: {
                  x: rectX + rectWidth - rectBorderSize - indicatorTextMarginRight - rectPaddingRight,
                  y: textY,
                  text: value.text,
                  align: 'right'
                },
                styles: {
                  color: value.color,
                  size: indicatorTextSize,
                  family: indicatorTextFamily,
                  weight: indicatorTextWeight
                }
              })
              textY += (indicatorTextSize + indicatorTextMarginBottom)
            })
          })
        }
      }
    }
  }

  private _getCandleTooltipLegends(
    data: CandleTooltipCustomCallbackData,
    precision: Precision,
    dateTimeFormat: Intl.DateTimeFormat,
    locale: string,
    customApi: CustomApi,
    thousandsSeparator: string,
    decimalFoldThreshold: number,
    styles: CandleStyle
  ): TooltipLegend[] {
    const tooltipStyles = styles.tooltip
    const textColor = tooltipStyles.text.color
    const current = data.current
    const prevClose = data.prev?.close ?? current.close
    const changeValue = current.close - prevClose
    const { price: pricePrecision, volume: volumePrecision } = precision
    const mapping = {
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
      '{change}': prevClose === 0 ? tooltipStyles.defaultValue : `${formatThousands(formatPrecision(changeValue / prevClose * 100), thousandsSeparator)}%`
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
      if (match !== null && match.length > 1) {
        const key = `{${match[1]}}`
        v.text = v.text.replace(key, (mapping[key] ?? tooltipStyles.defaultValue) as string)
        if (key === '{change}') {
          v.color = changeValue === 0 ? styles.priceMark.last.noChangeColor : (changeValue > 0 ? styles.priceMark.last.upColor : styles.priceMark.last.downColor)
        }
      }
      return { title: t, value: v }
    })
  }
}
