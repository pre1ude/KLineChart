

import { isValid, merge } from './utils/typeChecks'

export default interface Bounding {
  width: number
  height: number
  left: number
  top: number
}

export function createDefaultBounding (bounding?: Partial<Bounding>): Bounding {
  const defaultBounding: Bounding = {
    width: 0,
    height: 0,
    left: 0,
    top: 0
  }
  if (isValid(bounding)) {
    merge(defaultBounding, bounding)
  }
  return defaultBounding
}

export function isPointInBounding (bounding: Bounding, { x, y }: { x: number, y: number }): boolean {
  return x >= bounding.left &&
           x <= bounding.left + bounding.width &&
           y >= bounding.top &&
           y <= bounding.top + bounding.height
}
