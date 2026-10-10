import { utils, type KLineData } from '../../../../src/index'
import { TradingCalendar } from './TradingCalendar'
import type { OverlayAnchor, CalendarResolution, TradingRuleOverlayResolverOptions, TradingTimeMapping } from './types'

/** Business demo only: all timestamps represent actual bar starts. */
export function createTradingCalendarTimeMapping(options: TradingRuleOverlayResolverOptions): TradingTimeMapping {
  const calendar = new TradingCalendar(options.calendar)
  const periods = JSON.parse(JSON.stringify(options.periods)) as Record<string, CalendarResolution>
  for (const resolution of Object.values(periods)) {
    if (!['minute', 'day', 'week', 'month'].includes(resolution.unit) || (resolution.unit === 'minute' && (!Number.isSafeInteger(resolution.count) || resolution.count < 1 || resolution.count > 10080))) throw new RangeError('Invalid calendar resolution')
  }
  const getPeriod = (period?: string): CalendarResolution | undefined => period !== undefined && Object.prototype.hasOwnProperty.call(periods, period) ? periods[period] : undefined
  const referenceIndex = (data: readonly KLineData[], timestamp: number): number | undefined => {
    const index = utils.lowerBound(data, bar => bar.timestamp - timestamp)
    return data[index]?.timestamp === timestamp ? index : undefined
  }

  // Count loaded source bars first; use the calendar only beyond their boundaries.
  const resolveAnchorTime = (point: Readonly<OverlayAnchor>, source?: readonly KLineData[]): number | undefined => {
    const offset = point.offset ?? 0
    if (offset === 0) return point.timestamp
    const resolution = getPeriod(point.period)
    if (!resolution) return undefined
    if (source === undefined) return calendar.shift(point.timestamp, offset, resolution)
    const reference = referenceIndex(source, point.timestamp)
    if (reference === undefined) return undefined
    const index = reference + offset
    if (source[index]) return source[index].timestamp
    const boundary = index < 0 ? 0 : source.length - 1
    return calendar.shift(source[boundary].timestamp, index - boundary, resolution)
  }

  const projectTime = (timestamp: number, resolution: CalendarResolution, data: readonly KLineData[]): number | undefined => {
    const exact = referenceIndex(data, timestamp)
    if (exact !== undefined) return exact
    const target = calendar.barAt(timestamp, resolution)
    const first = calendar.barAt(data[0].timestamp, resolution)
    const last = calendar.barAt(data[data.length - 1].timestamp, resolution)
    if (!target || !first || !last) return undefined
    if (target.start < first.start || target.start > last.start) {
      const index = target.start < first.start ? 0 : data.length - 1
      const distance = calendar.distance(index === 0 ? first.start : last.start, target.start, resolution)
      return distance === undefined ? undefined : index + distance
    }
    let lo = 0, hi = data.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const bar = calendar.barAt(data[mid].timestamp, resolution)
      if (!bar) return undefined
      if (bar.start <= target.start) lo = mid + 1
      else hi = mid
    }
    return lo > 0 ? lo - 1 : undefined
  }

  return {
    anchorToIndex: ({ point, currentPeriod, dataList }) => {
      const resolution = getPeriod(currentPeriod)
      const offset = point.offset ?? 0
      if (!resolution || !dataList.length || !Number.isFinite(point.timestamp) || !Number.isInteger(offset)) return undefined
      // Application failures must escape the calendar's expected range fallback.
      const source = offset !== 0 && point.period !== currentPeriod && point.period !== undefined && getPeriod(point.period)
        ? options.sourceData?.(point.period) : undefined
      try {
        if (point.period === currentPeriod) {
          const reference = referenceIndex(dataList, point.timestamp)
          return reference === undefined ? undefined : reference + offset
        }
        const timestamp = resolveAnchorTime(point, source)
        return timestamp === undefined ? undefined : projectTime(timestamp, resolution, dataList)
      } catch (error) {
        if (error instanceof RangeError) return undefined
        throw error
      }
    }
  }
}
