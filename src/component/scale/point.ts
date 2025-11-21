import { createBand } from './band'
import type { BandScale, BandScaleOptions } from './band'

export interface PointScale extends BandScale {}

export interface PointScaleOptions extends Omit<BandScaleOptions, 'padding'> {
  padding?: number
}

export function createPoint(options: PointScaleOptions): PointScale {
  return createBand({ ...options, padding: 1 })
}
