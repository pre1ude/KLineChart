import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries, type IndicatorFigure } from '../../component/Indicator'

interface Vol {
  volume?: number
  ma1?: number
  ma2?: number
  ma3?: number
}

function getVolumeFigure(): IndicatorFigure<Vol> {
  return {
    key: 'volume',
    title: 'VOLUME: ',
    type: 'bar',
    baseValue: 0,
    drawOrder: -1,
    styles: (dataIndex, _indicator, kLineDataList, defaultStyles) => {
      const kLineData = kLineDataList[dataIndex]

      let color = defaultStyles.bars[0].noChangeColor
      if (kLineData.close > kLineData.open) {
        color = defaultStyles.bars[0].upColor
      } else if (kLineData.close < kLineData.open) {
        color = defaultStyles.bars[0].downColor
      }

      return { color }
    }
  }
}

const volume: IndicatorTemplate<Vol> = {
  name: 'VOL',
  shortName: 'VOL',
  series: IndicatorSeries.Volume,
  calcParams: [5, 10, 20],
  shouldFormatBigNumber: true,
  precision: 0,
  figures: [
    { key: 'ma1', title: 'MA5: ', type: 'line', calcParamIndex: 0 },
    { key: 'ma2', title: 'MA10: ', type: 'line', calcParamIndex: 1 },
    { key: 'ma3', title: 'MA20: ', type: 'line', calcParamIndex: 2 },
    getVolumeFigure()
  ],
  regenerateFigures: (params) => {
    const figures: Array<IndicatorFigure<Vol>> = params.map((p, i) => {
      return { key: `ma${i + 1}`, title: `MA${p}: `, type: 'line', calcParamIndex: i }
    })
    figures.push(getVolumeFigure())
    return figures
  },
  calc: (dataList: KLineData[], indicator: Indicator<Vol>) => {
    const { calcParams: params, figures } = indicator
    const volSums: number[] = []
    return dataList.map((kLineData, i) => {
      const volume = kLineData.volume ?? 0
      const vol: Vol = { volume }
      params.forEach((p, index) => {
        // 对于无效的周期参数（<= 0），设置为 NaN
        if (p <= 0) {
          vol[figures[index].key as keyof Vol] = NaN
          return
        }

        volSums[index] = (volSums[index] ?? 0) + volume
        if (i >= p - 1) {
          vol[figures[index].key as keyof Vol] = volSums[index] / p
          volSums[index] -= (dataList[i - (p - 1)].volume ?? 0)
        }
      })
      return vol
    })
  }
}

export default volume
