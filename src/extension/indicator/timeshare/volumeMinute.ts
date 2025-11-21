
import type KLineData from '../../../common/KLineData'
import { type IndicatorTemplate, IndicatorSeries, type IndicatorFigure } from '../../../component/Indicator'

interface Vol {
  volume?: number
}

function getVolumeFigure(): IndicatorFigure<Vol> {
  return {
    key: 'volume',
    // title: 'VOLUME: ',
    type: 'bar',
    baseValue: 0,
    styles: (dataIndex, _indicator, kLineDataList, defaultStyles) => {
      const kLineData = kLineDataList[dataIndex]

      let color = defaultStyles.bars[0].noChangeColor
      if (kLineData.diffLastPrice > 0) {
        color = defaultStyles.bars[0].upColor
      } else if (kLineData.diffLastPrice < 0) {
        color = defaultStyles.bars[0].downColor
      }

      return { color }
    }
  }
}

const volume: IndicatorTemplate<Vol> = {
  name: 'VOL_MINUTE',
  shortName: '',
  series: IndicatorSeries.Volume,
  shouldFormatBigNumber: true,
  precision: 0,
  minValue: 0,
  figures: [
    getVolumeFigure()
  ],
  calc: (dataList: KLineData[]) => {
    return dataList.map((kLineData: KLineData) => {
      const volume = kLineData.volume ?? 0
      return { volume }
    })
  }
}

export default volume
