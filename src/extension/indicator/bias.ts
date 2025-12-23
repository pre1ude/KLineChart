import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Bias {
  bias1?: number
  bias2?: number
  bias3?: number
}

/**
 * BIAS
 * 乖离率=[(当日收盘价-N日平均价)/N日平均价]*100%
 */
const bias: IndicatorTemplate<Bias> = {
  name: 'BIAS',
  shortName: 'BIAS',
  calcParams: [6, 12, 24],
  figures: [
    { key: 'bias1', title: 'BIAS6: ', type: 'line' },
    { key: 'bias2', title: 'BIAS12: ', type: 'line' },
    { key: 'bias3', title: 'BIAS24: ', type: 'line' }
  ],
  regenerateFigures: (params) => {
    return params.map((p, i) => {
      return { key: `bias${i + 1}`, title: `BIAS${p}: `, type: 'line' }
    })
  },
  calc: (dataList: KLineData[], indicator: Indicator<Bias>) => {
    const { calcParams: params, figures } = indicator
    const closeSums: number[] = []
    return dataList.map((kLineData, i) => {
      const bias: Bias = {}
      const close = kLineData.close
      params.forEach((p, index) => {
        // 对于无效的周期参数（<= 0），设置为 NaN
        if (p <= 0) {
          bias[figures[index].key as keyof Bias] = NaN
          return
        }

        closeSums[index] = (closeSums[index] ?? 0) + close
        if (i >= p - 1) {
          const mean = closeSums[index] / params[index]
          bias[figures[index].key as keyof Bias] = (close - mean) / mean * 100

          closeSums[index] -= dataList[i - (p - 1)].close
        }
      })
      return bias
    })
  }
}

export default bias
