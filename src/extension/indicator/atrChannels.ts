import type KLineData from '../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../component/Indicator'

interface AtrChannels {
  ema?: number
  ema2?: number
  plus1Atr?: number
  plus2Atr?: number
  plus3Atr?: number
  minus1Atr?: number
  minus2Atr?: number
  minus3Atr?: number
  ema50?: number
  ema200?: number
}

function setChannelValues(result: AtrChannels, ema: number, atr: number): void {
  result.plus1Atr = ema + atr
  result.plus2Atr = ema + atr * 2
  result.plus3Atr = ema + atr * 3
  result.minus1Atr = ema - atr
  result.minus2Atr = ema - atr * 2
  result.minus3Atr = ema - atr * 3
}

/**
 * ATR Channels
 * Channel center = EMA(CLOSE, N)
 * Channel bands = center +/- RMA(TR, N) * (1, 2, 3)
 */
const atrChannels: IndicatorTemplate<AtrChannels> = {
  name: 'ATR_CHANNELS',
  shortName: 'ATR Channels',
  series: IndicatorSeries.Price,
  calcParams: [26, 13],
  precision: 2,
  shouldOhlc: true,
  figures: [
    { key: 'ema', title: 'EMA: ', type: 'line', calcParamIndex: 0 },
    { key: 'ema2', title: 'EMA 2: ', type: 'line', calcParamIndex: 1 },
    { key: 'plus1Atr', title: '+1 ATR: ', type: 'line', calcParamIndex: 0 },
    { key: 'plus2Atr', title: '+2 ATR: ', type: 'line', calcParamIndex: 0 },
    { key: 'plus3Atr', title: '+3 ATR: ', type: 'line', calcParamIndex: 0 },
    { key: 'minus1Atr', title: '-1 ATR: ', type: 'line', calcParamIndex: 0 },
    { key: 'minus2Atr', title: '-2 ATR: ', type: 'line', calcParamIndex: 0 },
    { key: 'minus3Atr', title: '-3 ATR: ', type: 'line', calcParamIndex: 0 },
    { key: 'ema50', title: '50 EMA: ', type: 'line' },
    { key: 'ema200', title: '200 EMA: ', type: 'line' }
  ],
  styles: {
    figures: {
      ema: { color: 'rgba(255, 152, 0, 0.85)', size: 2 },
      ema2: { color: 'rgba(66, 165, 245, 0.85)', size: 2 },
      plus1Atr: { color: '#787B86' },
      plus2Atr: { color: '#434651' },
      plus3Atr: { color: '#787B86' },
      minus1Atr: { color: '#787B86' },
      minus2Atr: { color: '#434651' },
      minus3Atr: { color: '#787B86' },
      ema50: { color: 'rgba(144, 0, 0, 0.9)', size: 1 },
      ema200: { color: 'rgba(156, 39, 176, 0.7)', size: 1, visible: false }
    }
  },
  calc: (dataList: KLineData[], indicator: Indicator<AtrChannels>) => {
    const [period, ema2Period = 13] = indicator.calcParams
    const isPeriodValid = Number.isInteger(period) && period > 0
    const isEma2PeriodValid = Number.isInteger(ema2Period) && ema2Period > 0
    const emaAlpha = isPeriodValid ? 2 / (period + 1) : NaN
    const ema2Alpha = isEma2PeriodValid ? 2 / (ema2Period + 1) : NaN
    const ema50Alpha = 2 / 51
    const ema200Alpha = 2 / 201

    let ema = 0
    let ema2 = 0
    let ema50 = 0
    let ema200 = 0
    let trueRangeSum = 0
    let atr = 0

    return dataList.map((kLineData, index) => {
      const result: AtrChannels = {}
      const { close, high, low } = kLineData

      if (isPeriodValid) {
        ema = index === 0 ? close : close * emaAlpha + ema * (1 - emaAlpha)
        result.ema = ema

        const previousClose = (dataList[index - 1] ?? kLineData).close
        const trueRange = Math.max(
          high - low,
          Math.abs(high - previousClose),
          Math.abs(low - previousClose)
        )
        trueRangeSum += trueRange

        if (index === period - 1) {
          atr = trueRangeSum / period
          setChannelValues(result, ema, atr)
        } else if (index > period - 1) {
          atr = (atr * (period - 1) + trueRange) / period
          setChannelValues(result, ema, atr)
        }
      } else {
        result.ema = NaN
        setChannelValues(result, NaN, NaN)
      }

      if (isEma2PeriodValid) {
        ema2 = index === 0 ? close : close * ema2Alpha + ema2 * (1 - ema2Alpha)
        result.ema2 = ema2
      } else {
        result.ema2 = NaN
      }

      ema50 = index === 0 ? close : close * ema50Alpha + ema50 * (1 - ema50Alpha)
      ema200 = index === 0 ? close : close * ema200Alpha + ema200 * (1 - ema200Alpha)
      result.ema50 = ema50
      result.ema200 = ema200

      return result
    })
  }
}

export default atrChannels
