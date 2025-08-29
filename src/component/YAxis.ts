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

import { YAxisType, CandleType } from '../common/Styles'
import type Bounding from '../common/Bounding'
import { isNumber, isValid } from '../common/utils/typeChecks'
import { getPrecision, index10, log10, nice, round } from '../common/utils/number'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { formatPrecision, formatThousands, formatFoldDecimal } from '../common/utils/format'
import AxisImp, { type AxisTemplate, type Axis, type AxisTick, type AxisCreateTicksParams } from './Axis'
import { type IndicatorFigure } from './Indicator'
import { PaneIdConstants } from '../pane/types'
import type YAxisWidget from '../widget/YAxisWidget'
import type VisibleRange from '../common/VisibleRange'
import type DualYPane from '../pane/DualYPane'

interface FiguresResult {
  figures: IndicatorFigure[]
  result: any[]
}

export interface YAxis extends Axis {
  isInCandle: () => boolean
}

export type YAxisConstructor = new (parent: YAxisWidget) => YAxisImp

export default abstract class YAxisImp extends AxisImp implements YAxis {
  private _autoCalcTickFlag = true
  private _range: VisibleRange = { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
  private _prevRange: VisibleRange = { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
  private _ticks: AxisTick[] = []
  private readonly _indicatorNames: string[] = []

  isMainAxis (): boolean {
    const parent = this.getParent()
    const pane = parent.getPane() as DualYPane
    const mainAxisWidget = pane.getMainAxisWidget()
    return parent === mainAxisWidget
  }

  buildTicks (force: boolean): boolean {
    if (this._autoCalcTickFlag) {
      this._range = this.calcRange()
    }
    if (this._prevRange.from !== this._range.from || this._prevRange.to !== this._range.to || force) {
      this._prevRange = this._range
      const parent = this.getParent().getPane()
      const chart = parent.getChart()
      const chartStore = chart.getChartStore()
      const shouldCalcTimeShareTicks = this.isInCandle() && chartStore.getIsTimeShare()

      const cTicks = shouldCalcTimeShareTicks ? this._calcTimeShareTicks() : this._calcTicks()
      let defaultTicks: AxisTick[] = []
      if (!this.isMainAxis() && !shouldCalcTimeShareTicks) {
        const mainAxisWidget = (this.getParent().getPane() as DualYPane).getMainAxisWidget()
        const mainAxis = mainAxisWidget.getAxisComponent()
        if (mainAxis.getType() === this.getType() && this._range.from === mainAxis.getRange().from && this._range.to === mainAxis.getRange().to) {
          // 如果主轴和当前轴类型相同，则使用主轴的刻度
          defaultTicks = mainAxis.getTicks()
        } else {
          const parent = this.getParent().getPane()
          const chart = parent.getChart()
          const chartStore = chart.getChartStore()
          const indicators = chartStore.getIndicatorStore().getInstances(parent.getId())
          const type = this.getType()

          let precision = 0
          let shouldFormatBigNumber = false
          if (this.isInCandle()) {
            precision = chartStore.getPrecision().price
          } else {
            indicators.forEach(tech => {
              precision = Math.max(precision, tech.precision)
              if (!shouldFormatBigNumber) {
                shouldFormatBigNumber = tech.shouldFormatBigNumber
              }
            })
          }
          defaultTicks = mainAxis.getTicks().map(tick => {
            let v = this.convertFromPixel(tick.coord)
            let text = formatPrecision(v, precision)

            if (type === YAxisType.MinutePercentage) {
              const firstData = chartStore.getVisibleFirstData()
              // 获取昨收
              let prevClose = firstData?.prevClose
              if (!prevClose) {
                console.warn('YAxisImp: prevClose is not set, using first data close as prevClose')
                prevClose = firstData?.close
              }
              if (isNumber(prevClose)) {
                v = (v - prevClose) / prevClose * 100
                text = `${formatPrecision(v, 2)}%`
              }
            } else if (type === YAxisType.Percentage) {
              const firstData = chartStore.getVisibleFirstData()
              const fromClose = firstData?.close
              if (isNumber(fromClose)) {
                v = (v - fromClose) / fromClose * 100
                text = `${formatPrecision(v, 2)}%`
              }
            } else if (type === YAxisType.Log) {
              v = log10(v)
              text = formatPrecision(v, precision)
            }

            return {
              text,
              coord: tick.coord,
              value: v
            }
          })
        }
      } else {
        defaultTicks = this.optimalTicks(cTicks)
      }
      this._ticks = this.createTicks({
        range: this._range,
        bounding: this.getSelfBounding(),
        defaultTicks
      })
      return true
    }
    return false
  }

  getTicks (): AxisTick[] {
    return this._ticks
  }

  setRange (range: VisibleRange): void {
    this._autoCalcTickFlag = false
    this._range = range
  }

  getRange (): VisibleRange { return this._range }

  setAutoCalcTickFlag (flag: boolean): void {
    this._autoCalcTickFlag = flag
  }

  getAutoCalcTickFlag (): boolean { return this._autoCalcTickFlag }

  addToCollect (name: string): void {
    this._indicatorNames.push(name)
  }

  removeFromCollect (name: string): boolean {
    const index = this._indicatorNames.indexOf(name)
    if (index >= 0) {
      this._indicatorNames.splice(index, 1)
      return true
    }
    return false
  }

  clearCollect (): void {
    this._indicatorNames.length = 0
  }

  getIndicatorNames (): string[] {
    return this._indicatorNames
  }

  protected calcRange (): VisibleRange {
    const pane = this.getParent().getPane()
    const chart = pane.getChart()
    const chartStore = chart.getChartStore()
    let min = Number.MAX_SAFE_INTEGER
    let max = Number.MIN_SAFE_INTEGER
    const figuresResultList: FiguresResult[] = []
    let shouldOhlc = false
    let indicatorMin = Number.MAX_SAFE_INTEGER
    let indicatorMax = Number.MIN_SAFE_INTEGER
    let indicatorPrecision = Number.MAX_SAFE_INTEGER
    const paneIndicators = chartStore.getIndicatorStore().getInstances(pane.getId())
    const inCandle = this.isInCandle()

    let indicators = paneIndicators
    if (!inCandle) {
      // 如果不在蜡烛图面板里 我们只关心Y轴指明需要收集的指标
      const indicatorNames = this.getIndicatorNames()
      if (indicatorNames.length > 0) {
        // 如果有收集的指标，则只计算收集的指标
        const filteredIndicators = paneIndicators.filter(indicator => indicatorNames.includes(indicator.name))
        if (filteredIndicators.length > 0) {
          indicators = filteredIndicators
        }
      }
    }

    indicators.forEach(indicator => {
      if (!shouldOhlc) {
        shouldOhlc = indicator.shouldOhlc ?? false
      }
      indicatorPrecision = Math.min(indicatorPrecision, indicator.precision)
      if (isNumber(indicator.minValue)) {
        indicatorMin = Math.min(indicatorMin, indicator.minValue)
      }
      if (isNumber(indicator.maxValue)) {
        indicatorMax = Math.max(indicatorMax, indicator.maxValue)
      }
      figuresResultList.push({
        figures: indicator.figures ?? [],
        result: indicator.result ?? []
      })
    })

    let precision = 4
    if (inCandle) {
      const { price: pricePrecision } = chartStore.getPrecision()
      if (indicatorPrecision !== Number.MAX_SAFE_INTEGER) {
        precision = Math.min(indicatorPrecision, pricePrecision)
      } else {
        precision = pricePrecision
      }
    } else {
      if (indicatorPrecision !== Number.MAX_SAFE_INTEGER) {
        precision = indicatorPrecision
      }
    }
    const visibleDataList = chartStore.getVisibleDataList()
    const candleStyles = chart.getStyles().candle
    const isArea = candleStyles.type === CandleType.Area
    const areaValueKey = candleStyles.area.value
    // 用于蜡烛图数据
    const shouldCompareHighLow = (inCandle && !isArea) || (!inCandle && shouldOhlc)
    visibleDataList.forEach(({ dataIndex, data }) => {
      if (isValid(data)) {
        if (shouldCompareHighLow) {
          min = Math.min(min, data.low)
          max = Math.max(max, data.high)
        }
        if (inCandle && isArea) {
          const value = data[areaValueKey]
          if (isNumber(value)) {
            min = Math.min(min, value)
            max = Math.max(max, value)
          }
        }
      }
      figuresResultList.forEach(({ figures, result }) => {
        const indicatorData = result[dataIndex] ?? {}
        figures.forEach(figure => {
          const value = indicatorData[figure.key]
          if (isNumber(value)) {
            min = Math.min(min, value)
            max = Math.max(max, value)
          }
        })
      })
    })

    if (min !== Number.MAX_SAFE_INTEGER && max !== Number.MIN_SAFE_INTEGER) {
      min = Math.min(indicatorMin, min)
      max = Math.max(indicatorMax, max)
    } else {
      min = 0
      max = 10
    }

    if (this.isInCandle()) {
      if (chartStore.getIsTimeShare()) {
        // 分时图需要特殊处理
        const firstData = chartStore.getVisibleFirstData()
        if (isValid(firstData) && isNumber(firstData.prevClose)) {
          const maxDiff = Math.max(
            Math.abs(max - firstData.prevClose),
            Math.abs(min - firstData.prevClose)
          )
          min = firstData.prevClose - maxDiff
          max = firstData.prevClose + maxDiff
        }
      }
    }

    const type = this.getType()
    let dif: number
    switch (type) {
      case YAxisType.Percentage: {
        const firstData = chartStore.getVisibleFirstData()
        if (isValid(firstData) && isNumber(firstData.close)) {
          min = (min - firstData.close) / firstData.close * 100
          max = (max - firstData.close) / firstData.close * 100
        }
        dif = Math.pow(10, -2)
        break
      }
      case YAxisType.MinutePercentage: {
        const firstData = chartStore.getVisibleFirstData()
        // 获取昨收
        let prevClose = firstData?.prevClose
        if (!prevClose) {
          console.warn('YAxisImp: prevClose is not set, using first data close as prevClose')
          prevClose = firstData?.close
        }
        if (isNumber(prevClose)) {
          const maxPercent = Math.max(
            Math.abs((max - prevClose) / prevClose * 100),
            Math.abs((min - prevClose) / prevClose * 100)
          )
          min = -maxPercent
          max = maxPercent
        }
        dif = Math.pow(10, -2)
        break
      }
      case YAxisType.Log: {
        min = log10(min)
        max = log10(max)
        dif = 0.05 * index10(-precision)
        break
      }
      default: {
        dif = index10(-precision)
      }
    }
    if (
      min === max ||
      Math.abs(min - max) < dif
    ) {
      const minCheck = indicatorMin === min
      const maxCheck = indicatorMax === max
      min = minCheck ? min : (maxCheck ? min - 8 * dif : min - 4 * dif)
      max = maxCheck ? max : (minCheck ? max + 8 * dif : max + 4 * dif)
    }

    const height = this.getParent()?.getBounding().height ?? 0
    const { gap: paneGap } = pane.getOptions()
    let topRate = paneGap?.top ?? 0.2
    // todo this should be in options normalize
    if (topRate >= 1) {
      topRate = topRate / height
    }
    let bottomRate = paneGap?.bottom ?? 0.1
    if (bottomRate >= 1) {
      bottomRate = bottomRate / height
    }
    const range = Math.abs(max - min)
    // gap
    min = min - range * bottomRate
    max = max + range * topRate
    let domainFrom: number
    let domainTo: number
    if (type === YAxisType.Log) {
      domainFrom = index10(min)
      domainTo = index10(max)
    } else {
      domainFrom = min
      domainTo = max
    }

    return {
      from: min, to: max, domainFrom, domainTo
    }
  }

  // todo splite the part that paneGap handle

  // todo splite the part that handle type

  /**
   * 内部值转换成坐标
   * @param value
   * @return {number}
   * @private
   */
  _innerConvertToPixel (value: number): number {
    // todo should get the pane height
    const height = this.getParent()?.getBounding().height ?? 0
    const { from, to } = this.getRange()
    const rate = (value - from) / (to - from)
    return this.isReverse() ? Math.round(rate * height) : Math.round((1 - rate) * height)
  }

  /**
   * 是否是蜡烛图轴
   * @return {boolean}
   */
  isInCandle (): boolean {
    const pane = this.getParent().getPane()
    return pane.getId() === PaneIdConstants.CANDLE
  }

  /**
   * y轴类型
   * @return {YAxisType}
   */
  getType (): YAxisType {
    const yAxisWidget = this.getParent() as YAxisWidget
    return yAxisWidget.getOptions().type
  }

  /**
   * 是否反转
   * @return {boolean}
   */
  isReverse (): boolean {
    if (this.isInCandle()) {
      const chart = this.getParent().getPane().getChart()
      return chart.getStyles().yAxis.reverse
    }
    return false
  }

  protected optimalTicks (ticks: AxisTick[]): AxisTick[] {
    const widget = this.getParent()
    const pane = widget.getPane()
    const height = widget?.getBounding().height ?? 0
    const chartStore = pane.getChart().getChartStore()
    const customApi = chartStore.getCustomApi()
    const type = this.getType()
    const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
    const thousandsSeparator = chartStore.getThousandsSeparator()
    const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
    let precision = 0
    let shouldFormatBigNumber = false
    if (this.isInCandle()) {
      precision = chartStore.getPrecision().price
    } else {
      indicators.forEach(tech => {
        precision = Math.max(precision, tech.precision)
        if (!shouldFormatBigNumber) {
          shouldFormatBigNumber = tech.shouldFormatBigNumber
        }
      })
    }
    const textHeight = chartStore.getStyles().xAxis.tickText.size
    const tempTicks = ticks.map(({ value, colorHint }) => {
      let v: string
      let y = this._innerConvertToPixel(+value)
      switch (type) {
        case YAxisType.MinutePercentage:
        case YAxisType.Percentage: {
          v = `${formatPrecision(value, 2)}%`
          break
        }
        case YAxisType.Log: {
          y = this._innerConvertToPixel(log10(+value))
          v = formatPrecision(value, precision)
          break
        }
        default: {
          v = formatPrecision(value, precision)
          if (shouldFormatBigNumber) {
            v = customApi.formatBigNumber(value)
          }
          break
        }
      }
      v = formatFoldDecimal(formatThousands(v, thousandsSeparator), decimalFoldThreshold)
      return { text: v, coord: y, value, colorHint }
    })
    const isTimeShare = chartStore.getIsTimeShare()
    const isInCandle = this.isInCandle()
    const optimalTicks = isTimeShare && isInCandle ? tempTicks : this._commonYTicksLayout(tempTicks, textHeight, height)
    return optimalTicks
  }

  private _commonYTicksLayout (ticks: AxisTick[], textHeight: number, height: number): AxisTick[] {
    const optimalTicks: AxisTick[] = []
    let validY: number
    ticks.forEach((tick) => {
      const y = tick.coord
      const validYNumber = isNumber(validY)
      if (
        y > textHeight &&
        y < height - textHeight &&
        ((validYNumber && (Math.abs(validY - y) >= textHeight * 2)) || !validYNumber)) {
        optimalTicks.push(tick)
        validY = y
      }
    })
    return optimalTicks
  }

  override getAutoSize (): number {
    const pane = this.getParent().getPane()
    const chart = pane.getChart()
    const styles = chart.getStyles()
    const yAxisStyles = styles.yAxis
    const width = yAxisStyles.size
    if (width !== 'auto') {
      return width
    }

    let yAxisWidth = 0
    if (yAxisStyles.show) {
      if (yAxisStyles.axisLine.show) {
        yAxisWidth += yAxisStyles.axisLine.size
      }
      if (yAxisStyles.tickLine.show) {
        yAxisWidth += yAxisStyles.tickLine.length
      }
      if (yAxisStyles.tickText.show) {
        let textWidth = 0
        // todo check
        this.getTicks().forEach(tick => {
          textWidth = Math.max(textWidth, calcTextWidth(tick.text, createFont(yAxisStyles.tickText.size, yAxisStyles.tickText.weight, yAxisStyles.tickText.family)))
        })
        yAxisWidth += (yAxisStyles.tickText.marginStart + yAxisStyles.tickText.marginEnd + textWidth)
      }
    }
    const chartStore = chart.getChartStore()
    const customApi = chartStore.getCustomApi()
    const crosshairStyles = styles.crosshair
    let crosshairVerticalTextWidth = 0
    if (
      crosshairStyles.show &&
      crosshairStyles.horizontal.show &&
      crosshairStyles.horizontal.text.show
    ) {
      const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
      let techPrecision = 0
      let shouldFormatBigNumber = false
      indicators.forEach(tech => {
        techPrecision = Math.max(tech.precision, techPrecision)
        if (!shouldFormatBigNumber) {
          shouldFormatBigNumber = tech.shouldFormatBigNumber
        }
      })
      let precision = 2
      if (this.getType() !== YAxisType.Percentage) {
        if (this.isInCandle()) {
          const { price: pricePrecision } = chartStore.getPrecision()
          const lastValueMarkStyles = styles.indicator.lastValueMark
          if (lastValueMarkStyles.show && lastValueMarkStyles.text.show) {
            precision = Math.max(techPrecision, pricePrecision)
          } else {
            precision = pricePrecision
          }
        } else {
          precision = techPrecision
        }
      }
      // TODO should we consider this.getRange().from?
      let valueText = formatPrecision(this.getRange().to, precision)
      if (shouldFormatBigNumber) {
        valueText = customApi.formatBigNumber(valueText)
      }
      valueText = formatFoldDecimal(valueText, chartStore.getDecimalFoldThreshold())
      crosshairVerticalTextWidth += (
        crosshairStyles.horizontal.text.paddingLeft +
        crosshairStyles.horizontal.text.paddingRight +
        crosshairStyles.horizontal.text.borderSize * 2 +
        calcTextWidth(
          valueText,
          createFont(
            crosshairStyles.horizontal.text.size,
            crosshairStyles.horizontal.text.weight,
            crosshairStyles.horizontal.text.family
          )
        )
      )
    }
    return Math.max(yAxisWidth, crosshairVerticalTextWidth)
  }

  private _calcTimeShareTicks (): AxisTick[] {
    const { from, to } = this._range
    const mid = (from + to) / 2

    const arrV: number[] = []

    if (to - from >= 0) {
      const widget = this.getParent()
      const pane = widget.getPane()
      const chartStore = pane.getChart().getChartStore()

      const height = widget?.getBounding().height ?? 0
      const textHeight = chartStore.getStyles().xAxis.tickText.size
      const maxTickCount = Math.floor(height / (textHeight * 2))

      const interval = (to - from) / Math.min(7, Math.max(3, maxTickCount - 1))

      const first = mid
      let n = 0
      let f = first

      const halfLabelToRange = (to - from) * textHeight / height / 2
      if (interval !== 0) {
        while (f <= to - halfLabelToRange) {
          if (n > 0) {
            const v1 = first + n * interval
            const v2 = first - n * interval
            arrV.unshift(v2)
            arrV.push(v1)
          } else {
            const v = first
            arrV.push(v)
          }
          ++n
          f += interval
        }
      }
    }
    return arrV.map(e => ({ text: e + '', coord: 0, value: e, colorHint: e > mid ? 1 : e < mid ? -1 : 0 }))
  }

  private _calcTicks (): AxisTick[] {
    const { from, to } = this._range
    const ticks: AxisTick[] = []

    if (to - from >= 0) {
      const [interval, precision] = this._calcTickInterval(to - from)
      const first = round(Math.ceil(from / interval) * interval, precision)
      const last = round(Math.floor(to / interval) * interval, precision)
      let n = 0
      let f = first

      if (interval !== 0) {
        while (f <= last) {
          const v = f.toFixed(precision)
          ticks[n] = { text: v, coord: 0, value: f }
          ++n
          f += interval
        }
      }
    }
    return ticks
  }

  private _calcTickInterval (range: number): number[] {
    const interval = nice(range / 8.0)
    const precision = getPrecision(interval)
    return [interval, precision]
  }

  getSelfBounding (): Bounding {
    return this.getParent().getBounding()
  }

  convertFromPixel (pixel: number): number {
    const height = this.getParent().getBounding().height ?? 0
    const { from, to } = this.getRange()
    const rate = this.isReverse() ? pixel / height : 1 - pixel / height
    const value = rate * (to - from) + from
    switch (this.getType()) {
      case YAxisType.MinutePercentage: {
        const fromData = this.getParent().getPane().getChart().getChartStore().getVisibleFirstData()
        // 获取昨收
        let prevClose = fromData?.prevClose
        if (!prevClose) {
          console.warn('YAxisImp: prevClose is not set, using first data close as prevClose')
          prevClose = fromData?.close
        }
        if (isNumber(prevClose)) {
          return prevClose * (value / 100 + 1)
        }
        return 0
      }
      case YAxisType.Percentage: {
        const fromData = this.getParent().getPane().getChart().getChartStore().getVisibleFirstData()
        if (isValid(fromData) && isNumber(fromData.close)) {
          return fromData.close * (value / 100 + 1)
        }
        return 0
      }
      case YAxisType.Log: {
        return index10(value)
      }
      default: {
        return value
      }
    }
  }

  convertToRealValue (value: number): number {
    let v = value
    if (this.getType() === YAxisType.Log) {
      v = index10(value)
    }
    return v
  }

  convertToPixel (value: number): number {
    let v = value
    switch (this.getType()) {
      case YAxisType.MinutePercentage: {
        const fromData = this.getParent().getPane().getChart().getChartStore().getVisibleFirstData()
        // 获取昨收
        let prevClose = fromData?.prevClose
        if (!prevClose) {
          console.warn('YAxisImp: prevClose is not set, using first data close as prevClose')
          prevClose = fromData?.close
        }
        if (isNumber(prevClose)) {
          v = (value - prevClose) / prevClose * 100
        }
        break
      }
      case YAxisType.Percentage: {
        const fromData = this.getParent().getPane().getChart().getChartStore().getVisibleFirstData()
        if (isValid(fromData) && isNumber(fromData.close)) {
          v = (value - fromData.close) / fromData.close * 100
        }
        break
      }
      case YAxisType.Log: {
        v = log10(value)
        break
      }
      default: {
        v = value
      }
    }
    return this._innerConvertToPixel(v)
  }

  convertToNicePixel (value: number): number {
    const height = this.getParent()?.getBounding().height ?? 0
    const pixel = this.convertToPixel(value)
    return Math.round(Math.max(height * 0.05, Math.min(pixel, height * 0.98)))
  }

  static extend (template: AxisTemplate): YAxisConstructor {
    class Custom extends YAxisImp {
      createTicks (params: AxisCreateTicksParams): AxisTick[] {
        return template.createTicks(params)
      }
    }
    return Custom
  }
}
