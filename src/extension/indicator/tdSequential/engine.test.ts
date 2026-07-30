import { describe, expect, it } from 'vitest'

import { getSupportedIndicators } from '../index'
import {
  PUBLIC_BASELINE_V0_2,
  resolveTDSequentialConfig,
  TRADINGVIEW_STYLE_PUBLIC_V0_2,
  validateTDSequentialConfig
} from './config'
import { calculateTDSequential, TDSequentialEngine } from './engine'
import type { TDSequentialConfig, TDSequentialInputBar } from './types'

function makeBar(
  close: number,
  index: number,
  overrides: Partial<TDSequentialInputBar> = {}
): TDSequentialInputBar {
  const open = overrides.open ?? close
  return {
    timestamp: index,
    open,
    high: overrides.high ?? Math.max(open, close) + 0.25,
    low: overrides.low ?? Math.min(open, close) - 0.25,
    close,
    ...overrides
  }
}

function barsFromCloses(closes: number[]): TDSequentialInputBar[] {
  return closes.map((close, index) => makeBar(close, index))
}

function descending(length: number, start = 100, step = 1): TDSequentialInputBar[] {
  return Array.from({ length }, (_, index) => makeBar(start - index * step, index))
}

function ascending(length: number, start = 100, step = 1): TDSequentialInputBar[] {
  return Array.from({ length }, (_, index) => makeBar(start + index * step, index))
}

function custom(overrides: Partial<TDSequentialConfig> = {}): TDSequentialConfig {
  return resolveTDSequentialConfig({
    profile: 'CUSTOM',
    ...overrides
  })
}

function noTerminalInterference(overrides: Partial<TDSequentialConfig> = {}): TDSequentialConfig {
  return custom({
    enableOppositeSetupCancellation: false,
    enableTDSTCancellation: false,
    enableRecycle: false,
    ...overrides
  })
}

describe('TD Sequential v0.2 configuration', () => {
  it('provides the canonical public baseline', () => {
    expect(PUBLIC_BASELINE_V0_2).toMatchObject({
      setupLength: 9,
      setupLookback: 4,
      countdownLength: 13,
      countdownLookback: 2,
      finalCountComparisonSource: 'CLOSE'
    })
  })

  it('provides the documented TradingView-style final source', () => {
    expect(TRADINGVIEW_STYLE_PUBLIC_V0_2.finalCountComparisonSource).toBe('OPEN_OR_CLOSE')
  })

  it('marks modified built-in profiles as custom', () => {
    const config = resolveTDSequentialConfig({
      profile: 'PUBLIC_BASELINE_V0_2',
      enable8Vs5Deferral: true
    })
    expect(config.profile).toBe('CUSTOM')
  })

  it('rejects setup lengths too short for perfection indexing', () => {
    expect(() => custom({ setupLength: 3 })).toThrow(/setupLength/)
  })

  it('rejects a recycle count that is not beyond setup completion', () => {
    expect(() => custom({ recycleSetupCount: 9 })).toThrow(/recycleSetupCount/)
  })

  it('rejects final-vs-8 when countdown length has no count 8', () => {
    expect(() => custom({ countdownLength: 8, enableFinalVs8Deferral: true })).toThrow(/final vs\. 8/)
  })

  it('rejects invalid range ratios', () => {
    expect(() => custom({ recycleRangeMinRatio: 2, recycleRangeMaxRatio: 1 })).toThrow(/recycleRangeMaxRatio/)
  })

  it('rejects invalid tick sizes', () => {
    expect(() => custom({ tickSize: 0 })).toThrow(/tickSize/)
  })

  it('rejects unsupported policy values at the runtime boundary', () => {
    expect(() => custom({ setupEqualityPolicy: 'UNKNOWN' } as never)).toThrow(/setupEqualityPolicy/)
  })

  it('rejects non-boolean feature flags at the runtime boundary', () => {
    expect(() => custom({ enableRecycle: 'yes' } as never)).toThrow(/enableRecycle/)
  })

  it('rejects a forged built-in profile', () => {
    const forged = { ...PUBLIC_BASELINE_V0_2, setupLength: 10 } as TDSequentialConfig
    expect(() => validateTDSequentialConfig(forged)).toThrow(/canonical/)
  })
})

