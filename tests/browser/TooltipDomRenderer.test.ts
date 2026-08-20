import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ActionType, type TooltipIconClickEventData } from '../../src/common/Action'
import {
  CandleTooltipRectPosition,
  getDefaultStyles,
  TooltipIconPosition,
  TooltipShowType
} from '../../src/common/Styles'
import { setScale } from '../../src/common/utils/canvas'
import { dispose, init } from '../../src/index'
import { PaneIdConstants } from '../../src/pane/types'
import TooltipDomRenderer, { type TooltipDomRendererInteractions } from '../../src/view/TooltipDomRenderer'
import type { StandardTooltipBlock, TooltipRenderModel } from '../../src/view/TooltipModel'
import { CandleTooltipLayer } from '../../src/widget/layer/TooltipLayer'

let tooltipStylesheet: HTMLLinkElement

beforeAll(async () => {
  tooltipStylesheet = document.createElement('link')
  tooltipStylesheet.rel = 'stylesheet'
  tooltipStylesheet.href = '/klinechart-tooltip.css'
  const loaded = new Promise<void>((resolve, reject) => {
    tooltipStylesheet.addEventListener('load', () => { resolve() }, { once: true })
    tooltipStylesheet.addEventListener('error', () => { reject(new Error('Unable to load tooltip stylesheet')) }, { once: true })
  })
  document.head.appendChild(tooltipStylesheet)
  await loaded
})

afterAll(() => {
  tooltipStylesheet.remove()
})

