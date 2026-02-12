/**
 * 二分查找最近的元素索引
 * @returns 最近元素的索引，空数组返回 -1
 */
export function binarySearchNearest<T>(arr: T[], key: keyof T, value: number): number {
  const lb = lowerBound(arr, item => (item[key] as number) - value)
  if (lb === arr.length) return lb - 1
  if (arr[lb][key] === value || lb === 0) return lb

  const lDiff = value - (arr[lb - 1][key] as number)
  const rDiff = (arr[lb][key] as number) - value
  return lDiff <= rDiff ? lb - 1 : lb
}

// 参考 std::lower_bound
// element >= value
export function lowerBound<T>(arr: T[], cmp: (v: T) => number): number {
  let low = 0
  let high = arr.length

  while (low < high) {
    const mid = (low + high) >> 1

    if (cmp(arr[mid]) < 0) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

// 参考 std::upper_bound
// element > value
export function upperBound<T>(arr: T[], cmp: (v: T) => number): number {
  let low = 0
  let high = arr.length

  while (low < high) {
    const mid = (low + high) >> 1

    if (cmp(arr[mid]) <= 0) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

/**
 * 优化数字
 * @param value
 * @return {number|number}
 */
export function nice(value: number): number {
  const exponent = Math.floor(log10(value))
  const exp10 = index10(exponent)
  const f = value / exp10 // 1 <= f < 10
  let nf = 0
  if (f < 1.5) {
    nf = 1
  } else if (f < 2.5) {
    nf = 2
  } else if (f < 3.5) {
    nf = 3
  } else if (f < 4.5) {
    nf = 4
  } else if (f < 5.5) {
    nf = 5
  } else if (f < 6.5) {
    nf = 6
  } else {
    nf = 8
  }
  value = nf * exp10
  return exponent >= -20 ? +value.toFixed(exponent < 0 ? -exponent : 0) : value
}

/**
 * 四舍五入
 * @param value
 * @param precision
 * @return {number}
 */
export function round(value: number, precision: number): number {
  if (precision == null) {
    precision = 10
  }
  precision = Math.min(Math.max(0, precision), 20)
  const v = (+value).toFixed(precision)
  return +v
}

/**
 * 获取小数位数
 * @param value
 * @return {number|number}
 */
export function getPrecision(value: number): number {
  const str = value.toString()
  const eIndex = str.indexOf('e')
  if (eIndex > 0) {
    const precision = +str.slice(eIndex + 1)
    return precision < 0 ? -precision : 0
  }
  const dotIndex = str.indexOf('.')
  return dotIndex < 0 ? 0 : str.length - 1 - dotIndex

}

export function getMaxMin<D>(dataList: D[], maxKey: keyof D, minKey: keyof D): number[] {
  const maxMin = [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
  dataList.forEach(data => {
    maxMin[0] = Math.max((data[maxKey] ?? data) as number, maxMin[0])
    maxMin[1] = Math.min((data[minKey] ?? data) as number, maxMin[1])
  })
  return maxMin
}

/**
 * 10为底的对数函数
 * @param value
 * @return {number}
 */
export function log10(value: number): number {
  return Math.log(value) / Math.log(10)
}

/**
 * 10的指数函数
 * @param value
 * @return {number}
 */
export function index10(value: number): number {
  return Math.pow(10, value)
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function inBetween(v: number, min: number, max: number, inclusive = true) {
  if (inclusive) return v >= min && v <= max
  return v > min && v < max
}
