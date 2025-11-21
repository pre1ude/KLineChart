

import type KLineData from '../../../common/KLineData'
import { type IndicatorTemplate, IndicatorSeries } from '../../../component/Indicator'

interface OI {
  openInterest?: number
}

const openInterest: IndicatorTemplate<OI> = {
  name: 'OPEN_INTEREST',
  shortName: '',
  series: IndicatorSeries.Volume,
  shouldFormatBigNumber: true,
  precision: 0,
  figures: [
    {
      key: 'openInterest',
      // title: '持仓量: ',
      type: 'line',
      styles: () => {
        return { color: '#E6A760' }
      }
    }
  ],
  calc: (dataList: KLineData[]) => {
    return dataList.map((kLineData: KLineData) => {
      const openInterest = kLineData.openInterest ?? 0
      return { openInterest }
    })
  }
}

export default openInterest
