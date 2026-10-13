import { describe, expect, it, vi } from 'vitest'

import { LineType, PolygonType, type PolygonStyle } from '../../common/Styles'
import { DEVIATION } from '../../component/Figure'
import { checkCoordinateOnCircle, drawCircle } from './circle'
import { checkCoordinateOnEllipse, drawEllipse } from './ellipse'
import { checkCoordinateOnPolygon, drawPolygon } from './polygon'

function createContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn()
  }
}

const styles: Partial<PolygonStyle> = {
  style: PolygonType.StrokeFill,
  color: 'rgba(255, 0, 0, 0.15)',
  borderColor: '#ff0000',
  borderSize: 3,
  borderStyle: LineType.Dashed,
  borderDashedValue: [5, 3]
}

describe('degenerate polygon hit testing', () => {
  it.each([
    ['horizontal rectangle', [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 20 }, { x: 10, y: 20 }], { x: 20, y: 22 }, { x: 20, y: 23 }],
    ['vertical rectangle', [{ x: 10, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 40 }, { x: 10, y: 40 }], { x: 12, y: 30 }, { x: 13, y: 30 }],
    ['collinear triangle', [{ x: 20, y: 20 }, { x: 30, y: 30 }, { x: 10, y: 10 }], { x: 15, y: 15 }, { x: 35, y: 35 }],
    ['coincident vertices', [{ x: 10, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 20 }], { x: 10, y: 22 }, { x: 12, y: 22 }],
    ['single vertex', [{ x: 10, y: 20 }], { x: 10, y: 20 }, { x: 10, y: 23 }]
  ] as const)('selects a %s within the hit tolerance', (_name, coordinates, hit, miss) => {
    const attrs = { coordinates: [...coordinates] }
    expect(checkCoordinateOnPolygon(hit, attrs)).toBe(true)
    expect(checkCoordinateOnPolygon(miss, attrs)).toBe(false)
  })

  it.each([0, 1000, -1000])('selects and draws a decimal-coordinate line after translation by %s', offset => {
    const coordinates = [0, 1, 2].map(index => ({ x: offset + 10.1 + index * 6.1, y: offset + 100 + index * 30 }))
    const attrs = { coordinates }
    expect(checkCoordinateOnPolygon({ x: offset + 14.15, y: offset + 115 }, attrs)).toBe(true)
    expect(checkCoordinateOnPolygon({ x: offset + 16.15, y: offset + 115 }, attrs)).toBe(false)

    const ctx = createContext()
    drawPolygon(ctx as unknown as CanvasRenderingContext2D, attrs, styles)
    expect(ctx.moveTo).toHaveBeenCalledExactlyOnceWith(coordinates[0].x, coordinates[0].y)
    expect(ctx.lineTo).toHaveBeenCalledExactlyOnceWith(coordinates[2].x, coordinates[2].y)
    expect(ctx.stroke).toHaveBeenCalledOnce()
    expect(ctx.fill).not.toHaveBeenCalled()
  })

  it.each([1, 0.000001])('preserves a non-collinear triangle with height %s', height => {
    const attrs = { coordinates: [{ x: 10, y: 20 }, { x: 20, y: 20 + height }, { x: 30, y: 20 }] }
    expect(checkCoordinateOnPolygon({ x: 20, y: 19 }, attrs)).toBe(false)
    expect(checkCoordinateOnPolygon({ x: 20, y: 20 + height / 2 }, attrs)).toBe(true)

    const ctx = createContext()
    drawPolygon(ctx as unknown as CanvasRenderingContext2D, attrs, styles)
    expect(ctx.fill).toHaveBeenCalledOnce()
    expect(ctx.stroke).toHaveBeenCalledOnce()
  })

  it('does not mistake a polygon with nearly coincident leading vertices for a line', () => {
    const attrs = { coordinates: [{ x: 10, y: 20 }, { x: 10 + 1e-13, y: 20 }, { x: 20, y: 21 }, { x: 30, y: 20 }] }
    expect(checkCoordinateOnPolygon({ x: 20, y: 19 }, attrs)).toBe(false)
    expect(checkCoordinateOnPolygon({ x: 20, y: 20.5 }, attrs)).toBe(true)

    const ctx = createContext()
    drawPolygon(ctx as unknown as CanvasRenderingContext2D, attrs, styles)
    expect(ctx.fill).toHaveBeenCalledOnce()
  })

  it('handles empty entries and degenerate entries in an attribute array', () => {
    expect(checkCoordinateOnPolygon({ x: 10, y: 20 }, [
      { coordinates: [] },
      { coordinates: [{ x: 100, y: 100 }, { x: 120, y: 100 }, { x: 100, y: 120 }] },
      { coordinates: [{ x: 10, y: 20 }, { x: 10, y: 20 }] }
    ])).toBe(true)
    expect(checkCoordinateOnPolygon({ x: 10, y: 20 }, { coordinates: [] })).toBe(false)
  })

  it('retains normal and self-intersecting polygon hit regions', () => {
    const square = { coordinates: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }] }
    const bowTie = { coordinates: [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 20, y: 0 }] }
    expect(checkCoordinateOnPolygon({ x: 10, y: 10 }, square)).toBe(true)
    expect(checkCoordinateOnPolygon({ x: 21, y: 10 }, square)).toBe(false)
    expect(checkCoordinateOnPolygon({ x: 10, y: 3 }, bowTie)).toBe(true)
    expect(checkCoordinateOnPolygon({ x: 1, y: 10 }, bowTie)).toBe(false)
  })
})

