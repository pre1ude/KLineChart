import { createDom } from './dom'

let measureCtx: CanvasRenderingContext2D

let scale: number = 1

export function setScale(v: number): void {
  scale = v
}

export function getScale(): number {
  return scale
}

/**
 * Get pixel ratio
 * @param canvas
 * @returns {number}
 */
export function getPixelRatio(canvas: HTMLCanvasElement): number {
  const scale = getScale()
  let dpr = (canvas.ownerDocument?.defaultView?.devicePixelRatio ?? 1) * scale
  dpr = Math.round(dpr * 100) / 100
  return dpr < 1 ? 1 : dpr > 3 ? 3 : dpr
}

export function createFont(size?: number, weight?: string | number, fontFamily?: string): string {
  return `${weight ?? 'normal'} ${size ?? 12}px ${fontFamily ?? 'Trebuchet MS, sans-serif'}`
}

export function getMeasureContext(): CanvasRenderingContext2D {
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
export function calcTextWidth(text: string, font: string): number {
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
function isWordBreakChar(ch: string): boolean {
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
function findBreakPoints(text: string): number[] {
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

export interface LineSegment {
  text: string
  width: number
  indexRange: [number, number] // [startIndex, endIndex)
}

export interface BreakResult {
  segments: LineSegment[]
  isTruncated: boolean // 是否有文本因为宽度或行数限制被截断
}

/**
 * 处理单行文本的宽度约束分割
 * @returns 该行的所有分割结果
 */
function processLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  fitWidth: number,
  maxLines: number,
  ellipsisWidth: number
): LineSegment[] {
  const lines: LineSegment[] = []

  if (line.length === 0) {
    return [{ text: '', width: 0, indexRange: [0, 0] }]
  }

  /**
   * 二分查找最佳断点位置
   * @param text 要测量的文本
   * @param breakPoints 可能的断点位置数组
   * @param fitWidth 目标宽度
   * @returns [断点位置, 实际宽度]
   */
  const findBestBreakPoint = (
    text: string,
    breakPoints: number[],
    fitWidth: number
  ): [number, number] => {
    // 如果没有有效的中间断点，使用字符级别断点
    // 无效情况：空数组，或只有一个等于文本长度的断点
    if (breakPoints.length === 0 || (breakPoints.length === 1 && breakPoints[0] === text.length)) {
      breakPoints = Array.from({ length: text.length }, (_, i) => i + 1)
    }

    let left = 0
    let right = breakPoints.length - 1
    let bestFitIndex = -1
    let bestFitWidth = 0

    while (left <= right) {
      const mid = (left + right) >> 1
      const breakPoint = breakPoints[mid]
      const testText = text.slice(0, breakPoint)
      const testWidth = ctx.measureText(testText).width

      if (testWidth <= fitWidth) {
        bestFitIndex = mid
        bestFitWidth = testWidth
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    // 如果没找到合适断点（连1个字符都放不下），至少返回1个字符
    if (bestFitIndex === -1) {
      return [1, ctx.measureText(text.slice(0, 1)).width]
    }

    return [breakPoints[bestFitIndex], bestFitWidth]
  }

  // 预先计算整行的断点位置（只需计算一次）
  const allBreakPoints = findBreakPoints(line)
  let startIndex = 0

  for (let lineNum = 0; lineNum < maxLines && startIndex < line.length; lineNum++) {
    const remainingText = line.slice(startIndex)
    const fullWidth = ctx.measureText(remainingText).width
    const isLastLine = lineNum === maxLines - 1

    // 最后一行需要为省略号预留空间
    const effectiveFitWidth = isLastLine ? fitWidth - ellipsisWidth : fitWidth

    // 如果剩余文本能放下，直接添加
    if (fullWidth <= effectiveFitWidth) {
      lines.push({
        text: remainingText,
        width: fullWidth,
        indexRange: [startIndex, line.length]
      })
      break
    }

    // 获取当前剩余文本的断点位置（相对于 remainingText 的索引）
    const remainingBreakPoints = allBreakPoints
      .filter(bp => bp > startIndex)
      .map(bp => bp - startIndex)

    // 进行二分查找
    const [finalBreakPoint, finalWidth] = findBestBreakPoint(
      remainingText,
      remainingBreakPoints,
      effectiveFitWidth
    )

    // 记录该段的信息
    const endIndex = startIndex + finalBreakPoint
    lines.push({
      text: remainingText.slice(0, finalBreakPoint),
      width: finalWidth,
      indexRange: [startIndex, endIndex]
    })

    startIndex = endIndex
  }

  return lines
}

/**
 * 计算 text 换行 index 和每行的宽度（支持按单词换行）
 * @param text 文本, 至少长度为 2
 * @param fitWidth 多少宽度换行
 * @param font - font string (e.g., "12px Arial" or "bold 14px sans-serif")
 * @param maxLines - 最大行数（默认无限制）
 * @param ellipsisWidth - 省略号宽度（用于最后一行预留空间）
 * @returns BreakResult - 包含分割后的行段和截断信息
 */
export function calcBreakIndex(
  text: string,
  fitWidth: number,
  font: string,
  maxLines: number = Number.MAX_SAFE_INTEGER,
  ellipsisWidth: number = 0
): BreakResult {
  const ctx = getMeasureContext()
  ctx.font = font

  // 首先按换行符分割文本
  const textLines = text.split('\n')

  // 收集所有行的结果
  const allSegments: LineSegment[] = []

  let globalCharIndex = 0
  let remainingMaxLines = maxLines

  // 处理每一个手动换行的段落
  for (let i = 0; i < textLines.length && remainingMaxLines > 0; i++) {
    const line = textLines[i]

    // 处理当前行
    const lineSegments = processLine(ctx, line, fitWidth, remainingMaxLines, ellipsisWidth)

    // 将当前行的结果添加到总结果中，转换为全局索引
    for (const segment of lineSegments) {
      allSegments.push({
        text: segment.text,
        width: segment.width,
        indexRange: [
          globalCharIndex + segment.indexRange[0],
          globalCharIndex + segment.indexRange[1]
        ]
      })
    }

    // 更新状态
    remainingMaxLines -= lineSegments.length
    globalCharIndex += line.length + 1 // +1 for \n
  }

  const lastSegment = allSegments[allSegments.length - 1]

  return {
    segments: allSegments,
    isTruncated: lastSegment.indexRange[1] < text.length
  }
}

export function initCanvas(width: number, height: number) {
  const canvas = createDom('canvas', {
    width: `${width}px`,
    height: `${height}px`,
    boxSizing: 'border-box'
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Get canvas context failed.')
  }
  const pixelRatio = getPixelRatio(canvas)
  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  ctx.scale(pixelRatio, pixelRatio)
  return { ctx, canvas }
}
