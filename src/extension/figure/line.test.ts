import { describe, expect, it, vi } from 'vitest'

import { drawLine } from './line'

function createLineContext() {
  return {
    lineWidth: 0,
    strokeStyle: '',
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn()
  }
}

describe('drawLine pixel snap', () => {
  it('snaps vertical two-point lines to the pixel grid', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 2 },
        { x: 10.3, y: 20 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.moveTo).toHaveBeenCalledWith(10.5, 2)
    expect(ctx.lineTo).toHaveBeenCalledWith(10.5, 20)
  })

  it('snaps horizontal two-point lines to the pixel grid', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 0, y: 11.7 },
        { x: 100, y: 11.7 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.moveTo).toHaveBeenCalledWith(0, 12.5)
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 12.5)
  })

  it('snaps even-width lines without half-pixel correction', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.7, y: 2 },
        { x: 10.7, y: 20 }
      ]
    }, { size: 2, color: '#000000' })

    expect(ctx.moveTo).toHaveBeenCalledWith(11, 2)
    expect(ctx.lineTo).toHaveBeenCalledWith(11, 20)
  })

  it('keeps diagonal line coordinates unchanged', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 5.7 },
        { x: 20.6, y: 15.2 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.moveTo).toHaveBeenCalledWith(10.3, 5.7)
    expect(ctx.lineTo).toHaveBeenCalledWith(20.6, 15.2)
  })
})
