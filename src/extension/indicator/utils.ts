import type KLineData from '../../common/KLineData'

export function calcHhvLlv(dataList: KLineData[], period: number, hhvList: number[], llvList: number[]): void {
  const dataCount = dataList.length
  const highIndexQueue = new Array<number>(dataCount)
  const lowIndexQueue = new Array<number>(dataCount)
  let highQueueStart = 0
  let highQueueEnd = 0
  let lowQueueStart = 0
  let lowQueueEnd = 0
  for (let i = 0; i < dataCount; i++) {
    const { high, low } = dataList[i]

    // Keep candidates that may become the rolling HHV/LLV.
    while (highQueueStart < highQueueEnd && dataList[highIndexQueue[highQueueEnd - 1]].high <= high) {
      highQueueEnd--
    }
    highIndexQueue[highQueueEnd] = i
    highQueueEnd++

    while (lowQueueStart < lowQueueEnd && dataList[lowIndexQueue[lowQueueEnd - 1]].low >= low) {
      lowQueueEnd--
    }
    lowIndexQueue[lowQueueEnd] = i
    lowQueueEnd++

    const windowStart = i - period + 1
    // Remove candidates that have left the current window.
    while (highQueueStart < highQueueEnd && highIndexQueue[highQueueStart] < windowStart) {
      highQueueStart++
    }
    while (lowQueueStart < lowQueueEnd && lowIndexQueue[lowQueueStart] < windowStart) {
      lowQueueStart++
    }

    if (i >= period - 1) {
      hhvList[i] = dataList[highIndexQueue[highQueueStart]].high
      llvList[i] = dataList[lowIndexQueue[lowQueueStart]].low
    }
  }
}
