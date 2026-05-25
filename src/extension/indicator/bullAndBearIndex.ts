import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Bbi {
  bbi?: number
}

/**
 * 多空指标
 * 公式: BBI = (MA(CLOSE, M) + MA(CLOSE, N) + MA(CLOSE, O) + MA(CLOSE, P)) / 4
 *
 */
const bullAndBearIndex: IndicatorTemplate<Bbi> = {
  name: 'BBI',
  shortName: 'BBI',
  series: IndicatorSeries.Price,
  precision: 2,
  calcParams: [3, 6, 12, 24],
  shouldOhlc: true,
  figures: [
    { key: 'bbi', title: 'BBI: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Bbi>) => {
    const params = indicator.calcParams
    const paramCount = params.length
    const maxPeriod = Math.max(...params)
    const closeSums = new Array<number>(paramCount)
    const mas = new Array<number>(paramCount)
    const dataCount = dataList.length
    const result = new Array<Bbi>(dataCount)
    for (let i = 0; i < dataCount; i++) {
      const bbi: Bbi = {}
      const kLineData = dataList[i]
      const close = kLineData.close
      for (let index = 0; index < paramCount; index++) {
        const p = params[index]
        closeSums[index] = (closeSums[index] ?? 0) + close
        if (i >= p - 1) {
          mas[index] = closeSums[index] / p
          closeSums[index] -= dataList[i - (p - 1)].close
        }
      }
      if (i >= maxPeriod - 1) {
        let maSum = 0
        for (let j = 0; j < paramCount; j++) {
          maSum += mas[j]
        }
        bbi.bbi = maSum / 4
      }
      result[i] = bbi
    }
    return result
  }
}

export default bullAndBearIndex
