import type Bounding from '../common/Bounding'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { getDateTimeFormat } from '../common/utils/dateTimeFormat'
import type VisibleRange from '../common/VisibleRange'
import type XAxisWidget from '../widget/XAxisWidget'
import AxisImp, { type Axis, type AxisCreateTicksParams, type AxisTemplate, type AxisTick } from './Axis'
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
  private _prevBoundingWidth = 0
  private _prevBarSpace = 0
  private _ticks: XAxisTick[] = []

  buildTicks(force: boolean): boolean {
    if (this._autoCalcTickFlag) {
      this._range = this.calcRange()
    }
    const chart = this.getParent().getPane().getChart()
    const chartStore = chart.getChartStore()
    const boundingWidth = this.getSelfBounding().width
    const barSpace = chartStore.getTimeScaleStore().getBarSpace().bar
    const indexRangeChanged = this._prevRange.from !== this._range.from || this._prevRange.to !== this._range.to
    const domainRangeChanged = this._prevRange.domainFrom !== this._range.domainFrom || this._prevRange.domainTo !== this._range.domainTo
    const metricChanged = this._prevBoundingWidth !== boundingWidth || this._prevBarSpace !== barSpace
    if (force || indexRangeChanged || metricChanged) {
      this._prevRange = this._range
      this._prevBoundingWidth = boundingWidth
      this._prevBarSpace = barSpace
      const isTimeShare = chartStore.getIsTimeShare()
      const layoutOptions = isTimeShare
        ? resolveXAxisTickLayoutOptions(chart.getStyles().xAxis, false)
        : resolveXAxisTickLayoutOptions(chart.getStyles().xAxis, chartStore.getDataZoomEnabled())
      const defaultTicks = isTimeShare
        ? this.optimalMinuteTicks()
        : this.optimalTicks([])

      // todo if is minute period, should use fixed ticks
      const ticks = this.createTicks({
        range: this._range,
        bounding: this.getSelfBounding(),
        defaultTicks
      })
      this._ticks = this._filterOverlappedTicks(ticks, layoutOptions)
      return true
    }
    if (domainRangeChanged) {
      if (!this._repositionTicks()) {
        return this.buildTicks(true)
      }
      this._prevRange = this._range
    }
    return false
  }

  getTicks(): AxisTick[] {
    return this._ticks
  }

  protected calcRange(): VisibleRange {
    const chartStore = this.getParent().getPane().getChart().getChartStore()
    return chartStore.getTimeScaleStore().getVisibleRange()
  }

  protected optimalTicks(_ticks: AxisTick[]): AxisTick[] {
    const chart = this.getParent().getPane().getChart()
    const chartStore = chart.getChartStore()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const formatDate = chartStore.getCustomApi().formatDate
    const dateTimeFormat = getDateTimeFormat()
    const tickTextStyles = chart.getStyles().xAxis.tickText
    const font = createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.fontFamily)
    const layoutOptions = resolveXAxisTickLayoutOptions(chart.getStyles().xAxis, chartStore.getDataZoomEnabled())
    const optimalTicks = createRegularXAxisTicks(
      chartStore.getDataList(),
      this._range,
      formatDate,
      dateTimeFormat,
      layoutOptions,
      timeScaleStore.getBarSpace().bar,
      text => calcTextWidth(text, font),
      value => this.convertToPixel(value)
    )
    return optimalTicks
  }

  protected optimalMinuteTicks(): AxisTick[] {
    const chart = this.getParent().getPane().getChart()
    const chartStore = chart.getChartStore()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const timeShareDays = chartStore.getTimeShareDays()
    if (timeShareTicks.length === 0) {
      return []
    }

    const tickTextStyles = chart.getStyles().xAxis.tickText
    const defaultLabelWidth = calcTextWidth('00:00', createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.fontFamily))
    const maxTickCount = calcTimeShareMaxTickCount(this.getSelfBounding().width, defaultLabelWidth)
    const layoutOptions = resolveXAxisTickLayoutOptions(chart.getStyles().xAxis, false)
    const optimalTicks = createTimeShareXAxisTicks(
      timeShareTicks,
      timeShareDays,
      maxTickCount,
      layoutOptions,
      chartStore.getPreferXTicks(),
      chartStore.getTimeShareShowSessionGap(),
      chartStore.getTimeShareSessionGapForN(),
      value => chartStore.dataIndexToTimestamp(value),
      value => this.convertToPixel(value)
    )
    return optimalTicks
  }

  private _filterOverlappedTicks(ticks: XAxisTick[], options?: XAxisTickLayoutOptions): XAxisTick[] {
    const tickTextStyles = this.getParent().getPane().getChart().getStyles().xAxis.tickText
    const font = createFont(tickTextStyles.size, tickTextStyles.weight, tickTextStyles.fontFamily)
    const canvasWidth = this.getSelfBounding().width
    const widths = measureXAxisTickWidths(ticks, text => calcTextWidth(text, font))
    return filterOverlappedXAxisTicks(ticks, widths, canvasWidth, options)
  }

  private _repositionTicks(): boolean {
    if (this._ticks.some(tick => tick.dataIndex === undefined)) {
      return false
    }
    this._ticks = this._ticks.map(tick => ({
      ...tick,
      coord: this.convertToPixel(tick.dataIndex as number)
    }))
    return true
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

function calcTimeShareMaxTickCount(axisWidth: number, labelWidth: number): number {
  const minCenterDistance = Math.max(labelWidth + X_AXIS_TICK_MIN_GAP, 1)
  const centerDistance = Math.max(0, axisWidth - labelWidth)
  return Math.max(1, Math.floor(centerDistance / minCenterDistance) + 1)
}
