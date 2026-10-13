import type KLineData from '../common/KLineData'
import type Precision from '../common/Precision'
import type VisibleData from '../common/VisibleData'
import type { IPoint } from '../common/Point'
import { isValidPointOffset, type Point } from '../common/Point'
import { type DeepPartialStyles, getDefaultStyles, type Styles, type TooltipLegend } from '../common/Styles'
import { clone, isArray, isBoolean, isNumber, isObject, isString, isValid, merge } from '../common/utils/typeChecks'
import type LoadDataCallback from '../common/LoadDataCallback'
import { type LoadDataParams, LoadDataType } from '../common/LoadDataCallback'
import { ActionType } from '../common/Action'
import { getDefaultCustomApi, type CustomApi, defaultLocale, type DataZoomOptions, type DataZoomSliderOptions, type Options } from '../Options'
import { PANE_DEFAULT_HEIGHT, PANE_MIN_HEIGHT, type PaneResizeMode } from '../pane/types'
import TimeScaleStore from './TimeScaleStore'
import { TimeScaleModeKind } from './time-scale'
import {
  createTimeShareTimestampGetter,
  resolveMinutePercentageBasis,
  resolveTimeShareBasisPrice,
  timeShareDataIndexToTimestamp,
  timestampToTimeShareDataIndex
} from './time-share'
import IndicatorStore from './IndicatorStore'
import TooltipStore from './TooltipStore'
import OverlayStore from './OverlayStore'
import ActionStore from './ActionStore'
import GapStore from './GapStore'
import Gap1Store from './Gap1Store'
import { getStyles } from '../extension/styles/index'
import type Chart from '../Chart'
import { setTimezone } from '../common/utils/dateTimeFormat'
import { clamp } from '../common/utils/number'
import TaskScheduler from '@/common/TaskScheduler'
import type { GapDataChangeContext } from '../component/Gap'
import TimeIndex from '../component/TimeIndex'

export enum StyleInvalidation {
  None,
  Overlay,
  Metric
}

function getChangedStyleInvalidation(
  previous: unknown,
  current: unknown,
  path: string[] = []
): StyleInvalidation {
  if (Object.is(previous, current)) {
    return StyleInvalidation.None
  }

  const previousIsObject = isObject(previous)
  const currentIsObject = isObject(current)
  const previousIsArray = isArray(previous)
  const currentIsArray = isArray(current)
  if (
    !previousIsObject ||
    !currentIsObject ||
    previousIsArray !== currentIsArray ||
    (previousIsArray && currentIsArray && previous.length !== current.length)
  ) {
    return getStylePathInvalidation(path)
  }

  const previousRecord = previous as Record<string, unknown>
  const currentRecord = current as Record<string, unknown>
  const keys = new Set([...Object.keys(previousRecord), ...Object.keys(currentRecord)])
  let invalidation = StyleInvalidation.None
  for (const key of keys) {
    const childInvalidation = getChangedStyleInvalidation(
      previousRecord[key],
      currentRecord[key],
      [...path, key]
    )
    if (childInvalidation === StyleInvalidation.Metric) {
      return childInvalidation
    }
    if (childInvalidation > invalidation) {
      invalidation = childInvalidation
    }
  }
  return invalidation
}

function getStylePathInvalidation(path: string[]): StyleInvalidation {
  const tooltipOnly =
    (path[0] === 'candle' || path[0] === 'indicator') &&
    path[1] === 'tooltip'
  return tooltipOnly ? StyleInvalidation.Overlay : StyleInvalidation.Metric
}

export default class ChartStore {
  /**
   * Internal chart
   */
  private readonly _chart: Chart
  private readonly _overlayStore: OverlayStore

  // Add mainWidth property
  public mainWidth: number = 0

  /**
   * Style config
   */
  private readonly _styles = getDefaultStyles()

  /**
   * Custom api
   */
  private readonly _customApi = getDefaultCustomApi()

  /**
   * language
   */
  private _locale = defaultLocale

  private _isTimeShare = false

  private _timeShareDays = 1

  private _timeShareTicks: string[] = []

  private _getTimeShareTimestamp = createTimeShareTimestampGetter(this._timeShareTicks)

