import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Ma {
  ma1?: number
  ma2?: number
  ma3?: number
  ma4?: number
}

/**
 * MA 简单移动平均 (Simple Moving Average)
 */
const movingAverage: IndicatorTemplate<Ma> = {
  name: 'MA',
  shortName: 'MA',
  series: IndicatorSeries.Price,
  calcParams: [5, 10, 30, 60],
  precision: 2,
  shouldOhlc: true,
  figures: [
    { key: 'ma1', title: 'MA5: ', type: 'line', calcParamIndex: 0 },
    { key: 'ma2', title: 'MA10: ', type: 'line', calcParamIndex: 1 },
    { key: 'ma3', title: 'MA30: ', type: 'line', calcParamIndex: 2 },
    { key: 'ma4', title: 'MA60: ', type: 'line', calcParamIndex: 3 }
  ],
  regenerateFigures: (params) => {
    return params.map((p, i) => {
      return { key: `ma${i + 1}`, title: `MA${p}: `, type: 'line', calcParamIndex: i }
    })
  },
  calc: (dataList: KLineData[], indicator: Indicator<Ma>) => {
    const { calcParams: params, figures } = indicator
    const closeSums: number[] = []
    return dataList.map((kLineData, i) => {
      const ma: Ma = {}
      const close = kLineData.close
      params.forEach((p, index) => {
        // 对于无效的周期参数（<= 0），设置为 NaN
        if (p <= 0) {
          ma[figures[index].key as keyof Ma] = NaN
          return
        }

        closeSums[index] = (closeSums[index] ?? 0) + close
        if (i >= p - 1) {
          ma[figures[index].key as keyof Ma] = closeSums[index] / p
          closeSums[index] -= dataList[i - (p - 1)].close
        }
      })
      return ma
    })
  }
}

export default movingAverage
