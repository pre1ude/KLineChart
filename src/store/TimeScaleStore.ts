

import type BarSpace from '../common/BarSpace'
import type VisibleRange from '../common/VisibleRange'
import { createDefaultTimeShareVisibleRange, getDefaultVisibleRange } from '../common/VisibleRange'
import { ActionType } from '../common/Action'
import type ChartStore from './ChartStore'
import { LoadDataType } from '../common/LoadDataCallback'
import { clamp } from '../component/scale/utils'
import { createLinear, type LinearScale } from '../component/scale'
import { formatToHHmm } from '../common/utils/format'

const DEFAULT_BAR_WIDTH = 8
const DEFAULT_OFFSET_RIGHT = 10
const K_BAR_RATIO = 0.88

export default class TimeScaleStore {
  private readonly _chartStore: ChartStore
  private _zoomEnabled: boolean = true
  private _scrollEnabled: boolean = true
  private _barWidth: number = DEFAULT_BAR_WIDTH
  private _kWidth: number
  private _offsetRight = DEFAULT_OFFSET_RIGHT
  private _barSpaceLimit = { min: 1, max: 50 }

  private _maxOffsetLeftDistance: number
  private _maxOffsetRightDistance: number
  private _leftMinVisibleBarCount: number
  private _rightMinVisibleBarCount: number
  private _calcMode: 'DISTANCE_MODE' | 'BARCOUNT_MODE' = 'DISTANCE_MODE'
  /**
   * 滚动到最左时最小剩余宽度, 滚动到最右时最小剩余宽度
   */
  private readonly _minRemainWidth = { left: 0, right: 0 }

  private _visibleRange: VisibleRange = getDefaultVisibleRange()

  private _xScale: LinearScale

  constructor (chartStore: ChartStore) {
    this._chartStore = chartStore
    this._xScale = createScale(this._visibleRange, this._chartStore.mainWidth)
    this._kWidth = getKWidth(this._barWidth)
  }

  public initBarSpaceLimit (isTimeShare: boolean): void {
    if (isTimeShare) {
      this._barSpaceLimit = { min: 0.1, max: 50 }
    } else {
      this._barSpaceLimit = { min: 1, max: 50 }
    }
  }

