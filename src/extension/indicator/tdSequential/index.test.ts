import { describe, expect, it } from 'vitest'

import { calculateTDSequential } from './engine'
import {
  filterCountdownMarksForDisplay,
  filterSetupMarksForDisplay,
  resolveCountdownMarkColor,
  resolveSetupMarkColor
} from './index'
import type { TDSequentialBarOutput, TDSequentialInputBar } from './types'

function makeBar(close: number, index: number): TDSequentialInputBar {
  return {
    timestamp: index,
    open: close,
    high: close + 0.25,
    low: close - 0.25,
    close
  }
}

function descending(length: number): TDSequentialInputBar[] {
  return Array.from({ length }, (_, index) => makeBar(100 - index, index))
}

function visibleSetupValues(bars: TDSequentialInputBar[]): number[] {
  const result = calculateTDSequential(bars)
  return filterSetupMarksForDisplay(result.bars, result.setups)
    .flatMap(output => output.setupMark?.value ?? [])
}

describe('TD Sequential setup mark display confirmation', () => {
  it('hides setup marks before the run reaches six', () => {
    expect(visibleSetupValues(descending(9))).toEqual([])
  })

  it('backfills setup marks one through six when count six is reached', () => {
    expect(visibleSetupValues(descending(10))).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('removes a confirmed partial run when it is interrupted before nine', () => {
    const bars = descending(10)
    bars.push(makeBar(200, 10))
    expect(visibleSetupValues(bars)).toEqual([])
  })

  it('keeps all marks for a completed setup', () => {
    expect(visibleSetupValues(descending(13))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('TD Sequential setup mark colors', () => {
  it('uses red for Buy Setup and green for Sell Setup by default', () => {
    expect(resolveSetupMarkColor('BUY', false)).toBe('#D94A4A')
    expect(resolveSetupMarkColor('SELL', false)).toBe('#16A085')
  })

  it('keeps the directional color for Perfected Setup by default', () => {
    expect(resolveSetupMarkColor('BUY', true)).toBe('#D94A4A')
    expect(resolveSetupMarkColor('SELL', true)).toBe('#16A085')
  })

  it('supports directional and legacy color overrides', () => {
    expect(resolveSetupMarkColor('BUY', false, {
      setupColor: '#111111',
      buySetupColor: '#222222'
    })).toBe('#222222')
    expect(resolveSetupMarkColor('SELL', false, { setupColor: '#111111' })).toBe('#111111')
    expect(resolveSetupMarkColor('SELL', true, { perfectedColor: '#333333' })).toBe('#333333')
  })
})

describe('TD Sequential countdown mark colors', () => {
  it('matches the corresponding setup direction color by default', () => {
    expect(resolveCountdownMarkColor('BUY')).toBe(resolveSetupMarkColor('BUY', false))
    expect(resolveCountdownMarkColor('SELL')).toBe(resolveSetupMarkColor('SELL', false))
  })

  it('supports independent countdown color overrides', () => {
    expect(resolveCountdownMarkColor('BUY', { buyCountdownColor: '#111111' })).toBe('#111111')
    expect(resolveCountdownMarkColor('SELL', { sellCountdownColor: '#222222' })).toBe('#222222')
  })
})

describe('TD Sequential countdown mark display', () => {
  it('shows only the completed countdown number', () => {
    const result = calculateTDSequential(descending(25))
    const outputs = filterCountdownMarksForDisplay(result.bars)
    expect(outputs.flatMap(output => output.countdownMarks.map(mark => mark.value))).toEqual([13])
  })

  it('keeps deferred and recycled status marks', () => {
    const output: TDSequentialBarOutput = {
      barIndex: 0,
      timestamp: 0,
      provisional: false,
      countdownMarks: [
        { countdownId: 'count', direction: 'BUY', value: 5, kind: 'COUNT', provisional: false },
        { countdownId: 'deferred', direction: 'BUY', value: '+', kind: 'DEFERRED', provisional: false },
        { countdownId: 'recycled', direction: 'SELL', value: 'R', kind: 'RECYCLED', provisional: false },
        { countdownId: 'completed', direction: 'SELL', value: 13, kind: 'COMPLETED', provisional: false }
      ],
      perfectedSetupIds: [],
      events: []
    }
    const marks = filterCountdownMarksForDisplay([output])[0].countdownMarks
    expect(marks.map(mark => mark.value)).toEqual(['+', 'R', 13])
  })
})
