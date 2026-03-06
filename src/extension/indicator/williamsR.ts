import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'
import { getMaxMin } from '../../common/utils/number'

interface Wr {
  wr1?: number
  wr2?: number
  wr3?: number
}

/**
 * WR
 * 公式 WR(N) = 100 * [ C - HIGH(N) ] / [ HIGH(N)-LOW(N) ]
 */
const williamsR: IndicatorTemplate<Wr> = {
  name: 'WR',
  shortName: 'WR',
  calcParams: [6, 10, 14],
  figures: [
    { key: 'wr1', title: 'WR6: ', type: 'line' },
    { key: 'wr2', title: 'WR10: ', type: 'line' },
    { key: 'wr3', title: 'WR14: ', type: 'line' }
  ],
  regenerateFigures: (params) => {
    return params.map((p, i) => {
      return { key: `wr${i + 1}`, title: `WR${p}: `, type: 'line' }
    })
  },
  calc: (dataList: KLineData[], indicator: Indicator<Wr>) => {
    const { calcParams: params, figures } = indicator
    return dataList.map((kLineData, i) => {
      const wr: Wr = {}
      const close = kLineData.close
      params.forEach((param, index) => {
        // 对于无效的周期参数（<= 0），设置为 NaN
        if (param <= 0) {
          wr[figures[index].key as keyof Wr] = NaN
          return
        }

        const p = param - 1
        if (i >= p) {
          const hln = getMaxMin<KLineData>(dataList.slice(i - p, i + 1), 'high', 'low')
          const hn = hln[0]
          const ln = hln[1]
          const hnSubLn = hn - ln
          wr[figures[index].key as keyof Wr] = hnSubLn === 0 ? 0 : (close - hn) / hnSubLn * 100
        }
      })
      return wr
    })
  }
}

export default williamsR
