import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Pbx {
  [key: string]: number | undefined
}

/**
 * PBX 瀑布线
 *
 * PBXn = (EMA(CLOSE, M) + MA(CLOSE, 2M) + MA(CLOSE, 4M)) / 3
 */
const pbx: IndicatorTemplate<Pbx> = {
  name: 'PBX',
  shortName: 'PBX',
  series: IndicatorSeries.Price,
  calcParams: [4, 6, 9, 13, 18, 24],
  shouldOhlc: true,
  figures: [
    { key: 'pbx1', title: 'PBX1: ', type: 'line', calcParamIndex: 0 },
    { key: 'pbx2', title: 'PBX2: ', type: 'line', calcParamIndex: 1 },
    { key: 'pbx3', title: 'PBX3: ', type: 'line', calcParamIndex: 2 },
    { key: 'pbx4', title: 'PBX4: ', type: 'line', calcParamIndex: 3 },
    { key: 'pbx5', title: 'PBX5: ', type: 'line', calcParamIndex: 4 },
    { key: 'pbx6', title: 'PBX6: ', type: 'line', calcParamIndex: 5 }
  ],
  regenerateFigures: (params) => {
    return params.map((_period, index) => {
      return { key: `pbx${index + 1}`, title: `PBX${index + 1}: `, type: 'line', calcParamIndex: index }
    })
  },
  calc: (dataList: KLineData[], indicator: Indicator<Pbx>) => {
    const { calcParams: params, figures } = indicator
    const dataCount = dataList.length
    const result = new Array<Pbx>(dataCount)
    const emaValues = new Array<number>(params.length)
    const ma2Sums = new Array<number>(params.length).fill(0)
    const ma4Sums = new Array<number>(params.length).fill(0)

    for (let i = 0; i < dataCount; i++) {
      const close = dataList[i].close
      const pbxResult: Pbx = {}

      params.forEach((period, index) => {
        const key = figures[index]?.key ?? `pbx${index + 1}`
        if (period <= 0) {
          pbxResult[key] = NaN
          return
        }

        emaValues[index] = i === 0
          ? close
          : (2 * close + (period - 1) * emaValues[index]) / (period + 1)

        ma2Sums[index] += close
        ma4Sums[index] += close

        const ma2Period = period * 2
        const ma4Period = period * 4
        let ma2: number | undefined
        if (i >= ma2Period - 1) {
          ma2 = ma2Sums[index] / ma2Period
          ma2Sums[index] -= dataList[i - (ma2Period - 1)].close
        }
        if (i >= ma4Period - 1) {
          const ma4 = ma4Sums[index] / ma4Period
          if (ma2 !== undefined) {
            pbxResult[key] = (emaValues[index] + ma2 + ma4) / 3
          }
          ma4Sums[index] -= dataList[i - (ma4Period - 1)].close
        }
      })

      result[i] = pbxResult
    }

    return result
  }
}

export default pbx
