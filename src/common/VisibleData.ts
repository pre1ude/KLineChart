
import type Nullable from './Nullable'
import type KLineData from './KLineData'

export default interface VisibleData {
  dataIndex: number
  x: number
  data: Nullable<KLineData>
}
