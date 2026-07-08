import { describe, expect, it } from 'vitest'

import { YAxisPosition } from '../common/Styles'
import DualYPane from './DualYPane'

function createPane(position: YAxisPosition, mainPosition?: Exclude<YAxisPosition, YAxisPosition.Both>): DualYPane {
  const pane = Object.create(DualYPane.prototype) as DualYPane
  const leftWidget = { id: 'left' }
  const rightWidget = { id: 'right' }

  Reflect.set(pane, '_yLeftAxisWidget', leftWidget)
  Reflect.set(pane, '_yRightAxisWidget', rightWidget)
  Reflect.set(pane, 'getChart', () => ({
    getStyles: () => ({
      yAxis: {
        position,
        mainPosition
      }
    })
  }))

  return pane
}

describe('DualYPane.getMainAxisWidget', () => {
  it('uses the configured main y-axis when both y-axes are visible', () => {
    const pane = createPane(YAxisPosition.Both, YAxisPosition.Right)

    expect(pane.getMainAxisWidget()).toBe(pane.getYRightAxisWidget())
  })

  it('keeps the left y-axis as the default main axis when both y-axes are visible', () => {
    const pane = createPane(YAxisPosition.Both)

    expect(pane.getMainAxisWidget()).toBe(pane.getYLeftAxisWidget())
  })

  it('uses the visible y-axis as the main axis when only one y-axis is visible', () => {
    const leftPane = createPane(YAxisPosition.Left, YAxisPosition.Right)
    const rightPane = createPane(YAxisPosition.Right, YAxisPosition.Left)

    expect(leftPane.getMainAxisWidget()).toBe(leftPane.getYLeftAxisWidget())
    expect(rightPane.getMainAxisWidget()).toBe(rightPane.getYRightAxisWidget())
  })
})
