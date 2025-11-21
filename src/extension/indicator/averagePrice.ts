
import type KLineData from '../../common/KLineData'
import { type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Avp {
  avp?: number
}

/**
 * average price
 */
const averagePrice: IndicatorTemplate<Avp> = {
  name: 'AVP',
  shortName: 'AVP',
  series: IndicatorSeries.Price,
  precision: 2,
  figures: [
    { key: 'avp', title: 'AVP: ', type: 'line' }
  ],
  calc: (dataList: KLineData[]) => {
    let totalTurnover = 0
    let totalVolume = 0
    return dataList.map((kLineData: KLineData) => {
      const avp: Avp = {}
      const turnover = kLineData?.turnover ?? 0
      const volume = kLineData?.volume ?? 0
      totalTurnover += turnover
      totalVolume += volume
      if (totalVolume !== 0) {
        avp.avp = totalTurnover / totalVolume
      }
      return avp
    })
  }
}

export default averagePrice
