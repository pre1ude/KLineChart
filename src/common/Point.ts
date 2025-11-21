
export default interface Point {
  dataIndex: number
  timestamp: number
  value: number
  dataKey: string // 如果想用当前dataIndex数据上的其他字段值, 比如 close
}
