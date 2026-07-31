import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'
import { calcHhvLlv } from './utils'

interface Mike {
  wr?: number
  mr?: number
  sr?: number
  ws?: number
  ms?: number
  ss?: number
}

/**
 * MIKE
 */
const mike: IndicatorTemplate<Mike> = {
  name: 'MIKE',
  shortName: 'MIKE',
  series: IndicatorSeries.Price,
  calcParams: [12],
  shouldOhlc: true,
  figures: [
    { key: 'wr', title: 'WR: ', type: 'line' },
    { key: 'mr', title: 'MR: ', type: 'line' },
    { key: 'sr', title: 'SR: ', type: 'line' },
    { key: 'ws', title: 'WS: ', type: 'line' },
    { key: 'ms', title: 'MS: ', type: 'line' },
    { key: 'ss', title: 'SS: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Mike>) => {
    const [period] = indicator.calcParams
    const dataCount = dataList.length
    const result = new Array<Mike>(dataCount)
    const hhvList = new Array<number>(dataCount)
    const llvList = new Array<number>(dataCount)
    calcHhvLlv(dataList, period, hhvList, llvList)

    for (let i = 0; i < dataCount; i++) {
      const mike: Mike = {}
      if (i >= period - 1) {
        const { high, low, close } = dataList[i]
        const typ = (high + low + close) / 3
        const hhv = hhvList[i]
        const llv = llvList[i]
        mike.wr = 2 * typ - llv
        mike.mr = typ + hhv - llv
        mike.sr = 2 * hhv - llv
        mike.ws = 2 * typ - hhv
        mike.ms = typ - hhv + llv
        mike.ss = 2 * llv - hhv
      }
      result[i] = mike
    }
    return result
  }
}

export default mike
