import type KLineData from './KLineData'

export default interface Crosshair {
  x?: number
  y?: number
  paneId?: string
  realX?: number
  kLineData?: KLineData
  dataIndex?: number
  realDataIndex?: number
}
