import type Coordinate from '../../common/Coordinate'
import { type LineSymbolStyle, type SmoothLineStyle, LineType } from '../../common/Styles'
import { isTransparent } from '../../common/utils/color'
import { isNumber } from '../../common/utils/typeChecks'
import { type FigureTemplate, DEVIATION } from '../../component/Figure'

const DEFAULT_SMOOTH = 0.5
export const LINE_SYMBOL_MIN_SPACING = 40
const LINE_SYMBOL_SPARSE_TRIGGER_SPACING = 8
export const LINE_SYMBOL_RADIUS = 2
const LINE_SYMBOL_BORDER_SIZE = 1.5
const LINE_SYMBOL_FILL_COLOR = '#fff'
const EMPTY_LINE_DASH: number[] = []
const DEFAULT_LINE_DASH: number[] = [2, 2]
type LineSymbolResolverStyle = Pick<Partial<SmoothLineStyle>, 'color' | 'symbol'>

export function resolveLineSymbolStyle(styles: LineSymbolResolverStyle): LineSymbolStyle {
  const color = styles.color ?? 'currentColor'
  const symbol = styles.symbol
  return {
    show: symbol?.show === true,
    radius: Math.max(0, symbol?.radius ?? LINE_SYMBOL_RADIUS),
    borderSize: Math.max(0, symbol?.borderSize ?? LINE_SYMBOL_BORDER_SIZE),
    fillColor: symbol?.fillColor ?? LINE_SYMBOL_FILL_COLOR,
    borderColor: symbol?.borderColor ?? color,
    minSpacing: Math.max(1, symbol?.minSpacing ?? LINE_SYMBOL_MIN_SPACING)
  }
}

export function getLineSymbolStepBySpacing(styles: LineSymbolResolverStyle, pointSpacing: number): number {
  const symbolStyle = resolveLineSymbolStyle(styles)
  if (!symbolStyle.show || pointSpacing <= 0 || pointSpacing >= LINE_SYMBOL_SPARSE_TRIGGER_SPACING) {
    return 1
  }
  return Math.max(1, Math.ceil(symbolStyle.minSpacing / pointSpacing))
}

function isLineStyleVisible(styles: Partial<SmoothLineStyle>): boolean {
  const { size = 1, color = 'currentColor' } = styles
  return size > 0 && !isTransparent(color)
}

function hasDrawableLineCoordinates(coordinates: Coordinate[]): boolean {
  return coordinates.length > 1
}

function canDrawLineSymbols(symbolStyle: LineSymbolStyle): boolean {
  return symbolStyle.show &&
    symbolStyle.radius > 0 &&
    (
      !isTransparent(symbolStyle.fillColor) ||
      (symbolStyle.borderSize > 0 && !isTransparent(symbolStyle.borderColor))
    )
}

function drawLineSymbols(ctx: CanvasRenderingContext2D, attrs: LineAttrs, symbolStyle: LineSymbolStyle): void {
  if (!hasDrawableLineCoordinates(attrs.coordinates) || !canDrawLineSymbols(symbolStyle)) {
    return
  }

  const { coordinates, startDataIndex = 0 } = attrs
  const symbolStep = Math.max(1, attrs.symbolStep ?? 1)
  const shouldFill = !isTransparent(symbolStyle.fillColor)
  const shouldStroke = symbolStyle.borderSize > 0 && !isTransparent(symbolStyle.borderColor)
  if (!shouldFill && !shouldStroke) {
    return
  }

  const shouldStrokePoint = shouldStroke && (!shouldFill || symbolStyle.radius > symbolStyle.borderSize)
  let hasPath = false

  for (let i = 0; i < coordinates.length; i++) {
    if ((startDataIndex + i) % symbolStep !== 0) {
      continue
    }

    const point = coordinates[i]
    if (!hasPath) {
      ctx.beginPath()
      hasPath = true
    }
    ctx.moveTo(point.x + symbolStyle.radius, point.y)
    ctx.arc(point.x, point.y, symbolStyle.radius, 0, Math.PI * 2)
  }

  if (!hasPath) {
    return
  }

  if (shouldFill) {
    ctx.fillStyle = symbolStyle.fillColor
    ctx.fill()
  }
  if (shouldStrokePoint) {
    ctx.strokeStyle = symbolStyle.borderColor
    ctx.lineWidth = symbolStyle.borderSize
    ctx.setLineDash(EMPTY_LINE_DASH)
    ctx.stroke()
  }
}

function pointToSegmentDistance2(point: Coordinate, p1: Coordinate, p2: Coordinate): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    // 退化为点
    const pdx = point.x - p1.x
    const pdy = point.y - p1.y
    return pdx * pdx + pdy * pdy
  }

  // 计算投影参数 t
  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))  // 限制在 [0, 1]

  // 计算最近点
  const nearestX = p1.x + t * dx
  const nearestY = p1.y + t * dy

  // 计算距离
  const distX = point.x - nearestX
  const distY = point.y - nearestY
  return distX * distX + distY * distY
}