describe('TD Sequential v0.2 input contract', () => {
  it('rejects duplicate timestamps', () => {
    const bars = descending(2)
    bars[1].timestamp = bars[0].timestamp
    expect(() => calculateTDSequential(bars)).toThrow(/timestamps/)
  })

  it('rejects unordered timestamps', () => {
    const bars = descending(2)
    bars[1].timestamp = -1
    expect(() => calculateTDSequential(bars)).toThrow(/timestamps/)
  })

  it('rejects non-finite OHLC values', () => {
    const bars = descending(1)
    bars[0].close = Number.NaN
    expect(() => calculateTDSequential(bars)).toThrow(/non-finite/)
  })

  it('rejects a high below the close', () => {
    const bars = descending(1)
    bars[0].high = bars[0].close - 1
    expect(() => calculateTDSequential(bars)).toThrow(/high/)
  })

  it('rejects a low above the close', () => {
    const bars = descending(1)
    bars[0].low = bars[0].close + 1
    expect(() => calculateTDSequential(bars)).toThrow(/low/)
  })

  it('rejects unclosed bars in closed-only mode', () => {
    const bars = descending(1)
    bars[0].isClosed = false
    expect(() => calculateTDSequential(bars)).toThrow(/CLOSED_BAR_ONLY/)
  })

  it('rejects an unclosed historical middle bar', () => {
    const bars = descending(3)
    bars[1].isClosed = false
    expect(() => calculateTDSequential(bars, custom({
      calculationMode: 'REALTIME_PROVISIONAL'
    }))).toThrow(/at the end/)
  })
})

describe('TD Sequential v0.2 setup scanner', () => {
  it('completes a buy setup after nine qualifying comparisons', () => {
    const result = calculateTDSequential(descending(13))
    expect(result.setups).toHaveLength(1)
    expect(result.setups[0]).toMatchObject({
      direction: 'BUY',
      startIndex: 4,
      completionIndex: 12,
      extendedRunLength: 9
    })
    expect(result.bars[12].setupMark).toMatchObject({ value: 9, completed: true })
  })

  it('completes a sell setup symmetrically', () => {
    const result = calculateTDSequential(ascending(13))
    expect(result.setups[0]).toMatchObject({ direction: 'SELL', completionIndex: 12 })
  })

  it('starts the opposite setup at one on the interruption bar', () => {
    const bars = descending(12)
    bars.push(makeBar(200, 12))
    const result = calculateTDSequential(bars)
    expect(result.setups).toHaveLength(0)
    expect(result.bars[12].setupMark).toMatchObject({ direction: 'SELL', value: 1 })
  })

  it('creates only one setup instance for one continuous run', () => {
    const result = calculateTDSequential(descending(20), noTerminalInterference())
    expect(result.setups).toHaveLength(1)
    expect(result.setups[0].extendedRunLength).toBe(16)
    expect(result.bars[13].setupMark).toBeUndefined()
  })

  it('breaks an active setup on equality under BREAK', () => {
    const bars = barsFromCloses([10, 10, 10, 10, 9, 10])
    const result = calculateTDSequential(bars, custom({ setupEqualityPolicy: 'BREAK' }))
    expect(result.bars[4].setupMark?.value).toBe(1)
    expect(result.bars[5].setupMark).toBeUndefined()
    expect(result.events.some(event => event.type === 'SETUP_INTERRUPTED')).toBe(true)
  })

  it('continues an active setup on equality under CONTINUE_ACTIVE', () => {
    const bars = barsFromCloses([10, 10, 10, 10, 9, 10])
    const result = calculateTDSequential(bars, custom({ setupEqualityPolicy: 'CONTINUE_ACTIVE' }))
    expect(result.bars[5].setupMark).toMatchObject({ direction: 'BUY', value: 2 })
  })

  it('does not start a direction from equality alone', () => {
    const result = calculateTDSequential(
      barsFromCloses(Array.from({ length: 20 }, () => 10)),
      custom({ setupEqualityPolicy: 'CONTINUE_ACTIVE' })
    )
    expect(result.setups).toHaveLength(0)
    expect(result.bars.every(output => output.setupMark === undefined)).toBe(true)
  })

  it('does not start a monotonic run without a required price flip', () => {
    const result = calculateTDSequential(
      descending(20),
      custom({ setupStartPolicy: 'REQUIRE_PRICE_FLIP' })
    )
    expect(result.setups).toHaveLength(0)
  })

  it('starts on a configured bearish price flip', () => {
    const result = calculateTDSequential(
      barsFromCloses([10, 10, 10, 10, 11, 9]),
      custom({ setupStartPolicy: 'REQUIRE_PRICE_FLIP' })
    )
    expect(result.bars[5].setupMark).toMatchObject({ direction: 'BUY', value: 1 })
  })
})

