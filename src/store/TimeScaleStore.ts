import type BarSpace from '../common/BarSpace'
import type VisibleRange from '../common/VisibleRange'
import type { LogicalRange } from '../common/VisibleRange'
import type { ResizeAnchor } from '../Chart'
import type { DataZoomOptions } from '../Options'
import { ActionType } from '../common/Action'
import type ChartStore from './ChartStore'
import { LoadDataType } from '../common/LoadDataCallback'
import { clamp } from '@/common/utils/number'
import { createLinear, type LinearScale } from '../component/scale'
import { logWarn } from '../common/utils/logger'
import { DataZoomTimeScaleMode, type DataZoomRangeMoveHandle, type DataZoomRangeMoveResult, KLineTimeScaleMode, type TimeScaleMode, type TimeScaleModeContext, TimeScaleModeKind, TimeShareTimeScaleMode } from './time-scale'
import { CandleType, type Styles } from '../common/Styles'
import { isTransparent } from '../common/utils/color'
import { resolveLineSymbolStyle } from '../extension/figure/line'

const DEFAULT_BAR_WIDTH = 8
const DEFAULT_OFFSET_RIGHT = 10

interface InitialTimeScaleView {
  mode: TimeScaleModeKind
  barWidth: number
  offsetRight: number
  kLineAlignment?: 'left' | 'right'
  dataZoomRange?: { start: number, end: number }
}

interface TimeScaleDataAnchor {
  timestamp: number
  distanceFromRight: number
}

export default class TimeScaleStore {
  private readonly _chartStore: ChartStore
  private _zoomEnabled: boolean = true
  private _scrollEnabled: boolean = true
  private _barWidth: number = DEFAULT_BAR_WIDTH
  private _rightLogicalIndex: number
  private _barSpaceLimit = { min: 1, max: 50 }

  private _maxOffsetLeftDistance?: number
  private _maxOffsetRightDistance?: number
  private _leftMinVisibleBarCount?: number
  private _rightMinVisibleBarCount?: number
  private _calcMode: 'DISTANCE_MODE' | 'BARCOUNT_MODE' = 'DISTANCE_MODE'
  /**
   * 滚动到最左时最小剩余宽度, 滚动到最右时最小剩余宽度
   */
  private readonly _minRemainWidth = { left: 0, right: 0 }

  private _autoInitialAlignment: boolean = true

  private _logicalRange: LogicalRange = { from: 0, to: 0 }

  private _initialView?: InitialTimeScaleView