  private _timeShareBreakOnCrossDays = true

  private _timeShareShowSessionGap = false

  private _timeShareSessionGapForN = Number.POSITIVE_INFINITY

  private _preferXTicks: string[] | undefined

  private _dataZoomEnabled = false

  private _dataZoomOptions: DataZoomOptions = {}

  private _styleTheme: 'dark' | 'light' = 'light'

  private _paneResizeMode: PaneResizeMode = 'main-flex'

  private _indicatorPaneDefaultHeight = PANE_DEFAULT_HEIGHT

  private _minIndicatorPaneHeight = PANE_MIN_HEIGHT

  private _timeShareBasisPrice: number | undefined

  /**
   * Price and volume precision
   */
  private _precision = { price: 2, volume: 0 }

  /**
   * Thousands separator
   */
  private _thousandsSeparator = ','

  // Decimal fold threshold
  private _decimalFoldThreshold = 4

  /**
   * Data source
   */
  private _dataList: KLineData[] = []

  private _dataVersion = 0
  private _timeIndexVersion = 0
  // Independent values detect submitted bars whose timestamp was edited in place.
  private _dataTimestamps: number[] = []
  private _destroyed = false

  isDestroyed(): boolean { return this._destroyed }

  private readonly _timeIndex = new TimeIndex(() => this._dataList)

  private _datasetEpoch = 0
  private _loaderGeneration = 0
  private _effectDepth = 0
  private _flushingEffects = false
  private readonly _postCommitCalculations: Array<() => void> = []
  private readonly _effects = new Map<unknown, () => void>()

  /**
   * Load data callback
   */
  private _loadDataCallback?: LoadDataCallback

  /**
   * Loading state for each direction
   */
  private _loadingForward = false
  private _loadingBackward = false

  /**
   * Whether there are forward more flag
   */
  private _forwardMore = true

  /**
   * Whether there are forward more flag
   */
  private _backwardMore = true

  /**
   * Time scale store
   */
  private readonly _timeScaleStore = new TimeScaleStore(this)

  /**
   * Indicator store
   */
  private readonly _indicatorStore = new IndicatorStore(this)

  /**
   * Tooltip store
   */
  private readonly _tooltipStore: TooltipStore

  /**
   * Chart action store
   */
  private readonly _actionStore = new ActionStore((effect, key) => this.dispatchDataEffect(effect, key), () => this._dataVersion)

  /**
   * Candlestick gap store
   */
  private readonly _gapStore = new GapStore(this)

  /**
   * Visible-range candlestick gap store
   */
  private readonly _gap1Store = new Gap1Store(this)

  /**
   * Visible data array
   */
  private _visibleDataList: VisibleData[] = []

  /**
   * Task scheduler
   */
  private readonly _taskScheduler: TaskScheduler

  /**
   * Data ready callbacks
   */
  private _dataReadyCallbacks: Array<() => void> = []
  private _dataUpdatePending = false

  private _afterNextDataLayout?: () => void

  constructor(chart: Chart, options?: Options) {
    this._chart = chart
    this._tooltipStore = new TooltipStore(this, options?.tooltip)
    this.setOptions(options)

    this._taskScheduler = new TaskScheduler(() => {
      this.dispatchEffect(() => this._finishDataUpdate(), 'data-completion')
    }, ({ key, error }) => { console.error(`Task ${key} error:`, error) })
    this._overlayStore = new OverlayStore(this)
  }

  private _completeDataUpdate(callback?: () => void): void {
    this._dataUpdatePending = true
    if (callback) this._dataReadyCallbacks.push(callback)
    this._indicatorStore.calcInstance(this._indicatorStore.getIndicatorsByFilter({}))
    this.dispatchEffect(() => this._finishDataUpdate(), 'data-completion')
    this._actionStore.execute(ActionType.OnDataReady, undefined)
  }

  private _finishDataUpdate(): void {
    if (this._taskScheduler.hasPending() || this._destroyed) return
    const epoch = this._datasetEpoch
    const version = this._dataVersion
    if (this._dataUpdatePending) {
      this._dataUpdatePending = false
      this._refreshViewportLayoutAfterDataChange()
    }
    if (epoch === this._datasetEpoch && version === this._dataVersion) this._executeDataReadyCallbacks()
  }

