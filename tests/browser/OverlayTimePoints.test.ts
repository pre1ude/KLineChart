import { describe, expect, it, vi } from 'vitest'

import { dispose, init, registerOverlay } from '../../src/index'
import type { Point } from '../../src/common/Point'
import type Coordinate from '../../src/common/Coordinate'

const start = Date.UTC(2026, 8, 18, 1, 30)
function data(count: number, first = 0) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: start + (first + i) * 60000,
    open: 10, high: 20, low: 5, close: 15
  }))
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => { requestAnimationFrame(() => { resolve() }) })
}

describe('Overlay time points on a real chart', () => {
  it('picks the actual bar timestamp on sparse time-share data and rejects fractional API input', async () => {
    const container = document.createElement('div')
    container.style.cssText = 'width:800px;height:400px'
    document.body.appendChild(container)
    const chart = init(container, {
      isTimeShare: true,
      timeShareTicks: ['09:30', '09:31', '09:32', '09:33']
    })!
    try {
      const timestamps = [30, 32, 33].map(minute => new Date(2026, 8, 18, 9, minute).getTime())
      await new Promise<void>(resolve => chart.applyNewData(timestamps.map(timestamp => ({
        timestamp, open: 10, high: 20, low: 5, close: 15
      })), false, resolve))
      await nextFrame()
      await nextFrame()

      const coordinate = chart.convertToPixel({ timestamp: timestamps[2], value: 10 }, {})
      const picked = chart.convertFromPixel(coordinate, {})
      expect(picked.timestamp).toBe(timestamps[2])
      expect(picked.offset).toBe(0)
      expect(chart.externalToInternal(picked).logicalIndex).toBe(2)

      const points: Point[] = [{ timestamp: timestamps[0], value: 10 }, { timestamp: picked.timestamp!, value: 15 }]
      const id = chart.createOverlay({ name: 'segment', points })!
      expect(chart.getOverlayById(id)?.points).toEqual(points)
      const invalid = [{ ...points[0], offset: 0.5 }, points[1]]
      expect(chart.createOverlay({ name: 'segment', points: invalid })).toBeUndefined()
      chart.overrideOverlay({ id, visible: false, points: invalid })
      expect(chart.getOverlayById(id)?.visible).toBe(true)
      expect(chart.getOverlayById(id)?.points).toEqual(points)
      await nextFrame()
      await nextFrame()
    } finally {
      dispose(chart)
      container.remove()
    }
  })

  it.each([false, true])('renders preserved anchors after loading and replacement (dataZoom=%s)', async (dataZoom) => {
    const container = document.createElement('div')
    container.style.cssText = 'width:800px;height:400px'
    document.body.appendChild(container)
    let drawn: Coordinate[] = []
    const name = `time_point_test_${dataZoom}`
    registerOverlay({
      name,
      totalStep: 2,
      createFigures({ overlay, coordinates }) {
        expect(overlay.points[0]).toHaveProperty('timestamp')
        expect(overlay.points[0]).not.toHaveProperty('dataIndex')
        drawn = coordinates
        return [{ key: 'line', type: 'line', attrs: { coordinates } }]
      }
    })
    const chart = init(container, { dataZoom })!
    try {
      await new Promise<void>(resolve => chart.applyNewData(data(40), false, resolve))
      const points: Point[] = [
        { timestamp: start + 10 * 60000, value: 10 },
        { timestamp: start + 39 * 60000, offset: 2, value: 15 }
      ]
      const id = chart.createOverlay({ name, points })!
      const overlays = chart.getChartStore().getOverlayStore()
      const overlay = overlays.getInstanceById(id)!
      await vi.waitFor(() => expect(drawn).toHaveLength(2))
      expect(overlays.getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([10, 41])
      expect(JSON.parse(JSON.stringify(overlay)).points).toEqual(points)
      chart.overrideOverlay({ ...overlay, visible: false })
      expect(overlay.visible).toBe(false)
      chart.overrideOverlay({ id, visible: true })
      expect(overlay.visible).toBe(true)

      chart.appendData(data(2, 40), false)
      chart.replaceData(data(42), false)
      chart.prependData(data(2, -2), false)
      expect(overlay.points).toEqual(points)
      expect(overlays.exportOverlay(id)?.points).toEqual(points)
      await vi.waitFor(() => {
        const expected = chart.convertToPixel(points, {})
        expect(drawn[0].x).toBeCloseTo(expected[0].x!, 5)
        expect(drawn[1].x).toBeCloseTo(expected[1].x!, 5)
      })
      expect(overlays.getProjectedPoints(overlay)?.map(point => point.logicalIndex)).toEqual([10, 41])

      chart.replaceData(data(5, 100), false)
      expect(overlays.getProjectedPoints(overlay)).toBeUndefined()
      expect(overlays.exportOverlay(id)?.points).toEqual(points)
      drawn = []
      chart.replaceData(data(42), false)
      await vi.waitFor(() => expect(drawn).toHaveLength(2))
      expect(overlay.points).toEqual(points)
    } finally {
      dispose(chart)
      container.remove()
    }
  })
})