  private _xScale: LinearScale
  private _mode: TimeScaleMode
  private readonly _modeContext: TimeScaleModeContext
  private _dataZoomOptions: DataZoomOptions = {}

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
    this._rightLogicalIndex = chartStore.getTimeIndex().dataIndexToLogical(chartStore.getDataList().length) + DEFAULT_OFFSET_RIGHT / this._barWidth
    this._xScale = createScale(this._logicalRange, this._chartStore.mainWidth, this.getHorizontalInset())
    this._modeContext = {
      getBarWidth: () => this._barWidth,
      setBarWidth: barWidth => {
        this._barWidth = barWidth
      },
      getBarSpaceLimit: () => this._barSpaceLimit,
      getMainWidth: () => this._chartStore.mainWidth,
      getDataList: () => this._chartStore.getDataList(),
      getFirstLogicalIndex: () => this._chartStore.getTimeIndex().getFirstLogicalIndex(),
      getRightLogicalIndex: () => this._rightLogicalIndex,
      setRightLogicalIndex: logicalIndex => { this._rightLogicalIndex = logicalIndex },
      getMinRemainWidth: () => this._minRemainWidth,
      getTimeShareTicks: () => this._chartStore.getTimeShareTicks(),
      getTimeShareDays: () => this._chartStore.getTimeShareDays(),
      getZoomCoordinate: xCoord => {
        const crosshair = this._chartStore.getTooltipStore().getCrosshair()
        return xCoord ?? crosshair?.x ?? this._chartStore.mainWidth / 2
      },
      getInitialOffsetRightDistance: () => DEFAULT_OFFSET_RIGHT,
      getOffsetRightDistance: () => this.getOffsetRightDistance(),
      setOffsetRightDistance: distance => { this.setOffsetRightDistance(distance) }
    }
    this._mode = this.createMode(TimeScaleModeKind.KLine)
  }

  private _refreshTimeScale(requestLayout: boolean = false): void {
    this.adjustVisibleRange()
    this._chartStore.getTooltipStore().recalculateCrosshair(true)
    if (requestLayout) {
      this._chartStore.getChart().requestViewportLayout()
    } else {
      this._chartStore.getChart().refreshViewportLayout()
    }
  }

  private createMode(kind: TimeScaleModeKind): TimeScaleMode {
    switch (kind) {
      case TimeScaleModeKind.TimeShare:
        return new TimeShareTimeScaleMode(this._modeContext)
      case TimeScaleModeKind.DataZoom:
        return new DataZoomTimeScaleMode(this._modeContext)
      case TimeScaleModeKind.KLine:
        return new KLineTimeScaleMode(this._modeContext)
    }
  }

  setMode(kind: TimeScaleModeKind): void {
    this._mode = this.createMode(kind)
    this._barSpaceLimit = this._mode.createBarSpaceLimit()
    this.applyDataZoomOptions()
  }

  setDataZoomOptions(options: DataZoomOptions = {}): void {
    this._dataZoomOptions = options
    this.applyDataZoomOptions()
  }

  resetDataZoomRange(): void {
    this.applyDataZoomOptions()
  }

  getDataZoomRange(): { start: number, end: number } | undefined {
    if (this._mode instanceof DataZoomTimeScaleMode) {
      return this._mode.getRange()
    }
    return undefined
  }

  getDataZoomMinSpan(): number {
    if (this._mode instanceof DataZoomTimeScaleMode) {
      return this._mode.getMinSpan()
    }
    return 100
  }

  setDataZoomRange(start: number, end: number, requestLayout: boolean = false): boolean {
    if (!(this._mode instanceof DataZoomTimeScaleMode)) {
      return false
    }
    if (!this._mode.setRange(start, end)) {
      return false
    }
    this._refreshTimeScale(requestLayout)
    return true
  }

  setDataZoomRangeByMove(start: number, end: number, delta: number, handleIndex: DataZoomRangeMoveHandle, requestLayout: boolean = false): DataZoomRangeMoveResult | undefined {
    if (!(this._mode instanceof DataZoomTimeScaleMode)) {
      return undefined
    }
    const result = this._mode.setRangeByMove(start, end, delta, handleIndex)
    if (!result.changed) {
      return result
    }
    this._refreshTimeScale(requestLayout)
    return result
  }

  private applyDataZoomOptions(): void {
    if (this._mode instanceof DataZoomTimeScaleMode) {
      this._mode.setSpanLimit(this._dataZoomOptions.minSpan, this._dataZoomOptions.maxSpan)
      this._mode.setRange(this._dataZoomOptions.start, this._dataZoomOptions.end)
    }
  }

  private calcMinRemainWidth(): void {
    if (this._calcMode === 'DISTANCE_MODE') {
      if (this._maxOffsetLeftDistance != null) {
        this._minRemainWidth.right = Math.max(0, this._chartStore.mainWidth - this._maxOffsetLeftDistance)
      }
      if (this._maxOffsetRightDistance != null) {
        this._minRemainWidth.left = Math.max(0, this._chartStore.mainWidth - this._maxOffsetRightDistance)
      }
    } else if (this._calcMode === 'BARCOUNT_MODE') {
      if (this._leftMinVisibleBarCount != null) {
        this._minRemainWidth.left = this._barWidth * this._leftMinVisibleBarCount
      }
      if (this._rightMinVisibleBarCount != null) {
        this._minRemainWidth.right = this._barWidth * this._rightMinVisibleBarCount
      }
    }
  }

  private calcLogicalRange(): LogicalRange {
    this.calcMinRemainWidth()
    return this._mode.calcLogicalRange()
  }

  adjustVisibleRange(): void {
    this._chartStore.batchEffects(() => this._adjustVisibleRange())
  }

  private _adjustVisibleRange(): void {
    this._mode.prepareVisibleRange()
    this._logicalRange = this.calcLogicalRange()
    this._xScale = createScale(this._logicalRange, this._chartStore.mainWidth, this.getHorizontalInset())
    const visibleRange = this.getVisibleRange()

    this._chartStore.getActionStore().execute(ActionType.OnVisibleRangeChange, visibleRange)
    this._chartStore.adjustVisibleDataList()
    const dataList = this._chartStore.getDataList()
    const totalBarCount = dataList.length
    const { from, to } = visibleRange
    if (from === 0) {
      const firstData = dataList[0]
      this._chartStore.executeLoadDataCallback({
        type: LoadDataType.Backward,
        data: firstData ?? null
      })
    }
    if (to === totalBarCount) {
      this._chartStore.executeLoadDataCallback({
        type: LoadDataType.Forward,
        data: dataList[totalBarCount - 1] ?? null
      })
    }
  }

  getBarSpace(): BarSpace {
    return this._mode.createBarSpace()
  }

  setBarSpaceLimit(limit: { min?: number, max?: number } = {}): void {
    const nextLimit = {
      min: limit.min ?? this._barSpaceLimit.min,
      max: limit.max ?? this._barSpaceLimit.max
    }
    if (nextLimit.min > nextLimit.max) {
      logWarn('setBarSpaceLimit', 'min/max', 'min must less than or equal to max!!!')
      return
    }
    if (nextLimit.min === this._barSpaceLimit.min && nextLimit.max === this._barSpaceLimit.max) {
      return
    }

    this._barSpaceLimit = nextLimit

    const shouldRefresh = this._mode.applyBarSpaceLimitChange(clamp(this._barWidth, nextLimit.min, nextLimit.max))

    if (shouldRefresh) {
      this._refreshTimeScale()
    }
  }

  setBarSpace(barWidth: number): void {
    if (this._mode.setBarSpace(barWidth)) {
      this._refreshTimeScale()
    }
  }

  adjustBarSpaceForMainWidthChange(prevMainWidth: number, nextMainWidth: number, anchor: ResizeAnchor): void {
    this._mode.adjustBarSpaceForMainWidthChange(prevMainWidth, nextMainWidth, anchor)
  }

  setOffsetRightDistance(distance: number, update?: boolean): this {
    this._rightLogicalIndex = this._chartStore.getTimeIndex().dataIndexToLogical(this._chartStore.getDataList().length) + distance / this._barWidth
    if (update ?? false) {
      this._refreshTimeScale()
    }
    return this
  }

  resetOffsetRightDistance(): void {
    this.setOffsetRightDistance(DEFAULT_OFFSET_RIGHT)
  }

  /** Batch appends retain the public offset policy; streaming bars keep the logical viewport. */
  onBatchDataAppended(count: number): void {
    this._rightLogicalIndex += count
  }

  getInitialOffsetRightDistance(): number {
    return DEFAULT_OFFSET_RIGHT
  }

  getOffsetRightDistance(): number {
    return (this._rightLogicalIndex - this._chartStore.getTimeIndex().dataIndexToLogical(this._chartStore.getDataList().length)) * this._barWidth
  }

  setMaxOffsetLeftDistance(distance: number): void {
    this._maxOffsetLeftDistance = distance
    this._calcMode = 'DISTANCE_MODE'
  }

  setMaxOffsetRightDistance(distance: number): void {
    this._maxOffsetRightDistance = distance
    this._calcMode = 'DISTANCE_MODE'
  }

  setLeftMinVisibleBarCount(barCount: number): void {
    this._leftMinVisibleBarCount = barCount
    this._calcMode = 'BARCOUNT_MODE'
  }

  setRightMinVisibleBarCount(barCount: number): void {
    this._rightMinVisibleBarCount = barCount
    this._calcMode = 'BARCOUNT_MODE'
  }

  fitToWidth(align: 'left' | 'center' | 'right' | 'auto' = 'auto'): void {
    if (this._mode.fitToWidth(align)) {
      this._refreshTimeScale()
    }
  }

  resetTimeScale(): void {
    const initialView = this._initialView
    if (initialView?.mode !== this.getModeKind()) {
      return
    }

    let changed = false
    if (this._mode instanceof DataZoomTimeScaleMode && initialView.dataZoomRange != null) {
      changed = this._mode.setRange(initialView.dataZoomRange.start, initialView.dataZoomRange.end)
    } else {
      const nextBarWidth = this._mode instanceof KLineTimeScaleMode
        ? clamp(initialView.barWidth, this._barSpaceLimit.min, this._barSpaceLimit.max)
        : initialView.barWidth
      const index = this._chartStore.getTimeIndex()
      const nextRightLogicalIndex = initialView.kLineAlignment === 'left'
        ? index.getFirstLogicalIndex() + this._chartStore.mainWidth / nextBarWidth
        : index.dataIndexToLogical(this._chartStore.getDataList().length) + initialView.offsetRight / nextBarWidth
      changed = this._barWidth !== nextBarWidth || Math.abs(this._rightLogicalIndex - nextRightLogicalIndex) > this.getLogicalTolerance()
      if (changed) {
        this._barWidth = nextBarWidth
        this._rightLogicalIndex = nextRightLogicalIndex
      }
    }
    if (changed) {
      this._refreshTimeScale()
    }
  }

  captureInitialView(): void {
    const mode = this.getModeKind()
    const initialView: InitialTimeScaleView = {
      mode,
      barWidth: this._barWidth,
      offsetRight: this.getOffsetRightDistance()
    }
    if (this._mode instanceof KLineTimeScaleMode) {
      const leftAlignedRight = this._chartStore.getTimeIndex().getFirstLogicalIndex() + this._chartStore.mainWidth / this._barWidth
      initialView.kLineAlignment = Math.abs(this._rightLogicalIndex - leftAlignedRight) <= this.getLogicalTolerance()
        ? 'left'
        : 'right'
    } else if (this._mode instanceof DataZoomTimeScaleMode) {
      initialView.dataZoomRange = this._mode.getRange()
    }
    this._initialView = initialView
  }

  getVisibleRange(): VisibleRange {
    const index = this._chartStore.getTimeIndex()
    const count = this._chartStore.getDataList().length
    const domainFrom = index.logicalToDataIndex(this._logicalRange.from)
    const domainTo = index.logicalToDataIndex(this._logicalRange.to)
    // Correct round-off only when rounding iteration bounds; retain continuous geometry.
    const tolerance = Math.max(this.getLogicalTolerance(), Number.EPSILON * Math.max(count, Math.abs(domainFrom), Math.abs(domainTo)) * 4)
    return {
      from: count === 0 ? 0 : Math.max(0, Math.floor(domainFrom + tolerance)),
      to: count === 0 ? 0 : clamp(Math.ceil(domainTo - tolerance), 0, count),
      domainFrom,
      domainTo
    }
  }

  captureDataAnchor(): TimeScaleDataAnchor | undefined {
    if (!(this._mode instanceof KLineTimeScaleMode) || this._chartStore.mainWidth <= 0) {
      return undefined
    }
    const { from, to } = this.getVisibleRange()
    const range = this._logicalRange
    const index = this._chartStore.getTimeIndex()
    const data = this._chartStore.getDataList()
    if (data.length === 0 || from >= to) return undefined
    const dataIndex = clamp(index.logicalToDataIndex(Math.floor((range.from + range.to) / 2)), from, Math.min(to, data.length) - 1)
    const logicalIndex = index.dataIndexToLogical(dataIndex)
    return { timestamp: data[dataIndex].timestamp, distanceFromRight: range.to - logicalIndex }
  }

  restoreDataAnchor(anchor: TimeScaleDataAnchor | undefined, fallbackOffset: number): void {
    const logicalIndex = anchor === undefined ? undefined : this._chartStore.getTimeIndex().timeToLogical(anchor.timestamp)
    if (logicalIndex !== undefined && anchor !== undefined) {
      this._rightLogicalIndex = logicalIndex + anchor.distanceFromRight
    } else {
      this.setOffsetRightDistance(fallbackOffset)
    }
  }

  getXScale(): LinearScale {
    // Compatibility: this accessor, like VisibleRange, uses data-array offsets.
    const { domainFrom: from, domainTo: to } = this.getVisibleRange()
    return createScale({ from, to }, this._chartStore.mainWidth, this.getHorizontalInset())
  }

  getLogicalVisibleRange(): LogicalRange {
    return { ...this._logicalRange }
  }

  private getHorizontalInset(): number {
    return calcTimeScaleHorizontalInset(this._chartStore.getStyles())
  }

  scroll(distance: number, requestLayout: boolean = false): void {
    if (!this._scrollEnabled) {
      return
    }
    const prevOffsetRight = this.getOffsetRightDistance()
    if (!this._mode.scroll(distance)) {
      return
    }
    this._refreshTimeScale(requestLayout)
    const realDistance = Math.round(prevOffsetRight - this.getOffsetRightDistance())
    if (realDistance !== 0) {
      this._chartStore.getActionStore().execute(ActionType.OnScroll, { distance: realDistance })
    }
  }

  logicalToCoordinate(logicalIndex: number): number {
    return this._xScale(logicalIndex)
  }

  /** Continuous inverse; discrete bar picking uses coordinateToLogicalIndex. */
  coordinateToLogical(x: number): number {
    return this._xScale.invert(x)
  }

  /** Nearest bar, with midpoint ties going right despite interpolation round-off. */
  coordinateToLogicalIndex(x: number): number {
    return Math.floor(this.coordinateToLogical(x) + 0.5 + this.getLogicalTolerance())
  }

  private getLogicalTolerance(): number {
    // Allow a few ULPs from the affine viewport conversion.
    return Number.EPSILON * Math.max(1, Math.abs(this._logicalRange.from), Math.abs(this._logicalRange.to), Math.abs(this._rightLogicalIndex)) * 4
  }

  dataIndexToCoordinate(dataIndex: number): number {
    return this.logicalToCoordinate(this._chartStore.getTimeIndex().dataIndexToLogical(dataIndex))
  }

  coordinateToDataIndex(x: number): number {
    return this._chartStore.getTimeIndex().logicalToDataIndex(this.coordinateToLogicalIndex(x))
  }

  zoom(scaleDelta: number, xCoord?: number, requestLayout: boolean = false): void {
    if (!this._zoomEnabled) {
      return
    }
    const realScaleRatio = this._mode.zoom(scaleDelta, xCoord)
    if (realScaleRatio === undefined) {
      return
    }
    this._refreshTimeScale(requestLayout)

    if (realScaleRatio !== 1) {
      this._chartStore.getActionStore().execute(ActionType.OnZoom, { scale: realScaleRatio })
    }
  }

  get zoomEnabled(): boolean { return this._zoomEnabled }

  set zoomEnabled(enabled: boolean) { this._zoomEnabled = enabled }

  get scrollEnabled(): boolean { return this._scrollEnabled }

  set scrollEnabled(enabled: boolean) { this._scrollEnabled = enabled }

  clear(offsetRight: number = this.getOffsetRightDistance()): void {
    this._logicalRange = { from: 0, to: 0 }
    this.setOffsetRightDistance(offsetRight)
    this._xScale = createScale(this._logicalRange, this._chartStore.mainWidth, this.getHorizontalInset())
    this._initialView = undefined
  }

  /**
   * 将K线左对齐到屏幕左边
   * 适用于数据量较少，希望充分利用屏幕空间的场景
   */
  alignLeft(): void {
    if (this._mode.alignLeft()) {
      this._refreshTimeScale()
    }
  }

  /**
   * 将K线右对齐到屏幕右边（恢复默认行为）
   */
  alignRight(): void {
    if (this._mode.alignRight()) {
      this._refreshTimeScale()
    }
  }

  /**
   * 将K线居中对齐
   */
  alignCenter(): void {
    if (this._mode.alignCenter()) {
      this._refreshTimeScale()
    }
  }

  /**
   * 智能初始对齐
   * 根据数据量自动选择最合适的对齐方式
   */
  autoInitialAlignment(update: boolean = true): void {
    if (!this._autoInitialAlignment) {
      return
    }
    if (this._mode.autoInitialAlignment() && update) {
      this._refreshTimeScale()
    }
  }

  /**
   * 设置智能初始对齐开关
   */
  setAutoInitialAlignment(enabled: boolean): void {
    this._autoInitialAlignment = enabled
  }

  /**
   * 获取智能初始对齐开关状态
   */
  getAutoInitialAlignment(): boolean {
    return this._autoInitialAlignment
  }

  private getModeKind(): TimeScaleModeKind {
    if (this._mode instanceof DataZoomTimeScaleMode) {
      return TimeScaleModeKind.DataZoom
    }
    if (this._mode instanceof TimeShareTimeScaleMode) {
      return TimeScaleModeKind.TimeShare
    }
    return TimeScaleModeKind.KLine
  }

}

