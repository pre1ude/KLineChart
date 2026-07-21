import { describe, expect, it, vi } from 'vitest'

import { GapLayer } from './GapLayer'

const draw = vi.hoisted(() => vi.fn())
const construct = vi.hoisted(() => vi.fn())

vi.mock('../../view/GapView', () => ({
  default: class GapViewMock {
    constructor(widget: unknown) {
      construct(widget)
    }

    draw = draw
  }
}))

describe('GapLayer', () => {
  it('draws gaps on the main canvas and does not define overlay drawing', () => {
    const widget = {} as never
    const ctx = {} as CanvasRenderingContext2D
    const layer = new GapLayer(widget)

    layer.drawMain?.(ctx)

    expect(construct).toHaveBeenCalledWith(widget)
    expect(draw).toHaveBeenCalledWith(ctx)
    expect(layer.drawOverlay).toBeUndefined()
  })
})
