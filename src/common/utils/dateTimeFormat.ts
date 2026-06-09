import { logWarn } from './logger'
import { isString } from './typeChecks'

const dateTimeFormatLocale = 'en'

const yearFormatOptions = { year: 'numeric' } as const
const monthFormatOptions = { month: 'numeric' } as const
const dayFormatOptions = { day: 'numeric' } as const
const hourFormatOptions = { hour: 'numeric', hour12: false } as const
const minuteFormatOptions = { minute: 'numeric' } as const
const secondFormatOptions = { second: 'numeric' } as const

export interface DateTimeFormat {
  readonly year: Intl.DateTimeFormat
  readonly month: Intl.DateTimeFormat
  readonly day: Intl.DateTimeFormat
  readonly hour: Intl.DateTimeFormat
  readonly minute: Intl.DateTimeFormat
  readonly second: Intl.DateTimeFormat
  readonly timeZone: string
}

let _dateTimeFormat: DateTimeFormat = buildDateTimeFormat()!

function buildPartFormat(options: Intl.DateTimeFormatOptions, timezone?: string): Intl.DateTimeFormat {
  const formatOptions: Intl.DateTimeFormatOptions = { ...options }
  if (isString(timezone)) {
    formatOptions.timeZone = timezone
  }
  return new Intl.DateTimeFormat(dateTimeFormatLocale, formatOptions)
}

export function buildDateTimeFormat(timezone?: string): DateTimeFormat | undefined {
  let dateTimeFormat: DateTimeFormat | undefined
  try {
    const year = buildPartFormat(yearFormatOptions, timezone)
    dateTimeFormat = {
      year,
      month: buildPartFormat(monthFormatOptions, timezone),
      day: buildPartFormat(dayFormatOptions, timezone),
      hour: buildPartFormat(hourFormatOptions, timezone),
      minute: buildPartFormat(minuteFormatOptions, timezone),
      second: buildPartFormat(secondFormatOptions, timezone),
      timeZone: year.resolvedOptions().timeZone
    }
  } catch (_e) {
    logWarn('', '', 'Timezone is error!!!')
  }
  return dateTimeFormat
}

export function getDateTimeFormat(): DateTimeFormat {
  return _dateTimeFormat
}

export function setTimezone(timezone: string): void {
  _dateTimeFormat = buildDateTimeFormat(timezone)!
}

export function getTimezone(): string {
  return _dateTimeFormat.timeZone
}