export function calcTimeScaleHorizontalInset(styles: Styles): number {
  const candleStyles = styles.candle
  if (candleStyles.type !== CandleType.Area) {
    return 0
  }

  const areaStyles = candleStyles.area
  const symbolStyle = resolveLineSymbolStyle({
    color: areaStyles.lineColor,
    symbol: areaStyles.symbol
  })
  const symbolFillVisible = !isTransparent(symbolStyle.fillColor)
  const symbolBorderVisible = symbolStyle.borderSize > 0 && !isTransparent(symbolStyle.borderColor)
  const shouldStrokeSymbol = symbolBorderVisible && (!symbolFillVisible || symbolStyle.radius > symbolStyle.borderSize)
  const symbolInset = symbolStyle.show && symbolStyle.radius > 0 && (symbolFillVisible || symbolBorderVisible)
    ? symbolStyle.radius + (shouldStrokeSymbol ? symbolStyle.borderSize / 2 : 0)
    : 0
  const pointInset = areaStyles.point.show
    ? Math.max(areaStyles.point.radius, areaStyles.point.rippleRadius)
    : 0

  if (symbolInset === 0 && pointInset === 0) {
    return 0
  }
  return Math.ceil(Math.max(symbolInset, pointInset, areaStyles.lineSize / 2))
}

function createScale({ from, to }: LogicalRange, mainWidth: number, horizontalInset: number = 0): LinearScale {
  const inset = Math.max(0, Math.min(horizontalInset, mainWidth / 2))
  return createLinear({
    domain: [from - 0.5, to - 0.5],
    range: [inset, mainWidth - inset]
  })
}
