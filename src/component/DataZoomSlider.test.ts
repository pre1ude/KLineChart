import { describe, expect, it } from 'vitest'
import { buildCloseLinePath } from './DataZoomSlider'
import type KLineData from '../common/KLineData'

describe('buildCloseLinePath', () => {
  it('returns empty path for empty data or empty layout', () => {
    expect(buildCloseLinePath([], 100, 20)).toBe('')
    expect(buildCloseLinePath([createData(1)], 0, 20)).toBe('')
    expect(buildCloseLinePath([createData(1)], 100, 0)).toBe('')
  })

  it('renders one close point in the track center', () => {
    expect(buildCloseLinePath([createData(10)], 100, 20)).toBe('M 50 10')
  })

  it('renders equal close values as a horizontal center line', () => {
    expect(buildCloseLinePath([createData(10), createData(10)], 100, 20)).toBe('M 0 10 L 100 10')
  })

  it('scales close values into a padded line path', () => {
    expect(buildCloseLinePath([createData(1), createData(2), createData(3)], 100, 20)).toBe('M 0 18 L 50 10 L 100 2')
  })
})

function createData(close: number): KLineData {
  return {
    timestamp: close,
    open: close,
    high: close,
    low: close,
    close
  }
}
