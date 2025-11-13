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

import type Nullable from '../common/Nullable'
import { CandleType, type SmoothLineStyle, type IndicatorStyle } from '../common/Styles'
import { formatValue } from '../common/utils/format'
import { isNumber, isValid } from '../common/utils/typeChecks'
import type Coordinate from '../common/Coordinate'
import type ChartStore from '../store/ChartStore'
import { getFigureBaseStyles, getMergedDefaultStyles, type Indicator, type IndicatorFigure, type IndicatorFigureAttrs, type IndicatorFigureStyle } from '../component/Indicator'
import CandleBarView, { type CandleBarOptions } from './CandleBarView'
import type DualYPane from '../pane/DualYPane'
import type XAxisWidget from '../widget/XAxisWidget'
import { drawStaticFigure } from '../extension/figure'
import type YAxisImp from '../component/YAxis'

export default class IndicatorView extends CandleBarView {
  override getCandleBarOptions (chartStore: ChartStore): Nullable<CandleBarOptions> {
    const pane = this.getWidget().getPane()
    const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
    if (!yAxis.isInCandle()) {
      const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
      for (const indicator of indicators) {
        if (indicator.shouldOhlc && indicator.visible) {
          const indicatorStyles = indicator.styles
          const defaultStyles = chartStore.getStyles().indicator
          const upColor = formatValue(indicatorStyles, 'ohlc.upColor', defaultStyles.ohlc.upColor) as string
          const downColor = formatValue(indicatorStyles, 'ohlc.downColor', defaultStyles.ohlc.downColor) as string
          const noChangeColor = formatValue(indicatorStyles, 'ohlc.noChangeColor', defaultStyles.ohlc.noChangeColor) as string
          return {
            type: CandleType.Ohlc,
            styles: {
              upColor,
              downColor,
              noChangeColor,
              upBorderColor: upColor,
              downBorderColor: downColor,
              noChangeBorderColor: noChangeColor,
              upWickColor: upColor,
              downWickColor: downColor,
              noChangeWickColor: noChangeColor
            }
          }
        }
      }
    }
    return null
  }

