import { describe, expect, it, vi } from 'vitest'

import { textLog } from '../extension/overlay/custom/textLog'
import { OVERLAY_FIGURE_KEY_PREFIX, Overlay } from './Overlay'

describe('Overlay offset validation', () => {
  it('rejects fractional offsets when constructing an instance directly', () => {
    expect(() => new Overlay({ name: 'test' }, {
      id: 'invalid_offset',
      groupId: 'invalid_offset',
      paneId: 'candle',
      points: [{ timestamp: 100, offset: 0.5, value: 10 }]
    })).toThrow(RangeError)
  })
})

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

describe('Overlay editable properties', () => {
  it('does not import runtime fields or drawing state from initialization data', () => {
    const runtime: { self?: unknown } = {}
    runtime.self = runtime
    const overlay = new Overlay({ name: 'test', totalStep: 2 }, {
      id: 'overlay_1', groupId: 'overlay_1', paneId: 'candle',
      points: [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }],
      runtime, totalStep: 1, currentStep: 99
    })
    expect(overlay).not.toHaveProperty('runtime')
    expect(overlay.totalStep).toBe(2)
    expect(overlay.currentStep).toBe(2)
    expect(() => JSON.stringify(overlay)).not.toThrow()
  })

  it('ignores unknown runtime fields and template methods during updates', () => {
    const overlay = new Overlay({ name: 'test', totalStep: 2 }, {
      id: 'overlay_1', groupId: 'overlay_1', paneId: 'candle',
      points: [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }]
    })
    const runtime: { self?: unknown } = {}
    runtime.self = runtime
    const update = { ...overlay, visible: false, totalStep: 1, createFigures: vi.fn(), runtime }

    expect(() => overlay.update(update)).not.toThrow()
    expect(overlay.visible).toBe(false)
    expect(overlay.totalStep).toBe(2)
    expect(overlay.createFigures).toBeUndefined()
    expect(overlay).not.toHaveProperty('runtime')
    expect(overlay.isCompleted()).toBe(true)
  })

  it('recognizes editable flags and event handlers without allowing template replacement', () => {
    const overlay = new Overlay({ name: 'test' }, { id: 'overlay_1', groupId: 'overlay_1', paneId: 'candle' })
    const onClick = vi.fn()
    expect(overlay.shouldUpdate({ lock: true, onClick }).fields).toEqual(['lock', 'onClick'])
    overlay.update({ lock: true, onClick })
    expect(overlay.lock).toBe(true)
    expect(overlay.onClick).toBe(onClick)
  })

  it('applies proposed body-drag points without a chart and owns the submitted data', () => {
    const overlay = new Overlay({ name: 'test', totalStep: 2 }, {
      id: 'overlay_1', groupId: 'overlay_1', paneId: 'candle',
      points: [{ timestamp: 100, value: 10 }, { timestamp: 200, value: 20 }]
    })
    const movedPoints = [{ timestamp: 200, value: 15 }, { timestamp: 300, offset: 1, value: 25 }]
    overlay.onDragMoveBody({
      point: { timestamp: 200, value: 15 }, prevPoint: { timestamp: 100, value: 10 },
      prevPoints: overlay.points, movedPoints
    })
    movedPoints[0].timestamp = 999
    expect(overlay.points).toEqual([{ timestamp: 200, value: 15 }, { timestamp: 300, offset: 1, value: 25 }])
    expect(() => JSON.stringify(overlay)).not.toThrow()
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
        { timestamp: 1, value: 10 },
        { timestamp: 2, value: 20 }
      ]
    })
    const point = { timestamp: 3, value: 30 }

    overlay.onDragMoveControlPoint(point, 1, 'corner_11')

    expect(onControlPointUpdate).toHaveBeenCalledWith(overlay.points, 1, point, 'corner_11')
  })
})
