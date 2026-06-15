import type Bounding from '../common/Bounding'
import type KLineData from '../common/KLineData'
import type VisibleData from '../common/VisibleData'
import { CandleType, YAxisPosition, YAxisType } from '../common/Styles'
import { calcTextWidth, createFont } from '../common/utils/canvas'
import { formatFoldDecimal, formatPrecision, formatThousands } from '../common/utils/format'
import { getPrecision, index10, log10, round } from '../common/utils/number'
import { isNumber, isValid } from '../common/utils/typeChecks'
import type VisibleRange from '../common/VisibleRange'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'
import type YAxisWidget from '../widget/YAxisWidget'
import { type YAxisOptions } from '../widget/YAxisWidget'
import AxisImp, { type Axis, type AxisCreateTicksParams, type AxisTemplate, type AxisTick } from './Axis'
import { isIndicatorFigureVisible, type Indicator, type IndicatorFigure } from './Indicator'

const DEFAULT_Y_AXIS_SPLIT_NUMBER = 5
const MIN_Y_AXIS_TICK_TEXT_SPACING = 2

export enum YAxisScaleMode {
  TimeShareMain = 'timeShareMain',
  Standard = 'standard'
}

interface FiguresResult {
  indicator: Indicator
  figures: IndicatorFigure[]
  result: unknown[]
}

export function getIndicatorYAxisPosition(
  indicator: Pick<Indicator, 'yAxisPosition'>,
  defaultPosition: 'left' | 'right' = YAxisPosition.Left
): 'left' | 'right' {
  return indicator.yAxisPosition ?? defaultPosition
}

function filterIndicatorsByYAxisPosition(
  indicators: Indicator[],
  position: 'left' | 'right',
  globalYAxisPosition: YAxisPosition
): Indicator[] {
  const defaultPosition = globalYAxisPosition === YAxisPosition.Right
    ? YAxisPosition.Right
    : YAxisPosition.Left
  return indicators.filter(indicator => getIndicatorYAxisPosition(indicator, defaultPosition) === position)
}

export interface YAxisTickSequence {
  from: number
  to: number
  interval: number
  precision: number
  nice: boolean
}

function normalizePaneGapRate(value: number | undefined, height: number): number {
  let rate = value ?? 0
  if (!Number.isFinite(rate)) {
    rate = 0
  }
  if (rate >= 1 && height > 0) {
    rate = rate / height
  }
  return rate > 0 ? rate : 0
}

function normalizeReservedSpace(value: number | undefined): number {
  return isNumber(value) && value > 0 ? value : 0
}

function applyReservedSpace(topRate: number, bottomRate: number, height: number, reservedTop: number, reservedBottom: number): number[] {
  if (height <= 0 || (reservedTop <= 0 && reservedBottom <= 0)) {
    return [topRate, bottomRate]
  }

  const denominator = 1 + topRate + bottomRate
  const baseTopSpace = height * topRate / denominator
  const baseBottomSpace = height * bottomRate / denominator

  let targetTopSpace = Math.max(baseTopSpace, reservedTop)
  let targetBottomSpace = Math.max(baseBottomSpace, reservedBottom)
  const maxReservedSpace = Math.max(height - 1, 0)
  const totalReservedSpace = targetTopSpace + targetBottomSpace
  if (totalReservedSpace > maxReservedSpace && totalReservedSpace > 0) {
    const scale = maxReservedSpace / totalReservedSpace
    targetTopSpace *= scale
    targetBottomSpace *= scale
  }

  const contentHeight = height - targetTopSpace - targetBottomSpace
  if (contentHeight <= 0) {
    return [topRate, bottomRate]
  }

  return [targetTopSpace / contentHeight, targetBottomSpace / contentHeight]
}

function calcEChartsNiceTickInterval(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  const exponent = Math.floor(log10(value))
  const exp10 = index10(exponent)
  const f = value / exp10
  let nf: number
  if (f < 1.5) {
    nf = 1
  } else if (f < 2.5) {
    nf = 2
  } else if (f < 4) {
    nf = 3
  } else if (f < 7) {
    nf = 5
  } else {
    nf = 10
  }

  const interval = nf * exp10
  return exponent >= -20 ? +interval.toFixed(exponent < 0 ? -exponent : 0) : interval
}

