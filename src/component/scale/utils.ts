export interface NiceInterval {
  floor: (x: number) => number
  ceil: (x: number) => number
}

export function ceil(n: number, base: number): number {
  if (base === 0) return n
  return base * Math.ceil(n / base)
}

export function floor(n: number, base: number): number {
  if (base === 0) return n
  return base * Math.floor(n / base)
}

export function round(n: number): number {
  // Use a more precise rounding approach
  const factor = 1e12
  return Math.round(n * factor) / factor
}

export function normalize(value: number, start: number, stop: number): number {
  const range = stop - start
  if (range === 0) return 0
  return (value - start) / range
}

export function log(n: number, base: number): number {
  if (n <= 0 || base <= 0 || base === 1) {
    throw new Error('Invalid arguments for logarithm')
  }
  return Math.log(n) / Math.log(base)
}

export function nice(domain: [number, number], interval: NiceInterval): [number, number] {
  const [min, max] = domain
  return [interval.floor(min), interval.ceil(max)]
}

export function random(a: number = 0, b: number = 1): number {
  return a + (b - a) * Math.random()
}

// @see https://github.com/d3/d3-array/blob/main/src/ticks.js#L46
export function tickStep(min: number, max: number, count: number): number {
  if (count <= 0) return 1
  if (min === max) return 1

  const e10 = Math.sqrt(50)
  const e5 = Math.sqrt(10)
  const e2 = Math.sqrt(2)
  const step0 = Math.abs(max - min) / Math.max(1, count)
  let step1 = 10 ** Math.floor(Math.log(step0) / Math.LN10)
  const error = step0 / step1

  if (error >= e10) step1 *= 10
  else if (error >= e5) step1 *= 5
  else if (error >= e2) step1 *= 2

  return step1
}

export function ticks(min: number, max: number, count: number): number[] {
  if (min === max) return [min]
  if (count <= 0) return []

  const step = tickStep(min, max, count)
  const start = Math.ceil(min / step)
  const stop = Math.floor(max / step)
  const n = Math.ceil(stop - start + 1)

  if (n <= 0) return []

  const values = new Array<number>(n)
  for (let i = 0; i < n; i += 1) {
    values[i] = round((start + i) * step)
  }
  return values
}

export function interpolateNumber(t: number, start: number, stop: number): number {
  return start * (1 - t) + stop * t
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
