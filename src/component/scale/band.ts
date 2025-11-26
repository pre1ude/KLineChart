import { createOrdinal } from './ordinal'

export interface BandScale {
  (x: unknown): number
  bandWidth: () => number
  step: () => number
}

export interface BandScaleOptions {
  domain: unknown[]
  range: [number, number]
  padding?: number
  margin?: number
}

interface BandResult {
  step: number
  bandWidth: number
  bandRange: number[]
}

export function createBand(options: BandScaleOptions): BandScale {
  const { bandRange, bandWidth, step } = band(options)
  const scale = createOrdinal({ ...options, range: bandRange }) as unknown as BandScale

  scale.bandWidth = (): number => bandWidth
  scale.step = (): number => step

  return scale
}

function band({ domain, range, padding = 0, margin = padding }: BandScaleOptions): BandResult {
  const [r0, r1] = range
  const n = domain.length
  const step = (r1 - r0) / (margin * 2 + n - padding)
  const bandWidth = step * (1 - padding)
  const x = (_: unknown, i: number): number => r0 + margin * step + step * i
  return {
    step,
    bandWidth,
    bandRange: new Array(n).fill(0).map(x)
  }
}