function increaseEChartsNiceTickInterval(interval: number): number {
  if (!Number.isFinite(interval) || interval <= 0) {
    return interval
  }

  const exponent = Math.floor(log10(interval))
  const exp10 = index10(exponent)
  const f = round(interval / exp10, 12)
  let nf: number
  if (f === 2) {
    nf = 3
  } else if (f === 3) {
    nf = 5
  } else {
    nf = f * 2
  }

  return round(nf * exp10, Math.max(getPrecision(interval), 0))
}

export function calcYAxisTickInterval(range: number, height: number, textHeight: number): [number, number] {
  if (!Number.isFinite(range) || range <= 0) {
    return [0, 0]
  }

  const minSpacing = height > 0 && textHeight > 0
    ? range * textHeight * MIN_Y_AXIS_TICK_TEXT_SPACING / height
    : 0
  const rawInterval = Math.max(range / DEFAULT_Y_AXIS_SPLIT_NUMBER, minSpacing)
  let interval = calcEChartsNiceTickInterval(rawInterval)
  let guard = 0

  while (interval < minSpacing && guard < 20) {
    const nextInterval = increaseEChartsNiceTickInterval(interval)
    if (nextInterval <= interval) {
      interval = minSpacing
      break
    }
    interval = nextInterval
    guard++
  }

  const precision = getPrecision(interval)
  return [interval, precision]
}

export function calcYAxisTickBounds(from: number, to: number, interval: number, precision: number): [number, number] {
  const min = Math.min(from, to)
  const max = Math.max(from, to)
  if (!Number.isFinite(interval) || interval <= 0) {
    return [min, max]
  }

  return [
    round(Math.floor(min / interval) * interval, precision),
    round(Math.ceil(max / interval) * interval, precision)
  ]
}

export function resolveYAxisScaleMode(inCandle: boolean, isTimeShare: boolean): YAxisScaleMode {
  return inCandle && isTimeShare ? YAxisScaleMode.TimeShareMain : YAxisScaleMode.Standard
}

function collectYAxisExtent(
  visibleDataList: VisibleData[],
  figuresResultList: FiguresResult[],
  shouldCompareHighLow: boolean,
  shouldCompareAreaValue: boolean,
  areaValueKey: keyof KLineData
) {
  let min = Number.MAX_SAFE_INTEGER
  let max = Number.MIN_SAFE_INTEGER

  visibleDataList.forEach(({ dataIndex, data }) => {
    if (isValid(data)) {
      if (shouldCompareHighLow) {
        min = Math.min(min, data.low)
        max = Math.max(max, data.high)
      }
      if (shouldCompareAreaValue) {
        const value = data[areaValueKey]
        if (isNumber(value)) {
          min = Math.min(min, value)
          max = Math.max(max, value)
        }
      }
    }
    figuresResultList.forEach(({ indicator, figures, result }) => {
      const indicatorData = result[dataIndex] ?? {}
      figures.forEach(figure => {
        if (!isIndicatorFigureVisible(indicator, figure)) {
          return
        }
        const value = (indicatorData as Record<string, unknown>)[figure.key]
        if (isNumber(value)) {
          if ((figure.type === 'bar' || figure.type === 'rect') && isNumber(figure.baseValue)) {
            min = Math.min(min, figure.baseValue)
            max = Math.max(max, figure.baseValue)
          }
          min = Math.min(min, value)
          max = Math.max(max, value)
        }
      })
    })
  })

  if (min !== Number.MAX_SAFE_INTEGER && max !== Number.MIN_SAFE_INTEGER) {
    return { min, max, hasValidData: true }
  }
  return { min: 0, max: 10, hasValidData: false }
}

