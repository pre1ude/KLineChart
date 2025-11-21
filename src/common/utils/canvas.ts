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

let measureCtx: CanvasRenderingContext2D

let scale: number = 1

export function setScale (v: number): void {
  scale = v
}

export function getScale (): number {
  return scale
}

/**
 * Get pixel ratio
 * @param canvas
 * @returns {number}
 */
export function getPixelRatio (canvas: HTMLCanvasElement): number {
  const scale = getScale()
  let dpr = (canvas.ownerDocument?.defaultView?.devicePixelRatio ?? 1) * scale
  dpr = Math.round(dpr * 100) / 100
  return dpr < 1 ? 1 : dpr > 3 ? 3 : dpr
}

export function createFont (size?: number, weight?: string | number, family?: string): string {
  return `${weight ?? 'normal'} ${size ?? 12}px ${family ?? 'Helvetica Neue'}`
}

export function getMeasureContext (): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement('canvas')
    measureCtx = canvas.getContext('2d')!
    const pixelRatio = getPixelRatio(canvas)
    measureCtx.scale(pixelRatio, pixelRatio)
  }
  return measureCtx
}

/**
 * Measure the width of text
 * @param text
 * @param font - font string (e.g., "12px Arial" or "bold 14px sans-serif")
 * @returns {number}
 */
export function calcTextWidth (text: string, font: string): number {
  const measureCtx = getMeasureContext()
  measureCtx.font = font
  return Math.round(measureCtx.measureText(text).width)
}

// 断词字符集合
const breakCharSet = new Set(['?', '-', ' ', ',', '.', '!', ';', ':', '/', '\\', '(', ')', '[', ']', '{', '}', '<', '>', '"', "'", '`', '~', '@', '#', '$', '%', '^', '&', '*', '+', '=', '|'])

/**
 * 判断字符是否是断词字符
 * @param ch 字符
 * @returns 是否是断词字符
 */
function isWordBreakChar (ch: string): boolean {
  const code = ch.charCodeAt(0)
  // 拉丁字符范围内，检查是否在断词字符集合中
  if (code < 0x2e80) {
    return breakCharSet.has(ch)
  }
  // 非拉丁字符（如中文、日文等）都可以断词
  return true
}

/**
 * 预处理文本，找出所有可能的断词位置
 * @param text 文本
 * @returns 断词位置数组（索引）
 */
function findBreakPoints (text: string): number[] {
  const breakPoints: number[] = [0] // 起始位置

  for (let i = 0; i < text.length; i++) {
    if (isWordBreakChar(text[i])) {
      // 在断词字符后面可以断行
      if (i + 1 < text.length) {
        breakPoints.push(i + 1)
      }
    }
  }

  // 末尾位置
  if (breakPoints[breakPoints.length - 1] !== text.length) {
    breakPoints.push(text.length)
  }

  return breakPoints
}

/**
 * 计算 text 换行 index 和每行的宽度（支持按单词换行）
 * @param text 文本, 至少长度为 2
 * @param fitWidth 多少宽度换行
 * @param font - font string (e.g., "12px Arial" or "bold 14px sans-serif")
 * @param maxLines - 最大行数（默认无限制）
 * @param ellipsisWidth - 省略号宽度（用于最后一行预留空间）
 * @returns { breakIndex: 换行断点数组, lineWidths: 每行的宽度数组 }
 */
export function calcBreakIndex (
  text: string,
  fitWidth: number,
  font: string,
  maxLines: number = Number.MAX_SAFE_INTEGER,
  ellipsisWidth: number = 0
): { breakIndex: number[], lineWidths: number[] } {
  const measureCtx = getMeasureContext()
  measureCtx.font = font

  const breakIndex: number[] = []
  const lineWidths: number[] = []
  let startIndex = 0

  /**
   * 二分查找最大能放入指定宽度的文本长度
   * @param text 文本
   * @returns [最大字符索引, 实际宽度]
   */
  const binarySearch = (text: string, fitWidth: number) => {
    let left = 1
    let right = text.length
    let bestFitIndex = 0
    let finalWidth = 0

    while (left <= right) {
      const mid = (left + right) >> 1
      const testText = text.slice(0, mid)
      const testWidth = measureCtx.measureText(testText).width

      if (testWidth <= fitWidth) {
        bestFitIndex = mid
        finalWidth = testWidth
        left = mid + 1
      } else {
        right = mid - 1
      }
    }
    return [bestFitIndex, finalWidth]
  }

  for (let lineNum = 0; lineNum < maxLines && startIndex < text.length; lineNum++) {
    const remainingText = text.slice(startIndex)
    const fullWidth = measureCtx.measureText(remainingText).width
    const isLastLine = lineNum === maxLines - 1

    // 最后一行需要为省略号预留空间
    const effectiveFitWidth = isLastLine ? fitWidth - ellipsisWidth : fitWidth

    // 如果剩余文本能放下，直接添加
    if (fullWidth <= effectiveFitWidth) {
      lineWidths.push(fullWidth)
      break
    }

    // 找出剩余文本中所有可能的断词位置
    const breakPoints = findBreakPoints(remainingText)

    // 在断词位置上进行二分查找
    let left = 0
    let right = breakPoints.length - 1
    let bestFitIndex = 0
    let bestFitWidth = 0

    while (left <= right) {
      const mid = (left + right) >> 1
      const breakPoint = breakPoints[mid]
      const testText = remainingText.slice(0, breakPoint)
      const testWidth = measureCtx.measureText(testText).width

      if (testWidth <= effectiveFitWidth) {
        bestFitIndex = mid
        bestFitWidth = testWidth
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    // 获取最佳断点位置
    let finalBreakPoint = breakPoints[bestFitIndex]
    let finalWidth = bestFitWidth

    // 如果 bestFitIndex 是 0，说明连第一个单词都放不下
    // 这种情况下需要强制断开（字符级别截断）
    if (bestFitIndex === 0 && finalBreakPoint === 0) {
      // 回退到字符级别的二分查找
      const res = binarySearch(remainingText, effectiveFitWidth)

      finalBreakPoint = res[0]
      finalWidth = res[1]
    }

    // 记录断点和宽度（断点是相对于原文本的位置）
    breakIndex.push(startIndex + finalBreakPoint - 1)
    lineWidths.push(finalWidth)

    startIndex = startIndex + finalBreakPoint

    // 达到最大行数，停止
    if (lineNum === maxLines - 1) {
      break
    }
  }

  return { breakIndex, lineWidths }
}