  private _executeDataReadyCallbacks(): void {
    const epoch = this._datasetEpoch
    while (this._dataReadyCallbacks.length > 0 && epoch === this._datasetEpoch && !this._dataUpdatePending && !this._taskScheduler.hasPending()) {
      const callback = this._dataReadyCallbacks.shift()
      try {
        callback?.()
      } catch (error) {
        console.error('Data ready callback error:', error)
      }
    }
  }

  private _refreshViewportLayoutAfterDataChange(): void {
    const afterNextDataLayout = this._afterNextDataLayout
    this._afterNextDataLayout = undefined
    const epoch = this._datasetEpoch
    this._chart.refreshViewportLayout(afterNextDataLayout ? () => {
      if (epoch === this._datasetEpoch) afterNextDataLayout()
    } : undefined)
  }

  setOptions(options?: Options): this {
    this.updateOptions(options)
    return this
  }

  updateOptions(options?: Options): StyleInvalidation {
    let styleInvalidation = StyleInvalidation.None
    if (isValid(options)) {
      const {
        locale,
        timezone,
        styles,
        customApi,
        thousandsSeparator,
        decimalFoldThreshold,
        paneResizeMode,
        indicatorPaneDefaultHeight,
        minIndicatorPaneHeight
      } = options
      if (paneResizeMode === 'adjacent' || paneResizeMode === 'main-flex') {
        this._paneResizeMode = paneResizeMode
      }
      if (isNumber(indicatorPaneDefaultHeight) && indicatorPaneDefaultHeight > 0) {
        this._indicatorPaneDefaultHeight = indicatorPaneDefaultHeight
      }
      if (isNumber(minIndicatorPaneHeight) && minIndicatorPaneHeight > 0) {
        this._minIndicatorPaneHeight = minIndicatorPaneHeight
      }
      if (isString(locale)) {
        this._locale = locale
      }
      if (isString(timezone)) {
        setTimezone(timezone)
      }
      if (isValid(styles)) {
        const previousStyles = clone(this._styles)
        const previousStyleTheme = this._styleTheme
        let ss: DeepPartialStyles | undefined
        if (isString(styles)) {
          this._styleTheme = resolveStyleTheme(styles)
          ss = getStyles(styles)
        } else {
          ss = styles
        }
        merge(this._styles, ss)
        // `candle.tooltip.custom` should override
        if (isArray(ss?.candle?.tooltip?.custom)) {
          this._styles.candle.tooltip.custom = ss?.candle?.tooltip?.custom as unknown as TooltipLegend[]
        }
        styleInvalidation = previousStyleTheme === this._styleTheme
          ? getChangedStyleInvalidation(previousStyles, this._styles)
          : StyleInvalidation.Metric
      }
      if (isValid(customApi)) {
        merge(this._customApi, customApi)
      }
      if (isValid(options.tooltip)) {
        this._tooltipStore.setOptions(options.tooltip)
      }
      if (isString(thousandsSeparator)) {
        this._thousandsSeparator = thousandsSeparator
      }
      if (isNumber(decimalFoldThreshold) && decimalFoldThreshold > 0) {
        this._decimalFoldThreshold = decimalFoldThreshold
      }
      if (isValid(options.isTimeShare)) {
        // Time-share settings change timestamp/index mapping even without new bars.
        this._timeIndexVersion++
        this._timeIndex.invalidate()
        this._isTimeShare = options.isTimeShare
        if (this._isTimeShare) {
          if ((this._timeShareTicks.length === 0) && options.timeShareTicks == null) {
            console.warn('KLineChart: `timeShareTicks` is required when `isTimeShare` is true.')
          }
          if (options.timeShareTicks) {
            this._timeShareTicks = options.timeShareTicks
            this._getTimeShareTimestamp = createTimeShareTimestampGetter(this._timeShareTicks)
          }

          this._preferXTicks = options.preferXTicks
        }
        this._timeScaleStore.setMode(this.getTimeScaleModeKind())
      }
      if (isValid(options.dataZoom)) {
        this._dataZoomEnabled = options.dataZoom !== false
        this._dataZoomOptions = getDataZoomOptions(options.dataZoom)
        this._timeScaleStore.setDataZoomOptions(this._dataZoomOptions)
        this._timeScaleStore.setMode(this.getTimeScaleModeKind())
      }
      if (options.gapShow === false) {
        this._gapStore.setShow(false)
      }
      if (options.gap1Show === false) {
        this._gap1Store.setShow(false)
      }
      if (isValid(options.gaps)) {
        this._gapStore.setOptions(options.gaps)
      }
      if (isValid(options.gap1)) {
        this._gap1Store.setOptions(options.gap1)
      }
      if (options.gapShow === true) {
        this._gapStore.setShow(true)
      }
      if (options.gap1Show === true) {
        this._gap1Store.setShow(true)
      }
      if (isValid(options.timeShareDays)) {
        this._timeShareDays = options.timeShareDays
      }
      if (isValid(options.timeShareBreakOnCrossDays)) {
        this._timeShareBreakOnCrossDays = options.timeShareBreakOnCrossDays
      }
      if (isValid(options.timeShareShowSessionGap)) {
        this._timeShareShowSessionGap = options.timeShareShowSessionGap
      }
      if (isNumber(options.timeShareSessionGapForN) && options.timeShareSessionGapForN > 0) {
        this._timeShareSessionGapForN = options.timeShareSessionGapForN
      }
    }
    return styleInvalidation
  }

