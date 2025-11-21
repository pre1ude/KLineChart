
import type KLineData from '../../../common/KLineData'
import { type IndicatorTemplate, IndicatorSeries } from '../../../component/Indicator'

interface WaPrice {
  waPrice?: number
}

const waPrice: IndicatorTemplate<WaPrice> = {
  name: 'WA_PRICE',
  shortName: '',
  series: IndicatorSeries.Price,
  shouldFormatBigNumber: true,
  precision: 3,
  figures: [
    {
      key: 'waPrice',
      // title: '分时均价: ',
      type: 'line',
      styles: () => {
        return { color: '#FFC62B' }
      }
    }
  ],
  calc: (dataList: KLineData[]) => {
    return dataList.map((kLineData: KLineData) => {
      const waPrice = kLineData.waPrice ?? 0
      return { waPrice }
    })
  }
}

export default waPrice
