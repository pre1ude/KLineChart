import type KLineData from '../common/KLineData'
import type Precision from '../common/Precision'
import type VisibleData from '../common/VisibleData'
import type DeepPartial from '../common/DeepPartial'
import type { IPoint } from '../common/Point'
import type { Point } from '../common/Point'
import { getDefaultStyles, type Styles, type TooltipLegend } from '../common/Styles'
import { isArray, isNumber, isString, isValid, merge } from '../common/utils/typeChecks'
import type LoadDataCallback from '../common/LoadDataCallback'
import { type LoadDataParams, LoadDataType } from '../common/LoadDataCallback'
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
import { lowerBound, binarySearchNearest } from '../common/utils/number'
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
  private _decimalFoldThreshold = 3

  /**
   * Data source
   */
  private _dataList: KLineData[] = []

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
          if ((this._timeShareTicks.length === 0) && options.timeShareTicks == null) {
            console.warn('KLineChart: `timeShareTicks` is required when `isTimeShare` is true.')
          }
          if (options.timeShareTicks) {
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

  timestampToDataIndex(timestamp: number): number | undefined {
    if (this._dataList.length === 0) return undefined

    const lb = lowerBound(this._dataList, d => d.timestamp - timestamp)

    // 精确匹配
    if (lb < this._dataList.length && this._dataList[lb].timestamp === timestamp) {
      return lb
    }

    // 分时模式：只要能在时间轴上找到对应的时间槽就可以
    if (this._isTimeShare) {
      const date = new Date(timestamp)
      const tickStr = `${date.getHours()}:${date.getMinutes()}`
      const tickIndex = this._timeShareTicks.indexOf(tickStr)
      if (tickIndex === -1) return undefined

      const dayIndex = Math.floor(Math.min(lb, this._dataList.length - 1) / this._timeShareTicks.length)
      return dayIndex * this._timeShareTicks.length + tickIndex
    }

    // K线模式：超出数据范围返回 undefined
    if (lb === this._dataList.length || (lb === 0 && this._dataList[0].timestamp > timestamp)) {
      return undefined
    }

    return lb
  }

  /**
   * 将 timestamp 转换为最近的 dataIndex
   * 超出范围时返回边界索引，而不是 undefined
   */
  timestampToNearestDataIndex(timestamp: number): number | undefined {
    const index = binarySearchNearest(this._dataList, 'timestamp', timestamp)
    return index === -1 ? undefined : index
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
    return this._dataList[0]
  }

  getTimeShareBasisPrice(): number {
    return this._timeShareBasisPrice ?? this._dataList[0]?.prevClose ?? 0
  }

  setTimeShareBasisPrice(v: number): void {
    this._timeShareBasisPrice = v
  }

  /**
   * 获取分钟百分比模式的基准价格
   * 分时图模式使用 timeShareBasisPrice，否则使用 prevClose
   */
  getMinutePercentageBasis(): number {
    if (this.getIsTimeShare()) {
      return this.getTimeShareBasisPrice()
    }
    const firstData = this.getVisibleFirstData()
    return firstData?.prevClose ?? firstData?.close ?? 0
  }

  /**
   * 将外部点（timestamp + offset）转换为内部点（dataIndex + value）
   */
  externalToInternal(point: Partial<Point>): Partial<IPoint> {
    const result: Partial<IPoint> = {}
    if (isNumber(point.timestamp)) {
      let baseDataIndex = this.timestampToDataIndex(point.timestamp)
      // 分时模式：如果 timestampToDataIndex 返回 undefined，说明在数据范围外，走额外逻辑
      if (baseDataIndex === undefined && this._isTimeShare) {
        baseDataIndex = this._timestampToTimeShareDataIndex(point.timestamp)
      }
      if (baseDataIndex !== undefined) {
        result.dataIndex = baseDataIndex + (point.offset ?? 0)
      }
    }
    if (isNumber(point.value)) {
      result.value = point.value
    }
    return result
  }

  /**
   * 分时模式：将 timestamp 转换为 dataIndex
   * 与 timestampToDataIndex 不同，此方法允许返回超出数据范围的 dataIndex
   * 用于支持在未来时间位置绘制 overlay
   */
  private _timestampToTimeShareDataIndex(timestamp: number): number | undefined {
    const ticksPerDay = this._timeShareTicks.length
    if (ticksPerDay === 0 || this._dataList.length === 0) return undefined

    const date = new Date(timestamp)
    const tickStr = `${date.getHours()}:${date.getMinutes()}`
    const tickIndex = this._timeShareTicks.indexOf(tickStr)
    if (tickIndex === -1) return undefined

    const firstTs = this._dataList[0].timestamp
    const firstDate = new Date(firstTs)
    const firstTickStr = `${firstDate.getHours()}:${firstDate.getMinutes()}`
    const firstTickIndex = this._timeShareTicks.indexOf(firstTickStr)

    const msDiff = timestamp - firstTs
    const dayDiff = Math.floor(msDiff / (24 * 60 * 60 * 1000))
    const tickDiff = tickIndex - firstTickIndex

    return dayDiff * ticksPerDay + tickDiff
  }

  /**
   * 将内部点（dataIndex + value）转换为外部点（timestamp + offset）
   */
  internalToExternal(point: Partial<IPoint>): Partial<Point> {
    const result: Partial<Point> = {}
    if (isNumber(point.dataIndex)) {
      if (this._isTimeShare) {
        // 分时模式：X 轴是预定义的时间槽，offset 始终为 0
        result.timestamp = this._timeShareDataIndexToTimestamp(point.dataIndex)
        result.offset = 0
      } else {
        // K 线模式：基于 dataList 计算
        const dataList = this._dataList
        const dataLength = dataList.length

        if (dataLength === 0) {
          result.timestamp = 0
          result.offset = point.dataIndex
        } else if (point.dataIndex < 0) {
          // 超出左边界
          result.timestamp = dataList[0].timestamp
          result.offset = point.dataIndex
        } else if (point.dataIndex >= dataLength) {
          // 超出右边界
          result.timestamp = dataList[dataLength - 1].timestamp
          result.offset = point.dataIndex - (dataLength - 1)
        } else {
          // 在数据范围内
          result.timestamp = this.dataIndexToTimestamp(point.dataIndex) ?? 0
          result.offset = 0
        }
      }
    }
    if (isNumber(point.value)) {
      result.value = point.value
    }
    return result
  }

  /**
   * 分时模式：将 dataIndex 转换为 timestamp
   * dataIndex 对应 timeShareTicks 的索引位置
   */
  private _timeShareDataIndexToTimestamp(dataIndex: number): number {
    const ticksPerDay = this._timeShareTicks.length
    if (ticksPerDay === 0) return 0

    // 尝试从 dataList 获取对应数据的 timestamp
    const data = this._dataList[dataIndex]
    if (data) {
      return data.timestamp
    }

    // 如果没有数据，根据时间槽计算 timestamp
    // 找到最近的有数据的日期作为基准
    const dayIndex = Math.floor(dataIndex / ticksPerDay)
    const tickIndex = dataIndex % ticksPerDay
    const tick = this._timeShareTicks[tickIndex] // 如 "09:30"

    // 找基准日期：优先使用当天第一条数据，否则使用第一条数据
    const dayStartIndex = dayIndex * ticksPerDay
    const baseData = this._dataList[dayStartIndex] ?? this._dataList[0]
    if (!baseData) return 0

    // 解析基准日期
    const baseDate = new Date(baseData.timestamp)
    const [hours, minutes] = tick.split(':').map(Number)

    // 构造目标 timestamp
    const targetDate = new Date(baseDate)
    targetDate.setHours(hours, minutes, 0, 0)

    return targetDate.getTime()
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
    let adjustFlag = false
    if (isArray<KLineData>(data)) {
      switch (type) {
        case LoadDataType.Init: {
          this.clear()
          this._dataList = data
          this._forwardMore = more ?? true
          this._timeScaleStore.resetOffsetRightDistance()
          adjustFlag = true
          // 数据初始化后触发智能对齐
          setTimeout(() => {
            this._timeScaleStore.autoInitialAlignment()
          }, 0)
          break
        }
        case LoadDataType.Backward: {
          const offset = data.length
          if (offset > 0) {
            this._dataList = data.concat(this._dataList)
            // 现有 overlay 的 dataIndex 偏移
            this._overlayStore.updatePointPosition(offset)
            // 尝试恢复之前因为超出左边界而 skipDraw 的 overlay
            this._overlayStore.tryRecoverSkippedOverlays('left')
            adjustFlag = true
          }
          this._backwardMore = more ?? false
          break
        }
        case LoadDataType.Forward: {
          if (data.length > 0) {
            this._dataList = this._dataList.concat(data)
            // 尝试恢复之前因为超出右边界而 skipDraw 的 overlay
            this._overlayStore.tryRecoverSkippedOverlays('right')
            adjustFlag = true
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
        const nextOffsetRight = this._timeScaleStore.getOffsetRightDistance() - this._timeScaleStore.getBarSpace().bar
        this._timeScaleStore.setOffsetRightDistance(nextOffsetRight)
        adjustFlag = true
      } else if (timestamp === lastDataTimestamp) {
        // 更新最后一条
        this._dataList[dataCount - 1] = data
        adjustFlag = true
      } else {
        // 更新历史数据：二分查找匹配的 timestamp
        const index = this.timestampToDataIndex(timestamp)
        if (index !== undefined && this._dataList[index].timestamp === timestamp) {
          this._dataList[index] = data
          adjustFlag = true
        }
      }
    }
    if (adjustFlag) {
      try {
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
        this._actionStore.execute(ActionType.OnDataReady, undefined)
      } catch {}
    }
  }

  replaceData(dataList: KLineData[], more?: boolean, callback?: () => void): void {
    // 数据替换：需要全量重新转换
    this._overlayStore.syncPointsToRaw()
    this._dataList = dataList
    this._overlayStore.reconvertAllFromRaw()
    this._backwardMore = more ?? false

    this._timeScaleStore.adjustVisibleRange()
    this._tooltipStore.recalculateCrosshair(true)
    const filterIndicators = this._indicatorStore.getIndicatorsByFilter({})

    if (filterIndicators.length > 0) {
      this._indicatorStore.calcInstance(filterIndicators)
      if (callback) {
        this._dataReadyCallbacks.push(callback)
      }
    } else {
      this._chart.adjustPaneViewport(false, true, true, true)
      callback?.()
    }
    this._actionStore.execute(ActionType.OnDataReady, undefined)
  }

  setLoadDataCallback(callback: LoadDataCallback): void {
    this._loadDataCallback = callback
  }

  private canLoadForward(): boolean {
    return !this._loadingForward && this._forwardMore && isValid(this._loadDataCallback)
  }

  private canLoadBackward(): boolean {
    return !this._loadingBackward && this._backwardMore && isValid(this._loadDataCallback)
  }

  executeLoadDataCallback(params: Omit<LoadDataParams, 'callback' | 'addData'>): void {
    if (params.type === LoadDataType.Init) return

    const isForward = params.type === LoadDataType.Forward
    const canLoad = isForward ? this.canLoadForward() : this.canLoadBackward()

    if (!canLoad) return

    if (isForward) {
      this._loadingForward = true
    } else {
      this._loadingBackward = true
    }

    const cb = (): void => {
      if (isForward) {
        this._loadingForward = false
      } else {
        this._loadingBackward = false
      }
    }

    const addData = (data: KLineData[], more?: boolean): void => {
      this.addData(data, params.type, more)
    }

    this._loadDataCallback?.({ ...params, callback: cb, addData })
  }

  clear(): void {
    this._forwardMore = true
    this._backwardMore = true
    this._loadingForward = false
    this._loadingBackward = false
    this._dataList = []
    this._visibleDataList = []
    this._timeScaleStore.clear()
    this._tooltipStore.clear()
    this._taskScheduler.clear()
    this._dataReadyCallbacks = []
  }

  /**
   * 销毁 ChartStore，清理所有引用防止内存泄漏
   */
  destroy(): void {
    this.clear()
    this._loadDataCallback = undefined
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
