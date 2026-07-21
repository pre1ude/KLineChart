import { describe, expect, it, vi } from 'vitest'

import { PolygonType } from '../../common/Styles'
import { drawRect } from './rect'

function createRectContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    rect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    setLineDash: vi.fn()
  }
}

describe('drawRect', () => {
  it('retains the border of a stroke-fill rectangle at very small heights', () => {
    const ctx = createRectContext()

    drawRect(ctx as unknown as CanvasRenderingContext2D, {
      x: 10,
      y: 20,
      width: 20,
      height: 1
    }, {
      style: PolygonType.StrokeFill,
      color: 'rgba(255, 0, 0, 0.15)',
      borderColor: 'red',
      borderSize: 1
    })

    expect(ctx.fill).toHaveBeenCalledTimes(1)
    expect(ctx.rect).toHaveBeenNthCalledWith(2, 10.5, 20.5, 19, 0, 0)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })
})
