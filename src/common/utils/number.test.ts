import { describe, it, expect } from 'vitest'
import { binarySearchNearest, nice, round, getPrecision, clamp } from './number'

describe('binarySearchNearest', () => {
  type Item = { value: number }
  const toItems = (arr: number[]): Item[] => arr.map(value => ({ value }))

  it('空数组返回 -1', () => {
    expect(binarySearchNearest([], 'value', 5)).toBe(-1)
  })

  it('单元素始终返回 0', () => {
    expect(binarySearchNearest(toItems([10]), 'value', 5)).toBe(0)
    expect(binarySearchNearest(toItems([10]), 'value', 10)).toBe(0)
    expect(binarySearchNearest(toItems([10]), 'value', 15)).toBe(0)
  })

  it('超出范围返回边界', () => {
    expect(binarySearchNearest(toItems([10, 20]), 'value', 5)).toBe(0)
    expect(binarySearchNearest(toItems([10, 20]), 'value', 25)).toBe(1)
  })

  it('返回最近的索引', () => {
    expect(binarySearchNearest(toItems([10, 20]), 'value', 14)).toBe(0)
    expect(binarySearchNearest(toItems([10, 20]), 'value', 16)).toBe(1)
    expect(binarySearchNearest(toItems([1, 3, 5, 7, 9]), 'value', 6)).toBe(2)
  })

  it('精确匹配', () => {
    expect(binarySearchNearest(toItems([1, 3, 5, 7, 9]), 'value', 5)).toBe(2)
  })

  it('相等距离时偏向左边', () => {
    expect(binarySearchNearest(toItems([10, 20]), 'value', 15)).toBe(0)
  })
})

describe('clamp', () => {
  it('限制值在范围内', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('round', () => {
  it('四舍五入到指定精度', () => {
    expect(round(3.14159, 2)).toBe(3.14)
    expect(round(3.145, 2)).toBe(3.15)
  })
})

describe('getPrecision', () => {
  it('返回小数位数', () => {
    expect(getPrecision(123)).toBe(0)
    expect(getPrecision(3.14)).toBe(2)
    expect(getPrecision(1e-5)).toBe(5)
  })
})

describe('nice', () => {
  it('返回优化后的数字', () => {
    expect(nice(1.2)).toBe(1)
    expect(nice(2.3)).toBe(2)
    expect(nice(5.8)).toBe(6)
  })
})