describe('TD Sequential v0.2 perfection and TDST', () => {
  it('records buy perfection at count 8 and detection at count 9', () => {
    const result = calculateTDSequential(descending(13))
    expect(result.setups[0]).toMatchObject({
      perfectionState: 'PERFECTED',
      perfectionIndex: 11,
      perfectionDetectionIndex: 12
    })
    expect(result.events.find(event => event.type === 'SETUP_PERFECTED')?.barIndex).toBe(12)
  })

  it('records sell perfection symmetrically', () => {
    const result = calculateTDSequential(ascending(13))
    expect(result.setups[0]).toMatchObject({ perfectionState: 'PERFECTED', perfectionIndex: 11 })
  })

  it('supports disabling perfection', () => {
    const result = calculateTDSequential(descending(13), custom({ enablePerfection: false }))
    expect(result.setups[0].perfectionState).toBe('DISABLED')
    expect(result.events.some(event => event.type === 'SETUP_PERFECTED')).toBe(false)
  })

  it('supports late perfection until the next setup completes', () => {
    const bars = descending(14)
    bars[9].low = 0
    bars[10].low = 0
    bars[13].low = -1
    const result = calculateTDSequential(bars, custom({
      latePerfectionPolicy: 'UNTIL_NEXT_SETUP_COMPLETES'
    }))
    expect(result.setups[0]).toMatchObject({
      perfectionState: 'PERFECTED',
      perfectionIndex: 13,
      perfectionDetectionIndex: 13
    })
  })

  it('uses true high across the completed buy setup for TDST resistance', () => {
    const bars = descending(13)
    bars[4] = makeBar(50, 4, { high: 51, low: 49 })
    for (let i = 5; i < bars.length; i++) bars[i] = makeBar(50 - (i - 4), i)
    const result = calculateTDSequential(bars)
    expect(result.tdstLevels[0]).toMatchObject({ type: 'RESISTANCE', price: 97 })
  })

  it('breaks TDST on a later close beyond the level', () => {
    const bars = descending(13)
    bars.push(makeBar(100, 13, { low: 99, high: 101 }))
    const result = calculateTDSequential(bars)
    expect(result.tdstLevels[0]).toMatchObject({ state: 'BROKEN', endIndex: 13 })
    expect(result.events.some(event => event.type === 'TDST_BROKEN' && event.barIndex === 13)).toBe(true)
  })

  it('replaces the displayed TDST when a new same-direction setup completes', () => {
    const bars = descending(13)
    bars.push(makeBar(91, 13))
    for (let i = 14; i <= 22; i++) bars.push(makeBar(70 - (i - 14), i))
    const result = calculateTDSequential(bars, noTerminalInterference())
    expect(result.setups).toHaveLength(2)
    expect(result.tdstLevels[0].state).toBe('REPLACED')
    expect(result.tdstLevels[1].state).toBe('ACTIVE')
  })
})

