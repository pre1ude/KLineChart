import type { ResolveOverlayPoint } from './types'
import { createTradingCalendarTimeMapping } from './createTradingCalendarTimeMapping'
import type { TradingRuleOverlayResolverOptions } from './types'

/** Ready-to-use overlay resolver; trading rules remain outside the chart core. */
export function createTradingRuleOverlayResolver(options: TradingRuleOverlayResolverOptions): ResolveOverlayPoint {
  const mapping = createTradingCalendarTimeMapping(options)
  const resolve: ResolveOverlayPoint = params => {
    const dataIndex = mapping.anchorToIndex(params)
    if (dataIndex === undefined || !Number.isSafeInteger(dataIndex) || params.dataList.length === 0) return undefined
    const reference = Math.max(0, Math.min(dataIndex, params.dataList.length - 1))
    return { timestamp: params.dataList[reference].timestamp, offset: dataIndex - reference }
  }
  return resolve
}
