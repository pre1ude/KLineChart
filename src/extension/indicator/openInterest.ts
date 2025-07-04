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

import { type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface Vol {
  openInterest?: number
}

const openInterest: IndicatorTemplate<Vol> = {
  name: 'OPEN_INTEREST',
  shortName: '',
  series: IndicatorSeries.Volume,
  shouldFormatBigNumber: true,
  precision: 0,
  figures: [
    {
      key: 'openInterest',
      // title: '持仓量: ',
      type: 'line',
      styles: () => {
        return { color: '#E6A760' }
      }
    }
  ],
  calc: (dataList: KLineData[]) => {
    return dataList.map((kLineData: KLineData) => {
      const openInterest = kLineData.openInterest ?? 0
      return { openInterest }
    })
  }
}

export default openInterest
