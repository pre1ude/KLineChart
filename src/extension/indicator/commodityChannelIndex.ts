import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Cci {
  cci?: number
}

/**
 * CCI
 * CCI（N日）=（TP－MA）÷MD÷0.015
 * 其中，TP=（最高价+最低价+收盘价）÷3
 * MA=近N日TP价的累计之和÷N
 * MD=近N日TP - 当前MA绝对值的累计之和÷N
 *
 */
const commodityChannelIndex: IndicatorTemplate<Cci> = {
  name: 'CCI',
  shortName: 'CCI',
  calcParams: [14],
  figures: [
    { key: 'cci', title: 'CCI: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Cci>) => {
    const period = indicator.calcParams[0]
    let tpSum = 0
    const dataCount = dataList.length
    const tpList = new Array<number>(dataCount)
    const result = new Array<Cci>(dataCount)
    for (let i = 0; i < dataCount; i++) {
      const cci: Cci = {}
      const kLineData = dataList[i]
      const tp = (kLineData.high + kLineData.low + kLineData.close) / 3
      tpList[i] = tp
      tpSum += tp
      if (i >= period - 1) {
        const maTp = tpSum / period
        let sum = 0
        for (let j = i - period + 1; j <= i; j++) {
          sum += Math.abs(tpList[j] - maTp)
        }
        const md = sum / period
        cci.cci = md !== 0 ? (tp - maTp) / md / 0.015 : 0
        tpSum -= tpList[i - period + 1]
      }
      result[i] = cci
    }
    return result
  }
}

export default commodityChannelIndex
