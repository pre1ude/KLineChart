import { describe, expect, it, vi } from 'vitest'
import { TradingCalendar } from './TradingCalendar'
import { createTradingCalendarTimeMapping } from './createTradingCalendarTimeMapping'
import type { TradingCalendarConfig } from './types'
const t = (date: string) => Date.parse(date)
const daySessions = [{ start: { time: '09:30' }, end: { time: '11:30' } }, { start: { time: '13:00' }, end: { time: '15:00' } }]
const calendar: TradingCalendarConfig = { timezone: 'Asia/Shanghai', weekly: Object.fromEntries([1, 2, 3, 4, 5].map(day => [day, daySessions])), holidays: ['2024-09-16'], exceptions: { '2024-09-17': [{ start: { time: '09:30' }, end: { time: '11:30' } }] } }
const daily = { unit: 'day' } as const
const bars = (times: string[]) => times.map(date => ({ timestamp: t(date), open: 10, high: 12, low: 8, close: 11 }))

describe('local trading calendar', () => {
  it('continues 90 minute bars through the lunch break and truncates at the final close', () => {
    const c = new TradingCalendar(calendar), p = { unit: 'minute', count: 90 } as const
    expect(c.shift(t('2024-09-13T09:30:00+08:00'), 1, p)).toBe(t('2024-09-13T11:00:00+08:00'))
    expect(c.barAt(t('2024-09-13T13:30:00+08:00'), p)).toMatchObject({ start: t('2024-09-13T11:00:00+08:00'), end: t('2024-09-13T14:00:00+08:00') })
    expect(c.shift(t('2024-09-13T09:30:00+08:00'), 2, p)).toBe(t('2024-09-13T14:00:00+08:00'))
    expect(c.shift(t('2024-09-13T09:30:00+08:00'), 3, p)).toBe(t('2024-09-17T09:30:00+08:00'))
  })
  it('skips weekends and holidays in both directions and lets exceptions override holidays', () => {
    const c = new TradingCalendar({ ...calendar, holidays: ['2024-09-16', '2024-09-17'] })
    expect(c.shift(t('2024-09-13T09:30:00+08:00'), 1, daily)).toBe(t('2024-09-17T09:30:00+08:00'))
    expect(c.shift(t('2024-09-17T09:30:00+08:00'), -1, daily)).toBe(t('2024-09-13T09:30:00+08:00'))
    expect(c.distance(t('2024-09-13T09:30:00+08:00'), t('2024-09-18T09:30:00+08:00'), daily)).toBe(2)
  })
  it('combines night and day sessions assigned to one trading date; overrides replace both', () => {
    const config: TradingCalendarConfig = { timezone: 'Asia/Shanghai', weekly: { 2: [
      { start: { time: '21:00', dayOffset: -1 }, end: { time: '02:30' } },
      { start: { time: '09:00' }, end: { time: '15:00' } }
    ] } }
    const p = { unit: 'minute', count: 60 } as const
    const c = new TradingCalendar(config)
    expect(c.barAt(t('2024-09-17T09:15:00+08:00'), p)).toMatchObject({ start: t('2024-09-17T02:00:00+08:00'), end: t('2024-09-17T09:30:00+08:00') })
    const replacement = new TradingCalendar({ ...config, exceptions: { '2024-09-17': [{ start: { time: '09:00' }, end: { time: '11:00' } }] } })
    expect(replacement.barAt(t('2024-09-16T21:00:00+08:00'), p)).toBeUndefined()
  })
  it('aligns weekly and monthly starts to the first opening and respects DST', () => {
    const c = new TradingCalendar(calendar)
    expect(c.barAt(t('2024-09-18T10:00:00+08:00'), { unit: 'week' })?.start).toBe(t('2024-09-17T09:30:00+08:00'))
    expect(c.barAt(t('2024-09-18T10:00:00+08:00'), { unit: 'month' })?.start).toBe(t('2024-09-02T09:30:00+08:00'))
    const ny = new TradingCalendar({ timezone: 'America/New_York', weekly: { 1: [{ start: { time: '09:30' }, end: { time: '16:00' } }], 5: [{ start: { time: '09:30' }, end: { time: '16:00' } }] } })
    expect(ny.shift(t('2024-03-08T14:30:00Z'), 1, daily)).toBe(t('2024-03-11T13:30:00Z'))
  })
  it('counts natural months through leap February and declines nonexistent DST boundaries', () => {
    const c = new TradingCalendar({ timezone: 'UTC', weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ start: { time: '00:00' }, end: { time: '24:00' } }]])) })
    expect(c.shift(t('2024-01-01T00:00:00Z'), 2, { unit: 'month' })).toBe(t('2024-03-01T00:00:00Z'))
    const mapping = createTradingCalendarTimeMapping({ calendar: { timezone: 'America/New_York', weekly: { 0: [{ start: { time: '02:30' }, end: { time: '04:00' } }] } }, periods: { day: { unit: 'day' }, minute: { unit: 'minute', count: 1 } } })
    expect(mapping.anchorToIndex({ point: { timestamp: t('2024-03-03T07:30:00Z'), offset: 1, period: 'day' }, currentPeriod: 'minute', dataList: bars(['2024-03-03T07:30:00Z']) })).toBeUndefined()
  })

  it('rejects malformed configuration and bounds impossible or extreme lookups', () => {
    expect(() => new TradingCalendar({ ...calendar, timezone: 'invalid/zone' })).toThrow()
    expect(() => new TradingCalendar({ ...calendar, weekly: { 1: [{ start: { time: '10:00' }, end: { time: '09:00' } }] } })).toThrow()
    expect(() => createTradingCalendarTimeMapping({ calendar, periods: { bad: { unit: 'minute', count: 0 } } })).toThrow()
    expect(new TradingCalendar(calendar).shift(t('2024-09-13T09:30:00+08:00'), 10001, daily)).toBeUndefined()
  })

  it.each([-120, -96, -72, -65, -64, 64, 65, 72, 96, 120])('counts a reachable month offset %s within the date-search limit', offset => {
    const config = { timezone: 'UTC', weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ start: { time: '00:00' }, end: { time: '24:00' } }]])) }
    const c = new TradingCalendar(config), month = { unit: 'month' } as const
    const start = t('2024-01-01T00:00:00Z')
    const expected = Date.UTC(2024, offset, 1)
    expect(c.shift(start, offset, month)).toBe(expected)
    expect(c.distance(start, expected, month)).toBe(offset)
    const mapping = createTradingCalendarTimeMapping({ calendar: config, periods: { month, day: daily } })
    expect(mapping.anchorToIndex({ point: { timestamp: expected, period: 'day' }, currentPeriod: 'month', dataList: bars(['2024-01-01T00:00:00Z']) })).toBe(offset)
  })

  it.each([-1, 1])('keeps the real search-day and offset limits in direction %s', direction => {
    const c = new TradingCalendar({ timezone: 'UTC', weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ start: { time: '00:00' }, end: { time: '24:00' } }]])) })
    const start = t('2024-01-01T00:00:00Z'), minute = { unit: 'minute', count: 1 } as const
    expect(c.distance(start, Date.UTC(2024, direction * 121, 1), { unit: 'month' })).toBeUndefined()
    expect(c.distance(start, start + direction * 10000 * 60000, minute)).toBe(direction * 10000)
    expect(c.distance(start, start + direction * 10001 * 60000, minute)).toBeUndefined()
  })
})

