

import type Coordinate from './Coordinate'
import type KLineData from './KLineData'

export default interface Crosshair extends Partial<Coordinate> {
  paneId?: string
  realX?: number
  kLineData?: KLineData
  dataIndex?: number
  realDataIndex?: number
}
