/**
 * 矩形命中测试
 * @param x 点击的x坐标
 * @param y 点击的y坐标
 * @param rect 矩形区域 { x, y, width, height }
 * @returns 是否命中矩形
 */
export function isPointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}
