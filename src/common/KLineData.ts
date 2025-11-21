

export default interface KLineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
  turnover?: number
  [key: string]: any
}
