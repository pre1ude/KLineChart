import type Coordinate from '../../common/Coordinate'
import { LineType, type PolygonStyle, PolygonType } from '../../common/Styles'
import { isTransparent } from '../../common/utils/color'
import { isString } from '../../common/utils/typeChecks'
import { type FigureTemplate } from '../../component/Figure'
import { checkCoordinateOnDegeneratePolygon, drawDegeneratePolygon } from './degenerate'

export function checkCoordinateOnCircle(coordinate: Coordinate, attrs: CircleAttrs | CircleAttrs[], styles: Partial<PolygonStyle> = {}): boolean {
  let circles: CircleAttrs[] = []
  circles = circles.concat(attrs)

  for (let i = 0; i < circles.length; i++) {
    const { x, y, r } = circles[i]
    if (r === 0) {
      if (checkCoordinateOnDegeneratePolygon(coordinate, [circles[i], circles[i]], styles)) return true
      continue
    }
    const dx = (coordinate.x - x) / r
    const dy = (coordinate.y - y) / r
    if (dx * dx + dy * dy <= 1) {
      return true
    }
  }
  return false
}

export function drawCircle(ctx: CanvasRenderingContext2D, attrs: CircleAttrs | CircleAttrs[], styles: Partial<PolygonStyle>): void {
  let circles: CircleAttrs[] = []
  circles = circles.concat(attrs).filter(circle => {
    if (circle.r !== 0) return true
    drawDegeneratePolygon(ctx, [circle, circle], styles)
    return false
  })
  if (circles.length === 0) return

  const {
    style = PolygonType.Fill,
    color = 'currentColor',
    borderSize = 1,
    borderColor = 'currentColor',
    borderStyle = LineType.Solid,
    borderDashedValue = [2, 2]
  } = styles

  const solid = (style === PolygonType.Fill || styles.style === PolygonType.StrokeFill) && (!isString(color) || !isTransparent(color))
  if (solid) {
    ctx.fillStyle = color
    circles.forEach(({ x, y, r }) => {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
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
    circles.forEach(({ x, y, r }) => {
      if (!solid || r > borderSize) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.closePath()
        ctx.stroke()
      }
    })
  }
}

export interface CircleAttrs {
  x: number
  y: number
  r: number
}

const circle: FigureTemplate<CircleAttrs | CircleAttrs[], Partial<PolygonStyle>> = {
  name: 'circle',
  checkEventOn: checkCoordinateOnCircle,
  draw: (ctx: CanvasRenderingContext2D, attrs: CircleAttrs | CircleAttrs[], styles: Partial<PolygonStyle>) => {
    ctx.save()
    drawCircle(ctx, attrs, styles)
    ctx.restore()
  }
}

export default circle
