import { describe, expect, it } from 'vitest'

import { calculateTD9Outputs as calculateTD9OutputsFromRoot } from '../../../index'
import { getSupportedIndicators } from '../index'
import { calculateTD9, calculateTD9Outputs, DEFAULT_TD9_CONFIG } from './index'
import type { TD9InputBar } from './types'

function makeBar(close: number, index: number): TD9InputBar {
  return {
    timestamp: index,
    open: close,
    high: close + 0.25,
    low: close - 0.25,
    close
  }
}

function descending(length: number): TD9InputBar[] {
  return Array.from({ length }, (_, index) => makeBar(100 - index, index))
}

function ascending(length: number): TD9InputBar[] {
  return Array.from({ length }, (_, index) => makeBar(100 + index, index))
}

function barsFromCloses(closes: number[]): TD9InputBar[] {
  return closes.map(makeBar)
}

function visibleValues(bars: TD9InputBar[]): number[] {
  return calculateTD9Outputs(bars).flatMap(output => output.setupMark?.value ?? [])
}

function completionIndices(result: ReturnType<typeof calculateTD9>): number[] {
  return result.bars.flatMap(output => output.setupMark?.value === 9
    ? [output.barIndex]
    : [])
}

describe('TD9 built-in indicator', () => {
  it('registers TD9 as a built-in indicator', () => {
    expect(getSupportedIndicators()).toContain('TD9')
  })

  it('exports calculateTD9Outputs from the package root', () => {
    expect(calculateTD9OutputsFromRoot(descending(13))).toEqual(calculateTD9Outputs(descending(13)))
  })

  it('exposes only the remaining TD9 behavior switches', () => {
    expect(DEFAULT_TD9_CONFIG).toEqual({
      setupStartPolicy: 'CONTINUOUS_SCAN',
      afterCompleted: 'WAIT_BREAK',
      enablePerfection: true,
      calculationMode: 'CLOSED_BAR_ONLY'
    })
  })

  it('uses the confirmed Setup 9 display lifecycle', () => {
    expect(visibleValues(descending(9))).toEqual([])
    expect(visibleValues(descending(10))).toEqual([1, 2, 3, 4, 5, 6])
    expect(visibleValues(descending(13))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('removes a partial setup when it fails before nine', () => {
    const bars = descending(10)
    bars.push(makeBar(200, 10))
    expect(visibleValues(bars)).toEqual([])
  })

  it('does not expose Countdown or TDST fields', () => {
    const outputs = calculateTD9Outputs(descending(25))
    outputs.forEach(output => {
      expect('countdownMarks' in output).toBe(false)
      expect('tdstResistance' in output).toBe(false)
      expect('tdstSupport' in output).toBe(false)
    })
  })

  it('records completion and perfection on the Setup 9 output', () => {
    const result = calculateTD9(descending(13))
    expect('setups' in result).toBe(false)
    expect(result.bars[4].setupMark).toMatchObject({ direction: 'BUY', value: 1 })
    expect(result.bars[12].setupMark).toMatchObject({
      direction: 'BUY',
      value: 9,
      perfected: true
    })
    expect('completed' in result.bars[12].setupMark!).toBe(false)
    expect('provisional' in result.bars[12].setupMark!).toBe(false)
  })

  it('trusts the KLineData input contract instead of validating unused open values', () => {
    const bars = descending(13)
    bars[6] = { ...bars[6], open: Number.NaN }
    expect(completionIndices(calculateTD9(bars))).toEqual([12])
  })

  it('completes only one setup within an uninterrupted directional run', () => {
    const result = calculateTD9(descending(40))
    expect(completionIndices(result)).toEqual([12])
  })

  it('starts the opposite direction after WAIT_BREAK', () => {
    const bars = descending(13)
    bars.push(makeBar(200, 13))

    const result = calculateTD9(bars, { afterCompleted: 'WAIT_BREAK' })

    expect(completionIndices(result)).toEqual([12])
    expect(result.bars[13].setupMark).toMatchObject({ direction: 'SELL', value: 1 })
  })

  it('restarts at one after Setup 9 when afterCompleted is RESTART', () => {
    const result = calculateTD9(descending(22), { afterCompleted: 'RESTART' })

    expect(result.bars[13].setupMark).toMatchObject({ direction: 'BUY', value: 1 })
    expect(completionIndices(result)).toEqual([12, 21])
  })

  it('restarts without requiring another price flip', () => {
    const result = calculateTD9(
      barsFromCloses([
        10, 10, 10, 10, 11, 9, 8, 7, 6, 5, 4, 3,
        2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8
      ]),
      {
        setupStartPolicy: 'REQUIRE_PRICE_FLIP',
        afterCompleted: 'RESTART'
      }
    )

    expect(result.bars[14].setupMark).toMatchObject({ direction: 'BUY', value: 1 })
    expect(completionIndices(result)).toEqual([13, 22])
  })

  it('always interrupts an active setup on equality', () => {
    const result = calculateTD9(barsFromCloses([10, 10, 10, 10, 9, 10]))

    expect(result.bars[4].setupMark).toMatchObject({ direction: 'BUY', value: 1 })
    expect(result.bars[5].setupMark).toBeUndefined()
    expect(completionIndices(result)).toEqual([])
  })

  it('treats every non-zero price difference as directional', () => {
    const result = calculateTD9(barsFromCloses([
      10,
      10,
      10,
      10,
      10 - Number.EPSILON * 8
    ]))

    expect(result.bars[4].setupMark).toMatchObject({ direction: 'BUY', value: 1 })
  })

  it('starts only on bearish and bullish price flips when required', () => {
    const monotonic = calculateTD9(descending(20), {
      setupStartPolicy: 'REQUIRE_PRICE_FLIP'
    })
    const bearishFlip = calculateTD9(
      barsFromCloses([10, 10, 10, 10, 11, 9]),
      { setupStartPolicy: 'REQUIRE_PRICE_FLIP' }
    )
    const bullishFlip = calculateTD9(
      barsFromCloses([10, 10, 10, 10, 9, 11]),
      { setupStartPolicy: 'REQUIRE_PRICE_FLIP' }
    )

    expect(completionIndices(monotonic)).toEqual([])
    expect(monotonic.bars.every(output => output.setupMark === undefined)).toBe(true)
    expect(bearishFlip.bars[5].setupMark).toMatchObject({ direction: 'BUY', value: 1 })
    expect(bullishFlip.bars[5].setupMark).toMatchObject({ direction: 'SELL', value: 1 })
  })

  it('records count 8 perfection symmetrically when count 9 confirms the setup', () => {
    const buy = calculateTD9(descending(13))
    const sell = calculateTD9(ascending(13))

    expect(buy.bars[12].setupMark).toMatchObject({
      direction: 'BUY',
      value: 9,
      perfected: true
    })
    expect(sell.bars[12].setupMark).toMatchObject({
      direction: 'SELL',
      value: 9,
      perfected: true
    })
    expect(buy.bars[11].setupMark?.perfected).toBeUndefined()
    expect('perfectedSetupId' in buy.bars[12]).toBe(false)
  })

  it('falls back to count 9 when count 8 does not perfect the setup', () => {
    const bars = descending(13)
    bars[9] = { ...bars[9], low: 0 }
    bars[10] = { ...bars[10], low: 0 }
    bars[11] = { ...bars[11], low: 1 }
    bars[12] = { ...bars[12], low: -1 }

    const result = calculateTD9(bars)
    expect(result.bars[12].setupMark).toMatchObject({ value: 9, perfected: true })
  })

  it('finalizes an unperfected setup when count 9 completes', () => {
    const bars = descending(14)
    bars[9] = { ...bars[9], low: 0 }
    bars[10] = { ...bars[10], low: 0 }
    bars[13] = { ...bars[13], low: -1 }

    const result = calculateTD9(bars)

    expect(result.bars[12].setupMark).toMatchObject({ value: 9 })
    expect(result.bars[12].setupMark?.perfected).toBeUndefined()
    expect(result.bars.every(output => !('perfectedSetupId' in output))).toBe(true)
  })

  it('supports a provisional last bar without committing it', () => {
    const bars = descending(13)
    bars[12] = { ...bars[12], isClosed: false }
    const result = calculateTD9(bars, { calculationMode: 'REALTIME_PROVISIONAL' })
    expect(result.bars).toHaveLength(12)
    expect('committedBarCount' in result).toBe(false)
    expect('setups' in result).toBe(false)
    expect(result.provisional?.setupMark).toMatchObject({ value: 9 })
    expect('provisional' in result.provisional!.setupMark!).toBe(false)
  })

  it('rejects an unclosed bar in CLOSED_BAR_ONLY mode', () => {
    const bars = descending(13)
    bars[12] = { ...bars[12], isClosed: false }

    expect(() => calculateTD9(bars)).toThrow(/CLOSED_BAR_ONLY/)
  })

  it('keeps provisional positioning as an execution contract', () => {
    const bars = descending(13)
    bars[6] = { ...bars[6], isClosed: false }
    expect(() => calculateTD9(bars, {
      calculationMode: 'REALTIME_PROVISIONAL'
    })).toThrow(/at the end/)
  })
})