  private calcMinRemainWidth (): void {
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

  private computeVisibleRange (): VisibleRange {
    const isTimeShare = this._chartStore.getIsTimeShare()
    const timeShareTicks = this._chartStore.getTimeShareTicks()
    const timeShareDays = this._chartStore.getTimeShareDays()
    const dataList = this._chartStore.getDataList()
    const totalBarCount = dataList.length
    if (!totalBarCount) {
      const visibleRange = isTimeShare ? createDefaultTimeShareVisibleRange(timeShareTicks.length * timeShareDays) : getDefaultVisibleRange()

      return visibleRange
    }
    const totalBarWidth = totalBarCount * this._barWidth
    const mainWidth = this._chartStore.mainWidth

    this.calcMinRemainWidth()
    const [lmin, rmin] = [this._minRemainWidth.left, this._minRemainWidth.right].map(v => Math.min(v, totalBarWidth))

    this._offsetRight = clamp(this._offsetRight, -totalBarWidth + rmin, mainWidth - lmin)

    const to = this._offsetRight > 0 ? totalBarCount : Math.ceil(totalBarCount + this._offsetRight / this._barWidth)

    const diff = this._offsetRight + totalBarCount * this._barWidth - mainWidth
    const from = diff < 0 ? 0 : Math.floor(diff / this._barWidth)

    //

    const domainTo = totalBarCount + this._offsetRight / this._barWidth

    // (domainTo - domainFrom) * barWidth = mainWidth
    const domainFrom = domainTo - mainWidth / this._barWidth

    const visibleRange = { from, to, domainFrom, domainTo }
    return visibleRange
  }

  adjustForTimeShare (): void {
    // console.log('adjustForTimeShare')
    const mainWidth = this._chartStore.mainWidth
    const dataList = this._chartStore.getDataList()
    const totalBarCount = dataList.length
    const timeShareTicks = this._chartStore.getTimeShareTicks()
    const timeShareDays = this._chartStore.getTimeShareDays()
    const tickCount = timeShareTicks.length * timeShareDays
    if (tickCount === 0) {
      console.error('Time share ticks is empty, cannot adjust for time share.')
      return
    }
    const barWidth = mainWidth / tickCount
    let offsetRight = this._offsetRight
    if (totalBarCount === 0) {
      offsetRight = mainWidth
    } else {
      const lastData = dataList[totalBarCount - 1]
      const hhmm = formatToHHmm(lastData.timestamp)
      const tickIndex = timeShareTicks.indexOf(hhmm)
      if (tickIndex === -1) {
        console.error('Last data timestamp not found in time share ticks:', hhmm, lastData)
        return
      } else {
        const dayIndex = Math.floor((totalBarCount - 1) / timeShareTicks.length)
        const idx = dayIndex * timeShareTicks.length + tickIndex
        offsetRight = (tickCount - idx - 1) * barWidth
      }
    }
    this._barWidth = clamp(barWidth, this._barSpaceLimit.min, this._barSpaceLimit.max)
    this._kWidth = getKWidth(this._barWidth)
    this._offsetRight = offsetRight
  }

  adjustVisibleRange (): void {
    const isTimeShare = this._chartStore.getIsTimeShare()
    if (isTimeShare) {
      this.adjustForTimeShare()
    }
    const visibleRange = this.computeVisibleRange()

    this._visibleRange = visibleRange
    this._xScale = createScale(visibleRange, this._chartStore.mainWidth)

    this._chartStore.getActionStore().execute(ActionType.OnVisibleRangeChange, visibleRange)
    this._chartStore.adjustVisibleDataList()
    const dataList = this._chartStore.getDataList()
    const totalBarCount = dataList.length
    const { from, to } = visibleRange
    if (from === 0) {
      const firstData = dataList[0]
      this._chartStore.executeLoadMoreCallback(firstData?.timestamp ?? null)
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

  getBarSpace (): BarSpace {
    return {
      bar: this._barWidth,
      halfBar: this._barWidth / 2,
      gapBar: this._kWidth,
      halfGapBar: Math.floor(this._kWidth / 2)
    }
  }

  setBarSpace (barWidth: number): void {
    if (this._barWidth === barWidth) {
      return
    }
    this._barWidth = clamp(barWidth, this._barSpaceLimit.min, this._barSpaceLimit.max)
    this._kWidth = getKWidth(this._barWidth)
    this.adjustVisibleRange()
    this._chartStore.getTooltipStore().recalculateCrosshair(true)
    this._chartStore.getChart().adjustPaneViewport(false, true, true, true)
  }

  setOffsetRightDistance (distance: number, update?: boolean): this {
    this._offsetRight = distance
    if (update ?? false) {
      this.adjustVisibleRange()
      this._chartStore.getTooltipStore().recalculateCrosshair(true)
      this._chartStore.getChart().adjustPaneViewport(false, true, true, true)
    }
    return this
  }

  resetOffsetRightDistance (): void {
    this.setOffsetRightDistance(DEFAULT_OFFSET_RIGHT)
  }

  getInitialOffsetRightDistance (): number {
    return DEFAULT_OFFSET_RIGHT
  }

  getOffsetRightDistance (): number {
    return this._offsetRight
  }

  setMaxOffsetLeftDistance (distance: number): void {
    this._maxOffsetLeftDistance = distance
    this._calcMode = 'DISTANCE_MODE'
  }

  setMaxOffsetRightDistance (distance: number): void {
    this._maxOffsetRightDistance = distance
    this._calcMode = 'DISTANCE_MODE'
  }

  setLeftMinVisibleBarCount (barCount: number): void {
    this._leftMinVisibleBarCount = barCount
    this._calcMode = 'BARCOUNT_MODE'
  }

  setRightMinVisibleBarCount (barCount: number): void {
    this._rightMinVisibleBarCount = barCount
    this._calcMode = 'BARCOUNT_MODE'
  }

  getVisibleRange (): VisibleRange {
    return this._visibleRange
  }

  getXScale (): LinearScale {
    return this._xScale
  }

  scroll (distance: number): void {
    if (!this._scrollEnabled) {
      return
    }
    const prevOffsetRight = this._offsetRight
    this._offsetRight -= distance
    this.adjustVisibleRange()
    this._chartStore.getTooltipStore().recalculateCrosshair(true)
    this._chartStore.getChart().adjustPaneViewport(false, true, true, true)
    const realDistance = Math.round(prevOffsetRight - this._offsetRight)
    if (realDistance !== 0) {
      this._chartStore.getActionStore().execute(ActionType.OnScroll, { distance: realDistance })
    }
  }

  // map from [domainFrom, domainTo] -> [0, mainWidth]
  dataIndexToCoordinate (dataIndex: number): number {
    return this._xScale(dataIndex)
  }

  coordinateToDataIndex (x: number): number {
    const dataCount = this._chartStore.getDataList().length
    // * math explain: (dataCount - index) * bar = (mainWidth - offsetRight - x)
    const index = dataCount - (this._chartStore.mainWidth - this._offsetRight - x) / this._barWidth
    return Math.floor(index)
  }

  zoom (scaleDelta: number, xCoord?: number): void {
    if (!this._zoomEnabled) {
      return
    }
    const getDefaultXCoord = (): number => {
      const crosshair = this._chartStore.getTooltipStore().getCrosshair()
      return crosshair?.x ?? this._chartStore.mainWidth / 2
    }
    const x = xCoord ?? getDefaultXCoord()

    const scaleRatio = 1 + scaleDelta

    const nextBarWidth = clamp(this._barWidth * scaleRatio, this._barSpaceLimit.min, this._barSpaceLimit.max)

    const realScaleRatio = nextBarWidth / this._barWidth

    // let right edge as the origin, left direction is positive
    // Math explain: (nextOffsetRight - offsetX) / (offsetRight - offsetX) = scaleRatio
    const mainWidth = this._chartStore.mainWidth
    const offsetX = mainWidth - x
    const nextOffsetRight = (this._offsetRight - offsetX) * realScaleRatio + offsetX
    this._offsetRight = nextOffsetRight
    this._barWidth = nextBarWidth

    this._kWidth = getKWidth(this._barWidth)
    this.adjustVisibleRange()
    this._chartStore.getTooltipStore().recalculateCrosshair(true)
    this._chartStore.getChart().adjustPaneViewport(false, true, true, true)

    if (realScaleRatio !== 1) {
      this._chartStore.getActionStore().execute(ActionType.OnZoom, { scale: realScaleRatio })
    }
  }

  get zoomEnabled (): boolean { return this._zoomEnabled }

  set zoomEnabled (enabled: boolean) { this._zoomEnabled = enabled }

  get scrollEnabled (): boolean { return this._scrollEnabled }

  set scrollEnabled (enabled: boolean) { this._scrollEnabled = enabled }

  clear (): void {
    this._visibleRange = getDefaultVisibleRange()
  }
}

function getKWidth (barWidth: number): number {
  let kWidth: number
  if (barWidth > 3) {
    kWidth = Math.floor(barWidth * K_BAR_RATIO)
  } else {
    kWidth = Math.floor(barWidth)
    if (kWidth === barWidth) {
      kWidth--
    }
  }
  if (kWidth % 2 === 0) {
    kWidth--
  }
  kWidth = Math.max(1, kWidth)
  return kWidth
}

function createScale ({ domainFrom, domainTo }: VisibleRange, mainWidth: number): LinearScale {
  return createLinear({
    domain: [domainFrom - 0.5, domainTo - 0.5],
    range: [0, mainWidth]
  })
}
