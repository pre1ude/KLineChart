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
    const maxPeriod = Math.max(...params)
    const closeSums: number[] = []
    const mas: number[] = []
    return dataList.map((kLineData: KLineData, i: number) => {
      const bbi: Bbi = {}
      const close = kLineData.close
      params.forEach((p: number, index: number) => {
        closeSums[index] = (closeSums[index] ?? 0) + close
        if (i >= p - 1) {
          mas[index] = closeSums[index] / p
          closeSums[index] -= dataList[i - (p - 1)].close
        }
      })
      if (i >= maxPeriod - 1) {
        let maSum = 0
        mas.forEach(ma => {
          maSum += ma
        })
        bbi.bbi = maSum / 4
      }
      return bbi
    })
  }
}

export default bullAndBearIndex
