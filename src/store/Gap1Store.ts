import type KLineData from '../common/KLineData'
import type VisibleRange from '../common/VisibleRange'
import { clone } from '../common/utils/typeChecks'
import {
  calculateGap1,
  defaultGap1Options,
  normalizeGap1Options,
  type Gap1Record,
  type RequiredGap1Options
} from '../component/Gap1'
import type { Gap1Options } from '../Options'
import type ChartStore from './ChartStore'

export default class Gap1Store {
  private readonly _chartStore: ChartStore
  private _enabled = false
  private _options: RequiredGap1Options = clone(defaultGap1Options)
  private _gaps: Gap1Record[] = []

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  isEnabled(): boolean {
    return this._enabled
  }

  getOptions(): Readonly<RequiredGap1Options> {
    return this._options
  }

  getGaps(): readonly Gap1Record[] {
    return this._gaps
  }

  setOptions(value: boolean | Gap1Options): void {
    if (value === false) {
      this._enabled = false
      this._gaps = []
      return
    }

    const wasEnabled = this._enabled
    const previousMaxGapCount = this._options.maxGapCount
    const nextOptions = normalizeGap1Options(this._options, value)

    this._enabled = true
    this._options = nextOptions

    if (!wasEnabled || previousMaxGapCount !== nextOptions.maxGapCount) {
      this.recalculate(
        this._chartStore.getDataList(),
        this._chartStore.getTimeScaleStore().getVisibleRange()
      )
    }
  }

  recalculate(dataList: KLineData[], visibleRange: VisibleRange): void {
    if (!this._enabled) {
      this._gaps = []
      return
    }
    this._gaps = calculateGap1(dataList, visibleRange, this._options.maxGapCount)
  }

  clear(): void {
    this._gaps = []
  }
}
