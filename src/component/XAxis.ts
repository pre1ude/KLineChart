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
import type Bounding from '../common/Bounding'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { isValid } from '../common/utils/typeChecks'
import { type FormatDate, FormatDateType } from '../Options'
import AxisImp, { type AxisTemplate, type Axis, type AxisTick, type AxisCreateTicksParams } from './Axis'
import type XAxisWidget from '../widget/XAxisWidget'
import { genTimeStamp, getDateTimeFormat } from '../common/utils/dateTimeFormat'
import type VisibleRange from '../common/VisibleRange'
import { type LinearScale } from './scale'

export type XAxis = Axis

export type XAxisConstructor = new (parent: XAxisWidget) => XAxisImp

export default abstract class XAxisImp extends AxisImp {
  private _autoCalcTickFlag = true
  private _range: VisibleRange = { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
  private _prevRange: VisibleRange = { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
  private _ticks: AxisTick[] = []

  buildTicks (force: boolean): boolean {
    if (this._autoCalcTickFlag) {
      this._range = this.calcRange()
    }
    if (this._prevRange.from !== this._range.from || this._prevRange.to !== this._range.to || force) {
      this._prevRange = this._range
      const chart = this.getParent().getPane().getChart()
      const chartStore = chart.getChartStore()
      const isTimeShare = chartStore.getIsTimeShare()
      const defaultTicks = isTimeShare ? this.optimalMinuteTicks(this._calcTicks()) : this.optimalTicks(this._calcTicks())

      // todo if is minute period, should use fixed ticks
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

  protected _calcTicks (): AxisTick[] {
    const xScale = this.getXScale()
    const ticks = xScale.ticks()
    return ticks.map(v => ({ text: v + '', coord: 0, value: v }))
  }

  protected getXScale (): LinearScale {
    const timeScaleStore = this.getParent().getPane().getChart().getChartStore().getTimeScaleStore()
    return timeScaleStore.getXScale()
  }

  protected calcRange (): VisibleRange {
    const chartStore = this.getParent().getPane().getChart().getChartStore()
    return chartStore.getTimeScaleStore().getVisibleRange()
  }

  protected optimalTicks (ticks: AxisTick[]): AxisTick[] {
    const chart = this.getParent().getPane().getChart()
    const chartStore = chart.getChartStore()
    const formatDate = chartStore.getCustomApi().formatDate
    const optimalTicks: AxisTick[] = []
    const tickLength = ticks.length
    const dataList = chartStore.getDataList()
    if (tickLength > 0) {
      const dateTimeFormat = getDateTimeFormat()
      const tickTextStyles = chart.getStyles().xAxis.tickText
      const defaultLabelWidth = calcTextWidth('00-00 00:00', createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.family))
      const pos = parseInt(ticks[0].value as string, 10)
      const x = this.convertToPixel(pos)
      let tickCountDif = 1
      if (tickLength > 1) {
        const nextPos = parseInt(ticks[1].value as string, 10)
        const nextX = this.convertToPixel(nextPos)
        const xDif = Math.abs(nextX - x)
        if (xDif < defaultLabelWidth) {
          tickCountDif = Math.ceil(defaultLabelWidth / xDif)
        }
      }
      for (let i = 0; i < tickLength; i += tickCountDif) {
        const pos = parseInt(ticks[i].value as string, 10)
        const kLineData = dataList[pos]
        if (!isValid(kLineData)) continue
        const timestamp = kLineData.timestamp
        let text = formatDate(dateTimeFormat, timestamp, 'HH:mm', FormatDateType.XAxis)
        if (i !== 0) {
          const prevPos = parseInt(ticks[i - tickCountDif].value as string, 10)
          const prevKLineData = dataList[prevPos]
          if (!isValid(prevKLineData)) continue
          const prevTimestamp = prevKLineData.timestamp
          text = this._optimalTickLabel(formatDate, dateTimeFormat, timestamp, prevTimestamp) ?? text
        }
        const x = this.convertToPixel(pos)
        optimalTicks.push({ text, coord: x, value: timestamp })
      }
      const optimalTickLength = optimalTicks.length
      if (optimalTickLength < 1) return optimalTicks
      if (optimalTickLength === 1) {
        optimalTicks[0].text = formatDate(dateTimeFormat, optimalTicks[0].value as number, 'YYYY-MM-DD HH:mm', FormatDateType.XAxis)
      } else {
        const firstTimestamp = optimalTicks[0].value as number
        const secondTimestamp = optimalTicks[1].value as number
        if (isValid(optimalTicks[2])) {
          const thirdText = optimalTicks[2].text
          if (/^[0-9]{2}-[0-9]{2}$/.test(thirdText)) {
            optimalTicks[0].text = formatDate(dateTimeFormat, firstTimestamp, 'MM-DD', FormatDateType.XAxis)
          } else if (/^[0-9]{4}-[0-9]{2}$/.test(thirdText)) {
            optimalTicks[0].text = formatDate(dateTimeFormat, firstTimestamp, 'YYYY-MM', FormatDateType.XAxis)
          } else if (/^[0-9]{4}$/.test(thirdText)) {
            optimalTicks[0].text = formatDate(dateTimeFormat, firstTimestamp, 'YYYY', FormatDateType.XAxis)
          }
        } else {
          optimalTicks[0].text = this._optimalTickLabel(formatDate, dateTimeFormat, firstTimestamp, secondTimestamp) ?? optimalTicks[0].text
        }
      }
    }
    return optimalTicks
  }

  protected optimalMinuteTicks (ticks: AxisTick[]): AxisTick[] {
    const chart = this.getParent().getPane().getChart()
    const chartStore = chart.getChartStore()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const dataList = chartStore.getDataList()
    if (dataList.length < 1) return []
    const hintTs = dataList[0].timestamp
    const optimalTicks: AxisTick[] = []

    const tickTextStyles = chart.getStyles().xAxis.tickText
    const defaultLabelWidth = calcTextWidth('00:00', createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.family))

    const preferXTicks = chartStore.getPreferXTicks()
    if (preferXTicks) {
      const indexArr = getIndexArr(timeShareTicks, preferXTicks)
      for (let i = 0; i < indexArr.length; i++) {
        const x = this.convertToPixel(indexArr[i])
        const text = timeShareTicks[indexArr[i]]
        const timeStamp = genTimeStamp(text, hintTs)
        optimalTicks.push({ text, coord: x, value: timeStamp })
      }
    } else {
      let tickCountDif = 1
      if (ticks.length > 1) {
        const nextX = this.convertToPixel(parseInt(ticks[1].value as string, 10))
        const xDif = Math.abs(this.convertToPixel(parseInt(ticks[0].value as string, 10)) - nextX)
        if (xDif < defaultLabelWidth) {
          tickCountDif = Math.ceil(defaultLabelWidth / xDif)
        }
      }
      for (let i = 0; i < ticks.length; i += tickCountDif) {
        const text = timeShareTicks[ticks[i].value as number]
        const x = this.convertToPixel(ticks[i].value as number)
        const timeStamp = genTimeStamp(text, hintTs)
        optimalTicks.push({ text, coord: x, value: timeStamp })
      }
    }

    return optimalTicks
  }

  // should only call once
  private _optimalTickLabel (formatDate: FormatDate, dateTimeFormat: Intl.DateTimeFormat, timestamp: number, comparedTimestamp: number): Nullable<string> {
    const year = formatDate(dateTimeFormat, timestamp, 'YYYY', FormatDateType.XAxis)
    const month = formatDate(dateTimeFormat, timestamp, 'YYYY-MM', FormatDateType.XAxis)
    const day = formatDate(dateTimeFormat, timestamp, 'MM-DD', FormatDateType.XAxis)
    if (year !== formatDate(dateTimeFormat, comparedTimestamp, 'YYYY', FormatDateType.XAxis)) {
      return year
    } else if (month !== formatDate(dateTimeFormat, comparedTimestamp, 'YYYY-MM', FormatDateType.XAxis)) {
      return month
    } else if (day !== formatDate(dateTimeFormat, comparedTimestamp, 'MM-DD', FormatDateType.XAxis)) {
      return day
    }
    return null
  }

  override getAutoSize (): number {
    const styles = this.getParent().getPane().getChart().getStyles()
    const xAxisStyles = styles.xAxis
    const height = xAxisStyles.size
    if (height !== 'auto') {
      return height
    }
    const crosshairStyles = styles.crosshair
    let xAxisHeight = 0
    if (xAxisStyles.show) {
      if (xAxisStyles.axisLine.show) {
        xAxisHeight += xAxisStyles.axisLine.size
      }
      if (xAxisStyles.tickLine.show) {
        xAxisHeight += xAxisStyles.tickLine.length
      }
      if (xAxisStyles.tickText.show) {
        xAxisHeight += (xAxisStyles.tickText.marginStart + xAxisStyles.tickText.marginEnd + xAxisStyles.tickText.size)
      }
    }
    let crosshairVerticalTextHeight = 0
    if (
      crosshairStyles.show &&
      crosshairStyles.vertical.show &&
      crosshairStyles.vertical.text.show
    ) {
      crosshairVerticalTextHeight += (
        crosshairStyles.vertical.text.paddingTop +
        crosshairStyles.vertical.text.paddingBottom +
        crosshairStyles.vertical.text.borderSize * 2 +
        crosshairStyles.vertical.text.size
      )
    }
    return Math.max(xAxisHeight, crosshairVerticalTextHeight)
  }

  getSelfBounding (): Bounding {
    return this.getParent().getBounding()
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

  // todo should just use the timeScaleStore
  convertTimestampFromPixel (pixel: number): Nullable<number> {
    const chartStore = this.getParent().getPane().getChart().getChartStore()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const dataIndex = timeScaleStore.coordinateToDataIndex(pixel)
    return chartStore.dataIndexToTimestamp(dataIndex)
  }

  convertTimestampToPixel (timestamp: number): number {
    const chartStore = this.getParent().getPane().getChart().getChartStore()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const dataIndex = chartStore.timestampToDataIndex(timestamp)
    return timeScaleStore.dataIndexToCoordinate(dataIndex)
  }

  convertFromPixel (pixel: number): number {
    return this.getParent().getPane().getChart().getChartStore().getTimeScaleStore().coordinateToDataIndex(pixel)
  }

  convertToPixel (value: number): number {
    return this.getParent().getPane().getChart().getChartStore().getTimeScaleStore().dataIndexToCoordinate(value)
  }

  static extend (template: AxisTemplate): XAxisConstructor {
    class Custom extends XAxisImp {
      createTicks (params: AxisCreateTicksParams): AxisTick[] {
        return template.createTicks(params)
      }
    }
    return Custom
  }
}

function getIndexArr (timeShareTicks: string[], preferXTicks: string[]): number[] {
  const indexArr: number[] = []
  for (let i = 0; i < timeShareTicks.length; i++) {
    if (preferXTicks.includes(timeShareTicks[i])) {
      indexArr.push(i)
    }
  }
  return indexArr
}