export function resolveYAxisTypeExtent(
  min: number,
  max: number,
  type: YAxisType,
  firstClose: number | undefined,
  minutePercentageBasis: number
): [number, number] {
  switch (type) {
    case YAxisType.Percentage: {
      if (isNumber(firstClose)) {
        return [
          (min - firstClose) / firstClose * 100,
          (max - firstClose) / firstClose * 100
        ]
      }
      return [min, max]
    }
    case YAxisType.MinutePercentage: {
      if (minutePercentageBasis > 0) {
        const maxPercent = Math.max(
          Math.abs((max - minutePercentageBasis) / minutePercentageBasis * 100),
          Math.abs((min - minutePercentageBasis) / minutePercentageBasis * 100)
        )
        return [-maxPercent, maxPercent]
      }
      return [min, max]
    }
    case YAxisType.Log: {
      return [log10(min), log10(max)]
    }
    default: {
      return [min, max]
    }
  }
}

export function calcYAxisMinExtentDiff(type: YAxisType, precision: number): number {
  switch (type) {
    case YAxisType.Percentage:
    case YAxisType.MinutePercentage: {
      return index10(-2)
    }
    case YAxisType.Log: {
      return 0.05 * index10(-precision)
    }
    default: {
      return index10(-precision)
    }
  }
}

export function ensureNonDegenerateYAxisExtent(min: number, max: number, diff: number): [number, number] {
  if (min === max || Math.abs(min - max) < diff) {
    return [min - 4 * diff, max + 4 * diff]
  }
  return [min, max]
}

export function resolveYAxisDomain(
  min: number,
  max: number,
  type: YAxisType,
  firstClose: number | undefined,
  minutePercentageBasis: number
): [number, number] {
  switch (type) {
    case YAxisType.Percentage: {
      if (isNumber(firstClose)) {
        return [
          firstClose * (min / 100 + 1),
          firstClose * (max / 100 + 1)
        ]
      }
      return [min, max]
    }
    case YAxisType.MinutePercentage: {
      if (minutePercentageBasis > 0) {
        return [
          minutePercentageBasis * (min / 100 + 1),
          minutePercentageBasis * (max / 100 + 1)
        ]
      }
      return [min, max]
    }
    case YAxisType.Log: {
      return [index10(min), index10(max)]
    }
    default: {
      return [min, max]
    }
  }
}

export function resolveStandardTypedExtent(
  min: number,
  max: number,
  type: YAxisType,
  precision: number,
  firstClose: number | undefined,
  minutePercentageBasis: number
): [number, number] {
  const typedExtent = resolveYAxisTypeExtent(min, max, type, firstClose, minutePercentageBasis)
  return ensureNonDegenerateYAxisExtent(typedExtent[0], typedExtent[1], calcYAxisMinExtentDiff(type, precision))
}

export function resolveTimeShareMainScale(
  min: number,
  max: number,
  type: YAxisType,
  precision: number,
  basisPrice: number,
  firstClose: number | undefined,
  minutePercentageBasis: number,
  topRate = 0,
  bottomRate = 0
): VisibleRange {
  const maxDiff = Math.max(
    Math.abs(max - basisPrice),
    Math.abs(min - basisPrice)
  )
  let from = basisPrice - maxDiff
  let to = basisPrice + maxDiff
  const typedExtent = resolveYAxisTypeExtent(from, to, type, firstClose, minutePercentageBasis)
  from = typedExtent[0]
  to = typedExtent[1]
  const expandedExtent = ensureNonDegenerateYAxisExtent(from, to, calcYAxisMinExtentDiff(type, precision))
  from = expandedExtent[0]
  to = expandedExtent[1]
  const domain = resolveYAxisDomain(from, to, type, firstClose, minutePercentageBasis)
  const gapRate = Math.max(topRate, bottomRate)
  if (gapRate > 0) {
    const range = Math.abs(to - from)
    from -= range * gapRate
    to += range * gapRate
  }
  return {
    from,
    to,
    domainFrom: domain[0],
    domainTo: domain[1]
  }
}

export function resolveStandardScale(
  from: number,
  to: number,
  type: YAxisType,
  firstClose: number | undefined,
  minutePercentageBasis: number,
  topRate: number,
  bottomRate: number
): VisibleRange {
  const domain = resolveYAxisDomain(from, to, type, firstClose, minutePercentageBasis)
  const range = Math.abs(to - from)
  return {
    from: from - range * bottomRate,
    to: to + range * topRate,
    domainFrom: domain[0],
    domainTo: domain[1]
  }
}

