import { expect, it } from 'vitest'
import { createTradingCalendarTimeMapping } from './createTradingCalendarTimeMapping'
import type { TradingCalendarConfig } from './types'
const bars = (...times: string[]) => times.map(time => ({ timestamp: Date.parse(time), open: 10, high: 11, low: 9, close: 10 }))
const calendar: TradingCalendarConfig = { timezone: 'Asia/Shanghai', weekly: { 3: [{ start: { time: '09:30' }, end: { time: '15:00' } }] } }
const periods = { day: { unit: 'day' } as const, minute: { unit: 'minute', count: 1 } as const }

it('projects an actual daily start to the opening minute without rewriting its anchor', () => {
  const mapping = createTradingCalendarTimeMapping({ calendar, periods })
  const point = Object.freeze({ timestamp: Date.parse('2024-09-18T09:30:00+08:00'), period: 'day', offset: 0 })
  expect(mapping.anchorToIndex({ point, currentPeriod: 'minute', dataList: bars('2024-09-18T09:30:00+08:00', '2024-09-18T09:31:00+08:00') })).toBe(0)
  expect(mapping.anchorToIndex({ point, currentPeriod: 'day', dataList: bars('2024-09-18T09:30:00+08:00') })).toBe(0)
  expect(point.timestamp).toBe(Date.parse('2024-09-18T09:30:00+08:00'))
})
it('counts actual source bars before projecting their start timestamps', () => {
  const source = bars('2024-09-11T09:30:00+08:00', '2024-09-18T09:30:00+08:00')
  const mapping = createTradingCalendarTimeMapping({ calendar, periods, sourceData: () => source })
  expect(mapping.anchorToIndex({ point: { timestamp: source[0].timestamp, period: 'day', offset: 1 }, currentPeriod: 'minute', dataList: bars('2024-09-18T09:30:00+08:00') })).toBe(0)
})
it('preserves absolute instants instead of moving every daily point to the opening', () => {
  const mapping = createTradingCalendarTimeMapping({ calendar, periods })
  expect(mapping.anchorToIndex({ point: { timestamp: Date.parse('2024-09-18T13:00:00+08:00'), period: 'day' }, currentPeriod: 'minute', dataList: bars('2024-09-18T09:30:00+08:00', '2024-09-18T13:00:00+08:00') })).toBe(1)
})
it('uses actual opening instants across a DST weekend', () => {
  const sessions = [{ start: { time: '09:30' }, end: { time: '16:00' } }]
  const mapping = createTradingCalendarTimeMapping({ calendar: { timezone: 'America/New_York', weekly: { 1: sessions, 5: sessions } }, periods })
  expect(mapping.anchorToIndex({ point: { timestamp: Date.parse('2024-03-08T09:30:00-05:00'), period: 'day', offset: 1 }, currentPeriod: 'minute', dataList: bars('2024-03-11T09:30:00-04:00') })).toBe(0)
})
it('projects a daily bar that starts in the previous evening', () => {
  const mapping = createTradingCalendarTimeMapping({ calendar: { ...calendar, weekly: { 3: [{ start: { time: '21:00', dayOffset: -1 }, end: { time: '02:30' } }, { start: { time: '09:00' }, end: { time: '15:00' } }] } }, periods })
  expect(mapping.anchorToIndex({ point: { timestamp: Date.parse('2024-09-17T21:00:00+08:00'), period: 'day' }, currentPeriod: 'minute', dataList: bars('2024-09-17T21:00:00+08:00', '2024-09-18T00:00:00+08:00') })).toBe(0)
})
it('treats midnight as an actual instant, not an encoded trading date', () => {
  const overnight = [{ start: { time: '09:00' }, end: { time: '02:30', dayOffset: 1 } }]
  const mapping = createTradingCalendarTimeMapping({ calendar: { ...calendar, weekly: { 2: overnight, 3: overnight } }, periods })
  expect(mapping.anchorToIndex({ point: { timestamp: Date.parse('2024-09-18T00:00:00+08:00'), period: 'day' }, currentPeriod: 'minute', dataList: bars('2024-09-18T00:00:00+08:00', '2024-09-18T09:00:00+08:00') })).toBe(0)
})
it('does not swallow errors thrown by business source-data providers', () => {
  const cause = new RangeError('source unavailable')
  const mapping = createTradingCalendarTimeMapping({ calendar, periods, sourceData: () => { throw cause } })
  expect(() => mapping.anchorToIndex({ point: { timestamp: Date.parse('2024-09-18T09:30:00+08:00'), period: 'day', offset: 1 }, currentPeriod: 'minute', dataList: bars('2024-09-18T09:30:00+08:00') })).toThrow(cause)
})
