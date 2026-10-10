import type BarSpace from '../common/BarSpace'
import type VisibleRange from '../common/VisibleRange'
import type { ResizeAnchor } from '../Chart'
import type { DataZoomOptions } from '../Options'
import { getDefaultVisibleRange } from '../common/VisibleRange'
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
  private _offsetRight = DEFAULT_OFFSET_RIGHT
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

  private _visibleRange: VisibleRange = getDefaultVisibleRange()

  private _initialView?: InitialTimeScaleView

  private _xScale: LinearScale
  private _mode: TimeScaleMode
  private readonly _modeContext: TimeScaleModeContext
  private _dataZoomOptions: DataZoomOptions = {}

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
    this._xScale = createScale(this._visibleRange, this._chartStore.mainWidth, this.getHorizontalInset())
    this._modeContext = {
      getBarSpace: () => this.getBarSpace(),
      getBarWidth: () => this._barWidth,
      setBarWidth: barWidth => {
        this._barWidth = barWidth
      },
      getBarSpaceLimit: () => this._barSpaceLimit,
      getMainWidth: () => this._chartStore.mainWidth,
      getDataList: () => this._chartStore.getDataList(),
      getMinRemainWidth: () => this._minRemainWidth,
      getTimeShareTicks: () => this._chartStore.getTimeShareTicks(),
      getTimeShareDays: () => this._chartStore.getTimeShareDays(),
      getZoomCoordinate: xCoord => {
        const crosshair = this._chartStore.getTooltipStore().getCrosshair()
        return xCoord ?? crosshair?.x ?? this._chartStore.mainWidth / 2
      },
      getInitialOffsetRightDistance: () => DEFAULT_OFFSET_RIGHT,
      getOffsetRightDistance: () => this._offsetRight,
      setOffsetRightDistance: distance => {
        this._offsetRight = distance
      }
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

  private calcVisibleRange(): VisibleRange {
    this.calcMinRemainWidth()
    return this._mode.calcVisibleRange()
  }

  adjustVisibleRange(): void {
    this._chartStore.batchEffects(() => this._adjustVisibleRange())
  }

  private _adjustVisibleRange(): void {
    this._mode.prepareVisibleRange()
    const visibleRange = this.calcVisibleRange()

    this._visibleRange = visibleRange
    this._xScale = createScale(visibleRange, this._chartStore.mainWidth, this.getHorizontalInset(), this._chartStore.getTimeIndex().getFirstLogicalIndex())

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
    this._offsetRight = distance
    if (update ?? false) {
      this._refreshTimeScale()
    }
    return this
  }

  resetOffsetRightDistance(): void {
    this.setOffsetRightDistance(DEFAULT_OFFSET_RIGHT)
  }

  onAppendData(): void {
    this._mode.onAppendData()
  }

  getInitialOffsetRightDistance(): number {
    return DEFAULT_OFFSET_RIGHT
  }

  getOffsetRightDistance(): number {
    return this._offsetRight
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
    } else if (this._mode instanceof KLineTimeScaleMode) {
      const nextBarWidth = clamp(initialView.barWidth, this._barSpaceLimit.min, this._barSpaceLimit.max)
      const nextOffsetRight = initialView.kLineAlignment === 'left'
        ? this._chartStore.mainWidth - this._chartStore.getDataList().length * nextBarWidth
        : initialView.offsetRight
      changed = this._barWidth !== nextBarWidth || this._offsetRight !== nextOffsetRight
      this._barWidth = nextBarWidth
      this._offsetRight = nextOffsetRight
    } else {
      changed = this._barWidth !== initialView.barWidth || this._offsetRight !== initialView.offsetRight
      this._barWidth = initialView.barWidth
      this._offsetRight = initialView.offsetRight
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
      offsetRight: this._offsetRight
    }
    if (this._mode instanceof KLineTimeScaleMode) {
      const leftOffsetRight = this._chartStore.mainWidth - this._barWidth * this._chartStore.getDataList().length
      initialView.kLineAlignment = this._offsetRight === leftOffsetRight
        ? 'left'
        : 'right'
    } else if (this._mode instanceof DataZoomTimeScaleMode) {
      initialView.dataZoomRange = this._mode.getRange()
    }
    this._initialView = initialView
  }

  getVisibleRange(): VisibleRange {
    return this._visibleRange
  }

  captureDataAnchor(): TimeScaleDataAnchor | undefined {
    if (!(this._mode instanceof KLineTimeScaleMode) || this._chartStore.mainWidth <= 0) {
      return undefined
    }
    const { from, to, domainFrom, domainTo } = this._visibleRange
    const data = this._chartStore.getDataList()
    if (data.length === 0 || from >= to) return undefined
    const dataIndex = clamp(Math.floor((domainFrom + domainTo) / 2), from, Math.min(to, data.length) - 1)
    return { timestamp: data[dataIndex].timestamp, distanceFromRight: domainTo - dataIndex }
  }

  restoreDataAnchor(anchor: TimeScaleDataAnchor | undefined): void {
    if (anchor === undefined || !(this._mode instanceof KLineTimeScaleMode)) return
    const dataIndex = this._chartStore.getTimeIndex().timeToDataIndex(anchor.timestamp, 'exact')
    if (dataIndex !== undefined) {
      this._offsetRight = (dataIndex + anchor.distanceFromRight - this._chartStore.getDataList().length) * this._barWidth
    }
  }

  getXScale(): LinearScale {
    // Compatibility: this accessor, like VisibleRange, uses data-array offsets.
    return createScale(this._visibleRange, this._chartStore.mainWidth, this.getHorizontalInset())
  }

  getLogicalVisibleRange(): { from: number, to: number } {
    const index = this._chartStore.getTimeIndex()
    return {
      from: index.dataIndexToLogical(this._visibleRange.domainFrom),
      to: index.dataIndexToLogical(this._visibleRange.domainTo)
    }
  }

  private getHorizontalInset(): number {
    return calcTimeScaleHorizontalInset(this._chartStore.getStyles())
  }

  scroll(distance: number, requestLayout: boolean = false): void {
    if (!this._scrollEnabled) {
      return
    }
    const prevOffsetRight = this._offsetRight
    if (!this._mode.scroll(distance)) {
      return
    }
    this._refreshTimeScale(requestLayout)
    const realDistance = Math.round(prevOffsetRight - this._offsetRight)
    if (realDistance !== 0) {
      this._chartStore.getActionStore().execute(ActionType.OnScroll, { distance: realDistance })
    }
  }

  logicalToCoordinate(logicalIndex: number): number {
    return this._xScale(logicalIndex)
  }

  /** Continuous inverse; bar picking is performed by coordinateToDataIndex. */
  coordinateToLogical(x: number): number {
    return this._xScale.invert(x)
  }

  dataIndexToCoordinate(dataIndex: number): number {
    return this.logicalToCoordinate(this._chartStore.getTimeIndex().dataIndexToLogical(dataIndex))
  }

  coordinateToDataIndex(x: number): number {
    const dataIndex = this._chartStore.getTimeIndex().logicalToDataIndex(this.coordinateToLogical(x))
    return Math.floor(dataIndex + 0.5)
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

  clear(): void {
    this._visibleRange = getDefaultVisibleRange()
    this._xScale = createScale(this._visibleRange, this._chartStore.mainWidth, this.getHorizontalInset())
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

function createScale({ domainFrom, domainTo }: VisibleRange, mainWidth: number, horizontalInset: number = 0, firstLogicalIndex: number = 0): LinearScale {
  const inset = Math.max(0, Math.min(horizontalInset, mainWidth / 2))
  return createLinear({
    domain: [firstLogicalIndex + domainFrom - 0.5, firstLogicalIndex + domainTo - 0.5],
    range: [inset, mainWidth - inset]
  })
}
