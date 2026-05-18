import type Bounding from '../common/Bounding'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { getDateTimeFormat } from '../common/utils/dateTimeFormat'
import type VisibleRange from '../common/VisibleRange'
import type XAxisWidget from '../widget/XAxisWidget'
import AxisImp, { type Axis, type AxisCreateTicksParams, type AxisTemplate, type AxisTick } from './Axis'
import { type LinearScale } from './scale'
import { createRegularXAxisTicks } from './x-axis/regularTicks'
import { createTimeShareXAxisTicks, selectTimeShareTickIndexes } from './x-axis/timeShareTicks'
import {
  filterOverlappedXAxisTicks,
  measureXAxisTickWidths,
  mergeBoundaryXAxisTicks,
  resolveXAxisTickLayoutOptions,
  X_AXIS_TICK_MIN_GAP,
  type XAxisTick,
  type XAxisTickLayoutOptions
} from './x-axis/tickLayout'

export type XAxis = Axis

export type XAxisConstructor = new (parent: XAxisWidget) => XAxisImp

export {
  filterOverlappedXAxisTicks,
  mergeBoundaryXAxisTicks,
  resolveXAxisTickLayoutOptions,
  selectTimeShareTickIndexes
}
export type { XAxisTickLayoutOptions }

export default abstract class XAxisImp extends AxisImp {
  private _autoCalcTickFlag = true
  private _range: VisibleRange = { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
  private _prevRange: VisibleRange = { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
  private _ticks: AxisTick[] = []

  buildTicks(force: boolean): boolean {
    if (this._autoCalcTickFlag) {
      this._range = this.calcRange()
    }
    if (this._prevRange.from !== this._range.from || this._prevRange.to !== this._range.to || force) {
      this._prevRange = this._range
      const chart = this.getParent().getPane().getChart()
      const chartStore = chart.getChartStore()
      const isTimeShare = chartStore.getIsTimeShare()
      const defaultTicks = isTimeShare ? this.optimalMinuteTicks() : this.optimalTicks(this._calcTicks())

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

  getTicks(): AxisTick[] {
    return this._ticks
  }

  protected _calcTicks(): AxisTick[] {
    const xScale = this.getXScale()
    const _ticks = xScale.ticks()
    let ticks = _ticks
    if (ticks.length > 0) {
      const tmpTicks: number[] = []
      const { from, to } = this._range
      const firstTick = ticks[0]
      if (firstTick < from) {
        const step = ticks[1] - ticks[0]
        let it = from
        do {
          tmpTicks.push(it)
          it += step
        }
        while (it <= ticks[ticks.length - 1] && it <= to)
        ticks = tmpTicks
      }
    }
    return ticks.map(v => ({ text: `${v  }`, coord: 0, value: v }))
  }

  protected getXScale(): LinearScale {
    const timeScaleStore = this.getParent().getPane().getChart().getChartStore().getTimeScaleStore()
    return timeScaleStore.getXScale()
  }

  protected calcRange(): VisibleRange {
    const chartStore = this.getParent().getPane().getChart().getChartStore()
    return chartStore.getTimeScaleStore().getVisibleRange()
  }

  protected optimalTicks(ticks: AxisTick[]): AxisTick[] {
    const chart = this.getParent().getPane().getChart()
    const chartStore = chart.getChartStore()
    const formatDate = chartStore.getCustomApi().formatDate
    const dataList = chartStore.getDataList()
    const dateTimeFormat = getDateTimeFormat()
    const tickTextStyles = chart.getStyles().xAxis.tickText
    const font = createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.fontFamily)
    // todo should consider period, for month period: 2025-06
    const defaultLabelWidth = calcTextWidth('00-00 00:00', font)
    const layoutOptions = resolveXAxisTickLayoutOptions(chart.getStyles().xAxis, chartStore.getDataZoomEnabled())
    const optimalTicks = createRegularXAxisTicks(
      ticks,
      dataList,
      this._range,
      defaultLabelWidth,
      formatDate,
      dateTimeFormat,
      layoutOptions,
      value => this.convertToPixel(value)
    )
    return this._filterOverlappedTicks(optimalTicks, layoutOptions)
  }

  protected optimalMinuteTicks(): AxisTick[] {
    const chart = this.getParent().getPane().getChart()
    const chartStore = chart.getChartStore()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const timeShareDays = chartStore.getTimeShareDays()
    const dataList = chartStore.getDataList()
    if (timeShareTicks.length === 0) {
      return []
    }

    const tickTextStyles = chart.getStyles().xAxis.tickText
    const defaultLabelWidth = calcTextWidth('00:00', createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.fontFamily))
    const minLabelGap = Math.max(defaultLabelWidth * 1.5 + X_AXIS_TICK_MIN_GAP, defaultLabelWidth + X_AXIS_TICK_MIN_GAP, 1)
    const maxTickCount = Math.max(1, Math.floor(this.getSelfBounding().width / minLabelGap))
    const layoutOptions = resolveXAxisTickLayoutOptions(chart.getStyles().xAxis, false)
    const optimalTicks = createTimeShareXAxisTicks(
      timeShareTicks,
      timeShareDays,
      dataList,
      maxTickCount,
      layoutOptions,
      chartStore.getPreferXTicks(),
      value => this.convertToPixel(value)
    )
    return this._filterOverlappedTicks(optimalTicks, layoutOptions)
  }

  private _filterOverlappedTicks(ticks: XAxisTick[], options?: XAxisTickLayoutOptions): AxisTick[] {
    const tickTextStyles = this.getParent().getPane().getChart().getStyles().xAxis.tickText
    const font = createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.fontFamily)
    const canvasWidth = this.getSelfBounding().width
    const widths = measureXAxisTickWidths(ticks, text => calcTextWidth(text, font))
    return filterOverlappedXAxisTicks(ticks, widths, canvasWidth, options)
  }

  override getAutoSize(): number {
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

  getSelfBounding(): Bounding {
    return this.getParent().getBounding()
  }

  setRange(range: VisibleRange): void {
    this._autoCalcTickFlag = false
    this._range = range
  }

  getRange(): VisibleRange { return this._range }

  setAutoCalcTickFlag(flag: boolean): void {
    this._autoCalcTickFlag = flag
  }

  getAutoCalcTickFlag(): boolean { return this._autoCalcTickFlag }

  // todo should just use the timeScaleStore
  convertTimestampFromPixel(pixel: number) {
    const chartStore = this.getParent().getPane().getChart().getChartStore()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const dataIndex = timeScaleStore.coordinateToDataIndex(pixel)
    return chartStore.dataIndexToTimestamp(dataIndex)
  }

  convertTimestampToPixel(timestamp: number): number | undefined {
    const chartStore = this.getParent().getPane().getChart().getChartStore()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const dataIndex = chartStore.timestampToDataIndex(timestamp)
    if (dataIndex === undefined) return undefined
    return timeScaleStore.dataIndexToCoordinate(dataIndex)
  }

  convertFromPixel(pixel: number): number {
    return this.getParent().getPane().getChart().getChartStore().getTimeScaleStore().coordinateToDataIndex(pixel)
  }

  convertToPixel(value: number): number {
    return this.getParent().getPane().getChart().getChartStore().getTimeScaleStore().dataIndexToCoordinate(value)
  }

  static extend(template: AxisTemplate): XAxisConstructor {
    class Custom extends XAxisImp {
      createTicks(params: AxisCreateTicksParams): AxisTick[] {
        return template.createTicks(params)
      }
    }
    return Custom
  }
}
