
import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Obv {
  obv?: number
  maObv?: number
}

/**
 * OBV
 * OBV = REF(OBV) + sign * V
 */
const onBalanceVolume: IndicatorTemplate<Obv> = {
  name: 'OBV',
  shortName: 'OBV',
  calcParams: [30],
  figures: [
    { key: 'obv', title: 'OBV: ', type: 'line' },
    { key: 'maObv', title: 'MAOBV: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Obv>) => {
    const params = indicator.calcParams as number[]
    let obvSum = 0
    let oldObv = 0
    const result: Obv[] = []
    dataList.forEach((kLineData: KLineData, i: number) => {
      const prevKLineData = dataList[i - 1] ?? kLineData
      if (kLineData.close < prevKLineData.close) {
        oldObv -= (kLineData.volume ?? 0)
      } else if (kLineData.close > prevKLineData.close) {
        oldObv += (kLineData.volume ?? 0)
      }
      const obv: Obv = { obv: oldObv }
      obvSum += oldObv
      if (i >= params[0] - 1) {
        obv.maObv = obvSum / params[0]
        obvSum -= (result[i - (params[0] - 1)].obv ?? 0)
      }
      result.push(obv)
    })
    return result
  }
}

export default onBalanceVolume
