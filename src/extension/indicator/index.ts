import { TemplateManager } from '../../common/TemplateManager'
import type { IndicatorTemplate } from '../../component/Indicator'
import accumulativeSwingIndex from './accumulativeSwingIndex'
import averagePrice from './averagePrice'
import averageTrueRange from './averageTrueRange'
import awesomeOscillator from './awesomeOscillator'
import bias from './bias'
import bollingerBands from './bollingerBands'
import brar from './brar'
import bullAndBearIndex from './bullAndBearIndex'
import commodityChannelIndex from './commodityChannelIndex'
import currentRatio from './currentRatio'
import differentOfMovingAverage from './differentOfMovingAverage'
import directionalMovementIndex from './directionalMovementIndex'
import easeOfMovementValue from './easeOfMovementValue'
import exponentialMovingAverage from './exponentialMovingAverage'
import mike from './mike'
import momentum from './momentum'
import movingAverage from './movingAverage'
import movingAverageConvergenceDivergence from './movingAverageConvergenceDivergence'
import onBalanceVolume from './onBalanceVolume'
import pbx from './pbx'
import priceAndVolumeTrend from './priceAndVolumeTrend'
import psychologicalLine from './psychologicalLine'
import rateOfChange from './rateOfChange'
import relativeStrengthIndex from './relativeStrengthIndex'
import simpleMovingAverage from './simpleMovingAverage'
import kdj from './kdj'
import stopAndReverse from './stopAndReverse'
import td9 from './td9'
import tdSequential from './tdSequential'
import tripleExponentiallySmoothedAverage from './tripleExponentiallySmoothedAverage'
import volume from './volume'
import volumeRatio from './volumeRatio'
import williamsR from './williamsR'
/** indicator for timeshare */
import waPrice from './timeshare/waPrice'
import volumeMinute from './timeshare/volumeMinute'
/** indicator customized */
import openInterest from './custom/openInterest'

const extensions = [
  accumulativeSwingIndex, averagePrice, averageTrueRange, awesomeOscillator, bias, bollingerBands, brar,
  bullAndBearIndex, commodityChannelIndex, currentRatio, differentOfMovingAverage,
  directionalMovementIndex, easeOfMovementValue, exponentialMovingAverage, mike, momentum,
  movingAverage, movingAverageConvergenceDivergence, onBalanceVolume, pbx, priceAndVolumeTrend,
  psychologicalLine, rateOfChange, relativeStrengthIndex, simpleMovingAverage,
  kdj, stopAndReverse, td9, tdSequential, tripleExponentiallySmoothedAverage, volume, volumeRatio, williamsR, waPrice, volumeMinute, openInterest
]

const TM = new TemplateManager<IndicatorTemplate<any>>(extensions)

function registerIndicator<D = unknown>(template: IndicatorTemplate<D>): void {
  TM.add(template)
}

function getIndicatorTemplate(name: string): IndicatorTemplate<unknown> | undefined {
  return TM.get(name)
}

function getSupportedIndicators(): string[] {
  return TM.keys()
}

export { registerIndicator, getIndicatorTemplate, getSupportedIndicators }