describe('TooltipDomRenderer', () => {
  it('leaves structural layout to the public stylesheet', () => {
    const fixture = createFixture()
    const renderer = new TooltipDomRenderer(fixture.widget, fixture.interactions)
    const styles = getDefaultStyles()

    renderer.render(createStandardModel(styles))

    const root = renderer.getElement()
    const block = root.querySelector('[data-klinechart-tooltip-block="standard"]') as HTMLElement
    const legend = root.querySelector('[data-klinechart-tooltip-role="legend"]') as HTMLElement
    expect(root.style.position).toBe('')
    expect(root.style.pointerEvents).toBe('')
    expect(block.style.display).toBe('')
    expect(block.style.flexWrap).toBe('')
    expect(legend.style.whiteSpace).toBe('')
    expect(getComputedStyle(root).position).toBe('absolute')
    expect(getComputedStyle(root).pointerEvents).toBe('none')
    expect(getComputedStyle(block).display).toBe('flex')
    expect(getComputedStyle(block).flexWrap).toBe('wrap')
    expect(getComputedStyle(legend).whiteSpace).toBe('nowrap')
  })

  it('renders stable hooks and reuses standard nodes', () => {
    const fixture = createFixture()
    const renderer = new TooltipDomRenderer(fixture.widget, fixture.interactions)
    const styles = getDefaultStyles()
    const model = createStandardModel(styles)

    renderer.render(model)
    const root = renderer.getElement()
    const legendValue = root.querySelector('[data-klinechart-tooltip-role="value"]')!
    const legendRow = root.querySelector('[data-klinechart-tooltip-role="legend"]')!
    expect(root.classList.contains('klinechart-tooltip')).toBe(true)
    expect(root.dataset.klinechartTooltipKind).toBe('candle')
    expect(root.dataset.klinechartTooltipPaneId).toBe('candle')
    expect(root.getAttribute('role')).toBe('tooltip')
    expect(root.textContent).toContain('Close')
    expect(root.textContent).toContain('100')
    expect(getComputedStyle(legendRow).whiteSpace).toBe('nowrap')
    expect((root.querySelector('[data-klinechart-tooltip-block="standard"]') as HTMLElement).style.maxWidth).toBe('496px')

    const valueNode = root.querySelector('[data-klinechart-tooltip-role="value"]')
    model.blocks[0] = {
      ...model.blocks[0],
      contents: [{ type: 'legends', legends: [{ title: 'Close', value: '101' }], styles: styles.candle.tooltip.text }]
    }
    renderer.render(model)
    expect(root.querySelector('[data-klinechart-tooltip-role="value"]')).toBe(valueNode)
    expect(root.textContent).toContain('101')
    renderer.destroy()
    expect(document.body.contains(root)).toBe(false)
  })

  it('keeps icon controls native and dispatches hover/click actions', () => {
    const fixture = createFixture()
    const renderer = new TooltipDomRenderer(fixture.widget, fixture.interactions)
    const styles = getDefaultStyles()
    const icon = {
      id: 'settings',
      position: TooltipIconPosition.Left,
      color: '#fff',
      activeColor: '#000',
      size: 12,
      fontFamily: 'sans-serif',
      icon: '⚙',
      backgroundColor: 'transparent',
      activeBackgroundColor: '#fff',
      marginLeft: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      paddingLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0
    }
    const model = createStandardModel(styles)
    model.blocks[0] = {
      ...model.blocks[0],
      indicatorId: 'candle',
      contents: [{ type: 'icons', icons: [icon] }]
    }
    renderer.render(model)
    const button = renderer.getElement().querySelector('button') as HTMLButtonElement
    expect(button.type).toBe('button')
    expect(button.dataset.klinechartTooltipRole).toBe('icon')
    const defaultColor = button.style.color
    button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    expect(fixture.interactions.onIconEnter).toHaveBeenCalledWith(expect.objectContaining({ iconId: 'settings' }))
    const hoveredIcon = vi.mocked(fixture.interactions.onIconEnter).mock.calls[0][0]
    renderer.setHoveredIcon(hoveredIcon)
    expect(button.style.color).not.toBe(defaultColor)
    button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }))
    expect(fixture.interactions.onIconLeave).toHaveBeenCalledWith(hoveredIcon)
    renderer.setHoveredIcon(null)
    expect(button.style.color).toBe(defaultColor)
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    button.dispatchEvent(new Event('touchstart', { bubbles: true }))
    expect(fixture.gestureCount.value).toBe(0)
    button.click()
    expect(fixture.interactions.onIconClick).toHaveBeenCalledWith(expect.objectContaining({ iconId: 'settings' }))
  })

  it('removes native listeners when an icon node is discarded', () => {
    const fixture = createFixture()
    const renderer = new TooltipDomRenderer(fixture.widget, fixture.interactions)
    const styles = getDefaultStyles()
    const model = createIconModel(styles, PaneIdConstants.CANDLE, 'ma')

    renderer.render(model)
    const detachedButton = renderer.getElement().querySelector('button') as HTMLButtonElement
    model.blocks[0] = {
      ...model.blocks[0],
      contents: [{ type: 'legends', legends: [{ title: 'Close', value: '100' }], styles: styles.candle.tooltip.text }]
    }
    renderer.render(model)

    detachedButton.dispatchEvent(new MouseEvent('mouseenter'))
    expect(fixture.interactions.onIconEnter).not.toHaveBeenCalled()
  })

  it('keeps hover styling isolated when another pane renderer hides', () => {
    const styles = getDefaultStyles()
    const first = createFixture('candle')
    const second = createFixture('volume')
    const firstRenderer = new TooltipDomRenderer(first.widget, first.interactions)
    const secondRenderer = new TooltipDomRenderer(second.widget, second.interactions)
    const firstModel = createIconModel(styles, 'candle', 'ma')
    const secondModel = createIconModel(styles, 'volume', 'vol')

    firstRenderer.render(firstModel)
    secondRenderer.render(secondModel)
    const firstButton = firstRenderer.getElement().querySelector('button') as HTMLButtonElement
    const defaultColor = firstButton.style.color
    const firstIcon: TooltipIconClickEventData = {
      paneId: 'candle',
      indicatorId: 'ma',
      indicatorName: 'MA',
      iconId: 'settings'
    }
    firstRenderer.setHoveredIcon(firstIcon)
    expect(firstButton.style.color).not.toBe(defaultColor)

    secondRenderer.hide()

    expect(firstButton.style.color).not.toBe(defaultColor)
  })

  it('keeps the renderer selected at layer construction and reuses one DOM root', () => {
    const styles = getDefaultStyles()
    const model = createIconModel(styles, PaneIdConstants.CANDLE, 'ma')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const chartStore = {
      getTooltipStore: () => ({ getRenderType: () => 'dom' as const }),
      getActionStore: () => ({ execute: vi.fn() })
    }
    const chart = {
      getChartStore: () => chartStore,
      updatePane: vi.fn()
    }
    const pane = {
      getId: () => PaneIdConstants.CANDLE,
      getChart: () => chart
    }
    const widget = {
      getPane: () => pane,
      getContainer: () => container,
      addChild: vi.fn()
    }
    const layer = new CandleTooltipLayer(widget as never)
    const drawModel = vi.fn()
    Reflect.set(layer, '_tooltipView', {
      buildRenderModel: () => model,
      clear: vi.fn(),
      drawModel,
      setHasHoverIcon: vi.fn()
    })
    const ctx = {} as CanvasRenderingContext2D

    layer.drawOverlay(ctx)
    const button = container.querySelector('button') as HTMLButtonElement
    button.dispatchEvent(new MouseEvent('mouseenter'))
    expect(layer.isTooltipIconHovered()).toBe(true)

    layer.drawOverlay(ctx)
    expect(layer.isTooltipIconHovered()).toBe(true)
    expect(container.querySelectorAll('.klinechart-tooltip')).toHaveLength(1)
    expect(drawModel).not.toHaveBeenCalled()
  })

  it('positions rect blocks with CSS structure and dynamic inline values without measuring layout', () => {
    const fixture = createFixture()
    const renderer = new TooltipDomRenderer(fixture.widget, fixture.interactions)
    const styles = getDefaultStyles()
    styles.candle.tooltip.rect.position = CandleTooltipRectPosition.Pointer
    const model: TooltipRenderModel = {
      visible: true,
      paneId: 'candle',
      bounding: { width: 600, height: 400, left: 0, top: 0 },
      blocks: [{
        type: 'rect',
        top: 10,
        bounding: { width: 600, height: 400, left: 0, top: 0 },
        yLeftAxisWidth: 20,
        yRightAxisWidth: 20,
        crosshair: { paneId: 'candle', realX: 300, y: 100 },
        styles,
        drawCandle: true,
        drawIndicator: false,
        candleLegends: [{ title: 'Close', value: '100' }],
        indicatorLegends: []
      }]
    }

    renderer.render(model)
    const rect = renderer.getElement().querySelector('[data-klinechart-tooltip-role="rect"]') as HTMLElement
    const row = rect.firstElementChild as HTMLElement
    const value = rect.querySelector('[data-klinechart-tooltip-role="value"]') as HTMLElement
    expect(rect.style.position).toBe('')
    expect(getComputedStyle(rect).position).toBe('absolute')
    expect(row.style.display).toBe('')
    expect(getComputedStyle(row).display).toBe('grid')
    expect(getComputedStyle(value).textAlign).toBe('right')
    expect(rect.style.height).toMatch(/px$/)
    expect(rect.style.top).toMatch(/px$/)
    expect(rect.style.backgroundColor).not.toBe('')
    expect(row.style.marginLeft).toBe(`${styles.candle.tooltip.text.marginLeft}px`)
    expect(row.style.marginRight).toBe(`${styles.candle.tooltip.text.marginRight}px`)
  })

  it('centers a mixed pointer rect in pane-local coordinates', async () => {
    const fixture = createFixture()
    const renderer = new TooltipDomRenderer(fixture.widget, fixture.interactions)
    const styles = getDefaultStyles()
    styles.candle.tooltip.rect.position = CandleTooltipRectPosition.Pointer
    const model = createStandardModel(styles)
    model.blocks.push({
      type: 'rect',
      top: styles.candle.tooltip.offsetTop,
      bounding: { width: 600, height: 400, left: 0, top: 0 },
      yLeftAxisWidth: 20,
      yRightAxisWidth: 20,
      crosshair: { paneId: PaneIdConstants.CANDLE, realX: 300, y: 200 },
      styles,
      drawCandle: true,
      drawIndicator: false,
      candleLegends: [{ title: 'Close', value: '100' }],
      indicatorLegends: []
    })

    renderer.render(model)
    await nextFrame()
    await nextFrame()

    const root = renderer.getElement()
    const rect = root.querySelector('[data-klinechart-tooltip-role="rect"]') as HTMLElement
    const actualTop = rect.getBoundingClientRect().top - root.getBoundingClientRect().top
    const expectedTop = 200 - rect.getBoundingClientRect().height / 2
    expect(actualTop).toBeCloseTo(expectedTop, 1)
  })

  it('keeps long legends bounded and preserves custom font styles at edge positions', () => {
    const fixture = createFixture()
    const renderer = new TooltipDomRenderer(fixture.widget, fixture.interactions)
    const styles = getDefaultStyles()
    styles.candle.tooltip.text.fontFamily = 'Courier New, monospace'
    styles.candle.tooltip.text.size = 16
    const model = createStandardModel(styles)
    model.blocks[0] = {
      ...model.blocks[0],
      top: 0,
      maxWidth: 180,
      contents: [{
        type: 'legends',
        legends: [
          { title: 'FIRST', value: 'A very long first value' },
          { title: 'LAST', value: 'A very long last value' }
        ],
        styles: styles.candle.tooltip.text
      }]
    }

    renderer.render(model)

    const block = renderer.getElement().querySelector('[data-klinechart-tooltip-block="standard"]') as HTMLElement
    const legend = renderer.getElement().querySelector('[data-klinechart-tooltip-role="legend"]') as HTMLElement
    expect(block.style.maxWidth).toBe(`${180 - styles.candle.tooltip.offsetLeft}px`)
    expect(getComputedStyle(legend).fontFamily.toLowerCase()).toContain('courier')
    expect(getComputedStyle(legend).fontSize).toBe('16px')
    expect(renderer.getElement().textContent).toContain('FIRST')
    expect(renderer.getElement().textContent).toContain('LAST')
  })

  it('includes the committed DOM tooltip in export without rebuilding formatter data', async () => {
    const container = document.createElement('div')
    container.style.width = '600px'
    container.style.height = '400px'
    document.body.appendChild(container)
    const formatter = vi.fn(() => [{ title: 'Close', value: '{close}' }])
    const chart = init(container, {
      tooltip: { renderType: 'dom' },
      styles: {
        candle: {
          tooltip: {
            showType: TooltipShowType.Standard,
            custom: formatter
          }
        }
      }
    })
    const data = [{ timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }]
    await new Promise<void>(resolve => chart.applyNewData(data, true, resolve))
    chart.executeAction(ActionType.OnCrosshairChange, {
      x: 300,
      y: 100,
      paneId: PaneIdConstants.CANDLE
    })
    await nextFrame()
    await nextFrame()

    const callsBeforeExport = formatter.mock.calls.length
    const baseUrl = chart.getConvertPictureUrl(false)
    const overlayUrl = chart.getConvertPictureUrl(true)

    expect(formatter).toHaveBeenCalled()
    expect(formatter.mock.calls.length).toBe(callsBeforeExport)
    expect(overlayUrl).not.toBe(baseUrl)
    expect(container.querySelectorAll('.klinechart-tooltip')).toHaveLength(1)

    dispose(chart)
    container.remove()
  })

  it('keeps Canvas export sharp when the chart is rendered at a high scale', async () => {
    const container = document.createElement('div')
    container.style.width = '600px'
    container.style.height = '400px'
    container.style.transform = 'scale(2)'
    container.style.transformOrigin = 'top left'
    document.body.appendChild(container)
    const chart = init(container, { tooltip: { renderType: 'dom' } })

    try {
      await new Promise<void>(resolve => chart.applyNewData([
        { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }
      ], true, resolve))
      chart.executeAction(ActionType.OnCrosshairChange, {
        x: 300,
        y: 100,
        paneId: PaneIdConstants.CANDLE
      })
      await nextFrame()
      await nextFrame()

      const canvas = container.querySelector('canvas') as HTMLCanvasElement
      expect(canvas.width).toBeGreaterThan(canvas.clientWidth)
      expect(chart.getConvertPictureUrl(true)).toMatch(/^data:image\/png;base64,/)
    } finally {
      dispose(chart)
      container.remove()
      setScale(1)
    }
  })
})

