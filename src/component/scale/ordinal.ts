export type OrdinalScale = (x: unknown) => unknown

export interface OrdinalScaleOptions {
  domain: unknown[]
  range: unknown[]
}

export function createOrdinal({ domain, range }: OrdinalScaleOptions): OrdinalScale {
  const key = JSON.stringify
  const indexMap = new Map(domain.map((d: unknown, i: number) => [key(d), i]))
  return (x: unknown): unknown => {
    const index = indexMap.get(key(x))
    return index !== undefined ? range[index % range.length] : undefined
  }
}
