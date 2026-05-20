import { describe, expect, it } from 'vitest'
import { buildCloseAreaPath, buildCloseLinePath, computeSliderLayout, createSliderCoordinate, resolveDataZoomSliderTheme, updateDragRange } from './DataZoomSlider'
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

describe('computeSliderLayout', () => {
  it('keeps full range side handles inside half handle width padding', () => {
    const layout = computeSliderLayout(100, 32, { start: 0, end: 100 })

    expect(layout.trackLeft).toBe(5)
    expect(layout.trackWidth).toBe(90)
    expect(layout.startX).toBe(5)
    expect(layout.endX).toBe(95)
    expect(layout.selectedRangeLeft).toBe(5)
    expect(layout.selectedRangeWidth).toBe(90)
  })
})

describe('createSliderCoordinate', () => {
  it('maps between local x and percent inside the padded track range', () => {
    const coordinate = createSliderCoordinate(100)

    expect(coordinate.left).toBe(5)
    expect(coordinate.right).toBe(95)
    expect(coordinate.width).toBe(90)
    expect(coordinate.percentToX(0)).toBe(5)
    expect(coordinate.percentToX(50)).toBe(50)
    expect(coordinate.percentToX(100)).toBe(95)
    expect(coordinate.xToPercent(5)).toBe(0)
    expect(coordinate.xToPercent(50)).toBe(50)
    expect(coordinate.xToPercent(95)).toBe(100)
    expect(coordinate.xToPercent(0)).toBe(0)
    expect(coordinate.xToPercent(100)).toBe(100)
    expect(coordinate.distanceToPercent(9)).toBe(10)
    expect(coordinate.clampX(0)).toBe(5)
    expect(coordinate.clampX(100)).toBe(95)
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
