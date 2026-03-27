import type { DateTimeFormat } from './dateTimeFormat'
import { isNumber } from './typeChecks'

function normalizeHour(hour: string): string {
  return hour === '24' ? '00' : hour
}

function padDatePart(value: string): string {
  return value.length < 2 ? `0${value}` : value
}

export function formatDate(dateTimeFormat: DateTimeFormat, timestamp: number, format: string): string {
  const date = new Date(timestamp)
  let text = format
  if (text.includes('YYYY')) {
    text = text.replace(/YYYY/g, dateTimeFormat.year.format(date))
  }
  if (text.includes('MM')) {
    text = text.replace(/MM/g, padDatePart(dateTimeFormat.month.format(date)))
  }
  if (text.includes('DD')) {
    text = text.replace(/DD/g, padDatePart(dateTimeFormat.day.format(date)))
  }
  if (text.includes('HH')) {
    text = text.replace(/HH/g, padDatePart(normalizeHour(dateTimeFormat.hour.format(date))))
  }
  if (text.includes('mm')) {
    text = text.replace(/mm/g, padDatePart(dateTimeFormat.minute.format(date)))
  }
  if (text.includes('ss')) {
    text = text.replace(/ss/g, padDatePart(dateTimeFormat.second.format(date)))
  }
  return text
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

const subscriptNumbers = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const

const scientificNotationPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/

function toSubscriptNumbers(value: number): string {
  return `${value}`.split('').map(char => subscriptNumbers[Number(char)]).join('')
}

function normalizeDecimal(value: string | number): string {
  const raw = `${value}`
  const eIndex = raw.indexOf('e')
  const exponentIndex = eIndex > -1 ? eIndex : raw.indexOf('E')
  if (exponentIndex < 0) {
    return raw
  }

  const text = raw.trim()
  if (!scientificNotationPattern.test(text)) {
    return raw
  }

  const normalizedExponentIndex = text.indexOf('e') > -1 ? text.indexOf('e') : text.indexOf('E')
  const coefficient = text.slice(0, normalizedExponentIndex)
  const exponent = Number(text.slice(normalizedExponentIndex + 1))
  const isNegative = coefficient.startsWith('-')
  const unsignedCoefficient = coefficient.replace(/^[+-]/, '')
  const decimalIndex = unsignedCoefficient.indexOf('.')
  const integerPart = decimalIndex > -1 ? unsignedCoefficient.slice(0, decimalIndex) : unsignedCoefficient
  const fractionalPart = decimalIndex > -1 ? unsignedCoefficient.slice(decimalIndex + 1) : ''
  const digits = `${integerPart}${fractionalPart}`
  const nextDecimalIndex = integerPart.length + exponent
  const sign = isNegative ? '-' : ''

  if (nextDecimalIndex <= 0) {
    return `${sign}0.${'0'.repeat(-nextDecimalIndex)}${digits}`
  }
  if (nextDecimalIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(nextDecimalIndex - digits.length)}`
  }
  return `${sign}${digits.slice(0, nextDecimalIndex)}.${digits.slice(nextDecimalIndex)}`
}

export function formatFoldDecimal(value: string | number, threshold: number): string {
  const vl = normalizeDecimal(value)
  if (!Number.isInteger(threshold) || threshold <= 0) {
    return vl
  }

  const decimalIndex = vl.indexOf('.')
  if (decimalIndex < 0 || decimalIndex === vl.length - 1) {
    return vl
  }

  const decimal = vl.slice(decimalIndex + 1)
  let zeroCount = 0
  while (zeroCount < decimal.length && decimal[zeroCount] === '0') {
    zeroCount++
  }
  if (zeroCount < threshold || zeroCount === decimal.length) {
    return vl
  }

  return `${vl.slice(0, decimalIndex + 1)}0${toSubscriptNumbers(zeroCount)}${decimal.slice(zeroCount)}`
}

export function formatToHHmm(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}