export function resolveStandardAutoScale(
  from: number,
  to: number,
  type: YAxisType,
  firstClose: number | undefined,
  minutePercentageBasis: number,
  topRate: number,
  bottomRate: number,
  height: number,
  textHeight: number,
  nice = true
): { range: VisibleRange, tickSequence: YAxisTickSequence } {
  const contentHeight = height > 0 ? height / (1 + topRate + bottomRate) : height
  const [interval, precision] = calcYAxisTickInterval(Math.abs(to - from), contentHeight, textHeight)
  if (!nice) {
    return {
      range: resolveStandardScale(from, to, type, firstClose, minutePercentageBasis, topRate, bottomRate),
      tickSequence: {
        from,
        to,
        interval,
        precision,
        nice
      }
    }
  }

  const [tickFrom, tickTo] = calcYAxisTickBounds(from, to, interval, precision)
  return {
    range: resolveStandardScale(tickFrom, tickTo, type, firstClose, minutePercentageBasis, topRate, bottomRate),
    tickSequence: {
      from: tickFrom,
      to: tickTo,
      interval,
      precision,
      nice
    }
  }
}

export function formatYAxisTickText(
  value: number | string,
  text: string,
  type: YAxisType,
  precision: number,
  shouldFormatBigNumber: boolean,
  formatBigNumber: (value: string | number) => string,
  thousandsSeparator: string,
  decimalFoldThreshold: number
): string {
  let formattedText: string
  switch (type) {
    case YAxisType.MinutePercentage:
    case YAxisType.Percentage: {
      formattedText = `${formatPrecision(value, 2)}%`
      break
    }
    case YAxisType.Log: {
      formattedText = formatPrecision(index10(+value), precision)
      break
    }
    default: {
      formattedText = formatPrecision(value, precision)
      if (shouldFormatBigNumber) {
        formattedText = formatBigNumber(text || formattedText)
      }
      break
    }
  }
  return formatFoldDecimal(formatThousands(formattedText, thousandsSeparator), decimalFoldThreshold)
}

export function layoutYAxisTicks(
  ticks: AxisTick[],
  showMinLabel = true,
  showMaxLabel = true
): AxisTick[] {
  if (ticks.length === 0) {
    return []
  }

  const minValue = ticks[0].value
  const maxValue = ticks[ticks.length - 1].value
  return ticks.filter(tick => {
    const isMin = tick.value === minValue
    const isMax = tick.value === maxValue
    if (isMin && !showMinLabel) {
      return false
    }
    if (isMax && !showMaxLabel) {
      return false
    }
    return true
  })
}

export function createTimeShareYAxisTickValues(from: number, to: number, height: number, textHeight: number): number[] {
  if (to - from < 0) {
    return []
  }
  if (from === to) {
    return [from]
  }

  const range = to - from
  const maxTickCount = height > 0 && textHeight > 0
    ? Math.max(2, Math.floor(height / (textHeight * MIN_Y_AXIS_TICK_TEXT_SPACING)))
    : 2
  let splitCount = Math.min(8, Math.max(1, maxTickCount - 1))
  if (splitCount > 1 && splitCount % 2 !== 0) {
    splitCount--
  }

  return Array.from({ length: splitCount + 1 }, (_, index) => {
    if (index === 0) {
      return from
    }
    if (index === splitCount) {
      return to
    }
    return from + range * index / splitCount
  })
}

export function mapYAxisTicksToPixels(
  ticks: AxisTick[],
  type: YAxisType,
  precision: number,
  shouldFormatBigNumber: boolean,
  formatBigNumber: (value: string | number) => string,
  thousandsSeparator: string,
  decimalFoldThreshold: number,
  convertToPixel: (value: number) => number
): AxisTick[] {
  return ticks.map(({ text, value, colorHint }) => ({
    text: formatYAxisTickText(
      value,
      text,
      type,
      precision,
      shouldFormatBigNumber,
      formatBigNumber,
      thousandsSeparator,
      decimalFoldThreshold
    ),
    coord: convertToPixel(+value),
    value,
    colorHint
  }))
}