describe('TD Sequential v0.2 countdown, cancellation, and recycle', () => {
  it('allows setup completion to be countdown one', () => {
    const result = calculateTDSequential(descending(13))
    expect(result.countdowns[0].records[0]).toMatchObject({ ordinal: 1, barIndex: 12 })
    expect(result.bars[12].countdownMarks[0]).toMatchObject({ value: 1, kind: 'COUNT' })
  })

  it('completes countdown 13 strictly after its origin setup 9', () => {
    const result = calculateTDSequential(descending(25), noTerminalInterference())
    const setup = result.setups[0]
    const countdown = result.countdowns[0]
    expect(countdown.records).toHaveLength(13)
    expect(countdown.records[0].barIndex).toBe(setup.completionIndex)
    expect(countdown.completionIndex).toBe(setup.completionIndex + 12)
  })

  it('pauses a countdown without resetting it', () => {
    const bars = descending(13)
    bars.push(makeBar(100, 13))
    bars.push(makeBar(80, 14))
    bars.push(makeBar(79, 15))
    const result = calculateTDSequential(bars, noTerminalInterference({
      countdownLength: 3,
      enableFinalVs8Deferral: false
    }))
    expect(result.countdowns[0].records.map(record => record.barIndex)).toEqual([12, 14, 15])
    expect(result.countdowns[0].phase).toBe('COMPLETED')
  })

  it('applies countdown equality according to countdownAllowEqual', () => {
    const bars = descending(13)
    bars[10].low = bars[12].close
    const base = {
      countdownLength: 1,
      enableFinalVs8Deferral: false,
      enableRecycle: false
    }
    const inclusive = calculateTDSequential(bars, custom({ ...base, countdownAllowEqual: true }))
    const strict = calculateTDSequential(bars, custom({ ...base, countdownAllowEqual: false }))
    expect(inclusive.countdowns[0].phase).toBe('COMPLETED')
    expect(strict.countdowns[0].count).toBe(0)
  })

  it('uses open-or-close only for the final ordinary qualification', () => {
    const bars = descending(13)
    bars.push(makeBar(100, 13, { open: 80, high: 101, low: 79 }))
    const base = {
      countdownLength: 1,
      countdownStartPolicy: 'AFTER_SETUP_COMPLETION_BAR' as const,
      enableFinalVs8Deferral: false,
      enableRecycle: false,
      enableOppositeSetupCancellation: false,
      enableTDSTCancellation: false
    }
    const closeOnly = calculateTDSequential(bars, custom({
      ...base,
      finalCountComparisonSource: 'CLOSE'
    }))
    const openOrClose = calculateTDSequential(bars, custom({
      ...base,
      finalCountComparisonSource: 'OPEN_OR_CLOSE'
    }))
    expect(closeOnly.countdowns[0].count).toBe(0)
    expect(openOrClose.countdowns[0].records[0]).toMatchObject({
      barIndex: 13,
      comparisonSource: 'OPEN_OR_CLOSE',
      comparisonValue: 80
    })
  })

  it('defers count 8 until it passes 8-vs-5', () => {
    const bars = descending(19)
    bars.push(makeBar(100, 19, { low: 99 }))
    bars.push(makeBar(100, 20, { low: 99 }))
    bars.push(makeBar(98, 21, { low: 97.5 }))
    bars.push(makeBar(83, 22, { low: 82.5 }))
    const result = calculateTDSequential(bars, noTerminalInterference({
      enable8Vs5Deferral: true
    }))
    expect(result.bars[21].countdownMarks).toContainEqual(expect.objectContaining({ value: '+', kind: 'DEFERRED' }))
    expect(result.countdowns[0].deferredCandidates[0]).toMatchObject({
      attemptedOrdinal: 8,
      barIndex: 21
    })
    expect(result.countdowns[0].records.find(record => record.ordinal === 8)?.barIndex).toBe(22)
  })

  it('retries final-vs-8 after a deferred final candidate', () => {
    const bars = descending(20)
    bars.push(makeBar(100, 20, { low: 99 }))
    bars.push(makeBar(100, 21, { low: 99 }))
    bars.push(makeBar(98, 22, { low: 97.5 }))
    bars.push(makeBar(98, 23, { low: 97.5 }))
    bars.push(makeBar(97, 24, { low: 96.5 }))
    bars.push(makeBar(97, 25, { low: 96.5 }))
    bars.push(makeBar(96, 26, { low: 95.5 }))
    bars.push(makeBar(80, 27, { low: 79.5 }))
    const result = calculateTDSequential(bars, noTerminalInterference())
    expect(result.bars[26].countdownMarks).toContainEqual(expect.objectContaining({ value: '+' }))
    expect(result.countdowns[0].deferredCandidates[0]).toMatchObject({
      attemptedOrdinal: 'FINAL',
      barIndex: 26
    })
    expect(result.countdowns[0]).toMatchObject({ phase: 'COMPLETED', completionIndex: 27 })
  })

  it('cancels an incomplete countdown when the opposite setup completes', () => {
    const bars = descending(13)
    for (let i = 13; i <= 25; i++) bars.push(makeBar(88 + (i - 12) * 0.5, i))
    const result = calculateTDSequential(bars, custom({
      enableTDSTCancellation: false,
      enableRecycle: false
    }))
    const buyCountdown = result.countdowns.find(countdown => countdown.direction === 'BUY')
    expect(buyCountdown).toMatchObject({
      disposition: 'CANCELLED',
      cancellationReason: 'OPPOSITE_SETUP'
    })
  })

  it('cancels an incomplete countdown when true low clears its origin TDST resistance', () => {
    const bars = descending(13)
    bars.push(makeBar(100, 13, { low: 99, high: 101 }))
    bars.push(makeBar(100, 14, { low: 99, high: 101 }))
    const result = calculateTDSequential(bars, custom({
      enableOppositeSetupCancellation: false,
      enableRecycle: false
    }))
    expect(result.countdowns[0]).toMatchObject({
      disposition: 'CANCELLED',
      cancellationIndex: 14,
      cancellationReason: 'TDST_VIOLATION'
    })
  })

  it('does not cancel an already completed countdown', () => {
    const bars = descending(13)
    for (let i = 13; i <= 25; i++) bars.push(makeBar(88 + (i - 12) * 0.5, i))
    const result = calculateTDSequential(bars, custom({
      countdownLength: 1,
      enableFinalVs8Deferral: false,
      enableTDSTCancellation: false,
      enableRecycle: false
    }))
    const buyCountdown = result.countdowns.find(countdown => countdown.direction === 'BUY')
    expect(buyCountdown).toMatchObject({ phase: 'COMPLETED', disposition: 'ACTIVE' })
  })

  it('recycles a completed countdown when its origin setup reaches 22', () => {
    const result = calculateTDSequential(descending(26))
    expect(result.countdowns[0]).toMatchObject({
      phase: 'COMPLETED',
      disposition: 'RECYCLED',
      recycleIndex: 25,
      recycleReason: 'SETUP_EXTENDED_COUNT'
    })
    expect(result.events.some(event => event.type === 'COUNTDOWN_COMPLETED')).toBe(true)
    expect(result.events.some(event => event.type === 'COUNTDOWN_RECYCLED')).toBe(true)
  })

  it('counts the extended-recycle replacement on the trigger bar', () => {
    const result = calculateTDSequential(descending(26))
    const replacement = result.countdowns.find(countdown => countdown.id.includes(':recycle:'))
    expect(replacement?.records[0]).toMatchObject({ ordinal: 1, barIndex: 25 })
    expect(result.bars[25].countdownMarks).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'R' }),
      expect.objectContaining({ value: 1 })
    ]))
  })

  it('range-recycles an older same-direction countdown into the new setup countdown', () => {
    const bars = descending(13)
    bars.push(makeBar(91, 13))
    for (let i = 14; i <= 22; i++) bars.push(makeBar(82 - (i - 14), i))
    const result = calculateTDSequential(bars, custom({
      enableTDSTCancellation: false,
      enableOppositeSetupCancellation: false,
      enableRangeRecycle: true,
      recycleSetupCount: 30
    }))
    expect(result.setups).toHaveLength(2)
    expect(result.setups[1].range / result.setups[0].range).toBeGreaterThanOrEqual(1)
    expect(result.setups[1].range / result.setups[0].range).toBeLessThanOrEqual(2)
    expect(result.countdowns[0]).toMatchObject({
      disposition: 'RECYCLED',
      recycleReason: 'SETUP_RANGE_RATIO',
      recycleIndex: 22
    })
    expect(result.countdowns[1].predecessorCountdownIds).toContain(result.countdowns[0].id)
  })

  it('keeps the twelfth following bar within the completion window', () => {
    const result = calculateTDSequential(descending(25), noTerminalInterference({
      countdownLength: 1,
      enableFinalVs8Deferral: false
    }))
    expect(result.completionLifecycles[0]).toMatchObject({
      barsSinceCompletion: 12,
      state: 'WITHIN_12_BARS'
    })
  })

  it('moves to after-12-bars on the thirteenth following bar', () => {
    const result = calculateTDSequential(descending(26), noTerminalInterference({
      countdownLength: 1,
      enableFinalVs8Deferral: false
    }))
    expect(result.completionLifecycles[0]).toMatchObject({
      barsSinceCompletion: 13,
      state: 'AFTER_12_BARS',
      stateChangedIndex: 25
    })
  })
})

