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
import type VisibleData from '../common/VisibleData'
import { CandleType, type SmoothLineStyle } from '../common/Styles'
import { formatValue } from '../common/utils/format'
import { isNumber, isValid } from '../common/utils/typeChecks'
import type Coordinate from '../common/Coordinate'
import type ChartStore from '../store/ChartStore'
import { eachFigures, type Indicator, type IndicatorFigure, type IndicatorFigureAttrs, type IndicatorFigureStyle } from '../component/Indicator'
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

    const defaultStyles = chartStore.getStyles().indicator
    ctx.save()
    if (yLeftAxis.isInCandle()) {
      drawForAxis(paneIndicators, yLeftAxis)
    } else {
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
        if (indicator.visible) {
          if (indicator.zLevel < 0) {
            ctx.globalCompositeOperation = 'destination-over'
          } else {
            ctx.globalCompositeOperation = 'source-over'
          }
          let isCover = false
          // render custom indicator draw
          if (indicator.draw !== null) {
            ctx.save()
            isCover = indicator.draw({
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
          }
          if (!isCover) {
            const result = indicator.result
            const lines: Array<Array<{ coordinates: Coordinate[], styles: SmoothLineStyle, dataIndex: number, nextDataIndex: number }>> = []

            const visibleDataList = chartStore.getVisibleDataList()
            const barSpace = chartStore.getTimeScaleStore().getBarSpace()

            visibleDataList.forEach((data: VisibleData) => {
              const { halfGapBar } = barSpace
              const { dataIndex, x } = data
              const prevX = xAxis.convertToPixel(dataIndex - 1)
              const nextX = xAxis.convertToPixel(dataIndex + 1)
              const prevData = result[dataIndex - 1] ?? null
              const currentData = result[dataIndex] ?? null
              const nextData = result[dataIndex + 1] ?? null
              const prevCoordinate = { x: prevX }
              const currentCoordinate = { x }
              const nextCoordinate = { x: nextX }
              indicator.figures.forEach(({ key }) => {
                const prevValue = prevData?.[key]
                if (isNumber(prevValue)) {
                  prevCoordinate[key] = yAxis.convertToPixel(prevValue)
                }
                const currentValue = currentData?.[key]
                if (isNumber(currentValue)) {
                  currentCoordinate[key] = yAxis.convertToPixel(currentValue)
                }
                const nextValue = nextData?.[key]
                if (isNumber(nextValue)) {
                  nextCoordinate[key] = yAxis.convertToPixel(nextValue)
                }
              })
              eachFigures(dataList, indicator, dataIndex, defaultStyles, (figure: IndicatorFigure, figureStyles: IndicatorFigureStyle, figureIndex: number) => {
                if (isValid(currentData?.[figure.key])) {
                  const valueY = currentCoordinate[figure.key]
                  let attrs = figure.attrs?.({
                    data: { prev: prevData, current: currentData, next: nextData },
                    coordinate: { prev: prevCoordinate, current: currentCoordinate, next: nextCoordinate },
                    bounding,
                    barSpace,
                    xAxis,
                    yAxis
                  })
                  if (!isValid<IndicatorFigureAttrs>(attrs)) {
                    switch (figure.type) {
                      case 'circle': {
                        attrs = { x, y: valueY, r: Math.max(1, halfGapBar) }
                        break
                      }
                      case 'rect':
                      case 'bar': {
                        const baseValue = figure.baseValue ?? yAxis.getRange().from
                        const baseValueY = yAxis.convertToPixel(baseValue)
                        let height = Math.abs(baseValueY - (valueY as number))
                        if (baseValue !== currentData?.[figure.key]) {
                          height = Math.max(1, height)
                        }
                        let y: number
                        if (valueY > baseValueY) {
                          y = baseValueY
                        } else {
                          y = valueY
                        }
                        attrs = {
                          x: x - halfGapBar,
                          y,
                          width: Math.max(1, halfGapBar * 2),
                          height
                        }
                        break
                      }
                      case 'line': {
                        if (!isValid(lines[figureIndex])) {
                          lines[figureIndex] = []
                        }
                        if (isNumber(currentCoordinate[figure.key]) && isNumber(nextCoordinate[figure.key])) {
                          // 在分时图模式下，检查这条线段是否跨日
                          const isTimeShare = chartStore.getIsTimeShare()
                          const timeShareTicks = chartStore.getTimeShareTicks()
                          const ticksPerDay = timeShareTicks.length
                          let shouldDrawLine = true

                          if (isTimeShare && ticksPerDay > 0) {
                            const currentDayIndex = Math.floor(dataIndex / ticksPerDay)
                            const nextDayIndex = Math.floor((dataIndex + 1) / ticksPerDay)
                            // 如果跨日，不绘制这条线段
                            if (currentDayIndex !== nextDayIndex) {
                              shouldDrawLine = false
                            }
                          }

                          if (shouldDrawLine) {
                            lines[figureIndex].push({
                              coordinates: [
                                { x: currentCoordinate.x, y: currentCoordinate[figure.key] },
                                { x: nextCoordinate.x, y: nextCoordinate[figure.key] }
                              ],
                              styles: figureStyles as unknown as SmoothLineStyle,
                              dataIndex,
                              nextDataIndex: dataIndex + 1
                            })
                          }
                        }
                        break
                      }
                      default: { break }
                    }
                  }
                  const type = figure.type!
                  if (isValid<IndicatorFigureAttrs>(attrs) && type !== 'line') {
                    drawStaticFigure(ctx, type === 'bar' ? 'rect' : type, {
                      attrs,
                      styles: figureStyles
                    })
                  }
                }
              })
            })

            // merge line and render
            const isTimeShare = chartStore.getIsTimeShare()
            const timeShareTicks = chartStore.getTimeShareTicks()
            const ticksPerDay = timeShareTicks.length

            lines.forEach(items => {
              if (items.length > 1) {
                const mergeLines = [
                  {
                    coordinates: [items[0].coordinates[0], items[0].coordinates[1]],
                    styles: items[0].styles
                  }
                ]
                for (let i = 1; i < items.length; i++) {
                  const lastMergeLine = mergeLines[mergeLines.length - 1]
                  const current = items[i]
                  const lastMergeLineLastCoordinate = lastMergeLine.coordinates[lastMergeLine.coordinates.length - 1]

                  // 检查是否跨日（在分时图模式下）
                  const prev = items[i - 1]
                  let isCrossingDay = false
                  if (isTimeShare && ticksPerDay > 0) {
                    // 检查当前线段的起点和前一个线段的终点是否跨日
                    // current.dataIndex 是当前线段的起点
                    // prev.nextDataIndex 是前一个线段的终点
                    const currentStartDayIndex = Math.floor(current.dataIndex / ticksPerDay)
                    const prevEndDayIndex = Math.floor(prev.nextDataIndex / ticksPerDay)
                    isCrossingDay = currentStartDayIndex !== prevEndDayIndex
                  }

                  if (
                    !isCrossingDay &&
                    lastMergeLineLastCoordinate.x === current.coordinates[0].x &&
                  lastMergeLineLastCoordinate.y === current.coordinates[0].y &&
                  lastMergeLine.styles.style === current.styles.style &&
                  lastMergeLine.styles.color === current.styles.color &&
                  lastMergeLine.styles.size === current.styles.size &&
                  lastMergeLine.styles.smooth === current.styles.smooth &&
                  lastMergeLine.styles.dashedValue[0] === current.styles.dashedValue[0] &&
                  lastMergeLine.styles.dashedValue[1] === current.styles.dashedValue[1]
                  ) {
                    lastMergeLine.coordinates.push(current.coordinates[1])
                  } else {
                    mergeLines.push({
                      coordinates: [current.coordinates[0], current.coordinates[1]],
                      styles: current.styles
                    })
                  }
                }
                mergeLines.forEach(({ coordinates, styles }) => {
                  drawStaticFigure(ctx, 'line', {
                    attrs: { coordinates },
                    styles
                  })
                })
              }
            })
          }
        }
      })
    }
  }
}
