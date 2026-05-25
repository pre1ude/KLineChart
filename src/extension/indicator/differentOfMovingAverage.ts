
import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate } from '../../component/Indicator'

interface Dma {
  dif?: number
  difma?: number
}

/**
 * DMA
 * 公式：DIF:MA(CLOSE,N1)-MA(CLOSE,N2);DIFMA:MA(DIF,M)
 */
const differentOfMovingAverage: IndicatorTemplate<Dma> = {
  name: 'DMA',
  shortName: 'DMA',
  calcParams: [10, 50, 10],
  figures: [
    { key: 'dif', title: 'DIF: ', type: 'line' },
    { key: 'difma', title: 'DIFMA: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<Dma>) => {
    const [n1, n2, m] = indicator.calcParams
    const maxPeriod = Math.max(n1, n2)
    let closeSum1 = 0
    let closeSum2 = 0
    let difSum = 0
    const dataCount = dataList.length
    const result = new Array<Dma>(dataCount)
    for (let i = 0; i < dataCount; i++) {
      const j = i + 1
      const dma: Dma = {}
      const close = dataList[i].close
      closeSum1 += close
      closeSum2 += close

      if (j >= maxPeriod) {
        const dif = closeSum1 / n1 - closeSum2 / n2
        dma.dif = dif
        difSum += dif
        if (j >= maxPeriod + m - 1) {
          dma.difma = difSum / m
          difSum -= (result[j - m].dif ?? 0)
        }
      }
      if (j >= n1) {
        closeSum1 -= dataList[j - n1].close
      }
      if (j >= n2) {
        closeSum2 -= dataList[j - n2].close
      }
      result[i] = dma
    }
    return result
  }
}

export default differentOfMovingAverage
