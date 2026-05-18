import { describe, expect, it } from 'vitest'
import type KLineData from '../../common/KLineData'
import { resolveMinutePercentageBasis, resolveTimeShareBasisPrice, timestampToTimeShareDataIndex } from './index'

describe('timestampToTimeShareDataIndex', () => {
  const ticks = ['09:30', '09:31', '09:32']
  const dataList = [
    createData(5, 9, 30),
    createData(5, 9, 31),
    createData(6, 9, 30)
  ]

  it('returns exact data index before applying virtual time-share ticks', () => {
    expect(timestampToTimeShareDataIndex(dataList, toTime(6, 9, 30), ticks)).toBe(2)
  })

  it('maps missing intraday tick to the corresponding virtual slot', () => {
    expect(timestampToTimeShareDataIndex(dataList, toTime(6, 9, 31), ticks)).toBe(4)
  })

  it('returns a negative virtual slot before the first loaded day', () => {
    expect(timestampToTimeShareDataIndex(dataList, toTime(4, 9, 31), ticks)).toBe(-2)
  })

  it('returns undefined for timestamps outside configured ticks', () => {
    expect(timestampToTimeShareDataIndex(dataList, toTime(6, 10, 0), ticks)).toBeUndefined()
  })
})

describe('resolveTimeShareBasisPrice', () => {
  const firstData = createData(5, 9, 30, { open: 10, prevClose: 9 })

  it('uses explicit basis price first', () => {
    expect(resolveTimeShareBasisPrice(firstData, 8)).toBe(8)
  })

  it('uses first data prevClose when basis price is not configured', () => {
    expect(resolveTimeShareBasisPrice(firstData)).toBe(9)
  })

  it('falls back to first data open when prevClose is missing', () => {
    expect(resolveTimeShareBasisPrice(createData(5, 9, 30, { open: 10 }))).toBe(10)
  })
})

describe('resolveMinutePercentageBasis', () => {
  it('uses time-share basis in time-share mode', () => {
    expect(resolveMinutePercentageBasis(true, 9, 10)).toBe(9)
  })

  it('uses visible first close in k-line mode', () => {
    expect(resolveMinutePercentageBasis(false, 9, 10)).toBe(10)
  })
})

function createData(day: number, hour: number, minute: number, values?: { open?: number, prevClose?: number }): KLineData {
  const open = values?.open ?? 1
  return {
    timestamp: toTime(day, hour, minute),
    open,
    high: open,
    low: open,
    close: open,
    prevClose: values?.prevClose
  }
}

function toTime(day: number, hour: number, minute: number): number {
  return new Date(2026, 0, day, hour, minute).getTime()
}
