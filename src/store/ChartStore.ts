import type KLineData from '../common/KLineData'
import type Precision from '../common/Precision'
import type VisibleData from '../common/VisibleData'
import type DeepPartial from '../common/DeepPartial'
import { getDefaultStyles, type Styles, type TooltipLegend } from '../common/Styles'
import { isArray, isNumber, isString, isValid, merge } from '../common/utils/typeChecks'
import type LoadDataCallback from '../common/LoadDataCallback'
import { type LoadDataParams, LoadDataType } from '../common/LoadDataCallback'
import type LoadMoreCallback from '../common/LoadMoreCallback'
import { ActionType } from '../common/Action'
import { getDefaultCustomApi, type CustomApi, defaultLocale, type Options } from '../Options'
import TimeScaleStore from './TimeScaleStore'
import IndicatorStore from './IndicatorStore'
import TooltipStore from './TooltipStore'
import OverlayStore from './OverlayStore'
import ActionStore from './ActionStore'
import { getStyles } from '../extension/styles/index'
import type Chart from '../Chart'
import { setTimezone } from '../common/utils/dateTimeFormat'
import { binarySearchNearest } from '../common/utils/number'
import TaskScheduler from '@/common/TaskScheduler'

export default class ChartStore {
  /**
   * Internal chart
   */
  private readonly _chart: Chart

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

  private _timeShareBreakOnCrossDays = true

  private _preferXTicks: string[] | undefined

  /**
   * Price and volume precision
   */
  private _precision = { price: 2, volume: 0 }

  /**
   * Thousands separator
   */
  private _thousandsSeparator = ','

  // Decimal fold threshold
  private _decimalFoldThreshold = 3

  /**
   * Data source
   */
  private _dataList: KLineData[] = []

  /**
   * Load more data callback
   * Since v9.8.0 deprecated, since v10 removed
   * @deprecated
   */
  private _loadMoreCallback?: LoadMoreCallback

  /**
   * Load data callback
   */
  private _loadDataCallback?: LoadDataCallback

  /**
   * Is loading data flag
   */
  private _loading = true

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
   * Overlay store
   */
  private readonly _overlayStore = new OverlayStore(this)

  /**
   * Tooltip store
   */
  private readonly _tooltipStore = new TooltipStore(this)

  /**
   * Chart action store
   */
  private readonly _actionStore = new ActionStore()

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

  constructor(chart: Chart, options?: Options) {
    this._chart = chart
    this.setOptions(options)

    this._taskScheduler = new TaskScheduler(() => {
      this._chart.adjustPaneViewport(false, true, true, true)
      // 执行待处理的回调
      this._executeDataReadyCallbacks()
    }, (error) => { console.error(error) })
  }

  private _executeDataReadyCallbacks(): void {
    const callbacks = this._dataReadyCallbacks.slice()
    this._dataReadyCallbacks = []
    callbacks.forEach(cb => {
      try {
        cb()
      } catch (error) {
        console.error('Data ready callback error:', error)
      }
    })
  }

  setOptions(options?: Options): this {
    if (isValid(options)) {
      const { locale, timezone, styles, customApi, thousandsSeparator, decimalFoldThreshold } = options
      if (isString(locale)) {
        this._locale = locale
      }
      if (isString(timezone)) {
        setTimezone(timezone)
      }
      if (isValid(styles)) {
        let ss: DeepPartial<Styles> | undefined
        if (isString(styles)) {
          ss = getStyles(styles)
        } else {
          ss = styles
        }
        merge(this._styles, ss)
        // `candle.tooltip.custom` should override
        if (isArray(ss?.candle?.tooltip?.custom)) {
          this._styles.candle.tooltip.custom = ss?.candle?.tooltip?.custom as unknown as TooltipLegend[]
        }
      }
      if (isValid(customApi)) {
        merge(this._customApi, customApi)
      }
      if (isString(thousandsSeparator)) {
        this._thousandsSeparator = thousandsSeparator
      }
      if (isNumber(decimalFoldThreshold) && decimalFoldThreshold > 0) {
        this._decimalFoldThreshold = decimalFoldThreshold
      }
      if (isValid(options.isTimeShare)) {
        this._isTimeShare = options.isTimeShare
        if (this._isTimeShare) {
          if (!isValid(options.timeShareTicks) || !isArray(options.timeShareTicks) || options.timeShareTicks.length === 0) {
            console.warn('KLineChart: `timeShareTicks` is required when `isTimeShare` is true.')
          } else {
            this._timeShareTicks = options.timeShareTicks
          }

          this._preferXTicks = options.preferXTicks
        }
        this._timeScaleStore.initBarSpaceLimit(this._isTimeShare)
      }
      if (isValid(options.timeShareDays)) {
        this._timeShareDays = options.timeShareDays
      }
      if (isValid(options.timeShareBreakOnCrossDays)) {
        this._timeShareBreakOnCrossDays = options.timeShareBreakOnCrossDays
      }
    }
    return this
  }

  getStyles(): Styles {
    return this._styles
  }

  getLocale(): string {
    return this._locale
  }

