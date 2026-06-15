import { describe, expect, it, vi } from 'vitest'

import { drawLine } from './line'

function createLineContext() {
  return {
    canvas: {
      width: 100,
      clientWidth: 100
    },
    lineWidth: 0,
    lineJoin: '',
    strokeStyle: '',
    setLineDash: vi.fn(),
    getTransform: vi.fn(() => ({ a: 1 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
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

    expect(ctx.moveTo).toHaveBeenCalledWith(0, 11.5)
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 11.5)
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

  it('uses nearest stroke pixel center for odd-width lines', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.7, y: 2 },
        { x: 10.7, y: 20 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.moveTo).toHaveBeenCalledWith(10.5, 2)
    expect(ctx.lineTo).toHaveBeenCalledWith(10.5, 20)
  })

  it('snaps axis-aligned coordinates by canvas pixel ratio', () => {
    const ctx = createLineContext()
    ctx.getTransform.mockReturnValue({ a: 2 })

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 2 },
        { x: 10.3, y: 20 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.lineWidth).toBe(1)
    expect(ctx.moveTo).toHaveBeenCalledWith(10.5, 2)
    expect(ctx.lineTo).toHaveBeenCalledWith(10.5, 20)
  })

  it('keeps configured line width when snapping axis-aligned lines', () => {
    const ctx = createLineContext()
    ctx.getTransform.mockReturnValue({ a: 2 })

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 2 },
        { x: 10.3, y: 20 }
      ]
    }, { size: 1.25, color: '#000000' })

    expect(ctx.lineWidth).toBe(1.25)
  })

  it('keeps one physical pixel lines crisp on high-DPR canvas', () => {
    const ctx = createLineContext()
    ctx.getTransform.mockReturnValue({ a: 2 })

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 2 },
        { x: 10.3, y: 20 }
      ]
    }, { size: 0.5, color: '#000000' })

    expect(ctx.lineWidth).toBe(0.5)
    expect(ctx.moveTo).toHaveBeenCalledWith(10.25, 2)
    expect(ctx.lineTo).toHaveBeenCalledWith(10.25, 20)
  })

  it('uses bevel joins by default to avoid dark joints on polylines', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 5.7 },
        { x: 20.6, y: 15.2 },
        { x: 30.1, y: 11.8 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.lineJoin).toBe('bevel')
  })

  it('keeps explicit lineJoin overrides', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 5.7 },
        { x: 20.6, y: 15.2 }
      ]
    }, { size: 1, color: '#000000', lineJoin: 'miter' })

    expect(ctx.lineJoin).toBe('miter')
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

  it('can disable pixel snap for axis-aligned two-point lines', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 2 },
        { x: 10.3, y: 20 }
      ]
    }, { size: 1, color: '#000000', pixelSnap: false })

    expect(ctx.moveTo).toHaveBeenCalledWith(10.3, 2)
    expect(ctx.lineTo).toHaveBeenCalledWith(10.3, 20)
  })

  it('keeps multi-point polylines unchanged when pixelSnap is configured', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 10.3, y: 5.7 },
        { x: 20.6, y: 25.2 },
        { x: 30.1, y: 11.8 }
      ]
    }, { size: 1, color: '#000000', pixelSnap: 'y' })

    expect(ctx.moveTo).toHaveBeenCalledWith(10.3, 5.7)
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 20.6, 25.2)
    expect(ctx.lineTo).toHaveBeenNthCalledWith(2, 30.1, 11.8)
  })

  it('skips visually redundant straight-line data points when drawing polylines', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 0, y: 10 },
        { x: 10, y: 10.2 },
        { x: 20, y: 10.4 },
        { x: 30, y: 10.6 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.moveTo).toHaveBeenCalledWith(0, 10)
    expect(ctx.lineTo).toHaveBeenCalledTimes(1)
    expect(ctx.lineTo).toHaveBeenCalledWith(30, 10.6)
  })

  it('keeps visible bends when simplifying polyline data points', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 0, y: 10 },
        { x: 10, y: 12 },
        { x: 20, y: 10 }
      ]
    }, { size: 1, color: '#000000' })

    expect(ctx.moveTo).toHaveBeenCalledWith(0, 10)
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 10, 12)
    expect(ctx.lineTo).toHaveBeenNthCalledWith(2, 20, 10)
  })

  it('does not simplify smooth lines', () => {
    const ctx = createLineContext()

    drawLine(ctx as unknown as CanvasRenderingContext2D, {
      coordinates: [
        { x: 0, y: 10 },
        { x: 10, y: 10.2 },
        { x: 20, y: 10.4 },
        { x: 30, y: 10.6 }
      ]
    }, { size: 1, color: '#000000', smooth: true })

    expect(ctx.lineTo).not.toHaveBeenCalled()
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(3)
  })
})
