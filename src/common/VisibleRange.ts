export default interface VisibleRange {
  readonly from: number
  readonly to: number
  /** 值域起点: 图最左侧对应的索引值 */
  readonly domainFrom: number
  /** 值域终点: 图最右侧对应的索引值 */
  readonly domainTo: number
}

export function getDefaultVisibleRange(): VisibleRange {
  return { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
}

export function createDefaultTimeShareVisibleRange(timeTickLength: number): VisibleRange {
  return { from: 0, to: 0, domainFrom: 0, domainTo: timeTickLength }
}