function isPointOnSingleLine(point: Coordinate, attrs: LineAttrs): boolean {
  const { coordinates } = attrs
  const len = coordinates.length

  if (len <= 1) return false

  for (let j = 1; j < len; j++) {
    const prev = coordinates[j - 1]
    const curr = coordinates[j]
    // fast bounding box check
    const minX = Math.min(prev.x, curr.x) - DEVIATION
    const maxX = Math.max(prev.x, curr.x) + DEVIATION
    const minY = Math.min(prev.y, curr.y) - DEVIATION
    const maxY = Math.max(prev.y, curr.y) + DEVIATION

    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
      continue
    }
    const distance2 = pointToSegmentDistance2(point, prev, curr)
    if (distance2 <= DEVIATION * DEVIATION) {
      return true
    }
  }
  return false
}

export function isPointOnLine(point: Coordinate, attrs: LineAttrs | LineAttrs[]): boolean {
  if (Array.isArray(attrs)) {
    for (let i = 0; i < attrs.length; i++) {
      if (isPointOnSingleLine(point, attrs[i])) {
        return true
      }
    }
    return false
  }

  return isPointOnSingleLine(point, attrs)
}

export function getLinearYFromSlopeIntercept(kb: number[] | null, coordinate: Coordinate): number {
  if (kb !== null) {
    return coordinate.x * kb[0] + kb[1]
  }
  return coordinate.y
}

/**
 * 获取点在两点决定的一次函数上的y值
 * @param coordinate1
 * @param coordinate2
 * @param targetCoordinate
 */
export function getLinearYFromCoordinates(coordinate1: Coordinate, coordinate2: Coordinate, targetCoordinate: Coordinate): number {
  const kb = getLinearSlopeIntercept(coordinate1, coordinate2)
  return getLinearYFromSlopeIntercept(kb, targetCoordinate)
}

export function getLinearSlopeIntercept(coordinate1: Coordinate, coordinate2: Coordinate): number[] | null {
  const difX = coordinate1.x - coordinate2.x
  if (difX !== 0) {
    const k = (coordinate1.y - coordinate2.y) / difX
    const b = coordinate1.y - k * coordinate1.x
    return [k, b]
  }
  return null
}

function lineToSmooth(ctx: CanvasRenderingContext2D, points: Coordinate[], smooth: number): void {
  const length = points.length
  let x0 = points[0].x
  let y0 = points[0].y

  const lastIndex = length - 1

  for (let i = 1; i < lastIndex; i++) {
    const prevCoordinate = points[i - 1]
    const coordinate = points[i]
    const nextCoordinate = points[i + 1]
    const dx01 = coordinate.x - prevCoordinate.x
    const dy01 = coordinate.y - prevCoordinate.y
    const dx12 = nextCoordinate.x - coordinate.x
    const dy12 = nextCoordinate.y - coordinate.y
    let dx02 = nextCoordinate.x - prevCoordinate.x
    let dy02 = nextCoordinate.y - prevCoordinate.y
    const prevSegmentLength = Math.sqrt(dx01 * dx01 + dy01 * dy01)
    const nextSegmentLength = Math.sqrt(dx12 * dx12 + dy12 * dy12)
    const segmentLengthRatio = nextSegmentLength / (nextSegmentLength + prevSegmentLength)

    let nextCpx = coordinate.x + dx02 * smooth * segmentLengthRatio
    let nextCpy = coordinate.y + dy02 * smooth * segmentLengthRatio
    nextCpx = Math.min(nextCpx, Math.max(nextCoordinate.x, coordinate.x))
    nextCpy = Math.min(nextCpy, Math.max(nextCoordinate.y, coordinate.y))
    nextCpx = Math.max(nextCpx, Math.min(nextCoordinate.x, coordinate.x))
    nextCpy = Math.max(nextCpy, Math.min(nextCoordinate.y, coordinate.y))

    dx02 = nextCpx - coordinate.x
    dy02 = nextCpy - coordinate.y

    let x1 = coordinate.x - dx02 * prevSegmentLength / nextSegmentLength
    let y1 = coordinate.y - dy02 * prevSegmentLength / nextSegmentLength

    x1 = Math.min(x1, Math.max(prevCoordinate.x, coordinate.x))
    y1 = Math.min(y1, Math.max(prevCoordinate.y, coordinate.y))
    x1 = Math.max(x1, Math.min(prevCoordinate.x, coordinate.x))
    y1 = Math.max(y1, Math.min(prevCoordinate.y, coordinate.y))

    dx02 = coordinate.x - x1
    dy02 = coordinate.y - y1
    nextCpx = coordinate.x + dx02 * nextSegmentLength / prevSegmentLength
    nextCpy = coordinate.y + dy02 * nextSegmentLength / prevSegmentLength

    ctx.bezierCurveTo(x0, y0, x1, y1, coordinate.x, coordinate.y)

    x0 = nextCpx
    y0 = nextCpy
  }
  const lastCoordinate = points[lastIndex]
  ctx.bezierCurveTo(x0, y0, lastCoordinate.x, lastCoordinate.y, lastCoordinate.x, lastCoordinate.y)
}

