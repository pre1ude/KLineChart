import type KLineData from './KLineData'

export default interface VisibleData {
  dataIndex: number
  x: number
  data: KLineData
}
