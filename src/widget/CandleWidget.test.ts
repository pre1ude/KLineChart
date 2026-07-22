import { beforeEach, describe, expect, it, vi } from 'vitest'

import MainWidget from './MainWidget'
import { CandleWidget } from './CandleWidget'
import {
  CandleLayer,
  CandleTooltipLayer,
  CrosshairLayer,
  GapLayer,
  GridLayer,
  IndicatorLayer,
  OverlayLayer
} from './layer'

vi.mock('./MainWidget', () => ({
  default: vi.fn()
}))

describe('CandleWidget', () => {
  beforeEach(() => {
    vi.mocked(MainWidget).mockClear()
  })

  it('places gap rendering above candles and below indicators and overlays', () => {
    const root = {} as HTMLElement
    const pane = {} as never

    CandleWidget(root, pane)

    expect(MainWidget).toHaveBeenCalledWith(root, pane, [
      GridLayer,
      CandleLayer,
      GapLayer,
      IndicatorLayer,
      OverlayLayer,
      CrosshairLayer,
      CandleTooltipLayer
    ])
  })
})
