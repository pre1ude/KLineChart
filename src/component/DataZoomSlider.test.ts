import { describe, expect, it } from 'vitest'
import { buildCloseAreaPath, buildCloseLinePath, resolveDataZoomSliderTheme, updateDragRange } from './DataZoomSlider'
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

  it('builds a filled close area path down to the bottom edge', () => {
    expect(buildCloseAreaPath([createData(1), createData(2), createData(3)], 100, 20)).toBe('M 0 18 L 50 10 L 100 2 L 100 20 L 0 20 Z')
  })

  it('limits path point count to the available pixel width', () => {
    expect(buildCloseLinePath([1, 2, 3, 4, 5].map(createData), 2, 20)).toBe('M 0 18 L 1 10 L 2 2')
  })
})

describe('resolveDataZoomSliderTheme', () => {
  it('uses chart theme when slider theme is auto or undefined', () => {
    expect(resolveDataZoomSliderTheme(undefined, 'dark')).toBe('dark')
    expect(resolveDataZoomSliderTheme('auto', 'light')).toBe('light')
  })

  it('uses explicit slider theme before chart theme', () => {
    expect(resolveDataZoomSliderTheme('dark', 'light')).toBe('dark')
    expect(resolveDataZoomSliderTheme('light', 'dark')).toBe('light')
  })
})

describe('updateDragRange', () => {
  it('uses the constrained move result as the next drag baseline', () => {
    const drag = {
      startX: 100,
      startRange: { start: 50, end: 100 }
    }

    updateDragRange(drag, 51, { start: 49, end: 51 })
    expect(drag).toEqual({
      startX: 51,
      startRange: { start: 49, end: 51 }
    })

    updateDragRange(drag, 55, { start: 49, end: 55 })
    expect(drag).toEqual({
      startX: 55,
      startRange: { start: 49, end: 55 }
    })
  })

  it('keeps the previous drag baseline when no move result is available', () => {
    const drag = {
      startX: 100,
      startRange: { start: 50, end: 100 }
    }

    updateDragRange(drag, 80)

    expect(drag).toEqual({
      startX: 100,
      startRange: { start: 50, end: 100 }
    })
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
