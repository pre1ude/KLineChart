import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Asi {
  asi?: number
  asit?: number
}

/**
 * ASI Accumulative Swing Index
 *
 * SI = 16 * X / R * K
 * ASI = SUM(SI, M)
 * ASIT = MA(ASI, N)
 */
const accumulativeSwingIndex: IndicatorTemplate<Asi> = {
  name: 'ASI',
  shortName: 'ASI',
  calcParams: [26, 10],
  figures: [
    { key: 'asi', title: 'ASI: ', type: 'line' },
    { key: 'asit', title: 'ASIT: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Asi>) => {
    const [asiPeriod, asitPeriod] = indicator.calcParams
    const siWindow = new Array<number>(asiPeriod)
    const asiWindow = new Array<number>(asitPeriod)
    let siWindowIndex = 0
    let siCount = 0
    let siSum = 0
    let asiWindowIndex = 0
    let asiCount = 0
    let asiSum = 0

    return dataList.map((current, index) => {
      const result: Asi = {}
      if (index === 0) {
        return result
      }

      const previous = dataList[index - 1]
      const a = Math.abs(current.high - previous.close)
      const b = Math.abs(current.low - previous.close)
      const c = Math.abs(current.high - previous.low)
      const d = Math.abs(previous.close - previous.open)
      const x = (current.close - previous.close) +
        (current.close - current.open) / 2 +
        (previous.close - previous.open)
      const k = Math.max(a, b)

      let r: number
      if (a > b && a > c) {
        r = a + b / 2 + d / 4
      } else if (b > a && b > c) {
        r = b + a / 2 + d / 4
      } else {
        r = c + d / 4
      }

      const si = r === 0 ? 0 : 16 * x / r * k
      if (siCount === asiPeriod) {
        siSum -= siWindow[siWindowIndex]
      } else {
        siCount++
      }
      siWindow[siWindowIndex] = si
      siWindowIndex = (siWindowIndex + 1) % asiPeriod
      siSum += si

      if (siCount === asiPeriod) {
        result.asi = siSum
        if (asiCount === asitPeriod) {
          asiSum -= asiWindow[asiWindowIndex]
        } else {
          asiCount++
        }
        asiWindow[asiWindowIndex] = siSum
        asiWindowIndex = (asiWindowIndex + 1) % asitPeriod
        asiSum += siSum

        if (asiCount === asitPeriod) {
          result.asit = asiSum / asitPeriod
        }
      }

      return result
    })
  }
}

export default accumulativeSwingIndex
