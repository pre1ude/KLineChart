import type { CalendarResolution, TradingCalendarConfig, TradingSessionBoundary, TradingSession } from './types'

const DAY = 86400000
const MINUTE = 60000
const SEARCH_DAYS = 3660
export const MAX_CALENDAR_OFFSET = 10000

interface CalendarBar { start: number, end: number, group: string }
const dateNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`)
const dateString = (time: number): string => new Date(time).toISOString().slice(0, 10)
const addDays = (date: string, days: number): string => dateString(dateNumber(date) + days * DAY)

/** Local trading-date calendar. OHLC bars and indicators remain untouched. */
export class TradingCalendar {
  private readonly config: TradingCalendarConfig
  private readonly formatter: Intl.DateTimeFormat
  private readonly holidays: Set<string>
  private readonly sessionsCache = new Map<string, Array<{ start: number, end: number }>>()
  private readonly barsCache = new Map<string, CalendarBar[]>()
  private cachedBarCount = 0
  private readonly lookupCache = new Map<string, CalendarBar | undefined>()

  constructor(config: TradingCalendarConfig) {
    this.config = JSON.parse(JSON.stringify(config)) as TradingCalendarConfig
    this.formatter = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    this.holidays = new Set(config.holidays)
    for (const date of [...this.holidays, ...Object.keys(config.exceptions ?? {})]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dateNumber(date)) || dateString(dateNumber(date)) !== date) throw new RangeError(`Invalid trading date: ${date}`)
    }
    for (const [weekday, sessions] of Object.entries(config.weekly)) {
      if (!/^[0-6]$/.test(weekday)) throw new RangeError(`Invalid weekday: ${weekday}`)
      this.validateSessions(sessions ?? [])
    }
    for (const sessions of Object.values(config.exceptions ?? {})) this.validateSessions(sessions)
  }

  private boundaryMinutes(boundary: TradingSessionBoundary, end: boolean): number {
    const match = /^(\d{2}):(\d{2})$/.exec(boundary.time)
    if (!match) throw new RangeError('Session time must be HH:mm')
    const hour = Number(match[1]), minute = Number(match[2]), offset = boundary.dayOffset ?? 0
    if (minute > 59 || hour > 24 || (hour === 24 && (!end || minute !== 0)) || !Number.isInteger(offset) || Math.abs(offset) > 7) throw new RangeError('Invalid session boundary')
    return offset * 1440 + hour * 60 + minute
  }

  private validateSessions(sessions: TradingSession[]): void {
    let end = -Infinity
    for (const session of sessions) {
      const start = this.boundaryMinutes(session.start, false), nextEnd = this.boundaryMinutes(session.end, true)
      if (nextEnd <= start || start < end) throw new RangeError('Sessions must be ordered, non-overlapping and have positive duration')
      end = nextEnd
    }
  }

  private localParts(timestamp: number): Record<string, number> {
    return Object.fromEntries(this.formatter.formatToParts(timestamp).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  }

  private localDate(timestamp: number): string {
    const p = this.localParts(timestamp)
    return dateString(Date.UTC(p.year, p.month - 1, p.day))
  }

  private wallTime(date: string, minutes: number): number {
    const wall = dateNumber(date) + minutes * MINUTE
    let instant = wall
    for (let i = 0; i < 4; i++) {
      const p = this.localParts(instant)
      const delta = wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
      if (delta === 0) {
        // A repeated local hour has two possible UTC instants. Do not silently guess.
        for (const neighbor of [instant - DAY, instant + DAY]) {
          const q = this.localParts(neighbor)
          const offset = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second) - neighbor
          const alternate = wall - offset
          if (alternate === instant) continue
          const r = this.localParts(alternate)
          if (Date.UTC(r.year, r.month - 1, r.day, r.hour, r.minute, r.second) === wall) throw new RangeError('Ambiguous DST session boundary')
        }
        return instant
      }
      instant += delta
    }
    throw new RangeError('Session boundary is not representable in its timezone (DST transition)')
  }

  private sessions(date: string): Array<{ start: number, end: number }> {
    const cached = this.sessionsCache.get(date)
    if (cached) return cached
    const exception = this.config.exceptions?.[date]
    const rules = exception ?? (this.holidays.has(date) ? [] : this.config.weekly[new Date(dateNumber(date)).getUTCDay()] ?? [])
    const sessions = rules.map(rule => ({ start: this.wallTime(date, this.boundaryMinutes(rule.start, false)), end: this.wallTime(date, this.boundaryMinutes(rule.end, true)) }))
    if (sessions.some((session, index) => session.end <= session.start || (index > 0 && sessions[index - 1].end > session.start))) throw new RangeError('Invalid session ordering after timezone conversion')
    if (this.sessionsCache.size >= 4096) this.sessionsCache.clear()
    this.sessionsCache.set(date, sessions)
    return sessions
  }

  private group(date: string, resolution: CalendarResolution): string {
    if (resolution.unit === 'month') return `${date.slice(0, 7)}-01`
    if (resolution.unit === 'week') return addDays(date, -((new Date(dateNumber(date)).getUTCDay() + 6) % 7))
    return date
  }

  private moveGroup(date: string, direction: number, resolution: CalendarResolution): string {
    if (resolution.unit === 'month') {
      const d = new Date(dateNumber(date))
      return dateString(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + direction, 1))
    }
    return addDays(date, direction * (resolution.unit === 'week' ? 7 : 1))
  }

  private bars(date: string, resolution: CalendarResolution): CalendarBar[] {
    const group = this.group(date, resolution)
    const key = `${resolution.unit}:${resolution.unit === 'minute' ? resolution.count : 1}:${group}`
    const cached = this.barsCache.get(key)
    if (cached) return cached
    const endDate = this.moveGroup(group, 1, resolution)
    const sessions: Array<{ start: number, end: number }> = []
    for (let date = group; date < endDate; date = addDays(date, 1)) {
      const dailySessions = this.sessions(date)
      sessions.push(...dailySessions)
    }
    for (let i = 1; i < sessions.length; i++) if (sessions[i].start < sessions[i - 1].end) throw new RangeError('Sessions of neighboring trading dates overlap')
    const bars: CalendarBar[] = []
    if (sessions.length) {
      if (resolution.unit !== 'minute') bars.push({ start: sessions[0].start, end: sessions[sessions.length - 1].end, group })
      else {
        const duration = resolution.count * MINUTE
        let start: number | undefined, remaining = duration, end = 0
        for (const session of sessions) {
          let cursor = session.start
          while (cursor < session.end) {
            start ??= cursor
            const consumed = Math.min(remaining, session.end - cursor)
            cursor += consumed
            remaining -= consumed
            end = cursor
            if (remaining === 0) {
              bars.push({ start, end, group })
              start = undefined
              remaining = duration
            }
          }
        }
        if (start !== undefined) bars.push({ start, end, group })
      }
    }
    if (this.barsCache.size >= 4096 || this.cachedBarCount + bars.length > 20000) {
      this.barsCache.clear()
      this.cachedBarCount = 0
    }
    if (bars.length <= 20000) {
      this.barsCache.set(key, bars)
      this.cachedBarCount += bars.length
    }
    return bars
  }

  barAt(timestamp: number, resolution: CalendarResolution): CalendarBar | undefined {
    if (!Number.isFinite(timestamp)) return undefined
    const key = `${resolution.unit}:${resolution.unit === 'minute' ? resolution.count : 1}:${timestamp}`
    if (this.lookupCache.has(key)) return this.lookupCache.get(key)
    const bar = this.findBar(timestamp, resolution)
    if (this.lookupCache.size >= 8192) this.lookupCache.clear()
    this.lookupCache.set(key, bar)
    return bar
  }

  private findBar(timestamp: number, resolution: CalendarResolution): CalendarBar | undefined {
    if (!Number.isFinite(timestamp)) return undefined
    const contains = (start: number, end: number): boolean => start <= timestamp && timestamp < end
    const date = this.localDate(timestamp)
    // Locate the trading date first, including sessions assigned to another calendar date.
    for (let delta = -7; delta <= 7; delta++) {
      const candidate = addDays(date, delta)
      const sessions = this.sessions(candidate)
      if (sessions.some(s => contains(s.start, s.end))) {
        return this.bars(candidate, resolution).find(bar => contains(bar.start, bar.end))
      }
    }
    // Coarse periods cover their whole calendar group; intraday breaks are not bars.
    if (resolution.unit !== 'minute') return this.bars(date, resolution)[0]
    return undefined
  }

  shift(timestamp: number, offset: number, resolution: CalendarResolution): number | undefined {
    if (!Number.isInteger(offset) || Math.abs(offset) > MAX_CALENDAR_OFFSET) return undefined
    let bar = this.barAt(timestamp, resolution)
    if (!bar) return undefined
    const direction = Math.sign(offset)
    let remaining = Math.abs(offset), searched = 0
    while (remaining > 0) {
      const bars = this.bars(bar.group, resolution)
      const start = bar.start
      const index = bars.findIndex(item => item.start === start)
      const available = direction > 0 ? bars.length - index - 1 : index
      if (remaining <= available) return bars[index + direction * remaining].start
      remaining -= available
      let group = bar.group, next: CalendarBar[] = []
      while (!next.length) {
        const nextGroup = this.moveGroup(group, direction, resolution)
        searched += Math.abs(dateNumber(nextGroup) - dateNumber(group)) / DAY
        if (searched > SEARCH_DAYS) return undefined
        group = nextGroup
        next = this.bars(group, resolution)
      }
      bar = direction > 0 ? next[0] : next[next.length - 1]
      remaining--
    }
    return bar.start
  }

  distance(from: number, to: number, resolution: CalendarResolution): number | undefined {
    const first = this.barAt(from, resolution), last = this.barAt(to, resolution)
    if (!first || !last) return undefined
    if (first.start === last.start) return 0
    const direction = Math.sign(last.start - first.start)
    const [earlier, later] = direction > 0 ? [first, last] : [last, first]
    if (earlier.group > later.group || (dateNumber(later.group) - dateNumber(earlier.group)) / DAY > SEARCH_DAYS) return undefined

    // Count each group once, stopping at the target. This uses the same bars as shift,
    // without repeatedly traversing the interval or probing beyond it (e.g. into a DST gap).
    let group = earlier.group
    let current = this.bars(group, resolution)
    let distance = -current.findIndex(bar => bar.start === earlier.start)
    while (group < later.group) {
      distance += current.length
      if (distance > MAX_CALENDAR_OFFSET) return undefined
      group = this.moveGroup(group, 1, resolution)
      current = this.bars(group, resolution)
    }
    distance += current.findIndex(bar => bar.start === later.start)
    return distance <= MAX_CALENDAR_OFFSET ? direction * distance : undefined
  }
}