describe('degenerate circle hit testing', () => {
  it('selects a zero-radius circle as a point, including in an attribute array', () => {
    const attrs = { x: 10, y: 20, r: 0 }
    expect(checkCoordinateOnCircle({ x: 10, y: 20 }, attrs)).toBe(true)
    expect(checkCoordinateOnCircle({ x: 10 + DEVIATION, y: 20 }, attrs)).toBe(true)
    expect(checkCoordinateOnCircle({ x: 10 + DEVIATION, y: 20 + DEVIATION }, attrs)).toBe(false)
    expect(checkCoordinateOnCircle({ x: 10, y: 20 }, [{ x: 100, y: 100, r: 5 }, attrs])).toBe(true)
  })

  it('preserves the radius of nonzero circles', () => {
    expect(checkCoordinateOnCircle({ x: 11, y: 20 }, { x: 10, y: 20, r: 1 })).toBe(true)
    expect(checkCoordinateOnCircle({ x: 12, y: 20 }, { x: 10, y: 20, r: 1 })).toBe(false)
  })
})

const pointDrawers = [
  ['circle', (ctx: CanvasRenderingContext2D, style: Partial<PolygonStyle>) => drawCircle(ctx, { x: 10, y: 20, r: 0 }, style)],
  ['ellipse', (ctx: CanvasRenderingContext2D, style: Partial<PolygonStyle>) => drawEllipse(ctx, { x: 10, y: 20, rx: 0, ry: 0 }, style)],
  ['polygon', (ctx: CanvasRenderingContext2D, style: Partial<PolygonStyle>) => drawPolygon(ctx, { coordinates: [{ x: 10, y: 20 }, { x: 10, y: 20 }] }, style)]
] as const

it.each([
  ['circle', (point: { x: number, y: number }, style: Partial<PolygonStyle>) => checkCoordinateOnCircle(point, { x: 10, y: 20, r: 0 }, style)],
  ['ellipse', (point: { x: number, y: number }, style: Partial<PolygonStyle>) => checkCoordinateOnEllipse(point, { x: 10, y: 20, rx: 0, ry: 0 }, style)],
  ['polygon', (point: { x: number, y: number }, style: Partial<PolygonStyle>) => checkCoordinateOnPolygon(point, { coordinates: [{ x: 10, y: 20 }, { x: 10, y: 20 }] }, style)]
] as const)('matches the hit radius of a %s dot to its visible size', (_name, check) => {
  const thickBorder = { ...styles, borderSize: 8 }
  expect(check({ x: 14, y: 20 }, thickBorder)).toBe(true)
  expect(check({ x: 15, y: 20 }, thickBorder)).toBe(false)
  expect(check({ x: 14, y: 20 }, { ...thickBorder, style: PolygonType.Fill })).toBe(false)
})