  getIsTimeShare(): boolean {
    return this._isTimeShare
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

  getTaskScheduler(): TaskScheduler {
    return this._taskScheduler
  }

  getDataByDataIndex(index: number): KLineData | undefined {
    return this._dataList[index]
  }

  dataIndexToTimestamp(index: number): number | undefined {
    const data = this.getDataByDataIndex(index)
    return data?.timestamp
  }

  // todo
  timestampToDataIndex(timestamp: number): number {
    if (this._dataList.length === 0) {
      return 0
    }
    return binarySearchNearest(this._dataList, 'timestamp', timestamp)
  }

  /**
   * Get K-line data by timestamp
   * @param timestamp - Target timestamp
   * @param options - Query options
   * @returns K-line data or undefined if not found
   */
  getDataByTimestamp(timestamp: number, options?: { exact?: boolean }): KLineData | undefined {
    if (this._dataList.length === 0) {
      return undefined
    }

    const exact = options?.exact ?? false
    const index = binarySearchNearest(this._dataList, 'timestamp', timestamp)

    if (index < 0 || index >= this._dataList.length) {
      return undefined
    }

    const data = this._dataList[index]

    // If exact match is required, verify timestamp matches
    if (exact && data.timestamp !== timestamp) {
      return undefined
    }

    return data
  }

  getVisibleFirstData(): KLineData | undefined {
    return this._dataList[0]
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
  }

  addData(data: KLineData | KLineData[], type?: LoadDataType, more?: boolean, callback?: () => void): void {
    let success = false
    let adjustFlag = false
    let dataLengthChange = 0
    if (isArray<KLineData>(data)) {
      // TODO if data.length is zero, we should ajust the visible range
      dataLengthChange = data.length
      switch (type) {
        case LoadDataType.Init: {
          this.clear()
          this._dataList = data
          this._forwardMore = more ?? true
          this._timeScaleStore.resetOffsetRightDistance()
          adjustFlag = true
          break
        }
        case LoadDataType.Backward: {
          this._dataList = data.concat(this._dataList)
          this._backwardMore = more ?? false
          adjustFlag = dataLengthChange > 0
          break
        }
        case LoadDataType.Forward: {
          this._dataList = this._dataList.concat(data)
          this._forwardMore = more ?? false
          adjustFlag = dataLengthChange > 0
        }
      }
      this._loading = false
      success = true
    } else {
      const dataCount = this._dataList.length
      // Determine where individual data should be added
      const timestamp = data.timestamp
      const lastDataTimestamp = this._dataList[dataCount - 1]?.timestamp ?? 0
      if (timestamp > lastDataTimestamp) {
        this._dataList.push(data)
        const nextOffsetRight = this._timeScaleStore.getOffsetRightDistance() - this._timeScaleStore.getBarSpace().bar
        this._timeScaleStore.setOffsetRightDistance(nextOffsetRight)
        dataLengthChange = 1
        success = true
        adjustFlag = true
      } else if (timestamp === lastDataTimestamp) {
        this._dataList[dataCount - 1] = data
        success = true
        adjustFlag = true
      }
    }
    if (success) {
      try {
        this._overlayStore.updatePointPosition(dataLengthChange, type)
        if (adjustFlag) {
          this._timeScaleStore.adjustVisibleRange()
          this._tooltipStore.recalculateCrosshair(true)
          const filterIndicators = this._indicatorStore.getIndicatorsByFilter({})

          if (filterIndicators.length > 0) {
            // 有指标需要计算：先计算指标，TaskScheduler 完成后会自动调用 adjustPaneViewport
            // 这样确保 calcRange() 使用的是最新的 indicator.result
            this._indicatorStore.calcInstance(filterIndicators)
            // 将回调加入队列，等待指标计算完成
            if (callback) {
              this._dataReadyCallbacks.push(callback)
            }
          } else {
            // 没有指标：直接调整视口
            this._chart.adjustPaneViewport(false, true, true, true)
            // 立即执行回调
            callback?.()
          }
        }
        this._actionStore.execute(ActionType.OnDataReady, undefined)
      } catch {}
    }
  }

  setLoadMoreCallback(callback: LoadMoreCallback): void {
    this._loadMoreCallback = callback
  }

  executeLoadMoreCallback(timestamp?: number): void {
    if (this._forwardMore && !this._loading && isValid(this._loadMoreCallback)) {
      this._loading = true
      this._loadMoreCallback(timestamp)
    }
  }

  setLoadDataCallback(callback: LoadDataCallback): void {
    this._loadDataCallback = callback
  }

  executeLoadDataCallback(params: Omit<LoadDataParams, 'callback'>): void {
    if (
      !this._loading &&
      isValid(this._loadDataCallback) &&
      (
        (this._forwardMore && params.type === LoadDataType.Forward) ||
        (this._backwardMore && params.type === LoadDataType.Backward)
      )
    ) {
      const cb: ((data: KLineData[], more?: boolean) => void) = (data: KLineData[], more?: boolean) => {
        this.addData(data, params.type, more)
      }
      this._loading = true
      this._loadDataCallback({ ...params, callback: cb })
    }
  }

  clear(): void {
    this._forwardMore = true
    this._backwardMore = true
    this._loading = true
    this._dataList = []
    this._visibleDataList = []
    this._timeScaleStore.clear()
    this._tooltipStore.clear()
    this._taskScheduler.clear()
    this._dataReadyCallbacks = []
  }

  getTimeScaleStore(): TimeScaleStore {
    return this._timeScaleStore
  }

  getIndicatorStore(): IndicatorStore {
    return this._indicatorStore
  }

  getOverlayStore(): OverlayStore {
    return this._overlayStore
  }

  getTooltipStore(): TooltipStore {
    return this._tooltipStore
  }

  getActionStore(): ActionStore {
    return this._actionStore
  }

  getChart(): Chart {
    return this._chart
  }
}
