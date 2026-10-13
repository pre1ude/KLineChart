import type Coordinate from '../../common/Coordinate'
import { LineType, PolygonType, type PolygonStyle } from '../../common/Styles'
import { isTransparent } from '../../common/utils/color'
import { isString } from '../../common/utils/typeChecks'
import { DEVIATION } from '../../component/Figure'
import { isPointOnLine } from './line'

function getVisibleBorderSize(styles: Partial<PolygonStyle>): number {
  const { style = PolygonType.Fill, borderSize = 1, borderColor = 'currentColor' } = styles
  return (style === PolygonType.Stroke || style === PolygonType.StrokeFill) && !isTransparent(borderColor)
    ? Math.max(0, borderSize)
    : 0
}

export function checkCoordinateOnDegeneratePolygon(coordinate: Coordinate, segment: [Coordinate, Coordinate], styles: Partial<PolygonStyle>): boolean {
  const [start, end] = segment
  if (start.x === end.x && start.y === end.y) {
    const radius = Math.max(DEVIATION, getVisibleBorderSize(styles) / 2)
    const dx = coordinate.x - start.x
    const dy = coordinate.y - start.y
    return dx * dx + dy * dy <= radius * radius
  }
  return isPointOnLine(coordinate, { coordinates: segment })
}

export function getCollinearSegment(coordinates: Coordinate[]): [Coordinate, Coordinate] | undefined {
  if (coordinates.length === 0) return undefined

  const first = coordinates[0]
  let other = first
  let maxDistanceSquared = 0
  let coordinateScale = 0
  for (const point of coordinates) {
    coordinateScale = Math.max(coordinateScale, Math.abs(point.x), Math.abs(point.y))
    const dx = point.x - first.x
    const dy = point.y - first.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared > maxDistanceSquared) {
      other = point
      maxDistanceSquared = distanceSquared
    }
  }
  if (maxDistanceSquared === 0) return [first, first]

  const dx = other.x - first.x
  const dy = other.y - first.y
  const length = Math.hypot(dx, dy)
  // Use a stable baseline and tolerate coordinate roundoff, not a pixel-wide area.
  const tolerance = Number.EPSILON * coordinateScale * length * 4
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
  let start = first
  let end = first
  for (const point of coordinates) {
    const cross = (point.x - first.x) * dy - (point.y - first.y) * dx
    if (Math.abs(cross) > tolerance) return undefined
    if (point[axis] < start[axis]) start = point
    if (point[axis] > end[axis]) end = point
  }
  return [start, end]
}

export function drawDegeneratePolygon(ctx: CanvasRenderingContext2D, [start, end]: [Coordinate, Coordinate], styles: Partial<PolygonStyle>): void {
  const {
    style = PolygonType.Fill,
    color = 'currentColor',
    borderColor = 'currentColor',
    borderStyle = LineType.Solid,
    borderDashedValue = [2, 2]
  } = styles
  const borderSize = getVisibleBorderSize(styles)
  const stroke = borderSize > 0
  const fill = (style === PolygonType.Fill || style === PolygonType.StrokeFill) && (!isString(color) || !isTransparent(color))
  if (!stroke && !fill) return

  const visibleColor = stroke ? borderColor : color
  const size = stroke ? borderSize : 1
  ctx.beginPath()
  if (start.x === end.x && start.y === end.y) {
    // A zero-length canvas stroke is invisible with the default butt line cap.
    ctx.fillStyle = visibleColor
    ctx.arc(start.x, start.y, Math.max(DEVIATION, size / 2), 0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    return
  }
  ctx.strokeStyle = visibleColor
  ctx.lineWidth = size
  ctx.setLineDash(stroke && borderStyle === LineType.Dashed ? borderDashedValue : [])
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
  ctx.closePath()
}
