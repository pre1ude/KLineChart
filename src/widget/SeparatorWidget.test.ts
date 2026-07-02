import { describe, expect, it } from 'vitest'
import { calculateMainFlexPaneResize } from './SeparatorWidget'

describe('calculateMainFlexPaneResize', () => {
  it('uses upward separator drag to grow the target pane and shrink the main pane', () => {
    expect(calculateMainFlexPaneResize({
      dragDistance: -20,
      targetPaneStartHeight: 100,
      targetPaneMinHeight: 30,
      mainPaneStartHeight: 300,
      mainPaneMinHeight: 60
    })).toEqual({
      targetPaneHeight: 120,
      mainPaneHeight: 280
    })
  })

  it('uses downward separator drag to shrink the target pane and grow the main pane', () => {
    expect(calculateMainFlexPaneResize({
      dragDistance: 40,
      targetPaneStartHeight: 100,
      targetPaneMinHeight: 30,
      mainPaneStartHeight: 300,
      mainPaneMinHeight: 60
    })).toEqual({
      targetPaneHeight: 60,
      mainPaneHeight: 340
    })
  })

  it('does not shrink the target pane below its min height', () => {
    expect(calculateMainFlexPaneResize({
      dragDistance: 120,
      targetPaneStartHeight: 100,
      targetPaneMinHeight: 45,
      mainPaneStartHeight: 300,
      mainPaneMinHeight: 60
    })).toEqual({
      targetPaneHeight: 45,
      mainPaneHeight: 355
    })
  })

  it('does not shrink the main pane below its min height', () => {
    expect(calculateMainFlexPaneResize({
      dragDistance: -400,
      targetPaneStartHeight: 100,
      targetPaneMinHeight: 30,
      mainPaneStartHeight: 300,
      mainPaneMinHeight: 80
    })).toEqual({
      targetPaneHeight: 320,
      mainPaneHeight: 80
    })
  })
})