describe.each(pointDrawers)('%s collapsed to a point', (_name, draw) => {
  it('draws a visible dot using its border color and minimum radius', () => {
    const ctx = createContext()
    draw(ctx as unknown as CanvasRenderingContext2D, styles)
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, DEVIATION, 0, Math.PI * 2)
    expect(ctx.fillStyle).toBe(styles.borderColor)
    expect(ctx.fill).toHaveBeenCalledOnce()
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('uses half the border width for a thick dot', () => {
    const ctx = createContext()
    draw(ctx as unknown as CanvasRenderingContext2D, { ...styles, borderSize: 8 })
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, 4, 0, Math.PI * 2)
  })

  it('uses the fill color for a fill-only shape', () => {
    const ctx = createContext()
    draw(ctx as unknown as CanvasRenderingContext2D, { ...styles, style: PolygonType.Fill })
    expect(ctx.fillStyle).toBe(styles.color)
    expect(ctx.fill).toHaveBeenCalledOnce()
  })

  it.each([
    { ...styles, color: 'transparent', borderColor: 'transparent' },
    { ...styles, style: PolygonType.Stroke, borderSize: 0 }
  ])('keeps an invisible shape invisible', style => {
    const ctx = createContext()
    draw(ctx as unknown as CanvasRenderingContext2D, style)
    expect(ctx.fill).not.toHaveBeenCalled()
    expect(ctx.stroke).not.toHaveBeenCalled()
  })
})

describe('degenerate line drawing', () => {
  it.each([
    ['polygon', (ctx: CanvasRenderingContext2D, style: Partial<PolygonStyle>) => drawPolygon(ctx, { coordinates: [{ x: 20, y: 20 }, { x: 30, y: 30 }, { x: 10, y: 10 }] }, style), [10, 10], [30, 30]],
    ['vertical ellipse', (ctx: CanvasRenderingContext2D, style: Partial<PolygonStyle>) => drawEllipse(ctx, { x: 20, y: 20, rx: 0, ry: 10 }, style), [20, 10], [20, 30]],
    ['horizontal ellipse', (ctx: CanvasRenderingContext2D, style: Partial<PolygonStyle>) => drawEllipse(ctx, { x: 20, y: 20, rx: 10, ry: 0 }, style), [10, 20], [30, 20]]
  ] as const)('draws a %s once with its configured border style', (_name, draw, start, end) => {
    for (const borderStyle of [LineType.Solid, LineType.Dashed]) {
      const ctx = createContext()
      ctx.stroke.mockImplementation(() => {
        expect(ctx.setLineDash).toHaveBeenLastCalledWith(borderStyle === LineType.Dashed ? [5, 3] : [])
      })
      draw(ctx as unknown as CanvasRenderingContext2D, { ...styles, borderStyle })
      expect(ctx.moveTo).toHaveBeenCalledExactlyOnceWith(...start)
      expect(ctx.lineTo).toHaveBeenCalledExactlyOnceWith(...end)
      expect(ctx.strokeStyle).toBe(styles.borderColor)
      expect(ctx.lineWidth).toBe(styles.borderSize)
      expect(ctx.setLineDash).toHaveBeenCalledWith(borderStyle === LineType.Dashed ? [5, 3] : [])
      expect(ctx.stroke).toHaveBeenCalledOnce()
      expect(ctx.fill).not.toHaveBeenCalled()
    }
  })

  it('uses a one-pixel fill-colored line for a fill-only polygon', () => {
    const ctx = createContext()
    drawPolygon(ctx as unknown as CanvasRenderingContext2D, { coordinates: [{ x: 10, y: 20 }, { x: 30, y: 20 }] }, { ...styles, style: PolygonType.Fill })
    expect(ctx.strokeStyle).toBe(styles.color)
    expect(ctx.lineWidth).toBe(1)
    expect(ctx.setLineDash).toHaveBeenCalledWith([])
    expect(ctx.stroke).toHaveBeenCalledOnce()
  })
})

it('uses a circular hit region for an ellipse collapsed to a point', () => {
  const attrs = { x: 10, y: 20, rx: 0, ry: 0 }
  expect(checkCoordinateOnEllipse({ x: 10 + DEVIATION, y: 20 }, attrs)).toBe(true)
  expect(checkCoordinateOnEllipse({ x: 10 + DEVIATION + 1, y: 20 }, attrs)).toBe(false)
})

it('skips empty polygon paths without throwing', () => {
  const ctx = createContext()
  expect(() => drawPolygon(ctx as unknown as CanvasRenderingContext2D, { coordinates: [] }, styles)).not.toThrow()
  expect(ctx.fill).not.toHaveBeenCalled()
  expect(ctx.stroke).not.toHaveBeenCalled()
})
