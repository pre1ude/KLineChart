import { lowerBound } from '../common/utils/number'

export type TimeLookupMode = 'exact' | 'floor' | 'ceil' | 'nearest'

/** Real bars only. Calendar projection and display labels are separate concerns. */
export default class TimeIndex {
  private _firstLogicalIndex = 0
  private readonly _getData: () => readonly { timestamp: number }[]

  constructor(getData: () => readonly { timestamp: number }[]) {
    this._getData = getData
  }

  getFirstLogicalIndex(): number { return this._firstLogicalIndex }

  prepend(count: number): void {
    this._firstLogicalIndex -= count
  }

  reset(): void {
    this._firstLogicalIndex = 0
  }

  dataIndexToLogical(dataIndex: number): number {
    return this._firstLogicalIndex + dataIndex
  }

  logicalToDataIndex(logicalIndex: number): number {
    return logicalIndex - this._firstLogicalIndex
  }

  dataIndexToTime(dataIndex: number): number | undefined {
    return this._getData()[dataIndex]?.timestamp
  }

  logicalToTime(logicalIndex: number): number | undefined {
    return this.dataIndexToTime(this.logicalToDataIndex(logicalIndex))
  }

  timeToLogical(timestamp: number, mode: TimeLookupMode = 'exact'): number | undefined {
    const dataIndex = this.timeToDataIndex(timestamp, mode)
    return dataIndex === undefined ? undefined : this.dataIndexToLogical(dataIndex)
  }

  /** All modes are bounded by loaded data. Nearest ties choose the earlier bar. */
  timeToDataIndex(timestamp: number, mode: TimeLookupMode = 'exact'): number | undefined {
    const data = this._getData()
    if (!Number.isFinite(timestamp) || data.length === 0 || timestamp < data[0].timestamp || timestamp > data[data.length - 1].timestamp) {
      return undefined
    }
    const index = lowerBound(data, point => point.timestamp - timestamp)
    if (data[index].timestamp === timestamp) {
      return index
    }
    switch (mode) {
      case 'exact': return undefined
      case 'floor': return index - 1
      case 'ceil': return index
      case 'nearest': return timestamp - data[index - 1].timestamp <= data[index].timestamp - timestamp ? index - 1 : index
    }
  }
}
