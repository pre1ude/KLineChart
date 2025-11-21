import { normalize, interpolateNumber, ticks, tickStep, nice, floor, ceil } from './utils'

export interface LinearScale {
  (x: number): number
  ticks: (tickCount?: number) => number[]
  nice: (tickCount?: number) => void
}

export interface LinearScaleOptions {
  domain: [number, number]
  range: [number, number]
  interpolate?: (t: number, start: number, stop: number) => number
}

export function createLinear({
  domain: [d0, d1],
  range: [r0, r1],
  interpolate = interpolateNumber
}: LinearScaleOptions): LinearScale {
  let domainStart = d0
  let domainEnd = d1

  const scale = (x: number): number => {
    const t = normalize(x, domainStart, domainEnd)
    return interpolate(t, r0, r1)
  }

  scale.ticks = (tickCount: number = 10): number[] => {
    return ticks(domainStart, domainEnd, tickCount)
  }

  scale.nice = (tickCount: number = 10): void => {
    if (domainStart === domainEnd) return

    const step = tickStep(domainStart, domainEnd, tickCount)
    const niceDomain = nice([domainStart, domainEnd], {
      floor: (x: number) => floor(x, step),
      ceil: (x: number) => ceil(x, step)
    })

    domainStart = niceDomain[0]
    domainEnd = niceDomain[1]
  }

  return scale
}