  private getTimeScaleModeKind(): TimeScaleModeKind {
    if (this._isTimeShare) {
      return TimeScaleModeKind.TimeShare
    }
    return this._dataZoomEnabled ? TimeScaleModeKind.DataZoom : TimeScaleModeKind.KLine
  }

  getStyles(): Styles {
    return this._styles
  }

  getStyleTheme(): 'dark' | 'light' {
    return this._styleTheme
  }

  getPaneResizeMode(): PaneResizeMode {
    return this._paneResizeMode
  }

  getIndicatorPaneDefaultHeight(): number {
    return this._indicatorPaneDefaultHeight
  }

  getMinIndicatorPaneHeight(): number {
    return this._minIndicatorPaneHeight
  }

  getLocale(): string {
    return this._locale
  }

  getIsTimeShare(): boolean {
    return this._isTimeShare
  }

  getDataZoomEnabled(): boolean {
    return this._dataZoomEnabled
  }

  getDataZoomSliderOptions(): DataZoomSliderOptions {
    return getDataZoomSliderOptions(this._dataZoomOptions.slider)
  }

  getTimeShareDays(): number {
    return this._timeShareDays
  }

  setTimeShareDays(days: number): this {
    this._timeShareDays = days
    return this
  }

  getTimeShareTicks(): string[] {
    return this._timeShareTicks
  }

  getTimeShareBreakOnCrossDays(): boolean {
    return this._timeShareBreakOnCrossDays
  }

  getTimeShareShowSessionGap(): boolean {
    return this._timeShareShowSessionGap
  }

  getTimeShareSessionGapForN(): number {
    return this._timeShareSessionGapForN
  }

  getPreferXTicks(): string[] | undefined {
    return this._preferXTicks
  }

  getCustomApi(): CustomApi {
    return this._customApi
  }

  getThousandsSeparator(): string {
    return this._thousandsSeparator
  }

  getDecimalFoldThreshold(): number {
    return this._decimalFoldThreshold
  }

  getPrecision(): Precision {
    return this._precision
  }

  setPrecision(precision: Precision): this {
    this._precision = precision
    this._indicatorStore.synchronizeSeriesPrecision()
    return this
  }

  getDataList(): KLineData[] {
    return this._dataList
  }

  getDatasetEpoch(): number { return this._datasetEpoch }

  /** Internal side-effect barrier shared by data and drawing commits. */
  dispatchEffect(effect: () => void, key: unknown = Symbol()): void {
    const epoch = this._datasetEpoch
    const guarded = (): void => { if (epoch === this._datasetEpoch) effect() }
    this._effects.delete(key)
    this._effects.set(key, guarded)
    this._flushEffects()
  }

  /** Committed instance lifecycle notifications survive data resets. */
  dispatchLifecycleEffect(effect: () => void): void {
    this._effects.set(Symbol(), effect)
    this._flushEffects()
  }

