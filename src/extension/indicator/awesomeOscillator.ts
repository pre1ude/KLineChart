

import type KLineData from '../../common/KLineData'
import { PolygonType } from '../../common/Styles'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Ao {
  ao?: number
}

const awesomeOscillator: IndicatorTemplate<Ao> = {
  name: 'AO',
  shortName: 'AO',
  calcParams: [5, 34],
  figures: [{
    key: 'ao',
    title: 'AO: ',
    type: 'bar',
    baseValue: 0,
    styles: (dataIndex, indicator, _kLineDataList, defaultStyles) => {
      const prevAo = indicator.result[dataIndex - 1]?.ao ?? Number.MIN_SAFE_INTEGER
      const currentAo = indicator.result[dataIndex]?.ao ?? Number.MIN_SAFE_INTEGER

      const isUp = currentAo > prevAo
      const color = isUp
        ? defaultStyles.bars[0].upColor
        : defaultStyles.bars[0].downColor

      return {
        color,
        style: isUp ? PolygonType.Stroke : PolygonType.Fill,
        borderColor: color
      }
    }
  }],
  calc: (dataList: KLineData[], indicator: Indicator<Ao>) => {
    const params = indicator.calcParams
    const maxPeriod = Math.max(params[0] as number, params[1] as number)
    let shortSum = 0
    let longSum = 0
    let short = 0
    let long = 0
    return dataList.map((kLineData: KLineData, i: number) => {
      const ao: Ao = {}
      const middle = (kLineData.low + kLineData.high) / 2
      shortSum += middle
      longSum += middle
      if (i >= params[0] - 1) {
        short = shortSum / params[0]
        const agoKLineData = dataList[i - (params[0] - 1)]
        shortSum -= ((agoKLineData.low + agoKLineData.high) / 2)
      }
      if (i >= params[1] - 1) {
        long = longSum / params[1]
        const agoKLineData = dataList[i - (params[1] - 1)]
        longSum -= ((agoKLineData.low + agoKLineData.high) / 2)
      }
      if (i >= maxPeriod - 1) {
        ao.ao = short - long
      }
      return ao
    })
  }
}

export default awesomeOscillator