describe('TD Sequential v0.2 incremental and provisional API', () => {
  it('matches batch calculation after appending every bar', () => {
    const bars = descending(26)
    const engine = new TDSequentialEngine()
    bars.forEach(bar => engine.appendBar(bar))
    expect(engine.result).toEqual(calculateTDSequential(bars))
  })

  it('recalculates and reports event changes when replacing the last bar', () => {
    const bars = descending(13)
    const engine = new TDSequentialEngine()
    engine.calculate(bars)
    const replacement = makeBar(200, 12)
    const delta = engine.replaceLastBar(replacement)
    expect(delta.operation).toBe('REPLACE_LAST')
    expect(delta.removedEventIds.length).toBeGreaterThan(0)
    expect(engine.result.setups).toHaveLength(0)
  })

  it('rolls back the last committed bar', () => {
    const bars = descending(13)
    const engine = new TDSequentialEngine()
    engine.calculate(bars)
    const delta = engine.removeLastBar()
    expect(delta).toMatchObject({ operation: 'REMOVE_LAST', removedBarTimestamp: 12 })
    expect(engine.result).toEqual(calculateTDSequential(bars.slice(0, -1)))
  })

  it('keeps an unclosed last bar out of committed state', () => {
    const bars = descending(13)
    bars[12].isClosed = false
    const result = calculateTDSequential(bars, custom({
      calculationMode: 'REALTIME_PROVISIONAL'
    }))
    expect(result.committedBarCount).toBe(12)
    expect(result.setups).toHaveLength(0)
    expect(result.provisional).toMatchObject({ barIndex: 12, provisional: true })
    expect(result.provisional?.events.every(event => event.provisional)).toBe(true)
  })

  it('commits a formerly provisional bar exactly once', () => {
    const config = custom({ calculationMode: 'REALTIME_PROVISIONAL' })
    const engine = new TDSequentialEngine(config)
    const bars = descending(13)
    bars[12].isClosed = false
    engine.calculate(bars)
    const committed = { ...bars[12], isClosed: true }
    const delta = engine.replaceLastBar(committed)
    expect(delta.removedEventIds).toHaveLength(0)
    expect(engine.result.setups).toHaveLength(1)
    expect(engine.result.events.filter(event => event.type === 'SETUP_COMPLETED')).toHaveLength(1)
  })

  it('uses stable entity and event ids across batch and append', () => {
    const bars = descending(20)
    const batch = calculateTDSequential(bars, noTerminalInterference())
    const engine = new TDSequentialEngine(noTerminalInterference())
    bars.forEach(bar => engine.appendBar(bar))
    expect(engine.result.setups.map(setup => setup.id)).toEqual(batch.setups.map(setup => setup.id))
    expect(engine.result.events.map(event => event.id)).toEqual(batch.events.map(event => event.id))
  })

  it('stores one restorable snapshot per committed bar', () => {
    const engine = new TDSequentialEngine(noTerminalInterference())
    engine.calculate(descending(20))
    expect(engine.snapshots).toHaveLength(20)
    expect(engine.snapshots[19]).toMatchObject({
      afterBarIndex: 19,
      afterTimestamp: 19,
      configHash: engine.result.configHash
    })
  })

  it('does not persist a provisional bar as a state snapshot', () => {
    const bars = descending(13)
    bars[12].isClosed = false
    const engine = new TDSequentialEngine(custom({ calculationMode: 'REALTIME_PROVISIONAL' }))
    engine.calculate(bars)
    expect(engine.snapshots).toHaveLength(12)
    expect(engine.snapshots[11].afterBarIndex).toBe(11)
  })

  it('restores an arbitrary snapshot and replays to the same deterministic result', () => {
    const bars = descending(26)
    const engine = new TDSequentialEngine()
    const expected = engine.calculate(bars)
    engine.restoreSnapshot(14)
    bars.slice(15).forEach(bar => engine.appendBar(bar))
    expect(engine.result).toEqual(expected)
  })

  it('protects internal snapshots from mutations to returned snapshot data', () => {
    const bars = descending(13)
    const engine = new TDSequentialEngine()
    engine.calculate(bars)
    const snapshots = engine.snapshots
    snapshots[12].setups[0].extendedRunLength = 999
    engine.restoreSnapshot(12)
    expect(engine.result.setups[0].extendedRunLength).toBe(9)
  })

  it('registers TDSEQ as a built-in indicator', () => {
    expect(getSupportedIndicators()).toContain('TDSEQ')
  })
})