  override drawImp (ctx: CanvasRenderingContext2D): void {
    super.drawImp(ctx)
    const widget = this.getWidget()
    const pane = widget.getPane()
    const chart = pane.getChart()
    const bounding = widget.getBounding()
    const xAxis = (chart.getXAxisPane().getMainWidget() as XAxisWidget).getAxisComponent()
    const yLeftAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
    const yRightAxis = (pane as DualYPane).getYRightAxisWidget().getAxisComponent()
    const chartStore = chart.getChartStore()
    const dataList = chartStore.getDataList()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const visibleRange = timeScaleStore.getVisibleRange()
    const paneIndicators = chartStore.getIndicatorStore().getInstances(pane.getId())
    const visibleDataList = chartStore.getVisibleDataList()
    const barSpace = chartStore.getTimeScaleStore().getBarSpace()
    const isTimeShare = chartStore.getIsTimeShare()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const ticksPerDay = timeShareTicks.length

    ctx.save()
    if (yLeftAxis.isInCandle()) {
      // 在主图
      drawForAxis(paneIndicators, yLeftAxis)
    } else {
      // 在副图
      drawForAxis(filterIndicatorsByAxis(paneIndicators, yLeftAxis), yLeftAxis)
      drawForAxis(filterIndicatorsByAxis(paneIndicators, yRightAxis), yRightAxis)
    }
    ctx.restore()

    function filterIndicatorsByAxis (paneIndicators: Indicator[], yAxis: YAxisImp): Indicator[] {
      let indicators: Array<Indicator<any>> = []
      const indicatorNames = yAxis.getIndicatorNames()
      if (indicatorNames.length > 0) {
        // 如果有收集的指标，则只计算收集的指标
        const filteredIndicators = paneIndicators.filter(indicator => indicatorNames.includes(indicator.name))
        if (filteredIndicators.length > 0) {
          indicators = filteredIndicators
        }
      }
      return indicators
    }

    function drawForAxis (indicators: Indicator[], yAxis: YAxisImp): void {
      indicators.forEach(indicator => {
        if (!indicator.visible) return

        setCompositeOperation(indicator.zLevel)

        const mergedDefaultStyles = getMergedDefaultStyles(indicator, chartStore.getStyles().indicator)

        const customDrawCovered = tryCustomDraw(indicator, yAxis, mergedDefaultStyles)
        if (customDrawCovered) return

        for (let i = 0; i < indicator.figures.length; i++) {
          drawSingleFigure(indicator.figures[i], i, indicator, mergedDefaultStyles, yAxis)
        }
      })
    }

    function setCompositeOperation (zLevel: number): void {
      ctx.globalCompositeOperation = zLevel < 0 ? 'destination-over' : 'source-over'
    }

    function tryCustomDraw (indicator: Indicator, yAxis: YAxisImp, defaultStyles: IndicatorStyle): boolean {
      if (indicator.draw == null) return false

      ctx.save()
      const isCover = indicator.draw({
        ctx,
        kLineDataList: dataList,
        indicator,
        visibleRange,
        bounding,
        barSpace: timeScaleStore.getBarSpace(),
        defaultStyles,
        xAxis,
        yAxis
      }) ?? false
      ctx.restore()

      return isCover
    }

    function drawSingleFigure (
      figure: IndicatorFigure,
      figureIndex: number,
      indicator: Indicator,
      mergedDefaultStyles: IndicatorStyle,
      yAxis: YAxisImp
    ): void {
      const type = figure.type ?? 'line'
      const baseStyles = getFigureBaseStyles(type, figureIndex, mergedDefaultStyles)
      const createFigureStyles = (dataIndex: number): IndicatorFigureStyle => {
        const customStyles = figure.styles?.(dataIndex, indicator, dataList, mergedDefaultStyles)
        return customStyles ? { ...baseStyles, ...customStyles } : baseStyles
      }

      if (type === 'line') {
        // 线段类型：流式绘制
        drawLineStreaming(figure, createFigureStyles, indicator, yAxis)
      } else {
        // 其他类型：逐个绘制
        for (const data of visibleDataList) {
          const { dataIndex, x } = data
          if (!isValid(indicator.result[dataIndex]?.[figure.key])) continue

          const figureStyles = createFigureStyles(dataIndex)

          const attrs = figure.attrs?.(dataIndex, indicator.result, bounding, barSpace, xAxis, yAxis) ??
            computeDefaultAttrs(figure, type, dataIndex, x, indicator.result, yAxis)

          if (isValid<IndicatorFigureAttrs>(attrs)) {
            drawStaticFigure(ctx, type === 'bar' ? 'rect' : type, {
              attrs,
              styles: figureStyles
            })
          }
        }
      }
    }

    function drawLineStreaming (
      figure: IndicatorFigure,
      createFigureStyles: (dataIndex: number) => IndicatorFigureStyle,
      indicator: Indicator,
      yAxis: YAxisImp
    ): void {
      const key = figure.key
      const result = indicator.result

      const currentPath: Coordinate[] = []
      let currentStyles: SmoothLineStyle | null = null
      let lastDataIndex = -1

      // 绘制当前 path 并重置
      const drawCurrentPath = (): void => {
        if (currentPath.length >= 2 && currentStyles) {
          drawStaticFigure(ctx, 'line', {
            attrs: { coordinates: currentPath },
            styles: currentStyles
          })
        }
        currentPath.length = 0
        currentStyles = null
      }

      for (const data of visibleDataList) {
        const { dataIndex, x } = data

        const currentValue = result[dataIndex]?.[key]
        const nextValue = result[dataIndex + 1]?.[key]

        // 值无效 → 绘制当前 path 并重置
        if (!isNumber(currentValue) || !isNumber(nextValue)) {
          drawCurrentPath()
          lastDataIndex = -1
          continue
        }

        // 跨日检查 → 绘制当前 path 并重置
        if (isTimeShare && ticksPerDay > 0) {
          if ((dataIndex + 1) % ticksPerDay === 0) {
            drawCurrentPath()
            lastDataIndex = -1
            continue
          }
        }

        // 数据不连续 → 绘制当前 path 并重置
        if (lastDataIndex !== -1 && lastDataIndex !== dataIndex) {
          drawCurrentPath()
        }

        const figureStyles = createFigureStyles(dataIndex) as unknown as SmoothLineStyle

        // 样式变化 → 绘制当前 path 并重置
        if (currentStyles && !isSameStyle(currentStyles, figureStyles)) {
          drawCurrentPath()
        }

        const y1 = yAxis.convertToPixel(currentValue)
        const x2 = xAxis.convertToPixel(dataIndex + 1)
        const y2 = yAxis.convertToPixel(nextValue)

        if (currentPath.length === 0) {
          currentPath.push({ x, y: y1 }, { x: x2, y: y2 })
          currentStyles = figureStyles
        } else {
          currentPath.push({ x: x2, y: y2 })
        }

        lastDataIndex = dataIndex + 1
      }

      drawCurrentPath()
    }

    function computeDefaultAttrs (
      figure: IndicatorFigure,
      type: string,
      dataIndex: number,
      x: number,
      result: any[],
      yAxis: YAxisImp
    ): IndicatorFigureAttrs | undefined {
      const value = result[dataIndex]?.[figure.key]
      if (!isNumber(value)) return undefined

      const { halfGapBar } = barSpace
      const valueY = yAxis.convertToPixel(value)

      if (type === 'circle') {
        return { x, y: valueY, r: Math.max(1, halfGapBar) }
      }

      if (type === 'rect' || type === 'bar') {
        const baseValue = figure.baseValue ?? yAxis.getRange().from
        const baseValueY = yAxis.convertToPixel(baseValue)
        let height = Math.abs(baseValueY - valueY)
        if (baseValue !== value) {
          height = Math.max(1, height)
        }
        const y = valueY > baseValueY ? baseValueY : valueY
        return {
          x: x - halfGapBar,
          y,
          width: Math.max(1, halfGapBar * 2),
          height
        }
      }

      return undefined
    }
  }
}

function isSameStyle (a: SmoothLineStyle, b: SmoothLineStyle): boolean {
  return a === b || (
    a.style === b.style &&
    a.color === b.color &&
    a.size === b.size &&
    a.smooth === b.smooth &&
    a.dashedValue[0] === b.dashedValue[0] &&
    a.dashedValue[1] === b.dashedValue[1]
  )
}
