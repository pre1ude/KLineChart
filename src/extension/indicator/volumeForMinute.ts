/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type KLineData from '../../common/KLineData'
import { type IndicatorStyle } from '../../common/Styles'
import { formatValue } from '../../common/utils/format'
import { isValid } from '../../common/utils/typeChecks'

import { type Indicator, type IndicatorTemplate, type IndicatorFigureStylesCallbackData, IndicatorSeries, type IndicatorFigure } from '../../component/Indicator'

interface Vol {
  volume?: number
  openInterest?: number
}

function getVolumeFigure (): IndicatorFigure<Vol> {
  return {
    key: 'volume',
    title: 'VOLUME: ',
    type: 'bar',
    baseValue: 0,
    styles: (data: IndicatorFigureStylesCallbackData<Vol>, indicator: Indicator, defaultStyles: IndicatorStyle) => {
      const kLineData = data.current.kLineData
      let color = formatValue(indicator.styles, 'bars[0].noChangeColor', (defaultStyles.bars)[0].noChangeColor)
      if (isValid(kLineData)) {
        if (kLineData.close > kLineData.open) {
          color = formatValue(indicator.styles, 'bars[0].upColor', (defaultStyles.bars)[0].upColor)
        } else if (kLineData.close < kLineData.open) {
          color = formatValue(indicator.styles, 'bars[0].downColor', (defaultStyles.bars)[0].downColor)
        }
      }
      return { color: color as string }
    }
  }
}

const volumeForMinute: IndicatorTemplate<Vol> = {
  name: 'VOL_MINUTE',
  shortName: 'VOL_MINUTE',
  series: IndicatorSeries.Volume,
  shouldFormatBigNumber: true,
  precision: 0,
  minValue: 0,
  figures: [
    getVolumeFigure(),
    {
      key: 'openInterest',
      title: '持仓量: ',
      type: 'line',
      styles: () => {
        return { color: '#ccc' }
      }
    }
  ],
  calc: (dataList: KLineData[]) => {
    return dataList.map((kLineData: KLineData) => {
      const volume = kLineData.volume ?? 0
      const openInterest = kLineData.openInterest ?? 0

      return { volume, openInterest }
    })
  }
}

export default volumeForMinute