describe('business calendar projection', () => {
  const periods = { '1d': daily, '90m': { unit: 'minute', count: 90 } as const }
  it('projects future and past source offsets into daily positions', () => {
    const mapping = createTradingCalendarTimeMapping({ calendar, periods })
    const dataList = bars(['2024-09-12T09:30:00+08:00', '2024-09-13T09:30:00+08:00'])
    expect(mapping.anchorToIndex({ point: { timestamp: dataList[1].timestamp, offset: 3, period: '90m' }, currentPeriod: '1d', dataList })).toBe(2)
    expect(mapping.anchorToIndex({ point: { timestamp: dataList[0].timestamp, offset: -3, period: '90m' }, currentPeriod: '1d', dataList })).toBe(-1)
  })
  it('preserves same-period relative positions and counts actual source bars when supplied', () => {
    const dataList = bars(['2024-09-12T09:30:00+08:00', '2024-09-17T09:30:00+08:00'])
    const source = bars(['2024-09-12T09:30:00+08:00', '2024-09-17T09:30:00+08:00'])
    const mapping = createTradingCalendarTimeMapping({ calendar, periods, sourceData: () => source })
    expect(mapping.anchorToIndex({ point: { timestamp: dataList[0].timestamp, offset: 1, period: '1d' }, currentPeriod: '1d', dataList })).toBe(1)
    expect(mapping.anchorToIndex({ point: { timestamp: source[0].timestamp, offset: 1, period: '90m' }, currentPeriod: '1d', dataList })).toBe(1)
    expect(mapping.anchorToIndex({ point: { timestamp: t('2024-09-13T09:30:00+08:00'), period: '90m' }, currentPeriod: '1d', dataList })).toBe(0)
  })
})


