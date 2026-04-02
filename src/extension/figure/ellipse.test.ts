import { describe, expect, it } from 'vitest'
import { DEVIATION } from '../../component/Figure'
import { checkCoordinateOnEllipse } from './ellipse'

describe('checkCoordinateOnEllipse', () => {
  it('垂直退化椭圆按线段命中', () => {
    const attrs = { x: 10, y: 10, rx: 0, ry: 8 }

    expect(checkCoordinateOnEllipse({ x: 10, y: 16 }, attrs)).toBe(true)
    expect(checkCoordinateOnEllipse({ x: 13, y: 16 }, attrs)).toBe(false)
  })

  it('水平退化椭圆按线段命中', () => {
    const attrs = { x: 10, y: 10, rx: 8, ry: 0 }

    expect(checkCoordinateOnEllipse({ x: 16, y: 10 }, attrs)).toBe(true)
    expect(checkCoordinateOnEllipse({ x: 16, y: 13 }, attrs)).toBe(false)
  })

  it('极小椭圆与绘制的退化线段保持一致', () => {
    const attrs = { x: 10, y: 10, rx: 1, ry: 1 }

    expect(checkCoordinateOnEllipse({ x: 10 + DEVIATION, y: 10 }, attrs)).toBe(true)
    expect(checkCoordinateOnEllipse({ x: 10 + DEVIATION * 2 + 1, y: 10 }, attrs)).toBe(false)
  })

  it('正常椭圆仍按椭圆区域命中', () => {
    const attrs = { x: 10, y: 10, rx: 8, ry: 4 }

    expect(checkCoordinateOnEllipse({ x: 16, y: 10 }, attrs)).toBe(true)
    expect(checkCoordinateOnEllipse({ x: 19, y: 10 }, attrs)).toBe(false)
  })
})
