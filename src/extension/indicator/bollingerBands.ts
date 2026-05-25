import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Boll {
  up?: number
  mid?: number
  dn?: number
}

/**
 * BOLL
 */
const bollingerBands: IndicatorTemplate<Boll> = {
  name: 'BOLL',
  shortName: 'BOLL',
  series: IndicatorSeries.Price,
  calcParams: [20, 2],
  precision: 2,
  shouldOhlc: true,
  figures: [
    { key: 'up', title: 'UP: ', type: 'line' },
    { key: 'mid', title: 'MID: ', type: 'line' },
    { key: 'dn', title: 'DN: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Boll>) => {
    const [period, multiplier = 2] = indicator.calcParams
    let closeSum = 0
    let closeSquareSum = 0
    const dataCount = dataList.length
    const result = new Array<Boll>(dataCount)
    for (let i = 0; i < dataCount; i++) {
      const kLineData = dataList[i]
      const close = kLineData.close
      const boll: Boll = {}
      closeSum += close
      closeSquareSum += close * close
      if (i >= period - 1) {
        boll.mid = closeSum / period
        const variance = closeSquareSum / period - boll.mid * boll.mid
        const md = Math.sqrt(Math.max(variance, 0))
        boll.up = boll.mid + multiplier * md
        boll.dn = boll.mid - multiplier * md
        const leavingClose = dataList[i - period + 1].close
        closeSum -= leavingClose
        closeSquareSum -= leavingClose * leavingClose
      }
      result[i] = boll
    }
    return result
  }
}

export default bollingerBands
