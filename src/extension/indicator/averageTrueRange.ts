import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Atr {
  atr?: number
}

/**
 * ATR = RMA(TR, N)
 * TR = MAX(HIGH - LOW, ABS(HIGH - REF(CLOSE, 1)), ABS(LOW - REF(CLOSE, 1)))
 */
const averageTrueRange: IndicatorTemplate<Atr> = {
  name: 'ATR',
  shortName: 'ATR',
  series: IndicatorSeries.Price,
  calcParams: [14],
  figures: [
    { key: 'atr', title: 'ATR: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Atr>) => {
    const [period] = indicator.calcParams
    if (!Number.isInteger(period) || period <= 0) {
      return dataList.map(() => ({ atr: NaN }))
    }

    let trueRangeSum = 0
    let atr = 0
    const result = new Array<Atr>(dataList.length)
    for (let i = 0; i < dataList.length; i++) {
      const atrResult: Atr = {}
      const { high, low } = dataList[i]
      const previousClose = (dataList[i - 1] ?? dataList[i]).close
      const trueRange = Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose)
      )
      trueRangeSum += trueRange

      if (i === period - 1) {
        atr = trueRangeSum / period
        atrResult.atr = atr
      } else if (i > period - 1) {
        atr = (atr * (period - 1) + trueRange) / period
        atrResult.atr = atr
      }
      result[i] = atrResult
    }
    return result
  }
}

export default averageTrueRange
