import { expect, it } from 'vitest'
import { createTradingRuleOverlayResolver } from './createTradingRuleOverlayResolver'
const first = Date.UTC(2024, 8, 18)
const dataList = [first, first + 86400000].map(timestamp => ({ timestamp, open: 1, high: 2, low: 0, close: 1 }))
const resolver = createTradingRuleOverlayResolver({
  calendar: { timezone: 'UTC', weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ start: { time: '00:00' }, end: { time: '24:00' } }]])) },
  periods: { day: { unit: 'day' } }
})
it.each([-2, 0, 1, 3])('returns a current-data anchor for index %s without changing the stored point', offset => {
  const point = Object.freeze({ timestamp: first, offset, period: 'day' })
  const result = resolver({ point, currentPeriod: 'day', dataList })
  const reference = Math.max(0, Math.min(offset, dataList.length - 1))
  expect(result).toEqual({ timestamp: dataList[reference].timestamp, offset: offset - reference })
  expect(point).toEqual({ timestamp: first, offset, period: 'day' })
})
it('returns undefined for empty data or an unloaded reference', () => {
  const params = { point: { timestamp: first, period: 'day' }, currentPeriod: 'day' }
  expect(resolver({ ...params, dataList: [] })).toBeUndefined()
  expect(resolver({ ...params, dataList: dataList.slice(1) })).toBeUndefined()
})
