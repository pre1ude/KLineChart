import { createLinear } from './linear'

export interface TimeScale {
  (x: Date): number
  nice: (tickCount?: number) => void
  ticks: (tickCount?: number) => Date[]
}

export interface TimeScaleOptions {
  domain: [Date, Date]
  range: [number, number]
}

export function createTime ({ domain, range, ...rest }: TimeScaleOptions): TimeScale {
  const transform = (x: Date): number => x.getTime()
  const transformedDomain: [number, number] = domain.map(transform) as [number, number]
  const linear = createLinear({ domain: transformedDomain, range, ...rest })
  const scale = (x: Date): number => linear(transform(x))

  scale.nice = (tickCount?: number): void => { linear.nice(tickCount) }
  scale.ticks = (tickCount?: number): Date[] => linear.ticks(tickCount).map((d: number) => new Date(d))

  return scale
}
