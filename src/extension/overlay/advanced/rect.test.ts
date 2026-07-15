import { describe, expect, it } from 'vitest'

import { Overlay } from '../../../component/Overlay'
import rect from './rect'

function createRect(): Overlay {
  return new Overlay(rect, {
    id: 'overlay_rect',
    groupId: 'overlay_rect',
    paneId: 'candle',
    points: [
      { dataIndex: 10, value: 100 },
      { dataIndex: 20, value: 200 }
    ]
  })
}

describe('rect control points', () => {
  it('derives four corner handles while retaining two stored anchors', () => {
    const overlay = createRect()
    const coordinates = [
      { x: 10, y: 20 },
      { x: 30, y: 40 }
    ]

    expect(overlay.getControlPoints(coordinates)).toEqual([
      { key: 'corner_00', coordinate: { x: 10, y: 20 } },
      { key: 'corner_10', coordinate: { x: 30, y: 20 } },
      { key: 'corner_11', coordinate: { x: 30, y: 40 } },
      { key: 'corner_01', coordinate: { x: 10, y: 40 } }
    ])
    expect(overlay.points).toHaveLength(2)
  })

  it.each([
    ['corner_00', 0, [{ dataIndex: 30, value: 300 }, { dataIndex: 20, value: 200 }]],
    ['corner_10', 1, [{ dataIndex: 10, value: 300 }, { dataIndex: 30, value: 200 }]],
    ['corner_11', 2, [{ dataIndex: 10, value: 100 }, { dataIndex: 30, value: 300 }]],
    ['corner_01', 3, [{ dataIndex: 30, value: 100 }, { dataIndex: 20, value: 300 }]]
  ] as const)('maps %s drag updates back to the two stored anchors', (key, index, expectedPoints) => {
    const overlay = createRect()

    overlay.onDragMoveControlPoint({ dataIndex: 30, value: 300 }, index, key)

    expect(overlay.points).toEqual(expectedPoints)
  })
})