function createFixture(paneId = PaneIdConstants.CANDLE): {
  widget: never
  interactions: TooltipDomRendererInteractions
  gestureCount: { value: number }
} {
  const gestureCount = { value: 0 }
  const interactions: TooltipDomRendererInteractions = {
    onIconEnter: vi.fn(),
    onIconLeave: vi.fn(),
    onIconClick: vi.fn()
  }
  const container = document.createElement('div')
  container.style.position = 'relative'
  container.style.width = '600px'
  container.style.height = '400px'
  document.body.appendChild(container)
  container.addEventListener('mousedown', () => { gestureCount.value += 1 })
  container.addEventListener('touchstart', () => { gestureCount.value += 1 })
  const pane = { getId: () => paneId }
  const widget = {
    getPane: () => pane,
    getContainer: () => container
  }
  return { widget: widget as never, interactions, gestureCount }
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => { resolve() }))
}

function createIconModel(
  styles: ReturnType<typeof getDefaultStyles>,
  paneId: string,
  indicatorId: string
): StandardTooltipRenderModel {
  const model = createStandardModel(styles)
  model.paneId = paneId
  model.blocks[0] = {
    ...model.blocks[0],
    paneId,
    indicatorId,
    indicatorName: indicatorId.toUpperCase(),
    contents: [{
      type: 'icons',
      icons: [{
        id: 'settings',
        position: TooltipIconPosition.Left,
        color: '#fff',
        activeColor: '#000',
        size: 12,
        fontFamily: 'sans-serif',
        icon: '⚙',
        backgroundColor: 'transparent',
        activeBackgroundColor: '#fff',
        marginLeft: 0,
        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        paddingLeft: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0
      }]
    }]
  }
  return model
}

type StandardTooltipRenderModel = Omit<TooltipRenderModel, 'blocks'> & {
  blocks: [StandardTooltipBlock, ...TooltipRenderModel['blocks']]
}

function createStandardModel(styles: ReturnType<typeof getDefaultStyles>): StandardTooltipRenderModel {
  const tooltipStyles = styles.candle.tooltip
  return {
    visible: true,
    paneId: 'candle',
    bounding: { width: 600, height: 400, left: 0, top: 0 },
    blocks: [{
      type: 'standard',
      paneId: 'candle',
      indicatorId: '',
      indicatorName: '',
      left: tooltipStyles.offsetLeft,
      top: tooltipStyles.offsetTop,
      maxWidth: 500,
      styles: tooltipStyles,
      contents: [{
        type: 'legends',
        legends: [{ title: 'Close', value: '100' }],
        styles: tooltipStyles.text
      }]
    }]
  }
}