export function resolveYAxisTickTextOptions(
  inCandle: boolean,
  pricePrecision: number,
  indicators: Array<{ precision: number, shouldFormatBigNumber: boolean }>
): { precision: number, shouldFormatBigNumber: boolean } {
  if (inCandle) {
    return { precision: pricePrecision, shouldFormatBigNumber: false }
  }

  let precision = 0
  let shouldFormatBigNumber = false
  indicators.forEach(indicator => {
    precision = Math.max(precision, indicator.precision)
    shouldFormatBigNumber = shouldFormatBigNumber || indicator.shouldFormatBigNumber
  })
  return { precision, shouldFormatBigNumber }
}

export function resolveYAxisShowMinLabel(
  showMinLabel: boolean,
  isTimeShare: boolean,
  isInCandle: boolean,
  axisTitle: string | undefined
): boolean {
  if (isTimeShare && !isInCandle && axisTitle?.length) {
    return false
  }
  return showMinLabel
}

export function createSyncedYAxisTick(
  tick: AxisTick,
  type: YAxisType,
  precision: number,
  formatter: ((value: number) => string) | undefined,
  convertFromPixel: (coord: number) => number,
  minutePercentageBasis: number,
  firstClose: number | undefined
): AxisTick {
  let value = convertFromPixel(tick.coord)
  let text = formatter ? formatter(value) : formatPrecision(value, precision)

  if (type === YAxisType.MinutePercentage) {
    if (minutePercentageBasis > 0) {
      value = (value - minutePercentageBasis) / minutePercentageBasis * 100
      text = `${formatPrecision(value, 2)}%`
    }
  } else if (type === YAxisType.Percentage) {
    if (isNumber(firstClose)) {
      value = (value - firstClose) / firstClose * 100
      text = `${formatPrecision(value, 2)}%`
    }
  } else if (type === YAxisType.Log) {
    text = formatPrecision(value, precision)
  }

  return {
    text,
    coord: tick.coord,
    value
  }
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
  private _autoTickSequence?: YAxisTickSequence
  private _hasValidData = true

  isMainAxis(): boolean {
    const parent = this.getParent()
    const pane = parent.getPane() as DualYPane
    const mainAxisWidget = pane.getMainAxisWidget()
    return parent === mainAxisWidget
  }

  buildTicks(force: boolean): boolean {
    if (this._autoCalcTickFlag) {
      this._range = this.calcRange()
    }
    // 如果没有有效数据，返回空刻度数组
    if (!this._hasValidData) {
      this._ticks = []
      return true
    }
    if (this._prevRange.from !== this._range.from || this._prevRange.to !== this._range.to || force || this._ticks.length === 0) {
      this._prevRange = this._range
      const pane = this.getParent().getPane()
      const chart = pane.getChart()
      const chartStore = chart.getChartStore()
      const inCandle = this.isInCandle()
      const shouldCalcTimeShareTicks = inCandle && chartStore.getIsTimeShare()

      const cTicks = shouldCalcTimeShareTicks ? this._calcTimeShareTicks() : this._calcTicks()
      let defaultTicks: AxisTick[] = []
      if (!this.isMainAxis() && !shouldCalcTimeShareTicks) {
        const mainAxisWidget = (pane as DualYPane).getMainAxisWidget()
        const mainAxis = mainAxisWidget.getAxisComponent()
        if (mainAxis.getType() === this.getType() && this._range.from === mainAxis.getRange().from && this._range.to === mainAxis.getRange().to) {
          // 如果主轴和当前轴类型相同，则使用主轴的刻度
          defaultTicks = mainAxis.getTicks()
        } else {
          const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
          const type = this.getType()
          const paneAxisOptions = pane.getMainWidget().getPane().getOptions().axisOptions
          const position = (this.getParent().getOptions() as YAxisOptions).position
          const formatterFn = paneAxisOptions?.YAxis?.[position]?.formatter

          const { precision } = resolveYAxisTickTextOptions(inCandle, chartStore.getPrecision().price, indicators)
          defaultTicks = mainAxis.getTicks().map(tick => createSyncedYAxisTick(
            tick,
            type,
            precision,
            formatterFn,
            coord => this.convertFromPixel(coord),
            chartStore.getMinutePercentageBasis(),
            chartStore.getVisibleFirstData()?.close
          ))
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

  getTicks(): AxisTick[] {
    return this._ticks
  }

  setRange(range: VisibleRange): void {
    this._autoCalcTickFlag = false
    this._range = range
    this._autoTickSequence = undefined
  }

  getRange(): VisibleRange { return this._range }

  /**
   * 基于像素偏移量同步移动轴的范围
   * @param pixelOffset 像素偏移量
   * @param height 轴的高度
   */
  offsetByPixel(pixelOffset: number, height: number): void {
    if (this._autoCalcTickFlag || !this.getScrollZoomEnabled()) {
      return
    }

    const { from, to, domainFrom, domainTo } = this._range
    const rangeSize = to - from
    const domainSize = domainTo - domainFrom

    // 防止除零错误
    if (rangeSize === 0 || height === 0) {
      return
    }

    // 计算内部范围的偏移量
    const rangeOffset = (pixelOffset / height) * rangeSize

    // 计算新的内部范围
    const newFrom = from + rangeOffset
    const newTo = to + rangeOffset

    // 计算新的domain范围
    const newDomainFrom = domainFrom + (rangeOffset / rangeSize) * domainSize
    const newDomainTo = domainTo + (rangeOffset / rangeSize) * domainSize

    this._range = {
      from: newFrom,
      to: newTo,
      domainFrom: newDomainFrom,
      domainTo: newDomainTo
    }
  }

  setAutoCalcTickFlag(flag: boolean): void {
    this._autoCalcTickFlag = flag
  }

  getAutoCalcTickFlag(): boolean { return this._autoCalcTickFlag }

  protected calcRange(): VisibleRange {
    const pane = this.getParent().getPane()
    const chart = pane.getChart()
    const chartStore = chart.getChartStore()
    const figuresResultList: FiguresResult[] = []
    let shouldOhlc = false
    let indicatorPrecision = Number.MAX_SAFE_INTEGER
    const paneIndicators = chartStore.getIndicatorStore().getInstances(pane.getId())
    const inCandle = this.isInCandle()
    const yAxisWidget = this.getParent() as YAxisWidget

    const indicators = inCandle
      ? paneIndicators
      : filterIndicatorsByYAxisPosition(
        paneIndicators,
        yAxisWidget.getOptions().position,
        chart.getStyles().yAxis.position
      )

    indicators.forEach(indicator => {
      if (!shouldOhlc) {
        shouldOhlc = indicator.shouldOhlc ?? false
      }
      indicatorPrecision = Math.min(indicatorPrecision, indicator.precision)
      figuresResultList.push({
        indicator,
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
    } else if (indicatorPrecision !== Number.MAX_SAFE_INTEGER) {
      precision = indicatorPrecision
    }
    const visibleDataList = chartStore.getVisibleDataList()
    const candleStyles = chart.getStyles().candle
    const isArea = candleStyles.type === CandleType.Area
    const areaValueKey = candleStyles.area.value
    // 用于蜡烛图数据
    const shouldCompareHighLow = (inCandle && !isArea) || (!inCandle && shouldOhlc)
    const scaleMode = resolveYAxisScaleMode(inCandle, chartStore.getIsTimeShare())
    const extent = collectYAxisExtent(visibleDataList, figuresResultList, shouldCompareHighLow, inCandle && isArea, areaValueKey)
    this._hasValidData = extent.hasValidData

    const type = this.getType()
    const firstClose = chartStore.getVisibleFirstData()?.close
    const minutePercentageBasis = chartStore.getMinutePercentageBasis()
    const height = this.getParent()?.getBounding().height ?? 0
    const { gap: paneGap, reservedSpace } = pane.getOptions()
    let topRate = normalizePaneGapRate(paneGap?.top, height)
    let bottomRate = normalizePaneGapRate(paneGap?.bottom, height)
    const [nextTopRate, nextBottomRate] = applyReservedSpace(
      topRate,
      bottomRate,
      height,
      normalizeReservedSpace(reservedSpace?.top),
      normalizeReservedSpace(reservedSpace?.bottom)
    )
    topRate = nextTopRate
    bottomRate = nextBottomRate
    this._autoTickSequence = undefined
    if (scaleMode === YAxisScaleMode.TimeShareMain) {
      return resolveTimeShareMainScale(
        extent.min,
        extent.max,
        type,
        precision,
        chartStore.getTimeShareBasisPrice(),
        firstClose,
        minutePercentageBasis,
        topRate,
        bottomRate
      )
    }

    const textHeight = chart.getStyles().yAxis.tickText.size
    const dataExtent = resolveStandardTypedExtent(extent.min, extent.max, type, precision, firstClose, minutePercentageBasis)
    const scale = resolveStandardAutoScale(
      dataExtent[0],
      dataExtent[1],
      type,
      firstClose,
      minutePercentageBasis,
      topRate,
      bottomRate,
      height,
      textHeight,
      yAxisWidget.getOptions().nice
    )
    if (this._hasValidData) {
      this._autoTickSequence = scale.tickSequence
    }
    return scale.range
  }

  /**
   * 内部值转换成坐标
   * @param value
   * @return {number}
   * @private
   */
  _innerConvertToPixel(value: number): number {
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
  isInCandle(): boolean {
    const pane = this.getParent().getPane()
    return pane.getId() === PaneIdConstants.CANDLE
  }

  /**
   * y轴类型
   * @return {YAxisType}
   */
  getType(): YAxisType {
    const yAxisWidget = this.getParent() as YAxisWidget
    return yAxisWidget.getOptions().type
  }

  /**
   * 是否反转
   * @return {boolean}
   */
  isReverse(): boolean {
    if (this.isInCandle()) {
      const chart = this.getParent().getPane().getChart()
      return chart.getStyles().yAxis.reverse
    }
    return false
  }

  protected optimalTicks(ticks: AxisTick[]): AxisTick[] {
    const widget = this.getParent()
    const yAxisWidget = widget as YAxisWidget
    const pane = widget.getPane()
    const chartStore = pane.getChart().getChartStore()
    const customApi = chartStore.getCustomApi()
    const type = this.getType()
    const isInCandle = this.isInCandle()
    const indicators = chartStore.getIndicatorStore().getInstances(pane.getId())
    const thousandsSeparator = chartStore.getThousandsSeparator()
    const decimalFoldThreshold = chartStore.getDecimalFoldThreshold()
    const { precision, shouldFormatBigNumber } = resolveYAxisTickTextOptions(isInCandle, chartStore.getPrecision().price, indicators)
    const yAxisStyles = chartStore.getStyles().yAxis
    const tempTicks = mapYAxisTicksToPixels(
      ticks,
      type,
      precision,
      shouldFormatBigNumber,
      value => customApi.formatBigNumber(value),
      thousandsSeparator,
      decimalFoldThreshold,
      value => this._innerConvertToPixel(value)
    )
    const isTimeShare = chartStore.getIsTimeShare()
    const showMinLabel = resolveYAxisShowMinLabel(
      yAxisStyles.showMinLabel,
      isTimeShare,
      isInCandle,
      yAxisWidget.getOptions().axisTitle
    )
    const optimalTicks = layoutYAxisTicks(
      tempTicks,
      showMinLabel,
      yAxisStyles.showMaxLabel
    )
    return optimalTicks
  }

  override getAutoSize(): number {
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
          textWidth = Math.max(textWidth, calcTextWidth(tick.text, createFont(yAxisStyles.tickText.size, yAxisStyles.tickText.weight, yAxisStyles.tickText.fontFamily)))
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
            crosshairStyles.horizontal.text.fontFamily
          )
        )
      )
    }
    return Math.max(yAxisWidth, crosshairVerticalTextWidth)
  }

  private _calcTimeShareTicks(): AxisTick[] {
    const { from, to } = this._range
    const mid = (from + to) / 2

    if (to - from >= 0) {
      const widget = this.getParent()
      const pane = widget.getPane()
      const chartStore = pane.getChart().getChartStore()

      const height = widget?.getBounding().height ?? 0
      const textHeight = chartStore.getStyles().yAxis.tickText.size
      const arrV = createTimeShareYAxisTickValues(from, to, height, textHeight)
      return arrV.map(e => ({ text: `${e  }`, coord: 0, value: e, colorHint: e > mid ? 1 : e < mid ? -1 : 0 }))
    }
    return []
  }

  private _calcTicks(): AxisTick[] {
    const { from, to } = this._range
    const ticks: AxisTick[] = []

    if (to - from >= 0) {
      const [interval, precision, first, last, nice] = this._calcTickValues(from, to)
      const values = nice
        ? this._calcNiceTickValues(interval, precision, first, last)
        : this._calcExactBoundaryTickValues(interval, precision, first, last)

      for (let n = 0; n < values.length; n++) {
        const value = values[n]
        ticks[n] = { text: this._formatTickText(value, precision), coord: 0, value }
      }
    }
    return ticks
  }

  private _calcTickValues(from: number, to: number): [number, number, number, number, boolean] {
    if (this._autoCalcTickFlag && this._autoTickSequence && this._autoTickSequence.interval > 0) {
      return [
        this._autoTickSequence.interval,
        this._autoTickSequence.precision,
        this._autoTickSequence.from,
        this._autoTickSequence.to,
        this._autoTickSequence.nice
      ]
    }

    const height = this.getParent()?.getBounding().height ?? 0
    const textHeight = this.getParent().getPane().getChart().getStyles().yAxis.tickText.size
    const [interval, precision] = calcYAxisTickInterval(to - from, height, textHeight)
    if (interval <= 0) {
      return [0, precision, from, to, true]
    }
    const first = round(Math.ceil(from / interval) * interval, precision)
    const last = round(Math.floor(to / interval) * interval, precision)
    return [interval, precision, first, last, true]
  }

  private _calcNiceTickValues(interval: number, precision: number, first: number, last: number): number[] {
    const values: number[] = []
    let f = first

    if (interval !== 0) {
      while (f <= last + interval / 2 && values.length < 10000) {
        values.push(f)
        f = round(f + interval, precision)
      }
    }

    return values
  }

  private _calcExactBoundaryTickValues(interval: number, precision: number, from: number, to: number): number[] {
    if (from === to || interval <= 0) {
      return [from]
    }

    const values = [from]
    const first = round(Math.ceil(from / interval) * interval, precision)
    const last = round(Math.floor(to / interval) * interval, precision)
    const boundaryInset = interval / 2
    let f = first

    while (f <= last + interval / 2 && values.length < 10000) {
      if (f > from && f < to && f - from >= boundaryInset && to - f >= boundaryInset) {
        values.push(f)
      }
      f = round(f + interval, precision)
    }
    values.push(to)

    return values
  }

  private _formatTickText(value: number, precision: number): string {
    return value.toFixed(Math.max(precision, getPrecision(value)))
  }

  getSelfBounding(): Bounding {
    return this.getParent().getBounding()
  }

  convertFromPixel(pixel: number): number {
    const height = this.getParent().getBounding().height ?? 0
    const { from, to } = this.getRange()
    const rate = this.isReverse() ? pixel / height : 1 - pixel / height
    const value = rate * (to - from) + from
    switch (this.getType()) {
      case YAxisType.MinutePercentage: {
        const chartStore = this.getParent().getPane().getChart().getChartStore()
        const basisPrice = chartStore.getMinutePercentageBasis()
        if (basisPrice > 0) {
          return basisPrice * (value / 100 + 1)
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

  convertToRealValue(value: number): number {
    let v = value
    if (this.getType() === YAxisType.Log) {
      v = index10(value)
    }
    return v
  }

  convertToPixel(value: number): number {
    let v = value
    switch (this.getType()) {
      case YAxisType.MinutePercentage: {
        const chartStore = this.getParent().getPane().getChart().getChartStore()
        const basisPrice = chartStore.getMinutePercentageBasis()
        if (basisPrice > 0) {
          v = (value - basisPrice) / basisPrice * 100
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

  static extend(template: AxisTemplate): YAxisConstructor {
    class Custom extends YAxisImp {
      createTicks(params: AxisCreateTicksParams): AxisTick[] {
        return template.createTicks(params)
      }
    }
    return Custom
  }
}