it.each([1, -1])('counts only the target interval before a DST gap (direction %s)', direction => {
  const config = { timezone: 'America/New_York', weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ start: { time: '02:30' }, end: { time: '04:00' } }]])) }
  const c = new TradingCalendar(config)
  const from = t('2024-03-06T02:30:00-05:00'), to = t('2024-03-09T02:30:00-05:00')
  expect(c.shift(from, 3, daily)).toBe(to)
  expect(c.distance(direction === 1 ? from : to, direction === 1 ? to : from, daily)).toBe(direction * 3)
  const mapping = createTradingCalendarTimeMapping({ calendar: config, periods: { day: daily } })
  const dataList = bars([direction === 1 ? '2024-03-06T02:30:00-05:00' : '2024-03-09T02:30:00-05:00'])
  expect(mapping.anchorToIndex({ point: { timestamp: direction === 1 ? to : from }, currentPeriod: 'day', dataList })).toBe(direction * 3)
})

it('counts a long month interval without repeatedly shifting from the reference', () => {
  const c = new TradingCalendar({ timezone: 'UTC', weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ start: { time: '00:00' }, end: { time: '24:00' } }]])) })
  const shift = vi.spyOn(c, 'shift')
  expect(c.distance(t('2020-01-01T00:00:00Z'), t('2026-01-01T00:00:00Z'), { unit: 'month' })).toBe(72)
  expect(shift).not.toHaveBeenCalled()
})

it.each([
  { name: 'holidays and half sessions', config: calendar, reference: '2024-09-13T09:30:00+08:00' },
  { name: 'night sessions', config: { timezone: 'Asia/Shanghai', weekly: Object.fromEntries([1, 2, 3, 4, 5].map(day => [day, [
    { start: { time: '21:00', dayOffset: -1 }, end: { time: '02:30' } }, { start: { time: '09:00' }, end: { time: '15:00' } }
  ]])) }, reference: '2024-09-13T09:00:00+08:00' },
  { name: 'DST weekend', config: { timezone: 'America/New_York', weekly: Object.fromEntries([1, 2, 3, 4, 5].map(day => [day, [{ start: { time: '09:30' }, end: { time: '16:00' } }]])) }, reference: '2024-03-08T09:30:00-05:00' }
])('matches independent shifting in both directions with $name', ({ config, reference }) => {
  const c = new TradingCalendar(config)
  for (const resolution of [{ unit: 'minute', count: 90 }, { unit: 'day' }, { unit: 'week' }, { unit: 'month' }] as const) {
    const from = c.shift(t(reference), 1, resolution)!
    for (const offset of [-7, -2, -1, 0, 1, 2, 7]) {
      const target = c.shift(from, offset, resolution)
      expect(target).toBeDefined()
      expect(c.distance(from, target!, resolution)).toBe(offset)
      expect(c.distance(target!, from, resolution)).toBe(offset === 0 ? 0 : -offset)
    }
  }
})

it('skips an entirely closed month while counting the target interval', () => {
  const c = new TradingCalendar({ timezone: 'UTC', weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ start: { time: '00:00' }, end: { time: '24:00' } }]])), holidays: Array.from({ length: 29 }, (_, day) => `2024-02-${String(day + 1).padStart(2, '0')}`) })
  const start = t('2024-01-01T00:00:00Z'), end = t('2024-03-01T00:00:00Z'), resolution = { unit: 'month' } as const
  expect(c.shift(start, 1, resolution)).toBe(end)
  expect(c.distance(start, end, resolution)).toBe(1)
  expect(c.distance(end, start, resolution)).toBe(-1)
})