  /** Notifications derived from data stop when a newer data revision commits. */
  dispatchDataEffect(effect: () => void, key?: unknown): void {
    const version = this._dataVersion
    this.dispatchEffect(() => { if (version === this._dataVersion) effect() }, key)
  }

  /** Register task ownership first; run user calculations only after structural commit. */
  deferCalculation(start: () => void): void {
    this._postCommitCalculations.push(start)
    this._flushEffects()
  }

  private _flushEffects(): void {
    if (this._effectDepth > 0 || this._flushingEffects) return
    this._flushingEffects = true
    try {
      while (this._postCommitCalculations.length > 0 || this._effects.size > 0) {
        if (this._postCommitCalculations.length > 0) {
          const calculations = this._postCommitCalculations.splice(0)
          calculations.forEach(start => start())
          continue
        }
        const next = this._effects.entries().next()
        if (!next.done) {
          const [key, effect] = next.value
          this._effects.delete(key)
          try { effect() } catch (error) { console.error('Chart notification error:', error) }
        }
      }
    } finally { this._flushingEffects = false }
  }

  batchEffects<T>(commit: () => T): T {
    this._effectDepth++
    try { return commit() } finally {
      this._effectDepth--
      this._flushEffects()
    }
  }

  applyDataSnapshot(data: KLineData[], more?: boolean, callback?: () => void): void {
    if (data.some((bar, i) => !Number.isFinite(bar.timestamp) || (i > 0 && bar.timestamp <= data[i - 1].timestamp))) {
      throw new RangeError('Dataset timestamps must be finite and strictly increasing.')
    }
    this.batchEffects(() => this._addData(data, LoadDataType.Init, more, callback))
  }

  getDataVersion(): number {
    return this._dataVersion
  }

  /** Timestamp/index mapping revision, independent of ordinary price updates. */
  getTimeIndexVersion(): number {
    return this._timeIndexVersion
  }

  getTimeIndex(): TimeIndex {
    return this._timeIndex
  }

  getTaskScheduler(): TaskScheduler {
    return this._taskScheduler
  }

  getDataByDataIndex(index: number): KLineData | undefined {
    return this._dataList[index]
  }

  dataIndexToTimestamp(index: number): number | undefined {
    if (this._isTimeShare) {
      return timeShareDataIndexToTimestamp(this._dataList, index, this._timeShareTicks, this._getTimeShareTimestamp)
    }

    return this._timeIndex.dataIndexToTime(index)
  }

  timestampToDataIndex(timestamp: number): number | undefined {
    if (this._dataList.length === 0) return undefined

    // 分时模式：需确保单日分时的复盘日志均可见
    if (this._isTimeShare) {
      return timestampToTimeShareDataIndex(this._dataList, timestamp, this._timeShareTicks, this._getTimeShareTimestamp)
    }

    return this._timeIndex.timeToDataIndex(timestamp, 'ceil')
  }

  /**
   * 将 timestamp 转换为最近的 dataIndex
   * 超出范围时返回边界索引，而不是 undefined
   */
  timestampToNearestDataIndex(timestamp: number): number | undefined {
    if (this._dataList.length === 0) return undefined
    const boundedTime = clamp(timestamp, this._dataList[0].timestamp, this._dataList[this._dataList.length - 1].timestamp)
    return this._timeIndex.timeToDataIndex(boundedTime, 'nearest')
  }

  /**
   * Get K-line data by timestamp
   * @param timestamp - Target timestamp
   * @param options - Query options
   * @returns K-line data or undefined if not found
   */
  getDataByTimestamp(timestamp: number, options?: { exact?: boolean }): KLineData | undefined {
    const index = this.timestampToDataIndex(timestamp)
    if (index === undefined) return undefined

    const data = this._dataList[index]
    const exact = options?.exact ?? false

    // If exact match is required, verify timestamp matches
    if (exact && data.timestamp !== timestamp) return

    return data
  }

  getVisibleFirstData(): KLineData | undefined {
    const { from } = this._timeScaleStore.getVisibleRange()
    return this.getDataByDataIndex(from)
  }

  getFirstLoadedData(): KLineData | undefined {
    return this._dataList[0]
  }

