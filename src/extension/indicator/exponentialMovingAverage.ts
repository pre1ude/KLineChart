import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Ema {
  ema1?: number
  ema2?: number
  ema3?: number
}

/**
 * EMA 指数移动平均
 */
const exponentialMovingAverage: IndicatorTemplate<Ema> = {
  name: 'EMA',
  shortName: 'EMA',
  series: IndicatorSeries.Price,
  calcParams: [6, 12, 20],
  precision: 2,
  shouldOhlc: true,
  figures: [
    { key: 'ema1', title: 'EMA6: ', type: 'line' },
    { key: 'ema2', title: 'EMA12: ', type: 'line' },
    { key: 'ema3', title: 'EMA20: ', type: 'line' }
  ],
  regenerateFigures: (params) => {
    return params.map((p, i) => {
      return { key: `ema${i + 1}`, title: `EMA${p}: `, type: 'line' }
    })
  },
  calc: (dataList: KLineData[], indicator: Indicator<Ema>) => {
    const { calcParams: params, figures } = indicator
    let closeSum = 0
    const emaValues: number[] = []
    return dataList.map((kLineData, i) => {
      const ema: Ema = {}
      const close = kLineData.close
      closeSum += close
      params.forEach((p, index) => {
        // 对于无效的周期参数（<= 0），设置为 NaN
        if (p <= 0) {
          ema[figures[index].key as keyof Ema] = NaN
          return
        }

        if (i >= p - 1) {
          if (i > p - 1) {
            emaValues[index] = (2 * close + (p - 1) * emaValues[index]) / (p + 1)
          } else {
            emaValues[index] = closeSum / p
          }
          ema[figures[index].key as keyof Ema] = emaValues[index]
        }
      })
      return ema
    })
  }
}

export default exponentialMovingAverage
