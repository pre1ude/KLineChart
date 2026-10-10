import { expect, it } from 'vitest'
import { dispose, init, DomPosition, type Point } from '../../src/index'
import { copyRecord, editRecord, projectPoints, type DrawingRecord, type EditBaseline } from '../html/overlay/period-points/drawing'

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

it.each(['body', 'control-point'] as const)('keeps source anchors through real %s edits of collapsed points', async kind => {
  const container = document.createElement('div')
  container.style.cssText = 'width:900px;height:450px'
  document.body.appendChild(container)
  const chart = init(container)
  const data = Array.from({ length: 25 }, (_, i) => ({ timestamp: 1000000 + i * 60000, open: 10, high: 25, low: 5, close: 20 }))
  chart.applyNewData(data, false)
  chart.setBarSpace(25)
  chart.alignLeft()
  let source: DrawingRecord = { name: 'segment', period: '5m', points: [
    { timestamp: data[10].timestamp + 1000, value: 12, period: '5m' },
    { timestamp: data[10].timestamp + 2000, value: 20, period: '15m' }
  ] }
  const original = copyRecord(source)
  let baseline: EditBaseline | undefined
  const events: string[] = []
  const id = chart.createOverlay({ name: source.name,
    points: projectPoints(source, '1d', data, () => ({ timestamp: data[10].timestamp, offset: 0 })),
    controlPointVisibility: 'always',
    onPressedMoveStart() { baseline = { source: copyRecord(source), displayed: chart.getOverlayById(id)!.points.map(point => ({ ...point })) } },
    onPointsChange(event) { events.push(event.source); source = editRecord(source, event, '1d', baseline) },
    onPressedMoveEnd() { baseline = undefined }
  })!
  const ordinary = chart.createOverlay({ name: 'horizontalStraightLine', points: [{ timestamp: data[2].timestamp, value: 8 }] })!
  try {
    await nextFrame()
    const bounds = chart.getDom('candle_pane', DomPosition.Main)!.getBoundingClientRect()
    const pixel = chart.convertToPixel({ timestamp: data[10].timestamp, value: kind === 'body' ? 16 : 12 }, {})
    const x = bounds.left + pixel.x!, y = bounds.top + pixel.y!
    const target = document.elementFromPoint(x, y)!
    const send = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0, view: window })
      Object.defineProperty(event, 'sourceCapabilities', { value: { firesTouchEvents: false } })
      target.dispatchEvent(event)
    }
    send('mouseenter', x, y)
    send('mousemove', x, y)
    send('mousedown', x, y)
    send('mousemove', x, y - 20)
    expect(events).toContain(kind)
    const anchors = (points: Array<Point & { period: string }>) => points.map(({ value, ...point }) => point)
    expect(anchors(source.points)).toEqual(anchors(original.points))
    expect(source.points[0].value).not.toBe(original.points[0].value)
    send('mousemove', x + 50, y - 20)
    expect(source.points[0].period).toBe('1d')
    if (kind === 'control-point') expect(source.points[1]).toEqual(original.points[1])
    send('mousemove', x, y - 20)
    send('mouseup', x, y - 20)
    expect(anchors(source.points)).toEqual(anchors(original.points))
    const edited = copyRecord(source)
    chart.overrideOverlay({ id, styles: { line: { color: '#7c3aed' } } })
    chart.overrideOverlay({ id, points: projectPoints(source, '5m', data) })
    expect(source).toEqual(edited)
    expect(chart.getOverlayById(id)!.points.every(point => !('period' in point))).toBe(true)
    chart.removeOverlay(id)
    expect(chart.getOverlayById(ordinary)).toBeDefined()
  } finally { dispose(chart); container.remove() }
  await nextFrame()
})
