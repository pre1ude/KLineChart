import { describe, expect, it } from 'vitest'

import MainWidget from './MainWidget'

describe('MainWidget tooltip interaction', () => {
  it('reports pane-local tooltip hover from its layers', () => {
    const widget = Object.create(MainWidget.prototype) as MainWidget
    Reflect.set(widget, '_layers', [
      { name: 'grid' },
      { name: 'tooltip', isTooltipIconHovered: () => true }
    ])

    expect(widget.isTooltipIconHovered()).toBe(true)
  })

  it('reports no tooltip hover when no layer owns one', () => {
    const widget = Object.create(MainWidget.prototype) as MainWidget
    Reflect.set(widget, '_layers', [
      { name: 'grid' },
      { name: 'tooltip', isTooltipIconHovered: () => false }
    ])

    expect(widget.isTooltipIconHovered()).toBe(false)
  })
})
