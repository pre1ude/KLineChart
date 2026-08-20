import { describe, expect, it } from 'vitest'

import Event from './Event'
import type MainWidget from './widget/MainWidget'

describe('Event tooltip cursor resolution', () => {
  it('uses the current main widget tooltip layer instead of TooltipStore state', () => {
    const event = Object.create(Event.prototype) as Event
    const overlayStore = {
      isDragging: () => false,
      getProgressOverlay: () => undefined,
      getHoverInfo: () => undefined
    }
    Reflect.set(event, '_chart', {
      getChartStore: () => ({ getOverlayStore: () => overlayStore })
    })
    const widget = {
      getPane: () => ({ getId: () => 'candle' }),
      isTooltipIconHovered: () => true
    } as unknown as MainWidget
    const resolveMainCursor = Reflect.get(event, '_resolveMainCursor') as (widget: MainWidget) => string

    expect(resolveMainCursor.call(event, widget)).toBe('pointer')
  })
})
