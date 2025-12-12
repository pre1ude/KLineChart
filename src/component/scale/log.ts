import { createLinear } from './linear'
import { ticks, nice, log } from './utils'

export interface LogScale {
  (x: number): number
  invert: (y: number) => number
  ticks: (tickCount?: number) => number[]
  nice: () => void
}

export interface LogScaleOptions {
  domain: [number, number]
  range: [number, number]
  base?: number
}

export function createLog({ domain, base = Math.E, range, ...rest }: LogScaleOptions): LogScale {
  const transform = (x: number): number => Math.log(x)
  const untransform = (x: number): number => Math.exp(x)
  let linear = createLinear({ domain: domain.map(transform) as [number, number], range, ...rest })
  const scale = (x: number): number => linear(transform(x))

  scale.invert = (y: number): number => {
    return untransform(linear.invert(y))
  }

  scale.ticks = (tickCount: number = 5): number[] => {
    const [min, max] = domain.map((x: number) => log(x, base))
    return ticks(min, max, tickCount).map((x: number) => base ** x)
  }

  scale.nice = (): void => {
    const newDomain = nice(domain, {
      floor: (x: number) => base ** Math.floor(log(x, base)),
      ceil: (x: number) => base ** Math.ceil(log(x, base))
    })
    domain = newDomain
    linear = createLinear({ domain: domain.map(transform) as [number, number], range, ...rest })
  }

  return scale
}
