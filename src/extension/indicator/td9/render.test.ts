import { describe, expect, it, vi } from 'vitest'

import type KLineData from '../../../common/KLineData'
import type { Indicator } from '../../../component/Indicator'
import { drawStaticFigure } from '../../figure'
import td9 from './index'
import type { TD9BarOutput } from './types'

vi.mock('../../figure', () => ({
  drawStaticFigure: vi.fn()
}))

function makeBar(index: number): KLineData {
  return {
    timestamp: index,
    open: 10,
    high: 11,
    low: 9,
    close: 10
  }
}

describe('TD9 rendering', () => {
  it('dims counts 1-8 and renders a perfected 9 at 24px without an appended marker', () => {
    const result: TD9BarOutput[] = [
      {
        barIndex: 0,
        timestamp: 0,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction: 'BUY', value: 8 }
      },
      {
        barIndex: 1,
        timestamp: 1,
        provisional: false,
        setupMark: { setupId: 'setup-1', direction: 'BUY', value: 9, perfected: true }
      },
      {
        barIndex: 2,
        timestamp: 2,
        provisional: true,
        setupMark: { setupId: 'setup-2', direction: 'SELL', value: 7 }
      }
    ]
    const alphaStack: number[] = []
    const opacities: number[] = []
    const ctx = {
      globalAlpha: 1,
      save: vi.fn(() => { alphaStack.push(ctx.globalAlpha) }),
      restore: vi.fn(() => { ctx.globalAlpha = alphaStack.pop() ?? 1 })
    } as unknown as CanvasRenderingContext2D
    vi.mocked(drawStaticFigure).mockImplementation(ctx => {
      opacities.push(ctx.globalAlpha)
    })

    td9.draw?.({
      ctx,
      kLineDataList: [makeBar(0), makeBar(1), makeBar(2)],
      indicator: { result, extendData: undefined } as Indicator<TD9BarOutput>,
      visibleRange: { from: 0, to: 2 },
      xAxis: { convertToPixel: (value: number) => value },
      yScale: { convertToPixel: (value: number) => value }
    } as never)

    expect(vi.mocked(drawStaticFigure).mock.calls).toHaveLength(3)
    expect(vi.mocked(drawStaticFigure).mock.calls[0][2]).toMatchObject({
      attrs: { text: '8' },
      styles: { size: 10 }
    })
    expect(vi.mocked(drawStaticFigure).mock.calls[1][2]).toMatchObject({
      attrs: { text: '9' },
      styles: { size: 24 }
    })
    expect(opacities.slice(0, 2)).toEqual([0.6, 1])
    expect(opacities[2]).toBeCloseTo(0.48)
  })
})
