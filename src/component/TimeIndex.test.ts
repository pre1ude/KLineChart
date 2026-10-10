import { describe, expect, it } from 'vitest'
import TimeIndex, { type TimeLookupMode } from './TimeIndex'

describe('TimeIndex', () => {
  it.each([
    ['exact', undefined], ['floor', 0], ['ceil', 1], ['nearest', 0]
  ] as Array<[TimeLookupMode, number | undefined]>)('looks up between real bars with %s semantics', (mode, expected) => {
    const index = new TimeIndex(() => [{ timestamp: 100 }, { timestamp: 300 }, { timestamp: 600 }])
    expect(index.timeToDataIndex(200, mode)).toBe(expected)
    expect(index.timeToDataIndex(300, mode)).toBe(1)
    expect(index.timeToDataIndex(99, mode)).toBeUndefined()
    expect(index.timeToDataIndex(601, mode)).toBeUndefined()
    expect(index.timeToDataIndex(NaN, mode)).toBeUndefined()
    expect(index.timeToDataIndex(Infinity, mode)).toBeUndefined()
  })

  it('keeps historical logical positions when prepending and rebases only on reset', () => {
    let data = [{ timestamp: 300 }, { timestamp: 600 }]
    const index = new TimeIndex(() => data)
    expect(index.timeToLogical(300)).toBe(0)
    data = [{ timestamp: 100 }, { timestamp: 200 }, ...data]
    index.prepend(2)
    expect(index.timeToLogical(300)).toBe(0)
    expect(index.timeToLogical(100)).toBe(-2)
    expect(index.timeToDataIndex(300)).toBe(2)
    expect(index.logicalToTime(-2)).toBe(100)
    expect(index.logicalToTime(-3)).toBeUndefined()
    expect(index.logicalToTime(-1.5)).toBeUndefined()
    expect(index.logicalToTime(2)).toBeUndefined()
    index.reset()
    expect(index.timeToLogical(300)).toBe(2)
  })

  it('preserves fractional and out-of-data positions without inventing timestamps', () => {
    const index = new TimeIndex(() => [{ timestamp: 100 }])
    index.prepend(5)
    for (const value of [-100.25, -5, -0.5, 0, 50.75]) {
      expect(index.logicalToDataIndex(index.dataIndexToLogical(value))).toBe(value)
    }
    expect(index.logicalToTime(10)).toBeUndefined()
  })

  it('reads the current real data without a stale lookup cache', () => {
    let data = [{ timestamp: 100 }]
    const index = new TimeIndex(() => data)
    expect(index.timeToDataIndex(100)).toBe(0)
    data[0] = { timestamp: 200 }
    expect(index.timeToDataIndex(100)).toBeUndefined()
    expect(index.timeToDataIndex(200)).toBe(0)
    data = []
    index.reset()
    expect(index.timeToDataIndex(200, 'nearest')).toBeUndefined()
    expect(index.logicalToTime(0)).toBeUndefined()
  })
})
