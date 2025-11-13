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
import { type IndicatorTemplate, IndicatorSeries, type IndicatorFigure } from '../../component/Indicator'

interface Vol {
  volume?: number
}

function getVolumeFigure (): IndicatorFigure<Vol> {
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