  getTimeShareBasisPrice(): number {
    const firstData = this.getFirstLoadedData()
    return resolveTimeShareBasisPrice(firstData, this._timeShareBasisPrice)
  }

  setTimeShareBasisPrice(v: number): void {
    this._timeShareBasisPrice = v
  }

  /**
   * 获取分时百分比模式的基准价格
   * 分时图模式使用 timeShareBasisPrice，否则使用 prevClose
   */
  getMinutePercentageBasis(): number {
    return resolveMinutePercentageBasis(this.getIsTimeShare(), this.getTimeShareBasisPrice(), this.getVisibleFirstData()?.close)
  }

  /** Resolve persisted time anchors into the current logical geometry. */
  externalToInternal(point: Partial<Point>): Partial<IPoint> {
    const result: Partial<IPoint> = {}
    if (isNumber(point.timestamp) && isValidPointOffset(point)) {
      const baseDataIndex = this.timestampToDataIndex(point.timestamp)
      if (baseDataIndex !== undefined) {
        result.logicalIndex = this._timeIndex.dataIndexToLogical(baseDataIndex) + (point.offset ?? 0)
      }
    }
    if (isNumber(point.value)) result.value = point.value
    return result
  }

  /** Convert logical geometry to a persisted anchor at the data-access boundary. */
  internalToExternal(point: Partial<IPoint>): Partial<Point> {
    const result: Partial<Point> = {}
    if (isNumber(point.logicalIndex) && Number.isInteger(point.logicalIndex)) {
      const dataIndex = this._timeIndex.logicalToDataIndex(point.logicalIndex)
      const anchorIndex = clamp(dataIndex, 0, Math.max(0, this._dataList.length - 1))
      result.timestamp = this._dataList[anchorIndex]?.timestamp ?? 0
      result.offset = dataIndex - anchorIndex
    }
    if (isNumber(point.value)) result.value = point.value
    return result
  }

  getVisibleDataList(): VisibleData[] {
    return this._visibleDataList
  }

  adjustVisibleDataList(): void {
    this._visibleDataList = []
    // if is timeshare, we should accord the time ticks

    const { from, to } = this._timeScaleStore.getVisibleRange()
    for (let i = from; i < to; i++) {
      this._visibleDataList.push({
        dataIndex: i,
        x: this._timeScaleStore.dataIndexToCoordinate(i),
        data: this._dataList[i]
      })
    }
    this._gap1Store.recalculate(this._dataList, this._timeScaleStore.getVisibleRange())
  }

  addData(data: KLineData | KLineData[], type?: LoadDataType, more?: boolean, callback?: () => void): void {
    this.batchEffects(() => this._addData(data, type, more, callback))
  }

