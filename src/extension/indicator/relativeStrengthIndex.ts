import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Rsi {
  rsi1?: number
  rsi2?: number
  rsi3?: number
}

/**
 * RSI
 * RSI = RMA(MAX(CLOSE - REF(CLOSE,1),0),N) / RMA(ABS(CLOSE - REF(CLOSE,1)),N) × 100
 * RMA 为 Wilder 平滑移动平均，首个值使用 N 周期简单平均。
 */
const relativeStrengthIndex: IndicatorTemplate<Rsi> = {
  name: 'RSI',
  shortName: 'RSI',
  calcParams: [6, 12, 24],
  figures: [
    { key: 'rsi1', title: 'RSI6: ', type: 'line', calcParamIndex: 0 },
    { key: 'rsi2', title: 'RSI12: ', type: 'line', calcParamIndex: 1 },
    { key: 'rsi3', title: 'RSI24: ', type: 'line', calcParamIndex: 2 }
  ],
  regenerateFigures: (params) => {
    return params.map((p, index) => {
      const num = index + 1
      return { key: `rsi${num}`, title: `RSI${p}: `, type: 'line', calcParamIndex: index }
    })
  },
  calc: (dataList: KLineData[], indicator: Indicator<Rsi>) => {
    const { calcParams: params, figures } = indicator
    const dataCount = dataList.length
    const paramCount = params.length
    const result = new Array<Rsi>(dataCount)
    const figureKeys = new Array<keyof Rsi>(paramCount)
    const avgGains = new Array<number>(paramCount).fill(0)
    const avgLosses = new Array<number>(paramCount).fill(0)

    for (let i = 0; i < paramCount; i++) {
      figureKeys[i] = figures[i].key as keyof Rsi
    }

    for (let i = 0; i < dataCount; i++) {
      const rsi: Rsi = {}
      const kLineData = dataList[i]
      const prevClose = (dataList[i - 1] ?? kLineData).close
      const change = kLineData.close - prevClose
      const gain = Math.max(change, 0)
      const loss = Math.max(-change, 0)

      for (let index = 0; index < paramCount; index++) {
        const period = params[index]
        const figureKey = figureKeys[index]
        // 对于无效的周期参数（<= 0），设置为 NaN
        if (period <= 0) {
          rsi[figureKey] = NaN
          continue
        }

        if (i > 0 && i < period) {
          avgGains[index] += gain
          avgLosses[index] += loss
          continue
        }
        if (i === period) {
          avgGains[index] = (avgGains[index] + gain) / period
          avgLosses[index] = (avgLosses[index] + loss) / period
        } else if (i > period) {
          avgGains[index] = (avgGains[index] * (period - 1) + gain) / period
          avgLosses[index] = (avgLosses[index] * (period - 1) + loss) / period
        }

        if (i >= period) {
          const total = avgGains[index] + avgLosses[index]
          rsi[figureKey] = total !== 0 ? avgGains[index] / total * 100 : 100
        }
      }
      result[i] = rsi
    }
    return result
  }
}

export default relativeStrengthIndex
