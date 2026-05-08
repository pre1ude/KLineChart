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
import { DataZoomTimeScaleMode, KLineTimeScaleMode, type TimeScaleMode, type TimeScaleModeContext, TimeScaleModeKind, TimeShareTimeScaleMode } from './time-scale'

const DEFAULT_BAR_WIDTH = 8
const DEFAULT_OFFSET_RIGHT = 10

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

  private _xScale: LinearScale
  private _mode: TimeScaleMode
  private readonly _modeContext: TimeScaleModeContext
  private _dataZoomOptions: DataZoomOptions = {}

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
    this._xScale = createScale(this._visibleRange, this._chartStore.mainWidth)
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

  private _refreshTimeScale(): void {
    this.adjustVisibleRange()
    this._chartStore.getTooltipStore().recalculateCrosshair(true)
    this._chartStore.getChart().adjustPaneViewport(false, true, true, true)
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

  setDataZoomRange(start: number, end: number): boolean {
    if (!(this._mode instanceof DataZoomTimeScaleMode)) {
      return false
    }
    if (!this._mode.setRange(start, end)) {
      return false
    }
    this._refreshTimeScale()
    return true
  }

  private applyDataZoomOptions(): void {
    if (this._mode instanceof DataZoomTimeScaleMode) {
      this._mode.setRange(this._dataZoomOptions.start, this._dataZoomOptions.end)
    }
  }

  private calcMinRemainWidth(): void {
    if (this._calcMode === 'DISTANCE_MODE') {
      if (this._maxOffsetLeftDistance != null) {
        this._minRemainWidth.right = this._chartStore.mainWidth - this._maxOffsetLeftDistance
      }
      if (this._maxOffsetRightDistance != null) {
        this._minRemainWidth.left = this._chartStore.mainWidth - this._maxOffsetRightDistance
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
    this._mode.prepareVisibleRange()
    const visibleRange = this.calcVisibleRange()

    this._visibleRange = visibleRange
    this._xScale = createScale(visibleRange, this._chartStore.mainWidth)

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

  getVisibleRange(): VisibleRange {
    return this._visibleRange
  }

  getXScale(): LinearScale {
    return this._xScale
  }

  scroll(distance: number): void {
    if (!this._scrollEnabled) {
      return
    }
    const prevOffsetRight = this._offsetRight
    if (!this._mode.scroll(distance)) {
      return
    }
    this._refreshTimeScale()
    const realDistance = Math.round(prevOffsetRight - this._offsetRight)
    if (realDistance !== 0) {
      this._chartStore.getActionStore().execute(ActionType.OnScroll, { distance: realDistance })
    }
  }

  // map from [domainFrom, domainTo] -> [0, mainWidth]
  dataIndexToCoordinate(dataIndex: number): number {
    return this._xScale(dataIndex)
  }

  coordinateToDataIndex(x: number): number {
    const dataCount = this._chartStore.getDataList().length
    // * math explain: (dataCount - index) * bar = (mainWidth - offsetRight - x)
    const index = dataCount - (this._chartStore.mainWidth - this._offsetRight - x) / this._barWidth
    return Math.floor(index)
  }

  zoom(scaleDelta: number, xCoord?: number): void {
    if (!this._zoomEnabled) {
      return
    }
    const realScaleRatio = this._mode.zoom(scaleDelta, xCoord)
    if (realScaleRatio === undefined) {
      return
    }
    this._refreshTimeScale()

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
  autoInitialAlignment(): void {
    if (!this._autoInitialAlignment) {
      return
    }
    if (this._mode.autoInitialAlignment()) {
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

}

function createScale({ domainFrom, domainTo }: VisibleRange, mainWidth: number): LinearScale {
  return createLinear({
    domain: [domainFrom - 0.5, domainTo - 0.5],
    range: [0, mainWidth]
  })
}
