import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Cr {
  cr?: number
  ma1?: number
  ma2?: number
  ma3?: number
  ma4?: number
}

/**
 * CR 带状能量线
 *
 * MID:=REF((HIGH+LOW)/2,1);
 * UP:=MAX(0,HIGH-MID);
 * DN:=MAX(0,MID-LOW);
 * CR:SUM(UP,N)/SUM(DN,N)*100;
 * MA1:REF(MA(CR,M1),M1/2.5+1);
 * MA2:REF(MA(CR,M2),M2/2.5+1);
 * MA3:REF(MA(CR,M3),M3/2.5+1);
 * MA4:REF(MA(CR,M4),M4/2.5+1);
 *
 * MID: 昨日最高价与昨日最低价的中间价。
 * UP: 最高价高于 MID 的强势差额。
 * DN: MID 高于最低价的弱势差额。
 * CR: N 日 UP 累和与 N 日 DN 累和的比值。
 * MA1-MA4: CR 的简单移动平均线，并按 M/2.5+1 向前引用。
 *
 */
const currentRatio: IndicatorTemplate<Cr> = {
  name: 'CR',
  shortName: 'CR',
  calcParams: [26, 10, 20, 40, 60],
  figures: [
    { key: 'cr', title: 'CR: ', type: 'line' },
    { key: 'ma1', title: 'MA1: ', type: 'line' },
    { key: 'ma2', title: 'MA2: ', type: 'line' },
    { key: 'ma3', title: 'MA3: ', type: 'line' },
    { key: 'ma4', title: 'MA4: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Cr>) => {
    const [period, ...maPeriods] = indicator.calcParams
    const dataCount = dataList.length
    const result = new Array<Cr>(dataCount)
    const maKeys: Array<keyof Cr> = ['ma1', 'ma2', 'ma3', 'ma4']
    const maSums = new Array<number>(maKeys.length).fill(0)
    const refOffsets = new Array<number>(maKeys.length)
    for (let i = 0; i < maKeys.length; i++) {
      refOffsets[i] = Math.ceil(maPeriods[i] / 2.5 + 1)
    }

    let upSum = 0
    let dnSum = 0
    for (let i = 0; i < dataCount; i++) {
      result[i] = {}
    }
    for (let i = 0; i < dataCount; i++) {
      const kLineData = dataList[i]
      const prevData = dataList[i - 1] ?? kLineData
      const prevMid = (prevData.high + prevData.low) / 2
      const up = Math.max(0, kLineData.high - prevMid)
      const dn = Math.max(0, prevMid - kLineData.low)
      upSum += up
      dnSum += dn

      if (i >= period - 1) {
        const crValue = dnSum !== 0 ? upSum / dnSum * 100 : 0
        result[i].cr = crValue
        for (let j = 0; j < maKeys.length; j++) {
          const maPeriod = maPeriods[j]
          maSums[j] += crValue
          if (i >= period + maPeriod - 2) {
            const targetIndex = i + refOffsets[j]
            if (targetIndex < dataCount) {
              result[targetIndex][maKeys[j]] = maSums[j] / maPeriod
            }
            maSums[j] -= (result[i - maPeriod + 1].cr ?? 0)
          }
        }
        const leavingIndex = i - period + 1
        const leavingData = dataList[leavingIndex]
        const leavingPrevData = dataList[leavingIndex - 1] ?? leavingData
        const leavingPrevMid = (leavingPrevData.high + leavingPrevData.low) / 2
        upSum -= Math.max(0, leavingData.high - leavingPrevMid)
        dnSum -= Math.max(0, leavingPrevMid - leavingData.low)
      }
    }
    return result
  }
}
export default currentRatio