  private _addData(data: KLineData | KLineData[], type?: LoadDataType, more?: boolean, callback?: () => void): void {
    let timestampChanged = false
    let gapContext: GapDataChangeContext | undefined
    if (isArray<KLineData>(data)) {
      switch (type) {
        case LoadDataType.Init: {
          this.clear()
          this._dataList = data
          this._dataTimestamps = data.map(bar => bar.timestamp)
          this._forwardMore = more ?? true
          this._timeScaleStore.resetOffsetRightDistance()
          this._timeScaleStore.resetDataZoomRange()
          this._afterNextDataLayout = () => {
            this._timeScaleStore.autoInitialAlignment()
            this._timeScaleStore.captureInitialView()
          }
          gapContext = { kind: 'init', fromIndex: 0 }
          break
        }
        case LoadDataType.Backward: {
          const offset = data.length
          if (offset > 0) {
            this._dataList = data.concat(this._dataList)
            this._dataTimestamps = data.map(bar => bar.timestamp).concat(this._dataTimestamps)
            this._timeIndex.prepend(offset)
            gapContext = { kind: 'prepend', fromIndex: 0 }
          }
          this._backwardMore = more ?? false
          break
        }
        case LoadDataType.Forward: {
          const fromIndex = this._dataList.length
          if (data.length > 0) {
            this._dataList = this._dataList.concat(data)
            this._dataTimestamps = this._dataTimestamps.concat(data.map(bar => bar.timestamp))
            this._timeScaleStore.onBatchDataAppended(data.length)
            gapContext = { kind: 'append', fromIndex }
          }
          this._forwardMore = more ?? false
          break
        }
      }
    } else {
      const dataCount = this._dataList.length
      const timestamp = data.timestamp
      const lastDataTimestamp = this._dataList[dataCount - 1]?.timestamp ?? 0
      if (timestamp > lastDataTimestamp) {
        // 追加新数据
        this._dataList.push(data)
        this._dataTimestamps.push(timestamp)
        gapContext = { kind: 'append', fromIndex: dataCount }
      } else if (timestamp === lastDataTimestamp) {
        // 更新最后一条
        timestampChanged = this._dataTimestamps[dataCount - 1] !== timestamp
        this._dataTimestamps[dataCount - 1] = timestamp
        this._dataList[dataCount - 1] = data
        gapContext = { kind: 'update-latest', fromIndex: Math.max(0, dataCount - 1) }
      } else {
        // 更新历史数据：二分查找匹配的 timestamp
        const index = this.timestampToDataIndex(timestamp)
        if (index !== undefined && this._dataList[index].timestamp === timestamp) {
          timestampChanged = this._dataTimestamps[index] !== timestamp
          this._dataTimestamps[index] = timestamp
          this._dataList[index] = data
          gapContext = { kind: 'update-history', fromIndex: index }
        }
      }
    }
    if (gapContext === undefined) return
    this._dataVersion++
    if (timestampChanged || this._isTimeShare) this._timeIndex.invalidate()
    if (timestampChanged || this._isTimeShare || (gapContext.kind !== 'update-latest' && gapContext.kind !== 'update-history')) this._timeIndexVersion++
    if (timestampChanged || gapContext.kind === 'prepend') this._indicatorStore.clearResults()
    this._gapStore.recalculate(this._dataList, gapContext)
    this._timeScaleStore.adjustVisibleRange()
    this._tooltipStore.recalculateCrosshair(true)
    this._completeDataUpdate(callback)
  }

  replaceData(dataList: KLineData[], more?: boolean, callback?: () => void): void {
    this.batchEffects(() => this._replaceData(dataList, more, callback))
  }

  private _replaceData(dataList: KLineData[], more?: boolean, callback?: () => void): void {
    const anchor = this._timeScaleStore.captureDataAnchor()
    const offsetRight = this._timeScaleStore.getOffsetRightDistance()
    const timestamps = dataList.map(bar => bar.timestamp)
    const sameTimeline = timestamps.length === this._dataTimestamps.length &&
      timestamps.every((timestamp, index) => timestamp === this._dataTimestamps[index])
    if (!sameTimeline) this._indicatorStore.clearResults()
    // A polling snapshot can prepend history and append new bars without replacing
    // the existing timeline. Preserve its logical origin just like prependData;
    // corrections inside the sequence or unrelated datasets still start a new origin.
    const prefixLength = sameTimeline ? 0 : timestamps.indexOf(this._dataTimestamps[0])
    const extendsTimeline = this._dataTimestamps.length > 0 && (sameTimeline || (prefixLength >= 0 &&
      this._dataTimestamps.every((timestamp, index) => timestamps[prefixLength + index] === timestamp)))
    if (extendsTimeline) {
      this._timeIndex.prepend(prefixLength)
      if (this._isTimeShare) this._timeIndex.invalidate()
    } else {
      this._timeIndex.reset()
    }
    this._dataTimestamps = timestamps
    this._dataList = dataList
    this._dataVersion++
    this._timeIndexVersion++
    this._backwardMore = more ?? false
    this._gapStore.recalculate(this._dataList, { kind: 'replace', fromIndex: 0 })

    this._timeScaleStore.restoreDataAnchor(anchor, offsetRight)
    this._timeScaleStore.adjustVisibleRange()
    this._tooltipStore.recalculateCrosshair(true)
    this._completeDataUpdate(callback)
  }

  setLoadDataCallback(callback: LoadDataCallback): void {
    if (callback !== this._loadDataCallback) {
      this._loaderGeneration++
      this._resetLoading()
    }
    this._loadDataCallback = callback
  }

  private _resetLoading(): void {
    this._loadingForward = false
    this._loadingBackward = false
  }

