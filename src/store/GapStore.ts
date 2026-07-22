import type KLineData from '../common/KLineData'
import { clone } from '../common/utils/typeChecks'
import { logInfo } from '../common/utils/logger'
import {
  calculateGaps,
  defaultGapOptions,
  getGapCalculationSignature,
  normalizeGapOptions,
  type GapDataChangeContext,
  type GapEvent,
  type GapRecord,
  type RequiredGapOptions
} from '../component/Gap'
import type { GapOptions } from '../Options'
import type ChartStore from './ChartStore'

export default class GapStore {
  private readonly _chartStore: ChartStore
  private _enabled = false
  private _options: RequiredGapOptions = clone(defaultGapOptions)
  private _gaps: GapRecord[] = []
  private _latestLogTimestamp?: number
  private _emittedLatestEventKeys = new Set<string>()

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  isEnabled(): boolean {
    return this._enabled
  }

  getOptions(): Readonly<RequiredGapOptions> {
    return this._options
  }

  getGaps(): readonly GapRecord[] {
    return this._gaps
  }

  setOptions(value: GapOptions): void {
    const previousSignature = getGapCalculationSignature(this._options)
    const nextOptions = normalizeGapOptions(this._options, value)
    const nextSignature = getGapCalculationSignature(nextOptions)

    this._options = nextOptions

    if (this._enabled && previousSignature !== nextSignature) {
      this.recalculate(this._chartStore.getDataList(), { kind: 'options', fromIndex: 0 })
    }
  }

  setShow(show: boolean): void {
    if (!show) {
      this._enabled = false
      this._gaps = []
      this._resetLogState()
      return
    }

    if (this._enabled) return
    this._enabled = true
    this.recalculate(this._chartStore.getDataList(), { kind: 'options', fromIndex: 0 })
  }

  recalculate(dataList: KLineData[], context: GapDataChangeContext): void {
    if (!this._enabled) {
      this._gaps = []
      return
    }

    const { gaps, events } = calculateGaps(dataList, this._options)
    this._gaps = gaps
    this._processEvents(events, dataList, context)
  }

  clear(): void {
    this._gaps = []
    this._resetLogState()
  }

  private _processEvents(events: GapEvent[], dataList: KLineData[], context: GapDataChangeContext): void {
    const latestTimestamp = dataList[dataList.length - 1]?.timestamp
    const canLog = context.kind === 'append' || context.kind === 'update-latest'

    if (!canLog) {
      this._setLatestBaseline(events, latestTimestamp)
      return
    }

    if (context.kind === 'update-latest' && this._latestLogTimestamp !== latestTimestamp) {
      this._emittedLatestEventKeys.clear()
    }

    const eligibleEvents = events.filter(event => event.index >= context.fromIndex)
    eligibleEvents.forEach(event => {
      const isLatestEvent = event.timestamp === latestTimestamp
      if (isLatestEvent && this._emittedLatestEventKeys.has(event.key)) {
        return
      }
      this._logEvent(event)
      if (isLatestEvent) {
        this._emittedLatestEventKeys.add(event.key)
      }
    })

    this._latestLogTimestamp = latestTimestamp
    if (context.kind === 'append') {
      this._emittedLatestEventKeys = new Set(
        eligibleEvents.filter(event => event.timestamp === latestTimestamp).map(event => event.key)
      )
    }
  }

  private _setLatestBaseline(events: GapEvent[], latestTimestamp?: number): void {
    this._latestLogTimestamp = latestTimestamp
    this._emittedLatestEventKeys = new Set(
      events.filter(event => event.timestamp === latestTimestamp).map(event => event.key)
    )
  }

  private _resetLogState(): void {
    this._latestLogTimestamp = undefined
    this._emittedLatestEventKeys.clear()
  }

  private _logEvent(event: GapEvent): void {
    if (event.type === 'opened') {
      logInfo('Gaps', 'New Gap Appeared', {
        id: event.gapId,
        direction: event.direction,
        openTimestamp: event.openTimestamp,
        lowerPrice: event.bottom,
        upperPrice: event.top,
        size: event.size
      })
      return
    }

    logInfo('Gaps', 'Gap Closed', {
      id: event.gapId,
      direction: event.direction,
      openTimestamp: event.openTimestamp,
      closeTimestamp: event.timestamp,
      closeReason: event.closeReason
    })
  }
}
