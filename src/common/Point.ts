/**
 * 派生几何点 - 用于坐标转换和临时绘图计算
 * 不作为 Overlay 的业务状态或持久化数据
 */
export interface IPoint {
  /**
   * 数据索引 - 可以是负数（左边界外）或超出数据长度（右边界外）
   */
  dataIndex: number

  /**
   * Y轴坐标值
   */
  value: number
}

/**
 * 画线时间点 - Overlay 内部状态、API 输入输出和持久化统一使用
 * 使用 timestamp + offset 可以在数据变化时保持位置稳定
 */
export interface Point {
  /**
   * 时间戳 - 用于持久化存储
   * - 数据范围内的点：使用实际数据的 timestamp
   * - 超出右边的点：使用最后一个数据的 timestamp
   * - 超出左边的点：使用第一个数据的 timestamp
   */
  timestamp: number

  /**
   * Y轴坐标值
   */
  value: number

  /**
   * 相对于 timestamp 对应数据点的整数偏移量（以 bar 为单位）
   * 仅接受整数，拒绝小数、NaN 和 Infinity，不进行取整
   * - 0: 无偏移，在数据范围内, 与 undefined 等价
   * - 正数: 向右偏移，超出最后一个数据点
   * - 负数: 向左偏移，超出第一个数据点
   */
  offset?: number
}

export function isValidPointOffset(point: Pick<Point, 'offset'>): boolean {
  return point.offset === undefined || Number.isInteger(point.offset)
}
