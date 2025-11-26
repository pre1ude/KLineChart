import { logWarn } from './logger'
import { isString } from './typeChecks'

let _dateTimeFormat: Intl.DateTimeFormat = buildDateTimeFormat()!

export function buildDateTimeFormat(timezone?: string): Intl.DateTimeFormat | undefined {
  const options: Intl.DateTimeFormatOptions = {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
  if (isString(timezone)) {
    options.timeZone = timezone
  }
  let dateTimeFormat: Intl.DateTimeFormat | undefined
  try {
    dateTimeFormat = new Intl.DateTimeFormat('en', options)
  } catch (_e) {
    logWarn('', '', 'Timezone is error!!!')
  }
  return dateTimeFormat
}

export function getDateTimeFormat(): Intl.DateTimeFormat {
  return _dateTimeFormat
}

export function setTimezone(timezone: string): void {
  _dateTimeFormat = buildDateTimeFormat(timezone)!
}

export function getTimezone(): string {
  return _dateTimeFormat.resolvedOptions().timeZone
}

export function genTimeStamp(text: string, hintTs: number): number {
  const [hour, minute] = text.split(':').map(Number)
  const date = new Date(hintTs)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}
