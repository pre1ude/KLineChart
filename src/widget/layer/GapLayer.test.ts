import { describe, expect, it, vi } from 'vitest'

import { GapLayer } from './GapLayer'

const gapDraw = vi.hoisted(() => vi.fn())
const gapConstruct = vi.hoisted(() => vi.fn())
const gap1Draw = vi.hoisted(() => vi.fn())
const gap1Construct = vi.hoisted(() => vi.fn())

vi.mock('../../view/GapView', () => ({
  default: class GapViewMock {
    constructor(widget: unknown) {
      gapConstruct(widget)
    }

    draw = gapDraw
  }
}))

vi.mock('../../view/Gap1View', () => ({
  default: class Gap1ViewMock {
    constructor(widget: unknown) {
      gap1Construct(widget)
    }

    draw = gap1Draw
  }
}))

describe('GapLayer', () => {
  it('draws Gap then Gap1 on the main canvas and does not define overlay drawing', () => {
    const widget = {} as never
    const ctx = {} as CanvasRenderingContext2D
    const layer = new GapLayer(widget)

    layer.drawMain?.(ctx)

    expect(gapConstruct).toHaveBeenCalledWith(widget)
    expect(gap1Construct).toHaveBeenCalledWith(widget)
    expect(gapDraw).toHaveBeenCalledWith(ctx)
    expect(gap1Draw).toHaveBeenCalledWith(ctx)
    expect(gapDraw.mock.invocationCallOrder[0]).toBeLessThan(gap1Draw.mock.invocationCallOrder[0])
    expect(layer.drawOverlay).toBeUndefined()
  })
})
