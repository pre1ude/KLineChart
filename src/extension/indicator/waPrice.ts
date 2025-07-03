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

interface WaPrice {
  waPrice?: number
}

const waPrice: IndicatorTemplate<WaPrice> = {
  name: 'WA_PRICE',
  shortName: 'waPrice',
  series: IndicatorSeries.Price,
  shouldFormatBigNumber: true,
  precision: 3,
  figures: [
    {
      key: 'waPrice',
      title: '分时均价: ',
      type: 'line',
      styles: () => {
        return { color: '#FFC62B' }
      }
    }
  ],
  calc: (dataList: KLineData[]) => {
    return dataList.map((kLineData: KLineData) => {
      const waPrice = kLineData.waPrice ?? 0
      return { waPrice }
    })
  }
}

export default waPrice
