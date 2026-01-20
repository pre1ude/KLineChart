/**
 * 内部点表示 - 用于所有内部计算和渲染
 * 简化内部逻辑，只需要 dataIndex 和 value
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
 * 外部点表示 - 用于 API 输入输出和持久化
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
   * 相对于 timestamp 对应数据点的偏移量（以 bar 为单位）
   * - 0: 无偏移，在数据范围内
   * - 正数: 向右偏移，超出最后一个数据点
   * - 负数: 向左偏移，超出第一个数据点
   */
  offset: number
}
