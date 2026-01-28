import type KLineData from './KLineData'

enum LoadDataType {
  Init = 'init',
  Forward = 'forward',
  Backward = 'backward'
}

interface LoadDataParams {
  type: LoadDataType
  data?: KLineData
  callback: () => void
  addData: (dataList: KLineData[], more?: boolean) => void
}

export { LoadDataType, type LoadDataParams }

type LoadDataCallback = (params: LoadDataParams) => void

export default LoadDataCallback
