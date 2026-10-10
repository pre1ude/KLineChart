import type { KLineData } from '../../../../src/index'
import type { Point } from '../../../../src/index'

export type OverlayAnchor = Pick<Point, 'timestamp' | 'offset'> & { period?: string }
export type ResolveOverlayPoint = (params: { point: Readonly<OverlayAnchor>, currentPeriod: string | undefined, dataList: readonly KLineData[] }) => OverlayAnchor | undefined

export interface TradingTimeContext {
  currentPeriod: string | undefined
  dataList: readonly KLineData[]
}

/** Trading-rule mapping used for overlay projection. Estimated times are not axis labels. */
export interface TradingTimeMapping {
  anchorToIndex: (params: TradingTimeContext & { point: Readonly<OverlayAnchor> }) => number | undefined
}

export interface TradingSessionBoundary {
  /** HH:mm in calendar.timezone; 24:00 is allowed for an end boundary. */
  time: string
  /** Relative to the trading date, e.g. -1 for the previous evening. */
  dayOffset?: number
}

export interface TradingSession {
  start: TradingSessionBoundary
  end: TradingSessionBoundary
}

export interface TradingCalendarConfig {
  timezone: string
  /** Trading-date weekdays: Sunday=0, Monday=1, ... Saturday=6. */
  weekly: Partial<Record<number, TradingSession[]>>
  /** Optional refinements; ordinary weekly rules are sufficient for extrapolation. */
  holidays?: string[]
  /** YYYY-MM-DD keys. Complete replacement, including night sessions; takes precedence over holidays. */
  exceptions?: Record<string, TradingSession[]>
}

export type CalendarResolution = { unit: 'minute', count: number } | { unit: 'day' | 'week' | 'month' }

export interface TradingRuleOverlayResolverOptions {
  /** This demo accepts actual bar starts and requires the asset's trading rules. */
  calendar: TradingCalendarConfig
  periods: Record<string, CalendarResolution>
  /** Optional real source bars: offsets inside this range count actual bars, not calendar slots. */
  sourceData?: (period: string) => readonly KLineData[] | undefined
}
