import type Coordinate from '../../common/Coordinate'
import { type PolygonStyle, PolygonType, LineType } from '../../common/Styles'
import { isString } from '../../common/utils/typeChecks'
import { isTransparent } from '../../common/utils/color'

import { type FigureTemplate, DEVIATION } from '../../component/Figure'

export function checkCoordinateOnEllipse(coordinate: Coordinate, attrs: EllipseAttrs | EllipseAttrs[]): boolean {
  let ellipses: EllipseAttrs[] = []
  ellipses = ellipses.concat(attrs)

  for (let i = 0; i < ellipses.length; i++) {
    const { x, y, rx, ry } = ellipses[i]
    if (rx <= 0 || ry <= 0) {
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
