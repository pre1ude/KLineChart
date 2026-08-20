import { describe, expect, it, vi } from 'vitest'

import { ActionType, type TooltipIconClickEventData } from '../../common/Action'
import type { TooltipIconIdentity } from '../../common/Tooltip'
import { UpdateLevel } from '../../common/Updater'
import { CandleTooltipLayer } from './TooltipLayer'

describe('TooltipLayer interaction state', () => {
  it('owns hovered icon state locally and invalidates only its pane', () => {
    const fixture = createFixture('candle')
    const icon = createIcon('candle', 'ma')

    setHoveredIcon(fixture.layer, icon)

    expect(fixture.layer.isTooltipIconHovered()).toBe(true)
    expect(fixture.updatePane).toHaveBeenCalledWith(UpdateLevel.Overlay, 'candle')

    setHoveredIcon(fixture.layer, null)

    expect(fixture.layer.isTooltipIconHovered()).toBe(false)
  })

  it('does not clear another pane when its own hover is cleared', () => {
    const candle = createFixture('candle')
    const volume = createFixture('volume')
    setHoveredIcon(candle.layer, createIcon('candle', 'ma'), false)
    setHoveredIcon(volume.layer, createIcon('volume', 'vol'), false)

    setHoveredIcon(volume.layer, null, false)

    expect(candle.layer.isTooltipIconHovered()).toBe(true)
    expect(volume.layer.isTooltipIconHovered()).toBe(false)
  })

  it('dispatches the unchanged tooltip icon click payload', () => {
    const fixture = createFixture('candle')
    const icon = createIcon('candle', 'ma')
    const executeIconClick = Reflect.get(fixture.layer, '_executeIconClick') as (icon: TooltipIconClickEventData) => void

    executeIconClick.call(fixture.layer, icon)

    expect(fixture.execute).toHaveBeenCalledWith(ActionType.OnTooltipIconClick, icon)
  })
})

function createFixture(paneId: string): {
  layer: CandleTooltipLayer
  execute: ReturnType<typeof vi.fn>
  updatePane: ReturnType<typeof vi.fn>
} {
  const execute = vi.fn()
  const updatePane = vi.fn()
  const chartStore = {
    getActionStore: () => ({ execute }),
    getTooltipStore: () => ({ getRenderType: () => 'canvas' as const })
  }
  const chart = {
    getChartStore: () => chartStore,
    updatePane
  }
  const pane = {
    getId: () => paneId,
    getChart: () => chart
  }
  const widget = {
    getPane: () => pane,
    addChild: vi.fn()
  }
  return {
    layer: new CandleTooltipLayer(widget as never),
    execute,
    updatePane
  }
}

function createIcon(paneId: string, indicatorId: string): TooltipIconClickEventData {
  return {
    paneId,
    indicatorId,
    indicatorName: indicatorId.toUpperCase(),
    iconId: 'settings'
  }
}

function setHoveredIcon(
  layer: CandleTooltipLayer,
  icon: TooltipIconIdentity | null,
  invalidateCanvas = true
): void {
  const setHovered = Reflect.get(layer, '_setHoveredIcon') as (
    icon: TooltipIconIdentity | null,
    invalidateCanvas?: boolean
  ) => void
  setHovered.call(layer, icon, invalidateCanvas)
}
