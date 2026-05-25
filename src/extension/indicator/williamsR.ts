import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'
import { calcHhvLlv } from './utils'

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
    const paramCount = params.length
    const dataCount = dataList.length
    const result = new Array<Wr>(dataCount)
    for (let i = 0; i < dataCount; i++) {
      result[i] = {}
    }
    const hhvList = new Array<number>(dataCount)
    const llvList = new Array<number>(dataCount)
    for (let index = 0; index < paramCount; index++) {
      const period = params[index]
      const figureKey = figures[index].key as keyof Wr
      if (period <= 0) {
        for (let i = 0; i < dataCount; i++) {
          result[i][figureKey] = NaN
        }
        continue
      }

      calcHhvLlv(dataList, period, hhvList, llvList)
      for (let i = 0; i < dataCount; i++) {
        if (i >= period - 1) {
          const close = dataList[i].close
          const hhv = hhvList[i]
          const llv = llvList[i]
          const hl = hhv - llv
          result[i][figureKey] = hl === 0 ? 0 : (close - hhv) / hl * 100
        }
      }
    }
    return result
  }
}

export default williamsR
