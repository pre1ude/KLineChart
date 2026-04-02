import type Coordinate from '../../common/Coordinate'
import { type PolygonStyle, LineType, PolygonType } from '../../common/Styles'
import { isTransparent } from '../../common/utils/color'
import { isString } from '../../common/utils/typeChecks'
import { type FigureTemplate, DEVIATION } from '../../component/Figure'

function pointToSegmentDistance2(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    const distX = point.x - start.x
    const distY = point.y - start.y
    return distX * distX + distY * distY
  }

  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))

  const nearestX = start.x + t * dx
  const nearestY = start.y + t * dy
  const distX = point.x - nearestX
  const distY = point.y - nearestY
  return distX * distX + distY * distY
}

function checkCoordinateOnDegenerateEllipse(coordinate: Coordinate, attrs: EllipseAttrs): boolean {
  const { x, y, rx, ry } = attrs

  let start: Coordinate
  let end: Coordinate

  if (rx <= DEVIATION && ry <= DEVIATION) {
    start = { x: x - DEVIATION, y }
    end = { x: x + DEVIATION, y }
  } else if (rx <= DEVIATION) {
    const halfLength = Math.max(ry, DEVIATION)
    start = { x, y: y - halfLength }
    end = { x, y: y + halfLength }
  } else {
    const halfLength = Math.max(rx, DEVIATION)
    start = { x: x - halfLength, y }
    end = { x: x + halfLength, y }
  }

  return pointToSegmentDistance2(coordinate, start, end) <= DEVIATION * DEVIATION
}

export function checkCoordinateOnEllipse(coordinate: Coordinate, attrs: EllipseAttrs | EllipseAttrs[]): boolean {
  const ellipses = Array.isArray(attrs) ? attrs : [attrs]

  for (let i = 0; i < ellipses.length; i++) {
    const { x, y, rx, ry } = ellipses[i]
    if (rx <= DEVIATION || ry <= DEVIATION) {
      if (checkCoordinateOnDegenerateEllipse(coordinate, ellipses[i])) {
        return true
      }
      continue
    }
    const dx = (coordinate.x - x) / rx
    const dy = (coordinate.y - y) / ry
    if (dx * dx + dy * dy <= 1) {
      return true
    }
  }
  return false
}

export function drawEllipse(ctx: CanvasRenderingContext2D, attrs: EllipseAttrs | EllipseAttrs[], styles: Partial<PolygonStyle>): void {
  let ellipses: EllipseAttrs[] = []
  ellipses = ellipses.concat(attrs)

  const {
    style = PolygonType.Fill,
    color = 'currentColor',
    borderSize = 1,
    borderColor = 'currentColor',
    borderStyle = LineType.Solid,
    borderDashedValue = [2, 2]
  } = styles

  const solid = (style === PolygonType.Fill || styles.style === PolygonType.StrokeFill) && (!isString(color) || !isTransparent(color))
  const degenerates = ellipses.filter(({ rx, ry }) => rx <= DEVIATION || ry <= DEVIATION)
  const normals = ellipses.filter(({ rx, ry }) => rx > DEVIATION && ry > DEVIATION)

  if (degenerates.length > 0 && borderSize > 0 && !isTransparent(borderColor)) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderSize
    ctx.setLineDash(borderDashedValue)
    degenerates.forEach(({ x, y, rx, ry }) => {
      if (rx <= DEVIATION && ry <= DEVIATION) {
        const halfLength = DEVIATION
        ctx.beginPath()
        ctx.moveTo(x - halfLength, y)
        ctx.lineTo(x + halfLength, y)
        ctx.stroke()
        ctx.closePath()
        return
      }
      if (rx <= DEVIATION) {
        const halfLength = Math.max(ry, DEVIATION)
        ctx.beginPath()
        ctx.moveTo(x, y - halfLength)
        ctx.lineTo(x, y + halfLength)
        ctx.stroke()
        ctx.closePath()
        return
      }
      const halfLength = Math.max(rx, DEVIATION)
      ctx.beginPath()
      ctx.moveTo(x - halfLength, y)
      ctx.lineTo(x + halfLength, y)
      ctx.stroke()
      ctx.closePath()
    })
  }
  if (solid) {
    ctx.fillStyle = color
    normals.forEach(({ x, y, rx, ry }) => {
      if (rx <= 0 || ry <= 0) {
        return
      }
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
      ctx.closePath()
      ctx.fill()
    })
  }
  if ((style === PolygonType.Stroke || styles.style === PolygonType.StrokeFill) && borderSize > 0 && !isTransparent(borderColor)) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderSize
    if (borderStyle === LineType.Dashed) {
      ctx.setLineDash(borderDashedValue)
    } else {
      ctx.setLineDash([])
    }
    normals.forEach(({ x, y, rx, ry }) => {
      if (rx <= 0 || ry <= 0) {
        return
      }
      if (!solid || Math.min(rx, ry) > borderSize) {
        ctx.beginPath()
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
        ctx.closePath()
        ctx.stroke()
      }
    })
  }
}

export interface EllipseAttrs {
  x: number
  y: number
  rx: number
  ry: number
}

const ellipse: FigureTemplate<EllipseAttrs | EllipseAttrs[], Partial<PolygonStyle>> = {
  name: 'ellipse',
  checkEventOn: checkCoordinateOnEllipse,
  draw: (ctx: CanvasRenderingContext2D, attrs: EllipseAttrs | EllipseAttrs[], styles: Partial<PolygonStyle>) => {
    ctx.save()
    drawEllipse(ctx, attrs, styles)
    ctx.restore()
  }
}

export default ellipse
