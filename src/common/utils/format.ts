import { isNumber, isValid } from './typeChecks'

export function formatDate(dateTimeFormat: Intl.DateTimeFormat, timestamp: number, format: string): string {
  const date: Record<string, string> = {}
  dateTimeFormat.formatToParts(new Date(timestamp)).forEach(({ type, value }) => {
    switch (type) {
      case 'year': {
        date.YYYY = value
        break
      }
      case 'month': {
        date.MM = value
        break
      }
      case 'day': {
        date.DD = value
        break
      }
      case 'hour': {
        date.HH = value === '24' ? '00' : value
        break
      }
      case 'minute': {
        date.mm = value
        break
      }
      case 'second': {
        date.ss = value
        break
      }
    }
  })
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, key => date[key])
}

export function formatPrecision(value: string | number, precision?: number): string {
  const v = +value
  if (isNumber(v)) {
    return v.toFixed(precision ?? 2)
  }
  return `${value}`
}

export function formatBigNumber(value: string | number): string {
  const v = +value
  if (isNumber(v)) {
    if (v > 1000000000) {
      return `${+((v / 1000000000).toFixed(3))}B`
    }
    if (v > 1000000) {
      return `${+((v / 1000000).toFixed(3))}M`
    }
    if (v > 1000) {
      return `${+((v / 1000).toFixed(3))}K`
    }
  }
  return `${value}`
}

export function formatThousands(value: string | number, sign: string): string {
  const vl = `${value}`
  if (sign.length === 0) {
    return vl
  }
  if (vl.includes('.')) {
    const arr = vl.split('.')
    return `${arr[0].replace(/(\d)(?=(\d{3})+$)/g, $1 => `${$1}${sign}`)}.${arr[1]}`
  }
  return vl.replace(/(\d)(?=(\d{3})+$)/g, $1 => `${$1}${sign}`)
}

export function formatFoldDecimal(value: string | number, threshold: number): string {
  const vl = `${value}`
  const reg = new RegExp(`\\.0{${  threshold  },}[1-9][0-9]*$`)
  if (reg.test(vl)) {
    const result = vl.split('.')
    const v = result[result.length - 1]
    const match = v.match(/0*/)
    if (isValid(match)) {
      const count = match[0].length
      result[result.length - 1] = v.replace(/0*/, `0{${count}}`)
      return result.join('.')
    }
  }
  return vl
}

export function formatToHHmm(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}
