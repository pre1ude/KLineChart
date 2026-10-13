import { expect, it } from 'vitest'
import { dispose, init, DomPosition } from '../../src/index'

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
const data = Array.from({ length: 25 }, (_, i) => ({ timestamp: 1000000 + i * 60000, open: 10, high: 25, low: 5, close: 20 }))

function send(target: Element, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0, view: window })
  Object.defineProperty(event, 'sourceCapabilities', { value: { firesTouchEvents: false } })
  target.dispatchEvent(event)
}

it.each([
  ['rect', 'horizontal line', [[6, 16], [14, 16]], [10, 16]],
  ['rect', 'vertical line', [[10, 12], [10, 20]], [10, 16]],
  ['rect', 'point', [[10, 16], [10, 16]], [10, 16]],
  ['circle', 'point', [[10, 16], [10, 16]], [10, 16]],
  ['ellipse', 'horizontal line', [[10, 16], [14, 16]], [10, 16]],
  ['ellipse', 'vertical line', [[10, 16], [10, 20]], [10, 16]],
  ['ellipse', 'point', [[10, 16], [10, 16]], [10, 16]],
  ['triangle', 'line', [[6, 16], [10, 16], [14, 16]], [8, 16]],
  ['triangle', 'point', [[10, 16], [10, 16], [10, 16]], [10, 16]],
  ['parallelogram', 'line', [[6, 16], [10, 16], [14, 16]], [12, 16]]
] as const)('renders and drags a %s collapsed to a %s', async (name, _kind, anchors, hit) => {
  const container = document.createElement('div')
  container.style.cssText = 'width:900px;height:450px'
  document.body.appendChild(container)
  const chart = init(container)
  try {
    chart.applyNewData(data, false)
    chart.setBarSpace(25)
    chart.alignLeft()
    const events: string[] = []
    const points = anchors.map(([index, value]) => ({ timestamp: data[index].timestamp, value }))
    const shapeStyle = { color: 'transparent', borderColor: '#1234ff', borderSize: 2 }
    const id = chart.createOverlay({ name, points,
      styles: { polygon: shapeStyle, circle: shapeStyle, ellipse: shapeStyle },
      onPointsChange: event => { events.push(event.source) }
    })!
    await nextFrame()

    const main = chart.getDom('candle_pane', DomPosition.Main)!
    const bounds = main.getBoundingClientRect()
    const pixel = chart.convertToPixel({ timestamp: data[hit[0]].timestamp, value: hit[1] }, {})
    const canvas = main.querySelectorAll('canvas')[1]
    const scale = canvas.width / canvas.clientWidth
    const pixels = canvas.getContext('2d')!.getImageData(Math.floor(pixel.x! * scale) - 2, Math.floor(pixel.y! * scale) - 2, 5, 5).data
    let visible = false
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 18 && pixels[i + 1] === 52 && pixels[i + 2] === 255 && pixels[i + 3] > 0) visible = true
    }
    expect(visible).toBe(true)

    const x = bounds.left + pixel.x!, y = bounds.top + pixel.y!
    const target = document.elementFromPoint(x, y)!
    send(target, 'mouseenter', x, y)
    send(target, 'mousemove', x, y)
    expect(chart.getChartStore().getOverlayStore().getHoverInfo()?.overlay.id).toBe(id)
    send(target, 'mousedown', x, y)
    expect(chart.getChartStore().getOverlayStore().getSelectedInfo()?.overlay.id).toBe(id)
    send(target, 'mousemove', x + 25, y - 20)
    send(target, 'mouseup', x + 25, y - 20)
    expect(events).toContain('body')
    expect(chart.getOverlayById(id)!.points).toHaveLength(points.length)
    expect(chart.getOverlayById(id)!.points[0].value).not.toBe(points[0].value)
    expect(chart.getOverlayById(id)!.points[0].timestamp).not.toBe(points[0].timestamp)
  } finally {
    dispose(chart)
    container.remove()
  }
  await nextFrame()
})

it.each(['rect', 'circle', 'ellipse'])('expands a collapsed %s by dragging a control point', async name => {
  const container = document.createElement('div')
  container.style.cssText = 'width:900px;height:450px'
  document.body.appendChild(container)
  const chart = init(container)
  try {
    chart.applyNewData(data, false)
    chart.setBarSpace(25)
    chart.alignLeft()
    const events: string[] = []
    const point = { timestamp: data[10].timestamp, value: 16 }
    const id = chart.createOverlay({ name, points: [{ ...point }, { ...point }], controlPointVisibility: 'always',
      onPointsChange: event => { events.push(event.source) }
    })!
    await nextFrame()
    const bounds = chart.getDom('candle_pane', DomPosition.Main)!.getBoundingClientRect()
    const pixel = chart.convertToPixel(point, {})
    const x = bounds.left + pixel.x!, y = bounds.top + pixel.y!
    const target = document.elementFromPoint(x, y)!
    send(target, 'mouseenter', x, y)
    send(target, 'mousemove', x, y)
    send(target, 'mousedown', x, y)
    send(target, 'mousemove', x + 50, y - 30)
    send(target, 'mouseup', x + 50, y - 30)
    expect(events).toContain('control-point')
    const points = chart.getOverlayById(id)!.points
    expect(points[0].timestamp).not.toBe(points[1].timestamp)
    expect(points[0].value).not.toBe(points[1].value)
  } finally {
    dispose(chart)
    container.remove()
  }
  await nextFrame()
})
