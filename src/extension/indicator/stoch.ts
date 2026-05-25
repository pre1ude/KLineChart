import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'
import { calcHhvLlv } from './utils'

interface Kdj {
  k?: number
  d?: number
  j?: number
}

/**
 * KDJ
 *
 * 当日K值=2/3×前一日K值+1/3×当日RSV
 * 当日D值=2/3×前一日D值+1/3×当日K值
 * 若无前一日K 值与D值，则可分别用50来代替。
 * J值=3*当日K值-2*当日D值
 */
const stoch: IndicatorTemplate<Kdj> = {
  name: 'KDJ',
  shortName: 'KDJ',
  calcParams: [9, 3, 3],
  figures: [
    { key: 'k', title: 'K: ', type: 'line' },
    { key: 'd', title: 'D: ', type: 'line' },
    { key: 'j', title: 'J: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Kdj>) => {
    const [period, kPeriod, dPeriod] = indicator.calcParams
    const dataCount = dataList.length
    const result = new Array<Kdj>(dataCount)
    const hhvList = new Array<number>(dataCount)
    const llvList = new Array<number>(dataCount)
    calcHhvLlv(dataList, period, hhvList, llvList)
    for (let i = 0; i < dataCount; i++) {
      const kdj: Kdj = {}
      const close = dataList[i].close

      if (i >= period - 1) {
        const hhv = hhvList[i]
        const llv = llvList[i]
        const hl = hhv - llv
        const rsv = (close - llv) / (hl === 0 ? 1 : hl) * 100
        kdj.k = ((kPeriod - 1) * (result[i - 1]?.k ?? 50) + rsv) / kPeriod
        kdj.d = ((dPeriod - 1) * (result[i - 1]?.d ?? 50) + kdj.k) / dPeriod
        kdj.j = 3.0 * kdj.k - 2.0 * kdj.d
      }
      result[i] = kdj
    }
    return result
  }
}

export default stoch
