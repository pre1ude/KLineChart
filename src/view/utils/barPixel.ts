export function pixelSnapBarCenter(x: number): number {
  return Number.isFinite(x) ? Math.round(x - 0.5) : x
}

export function pixelSnapBarStart(x: number, halfWidth: number): number {
  return pixelSnapBarCenter(x) - halfWidth
}
