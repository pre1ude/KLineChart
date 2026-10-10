import { expect, it, vi } from 'vitest'
import { init, dispose, ActionType, registerIndicator, registerOverlay } from '../../src/index'

const data = Array.from({ length: 100 }, (_, i) => ({ timestamp: 1000000 + i * 60000, open: 10, high: 20, low: 5, close: 15 }))
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
function mount() {
  const element = document.createElement('div')
  element.style.cssText = 'width:900px;height:450px'
  document.body.appendChild(element)
  const chart = init(element)
  chart.applyNewData(data.map(bar => ({ ...bar })), false)
  return { element, chart }
}
function click(element: HTMLElement) {
  const bounds = element.getBoundingClientRect()
  const x = bounds.left + 300, y = bounds.top + 180
  const target = document.elementFromPoint(x, y)!
  for (const type of ['mouseenter', 'mousemove', 'mousedown', 'mouseup']) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, view: window })
    Object.defineProperty(event, 'sourceCapabilities', { value: { firesTouchEvents: false } })
    target.dispatchEvent(event)
  }
}

it('includes drawing while data, indicators, coordinates and crosshair work', async () => {
  const { chart, element } = mount()
  try {
    expect(typeof chart.createOverlay).toBe('function')
    expect(chart.getChartStore().getOverlayStore()).toBeDefined()
    const crosshair = vi.fn()
    chart.subscribeAction(ActionType.OnCrosshairChange, crosshair)
    const pixel = chart.convertToPixel({ timestamp: data[90].timestamp, value: 12 }, {})
    expect(chart.convertFromPixel(pixel, {}).timestamp).toBe(data[90].timestamp)
    chart.getChartStore().getTooltipStore().setCrosshair({ x: pixel.x, y: pixel.y, paneId: 'candle_pane' })
    expect(crosshair).toHaveBeenCalled()
    chart.createIndicator('MA', true, { id: 'candle_pane' })
    await vi.waitFor(() => expect(chart.getChartStore().getIndicatorStore().getIndicatorsByFilter({ name: 'MA' })[0].result).toHaveLength(data.length))
    chart.setBarSpace(10)
    expect(chart.getBarSpace()).toBe(10)
    chart.scrollByBar(2)
    chart.updateData({ ...data[99], close: 16 })
    expect(chart.getDataList()[99].close).toBe(16)
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('keeps click state consistent when a point observer removes its drawing', async () => {
  const { chart, element } = mount()
  const late = vi.fn()
  const states: boolean[] = []
  try {
    const create = {
      id: 'remove-on-points', name: 'horizontalStraightLine',
      onDrawStart: late, onDrawEnd: late,
      onPointsChange: () => {
        // Mouse movement previews a point before the click completes the drawing.
        if (!chart.getOverlayById('remove-on-points')!.isCompleted()) return
        states.push(chart.getOverlayById('remove-on-points')!.isCompleted())
        chart.removeOverlay('remove-on-points')
      }
    }
    chart.createOverlay(create)
    await nextFrame()
    click(element)
    expect(states).toEqual([true])
    expect(chart.getOverlayById(create.id)).toBeUndefined()
    expect(chart.getChartStore().getOverlayStore().getSelectedInfo()).toBeUndefined()
    expect(chart.getChartStore().getOverlayStore().isPressed()).toBe(false)
    expect(late).not.toHaveBeenCalled()
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('completes indicator creation after a newer tick calculation', async () => {
  const { chart, element } = mount()
  const pending: Array<(result: Array<{ value: number }>) => void> = []
  registerIndicator({ name: 'browser-creation-tick', calc: () => new Promise<Array<{ value: number }>>(resolve => pending.push(resolve)), figures: [{ key: 'value', type: 'line' }] })
  const done = vi.fn()
  try {
    chart.createIndicator({ name: 'browser-creation-tick', id: 'creation' }, false, {}, done)
    chart.updateData({ ...data[99], close: 16 })
    pending[1](data.map(() => ({ value: 16 })))
    await vi.waitFor(() => expect(done).toHaveBeenCalledOnce())
    pending[0](data.map(() => ({ value: 15 })))
    await nextFrame()
    expect(done).toHaveBeenCalledOnce()
    expect(chart.getIndicators({ id: 'creation' })[0].result[99]).toEqual({ value: 16 })
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('attaches drawing to future panes and axes and releases removed surfaces', async () => {
  const { chart, element } = mount()
  const mainDraws = vi.fn(), xDraws = vi.fn(), yDraws = vi.fn()
  registerOverlay({ name: 'host-surface-check', totalStep: 1,
    createFigures: ({ coordinates }) => { mainDraws(); return [{ type: 'circle', attrs: { x: coordinates[0].x, y: coordinates[0].y, r: 4 } }] },
    createXAxisFigures: () => { xDraws(); return [] },
    createYAxisFigures: () => { yDraws(); return [] }
  })
  registerIndicator({ name: 'host-pane-check', calc: bars => bars.map(() => ({ value: 10 })), figures: [{ key: 'value', type: 'line' }] })
  try {
    const drawing = chart
    const paneId = chart.createIndicator('host-pane-check')!
    await nextFrame()
    drawing.createOverlay({ name: 'host-surface-check', paneId, points: [{ timestamp: data[90].timestamp, value: 10 }] })
    await vi.waitFor(() => expect(mainDraws).toHaveBeenCalled())
    expect(xDraws).toHaveBeenCalled()
    expect(yDraws).toHaveBeenCalled()
    chart.removeIndicator(paneId, 'host-pane-check')
    await nextFrame()
    mainDraws.mockClear()
    yDraws.mockClear()
    chart.setBarSpace(8)
    await nextFrame()
    expect(mainDraws).not.toHaveBeenCalled()
    expect(yDraws).not.toHaveBeenCalled()
  } finally { dispose(chart); element.remove() }
})

it('reuses the built-in chart for a container and can recreate it after disposal', () => {
  const { chart, element } = mount()
  expect(init(element)).toBe(chart)
  dispose(element)
  const next = init(element)
  expect(next).not.toBe(chart)
  expect(typeof next.createOverlay).toBe('function')
  expect(init(element)).toBe(next)
  dispose(element)
  element.remove()
})

it('preserves full-entry drawing APIs and built-in template registration', async () => {
  const element = document.createElement('div')
  element.style.cssText = 'width:900px;height:450px'
  document.body.appendChild(element)
  const chart = init(element)
  try {
    chart.applyNewData(data.map(bar => ({ ...bar })), false)
    const points = [{ timestamp: data[90].timestamp, value: 10 }, { timestamp: data[95].timestamp, value: 15 }]
    const names = ['segment', 'rect', 'textLog']
    const ids = chart.createOverlay(names.map(name => ({ name, points, groupId: 'built-ins' })))
    ids.forEach((id, index) => {
      expect(id).toBeDefined()
      expect(chart.getOverlayById(id!)?.name).toBe(names[index])
      expect(chart.getOverlayById(id!)?.isCompleted()).toBe(true)
    })
    const updatedPoints = points.map(point => ({ ...point, value: point.value + 1 }))
    chart.overrideOverlay({ id: ids[0], points: updatedPoints, visible: false })
    expect(chart.getOverlayById(ids[0]!)?.points).toEqual(updatedPoints)
    expect(chart.getOverlayById(ids[0]!)?.visible).toBe(false)
    chart.removeOverlay(ids[0]!)
    expect(chart.getOverlayById(ids[0]!)).toBeUndefined()
    const draft = chart.createOverlay({ name: 'segment', points: [points[0]] })!
    expect(chart.getOverlayById(draft)?.isDrawing()).toBe(true)
    chart.resetOverlay(draft)
    expect(chart.getOverlayById(draft)?.points).toEqual([])
    expect(chart.getOverlayById(draft)?.isCreated()).toBe(true)
    chart.removeOverlay(draft)
    chart.removeOverlay({ groupId: 'built-ins' })
    expect(chart.getOverlayById(draft)).toBeUndefined()
    ids.forEach(id => expect(chart.getOverlayById(id!)).toBeUndefined())
    await nextFrame()
  } finally { dispose(chart); element.remove() }
})

it.each([false, true])('keeps indicator creation alive through setOptions({ isTimeShare: %s })', async isTimeShare => {
  const { chart, element } = mount()
  let finish!: (result: Array<{ value: number }>) => void
  const calc = vi.fn(() => new Promise<Array<{ value: number }>>(resolve => { finish = resolve }))
  const name = `browser-creation-mode-${isTimeShare}`
  registerIndicator({ name, calc, figures: [{ key: 'value', type: 'line' }] })
  const done = vi.fn()
  try {
    chart.createIndicator({ name, id: 'creation' }, false, {}, done)
    chart.setOptions({ isTimeShare, timeShareTicks: data.map(bar => new Date(bar.timestamp).toISOString().slice(11, 16)) })
    finish(data.map(() => ({ value: 15 })))
    await vi.waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(calc).toHaveBeenCalledOnce()
    expect(chart.getIndicators({ id: 'creation' })[0].result).toEqual(data.map(() => ({ value: 15 })))
  } finally { dispose(chart); element.remove() }
  await nextFrame()
})

it('notifies all drawing removals when an earlier observer reloads the real chart', async () => {
  const { chart, element } = mount()
  const removed: string[] = []
  try {
    chart.createOverlay(['first', 'second'].map(id => ({ id, name: 'horizontalStraightLine', points: [{ timestamp: data[90].timestamp, value: 12 }], onRemoved() {
      removed.push(id)
      if (id === 'first') chart.applyNewData(data.map(bar => ({ ...bar })), false)
    } })))
    chart.removeOverlay()
    expect(removed).toEqual(['first', 'second'])
    expect(chart.getOverlays()).toEqual([])
    await nextFrame()
  } finally { dispose(chart); element.remove() }
})