function lineToStraight(ctx: CanvasRenderingContext2D, points: Coordinate[]): void {
  const length = points.length
  for (let i = 1; i < length; i++) {
    const coord = points[i]
    ctx.lineTo(coord.x, coord.y)
  }
}

export function lineTo(ctx: CanvasRenderingContext2D, points: Coordinate[], smooth: number): void {
  const length = points.length
  if (smooth > 0 && length > 2) {
    lineToSmooth(ctx, points, smooth)
  } else {
    lineToStraight(ctx, points)
  }
}

function drawSingleLine(ctx: CanvasRenderingContext2D, points: Coordinate[], smooth: number, correction: number): void {
  if (points.length <= 1) return

  // 只对水平/垂直两点线段进行像素对齐
  if (
    points.length === 2 &&
    (points[0].x === points[1].x || points[0].y === points[1].y)
  ) {
    ctx.beginPath()
    if (points[0].x === points[1].x) {
      ctx.moveTo(points[0].x + correction, points[0].y)
      ctx.lineTo(points[1].x + correction, points[1].y)
    } else {
      ctx.moveTo(points[0].x, points[0].y + correction)
      ctx.lineTo(points[1].x, points[1].y + correction)
    }
    ctx.stroke()
    ctx.closePath()
    return
  }

  // 一般情况：不使用 correction
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  lineTo(ctx, points, smooth)
  ctx.stroke()
  ctx.closePath()
}

export const smoothNormalize = (smooth: number | boolean) => isNumber(smooth)
  ? (smooth > 0 && smooth < 1 ? smooth : 0)
  : (smooth ? DEFAULT_SMOOTH : 0)

export function drawLine(ctx: CanvasRenderingContext2D, attrs: LineAttrs | LineAttrs[], styles: Partial<SmoothLineStyle>): void {
  const {
    style = LineType.Solid,
    smooth = false,
    size = 1,
    color = 'currentColor',
    dashedValue = DEFAULT_LINE_DASH,
    lineJoin,
    miterLimit
  } = styles
  if (!isLineStyleVisible(styles)) {
    return
  }

  const normalizedSmooth = smoothNormalize(smooth)
  const symbolStyle = resolveLineSymbolStyle(styles)
  const correction = size % 2 === 1 ? 0.5 : 0

  ctx.lineWidth = size
  ctx.strokeStyle = color
  if (lineJoin !== undefined) {
    ctx.lineJoin = lineJoin
  }
  if (miterLimit !== undefined) {
    ctx.miterLimit = miterLimit
  }
  if (style === LineType.Dashed) {
    ctx.setLineDash(dashedValue)
  } else {
    ctx.setLineDash(EMPTY_LINE_DASH)
  }

  if (!Array.isArray(attrs)) {
    if (!hasDrawableLineCoordinates(attrs.coordinates)) {
      return
    }

    drawSingleLine(ctx, attrs.coordinates, normalizedSmooth, correction)
    if (canDrawLineSymbols(symbolStyle)) {
      drawLineSymbols(ctx, attrs, symbolStyle)
    }
    return
  }

  for (let i = 0; i < attrs.length; i++) {
    if (!hasDrawableLineCoordinates(attrs[i].coordinates)) {
      continue
    }
    drawSingleLine(ctx, attrs[i].coordinates, normalizedSmooth, correction)
  }

  if (!canDrawLineSymbols(symbolStyle)) {
    return
  }

  for (let i = 0; i < attrs.length; i++) {
    if (!hasDrawableLineCoordinates(attrs[i].coordinates)) {
      continue
    }
    drawLineSymbols(ctx, attrs[i], symbolStyle)
  }
}

export interface LineAttrs {
  coordinates: Coordinate[]
  startDataIndex?: number
  symbolStep?: number
}

const line: FigureTemplate<LineAttrs | LineAttrs[], Partial<SmoothLineStyle>> = {
  name: 'line',
  checkEventOn: isPointOnLine,
  draw: (ctx: CanvasRenderingContext2D, attrs: LineAttrs | LineAttrs[], styles: Partial<SmoothLineStyle>) => {
    ctx.save()
    drawLine(ctx, attrs, styles)
    ctx.restore()
  }
}

export default line
