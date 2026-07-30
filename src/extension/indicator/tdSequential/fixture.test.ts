import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { calculateTDSequential } from './engine'
import type { TDSequentialInputBar } from './types'

interface DailyFixture {
  symbol: string
  from: string
  to: string
  data: TDSequentialInputBar[]
}

function loadFixture(symbol: 'aapl' | 'nvda'): DailyFixture {
  return JSON.parse(
    readFileSync(new URL(`../../../../tests/data/${symbol}-daily.json`, import.meta.url), 'utf8')
  ) as DailyFixture
}

const aapl = loadFixture('aapl')
const nvda = loadFixture('nvda')
const fixtures = [aapl, nvda]

describe('TD Sequential five-year daily fixtures', () => {
  it('uses the same five-year date range and trading days', () => {
    fixtures.forEach(fixture => {
      expect(fixture).toMatchObject({
        from: '2021-07-20',
        to: '2026-07-20'
      })
      expect(fixture.data).toHaveLength(1255)
    })
    expect(aapl.data.map(bar => bar.timestamp)).toEqual(nvda.data.map(bar => bar.timestamp))
  })

  it('satisfies the input contract', () => {
    fixtures.forEach(fixture => fixture.data.forEach((bar, index) => {
      expect(Number.isFinite(bar.open)).toBe(true)
      expect(Number.isFinite(bar.high)).toBe(true)
      expect(Number.isFinite(bar.low)).toBe(true)
      expect(Number.isFinite(bar.close)).toBe(true)
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close))
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close))
      if (index > 0) expect(bar.timestamp).toBeGreaterThan(fixture.data[index - 1].timestamp)
    }))
  })

  it('identifies both symbols and preserves the shared end date', () => {
    expect(aapl).toMatchObject({
      symbol: 'AAPL',
      to: '2026-07-20'
    })
    expect(nvda).toMatchObject({
      symbol: 'NVDA',
      to: '2026-07-20'
    })
  })

  it('contains completed Buy and Sell Countdowns for directional demo coverage', () => {
    fixtures.forEach(fixture => {
      const result = calculateTDSequential(fixture.data)
      expect(result.countdowns.some(countdown => (
        countdown.direction === 'BUY' && countdown.phase === 'COMPLETED'
      ))).toBe(true)
      expect(result.countdowns.some(countdown => (
        countdown.direction === 'SELL' && countdown.phase === 'COMPLETED'
      ))).toBe(true)
    })
  })
})