  private canLoadForward(): boolean {
    return !this._loadingForward && this._forwardMore && isValid(this._loadDataCallback)
  }

  private canLoadBackward(): boolean {
    return !this._loadingBackward && this._backwardMore && isValid(this._loadDataCallback)
  }

  executeLoadDataCallback(params: Omit<LoadDataParams, 'callback' | 'addData'>): void {
    if (params.type === LoadDataType.Init) return
    if (this._effectDepth > 0) {
      this.dispatchDataEffect(() => this.executeLoadDataCallback(params), `load:${params.type}`)
      return
    }

    const isForward = params.type === LoadDataType.Forward
    const canLoad = isForward ? this.canLoadForward() : this.canLoadBackward()

    if (!canLoad) return

    const epoch = this._datasetEpoch
    const generation = this._loaderGeneration
    const isCurrent = (): boolean => epoch === this._datasetEpoch && generation === this._loaderGeneration
    let completed = false

    if (isForward) {
      this._loadingForward = true
    } else {
      this._loadingBackward = true
    }

    const cb = (): void => {
      if (completed || !isCurrent()) return
      completed = true
      if (isForward) {
        this._loadingForward = false
      } else {
        this._loadingBackward = false
      }
    }

    let added = false
    const addData = (data: KLineData[], more?: boolean): void => {
      if (!isCurrent() || added) return
      added = true
      this.addData(data, params.type, more)
    }

    this._loadDataCallback?.({ ...params, callback: cb, addData })
  }

  clear(): void {
    this.batchEffects(() => this._clear())
  }

  private _clear(): void {
    const offsetRight = this._timeScaleStore.getOffsetRightDistance()
    this._datasetEpoch++
    this._indicatorStore.cancelPendingCalculations()
    // Data-dependent effects check their captured epoch; lifecycle effects must finish.
    this._afterNextDataLayout = undefined
    this._indicatorStore.clearResults()
    this._forwardMore = true
    this._backwardMore = true
    this._resetLoading()
    this._dataList = []
    this._dataTimestamps = []
    this._timeIndex.reset()
    this._dataVersion++
    this._timeIndexVersion++
    this._visibleDataList = []
    this._timeScaleStore.clear(offsetRight)
    this._tooltipStore.clear()
    this._gapStore.clear()
    this._gap1Store.clear()
    this._taskScheduler.clear()
    this._dataReadyCallbacks = []
    this._dataUpdatePending = false
  }

  /**
   * 销毁 ChartStore，清理所有引用防止内存泄漏
   */
  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    this._overlayStore.removeInstance()
    this.clear()
    this._loadDataCallback = undefined
  }

  getTimeScaleStore(): TimeScaleStore {
    return this._timeScaleStore
  }

  getOverlayStore(): OverlayStore { return this._overlayStore }

  getIndicatorStore(): IndicatorStore {
    return this._indicatorStore
  }

  getTooltipStore(): TooltipStore {
    return this._tooltipStore
  }

  getActionStore(): ActionStore {
    return this._actionStore
  }

  getGapStore(): GapStore {
    return this._gapStore
  }

  getGap1Store(): Gap1Store {
    return this._gap1Store
  }

  getChart(): Chart {
    return this._chart
  }
}

function getDataZoomOptions(dataZoom: boolean | DataZoomOptions): DataZoomOptions {
  return isBoolean(dataZoom) ? {} : dataZoom
}

function resolveStyleTheme(styles: string): 'dark' | 'light' {
  return styles === 'dark' || styles === 'black' ? 'dark' : 'light'
}

function getDataZoomSliderOptions(slider?: boolean | DataZoomSliderOptions): DataZoomSliderOptions {
  if (isBoolean(slider)) {
    return {
      show: slider,
      brushSelect: true,
      showDataShadow: true,
      theme: 'auto'
    }
  }
  if (slider == null) {
    return {
      show: false,
      brushSelect: true,
      showDataShadow: true,
      theme: 'auto'
    }
  }
  return {
    ...slider,
    show: slider.show ?? true,
    brushSelect: slider.brushSelect ?? true,
    showDataShadow: slider.showDataShadow ?? true,
    theme: slider.theme ?? 'auto'
  }
}
