import { describe, expect, it, vi } from 'vitest'

import { textLog } from '../extension/overlay/custom/textLog'
import { OVERLAY_FIGURE_KEY_PREFIX, Overlay } from './Overlay'

describe('Overlay styles', () => {
  it('merges instance styles without mutating textLog template defaults', () => {
    const first = new Overlay(textLog, {
      id: 'overlay_1',
      groupId: 'overlay_1',
      paneId: 'candle',
      styles: {
        textBox: {
          color: '#ff0000'
        }
      }
    })

    expect(first.styles?.textBox?.color).toBe('#ff0000')
    expect(first.styles?.textBox?.maxWidth).toBe(150)
    expect(first.styles?.textBox?.backgroundColor).toBe('#4D6180')

    const second = new Overlay(textLog, {
      id: 'overlay_2',
      groupId: 'overlay_2',
      paneId: 'candle'
    })

    expect(second.styles?.textBox?.color).toBe('#FFF')
  })
})

describe('Overlay control points', () => {
  it('derives backward-compatible control points from stored point coordinates by default', () => {
    const overlay = new Overlay({ name: 'test' }, {
      id: 'overlay_1',
      groupId: 'overlay_1',
      paneId: 'candle'
    })
    const coordinates = [
      { x: 10, y: 20 },
      { x: 30, y: 40 }
    ]

    expect(overlay.getControlPoints(coordinates)).toEqual([
      { key: `${OVERLAY_FIGURE_KEY_PREFIX}point_0`, coordinate: coordinates[0] },
      { key: `${OVERLAY_FIGURE_KEY_PREFIX}point_1`, coordinate: coordinates[1] }
    ])
  })

  it('uses auto visibility by default and invalidates drawing when the policy changes', () => {
    const overlay = new Overlay({ name: 'test' }, {
      id: 'overlay_1',
      groupId: 'overlay_1',
      paneId: 'candle'
    })

    expect(overlay.controlPointVisibility).toBe('auto')
    expect(overlay.shouldUpdate({ controlPointVisibility: 'always' })).toEqual({
      sort: false,
      draw: true,
      fields: ['controlPointVisibility']
    })

    overlay.update({ controlPointVisibility: 'always' })
    expect(overlay.controlPointVisibility).toBe('always')
  })

  it('passes the stable control-point key to custom update logic', () => {
    const onControlPointUpdate = vi.fn()
    const overlay = new Overlay({ name: 'test', totalStep: 2, onControlPointUpdate }, {
      id: 'overlay_1',
      groupId: 'overlay_1',
      paneId: 'candle',
      points: [
        { dataIndex: 1, value: 10 },
        { dataIndex: 2, value: 20 }
      ]
    })
    const point = { dataIndex: 3, value: 30 }

    overlay.onDragMoveControlPoint(point, 1, 'corner_11')

    expect(onControlPointUpdate).toHaveBeenCalledWith(overlay.points, 1, point, 'corner_11')
  })
})
