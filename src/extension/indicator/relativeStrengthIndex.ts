import { isNumber } from '@/common/utils/typeChecks'
import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Rsi {
  rsi1?: number
  rsi2?: number
  rsi3?: number
}

/**
 * RSI
 * RSI = SUM(MAX(CLOSE - REF(CLOSE,1),0),N) / SUM(ABS(CLOSE - REF(CLOSE,1)),N) × 100
 */
const relativeStrengthIndex: IndicatorTemplate<Rsi> = {
  name: 'RSI',
  shortName: 'RSI',
  calcParams: [6, 12, 24],
  figures: [
    { key: 'rsi1', title: 'RSI6: ', type: 'line' },
    { key: 'rsi2', title: 'RSI12: ', type: 'line' },
    { key: 'rsi3', title: 'RSI24: ', type: 'line' }
  ],
  regenerateFigures: (params) => {
    return params.map((p, index) => {
      const num = index + 1
      return { key: `rsi${num}`, title: `RSI${p}: `, type: 'line' }
    })
  },
  calc: (dataList: KLineData[], indicator: Indicator<Rsi>) => {
    const { calcParams: params, figures } = indicator

    return dataList.map((kLineData, i) => {
      const rsi: Rsi = {}

      // 计算价格变化
      const prevClose = (dataList[i - 1] ?? kLineData).close
      const change = kLineData.close - prevClose
      const gain = Math.max(change, 0)
      const loss = Math.abs(Math.min(change, 0))

      params.forEach((period, index) => {
        const figureKey = figures[index].key as keyof Rsi

        // 对于无效的周期参数（<= 0），设置为 NaN
        if (period <= 0) {
          rsi[figureKey] = NaN
          return
        }

        let avgGain: number = NaN
        let avgLoss: number = NaN
        let rsiValue: number = NaN

        if (i >= period) {
          if (i === period) {
            // 初始计算：使用简单移动平均
            let gainSum = 0
            let lossSum = 0

            // 计算前period个周期的平均涨跌幅
            for (let j = 1; j <= period; j++) {
              const prevData = dataList[i - j + 1]
              const prevPrevData = dataList[i - j] ?? prevData
              const periodChange = prevData.close - prevPrevData.close

              if (periodChange > 0) {
                gainSum += periodChange
              } else {
                lossSum += Math.abs(periodChange)
              }
            }

            avgGain = gainSum / period
            avgLoss = lossSum / period
          } else {
            // 后续计算：使用Wilder的平滑移动平均 (EMA with alpha = 1/period)
            const prevResult = dataList[i - 1]
            const prevAvgGain = isNumber(prevResult[`${figureKey}_avgGain`]) ? prevResult[`${figureKey}_avgGain`] : 0
            const prevAvgLoss = isNumber(prevResult[`${figureKey}_avgLoss`]) ? prevResult[`${figureKey}_avgLoss`] : 0

            // Wilder's smoothing: new_avg = (prev_avg * (period-1) + current_value) / period
            avgGain = (prevAvgGain * (period - 1) + gain) / period
            avgLoss = (prevAvgLoss * (period - 1) + loss) / period
          }

          // 计算RSI
          if (avgLoss === 0) {
            rsiValue = 100
          } else if (avgGain === 0) {
            rsiValue = 0
          } else {
            const rs = avgGain / avgLoss
            rsiValue = 100 - (100 / (1 + rs))
          }

          // 存储中间计算结果供下次使用
          const currentData = kLineData
          currentData[`${figureKey}_avgGain`] = avgGain
          currentData[`${figureKey}_avgLoss`] = avgLoss

          rsi[figureKey] = rsiValue
        }
      })
      return rsi
    })
  }
}

export default relativeStrengthIndex
