export type OrdinalScale = (x: any) => any

export interface OrdinalScaleOptions {
  domain: any[]
  range: any[]
}

export function createOrdinal({ domain, range }: OrdinalScaleOptions): OrdinalScale {
  const key = JSON.stringify
  const indexMap = new Map(domain.map((d: any, i: number) => [key(d), i]))
  return (x: any): any => {
    const index = indexMap.get(key(x))
    return index !== undefined ? range[index % range.length] : undefined
  }
}
