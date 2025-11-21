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

import type Coordinate from '../../common/Coordinate'
import { type TextBoxStyle } from '../../common/Styles'

import {
  createFont,
  calcTextWidth,
  calcBreakIndex
} from '../../common/utils/canvas'

import { type FigureTemplate } from '../../component/Figure'

import { type RectAttrs, drawRect } from './rect'

// 默认省略号
const DEFAULT_ELLIPSIS = '...'

interface LineLayout {
  // 该行文本内容的起始和结束索引
  startIndex: number
  endIndex: number
  // 该行的渲染位置
  x: number
  y: number
  // 该行的宽度和高度
  width: number
  height: number
  // 是否是最后一行（需要显示省略号）
  isTruncated: boolean
}

interface TextLayout {
  // ===== 几何信息 =====
  // 文本的包围盒（用于碰撞检测、裁剪等）
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }

  // ===== 文本行信息 =====
  // 每一行的布局信息
  lines: LineLayout[]

  // ===== 样式信息 =====
  // 字体字符串（用于设置 ctx.font）
  font: string
  // 文本对齐方式
  textAlign: CanvasTextAlign
  // 文本基线
  textBaseline: CanvasTextBaseline

  // ===== 优化信息 =====
  // 是否是单行文本（快速路径）
  isSingleLine: boolean
  // 总行数
  lineCount: number
  // 省略号文本
  ellipsis: string
  // 省略号文本宽度
  ellipsisWidth: number
  // 截断原因（用于调试和优化）
  truncationReason?: 'none' | 'maxChars' | 'maxLines' | 'maxHeight' | 'maxWidth'
}

// 提取公共的对齐计算逻辑
function calculateStartX (x: number, width: number, textAlign: CanvasTextAlign = 'left'): number {
  switch (textAlign) {
    case 'left':
    case 'start':
      return x
    case 'right':
    case 'end':
      return x + width
    default:
      return x + width / 2
  }
}

interface VerticalLayoutInfo {
  lineHeight: number
  hangingline: number
  baseline: number
}

function calculateStartY (y: number, info: VerticalLayoutInfo, testBaseline: CanvasTextBaseline = 'top'): number {
  switch (testBaseline) {
    case 'top':
      return y
    case 'hanging':
      return y + info.hangingline
    case 'bottom':
      return y + info.lineHeight
    case 'ideographic':
    case 'alphabetic':
      return y + info.baseline
    default:
      return y + info.lineHeight / 2
  }
}

function createVerticalLayoutInfo (fontSize: number): VerticalLayoutInfo {
  // 简易排版模型：
  // 真正的精准排版需要 TextMetrics 的 fontBoundingBoxAscent，但会有性能损耗。
  // 这里使用常见的倍率估算。
  return {
    lineHeight: 1.4 * fontSize,
    baseline: 1.1 * fontSize,
    hangingline: 0.2 * fontSize
  }
}

// Layout 阶段：计算文本的布局信息（不涉及绘制）
function layoutText (attrs: TextBoxAttrs, styles: Partial<TextBoxStyle>): TextLayout {
  const text = attrs.text

  // 提取样式参数
  const fontSize = styles.size ?? 12
  const fontWeight = styles.weight ?? 'normal'
  const fontFamily = styles.family ?? 'Helvetica Neue'
  const paddingLeft = styles.paddingLeft ?? 0
  const paddingTop = styles.paddingTop ?? 0
  const paddingRight = styles.paddingRight ?? 0
  const paddingBottom = styles.paddingBottom ?? 0
  const textAlign = styles.textAlign ?? 'left'
  const textBaseline = styles.textBaseline ?? 'alphabetic'

  // todo add support for italic
  const font = createFont(fontSize, fontWeight, fontFamily)

  const ellipsis = styles?.ellipsis ?? DEFAULT_ELLIPSIS
  const ellipsisWidth = calcTextWidth(ellipsis, font)

  // 提取约束条件
  const maxChars = styles?.maxChars
  const maxWidth = styles?.maxWidth
  const maxLines = styles?.maxLines
  const maxHeight = styles?.maxHeight

  const vLInfo = createVerticalLayoutInfo(fontSize)

  // 根据高度约束计算最大行数
  let maxLinesFromHeight = Infinity
  if (maxHeight !== undefined) {
    maxLinesFromHeight = Math.floor((maxHeight - paddingTop - paddingBottom) / vLInfo.lineHeight)
    if (maxLinesFromHeight < 1) maxLinesFromHeight = 1
  }

  // 取最严格的行数限制
  const effectiveMaxLines = Math.min(
    maxLines ?? Infinity,
    maxLinesFromHeight
  )

  // 场景判断与处理
  let displayText = text
  let truncationReason: TextLayout['truncationReason'] = 'none'
  let isCharTruncated = false

  // 场景 3, 6, 9, 10, 12, 13, 15, 16: 字符数约束
  if (maxChars !== undefined && text.length > maxChars) {
    displayText = text.slice(0, maxChars)
    isCharTruncated = true
    truncationReason = 'maxChars'
  }

  // 边界情况: 空文本 (场景18)
  if (displayText.length === 0) {
    const boundsWidth = attrs.width ?? paddingLeft + paddingRight
    const boundsHeight = attrs.height ?? paddingTop + paddingBottom

    const boundsX = attrs.x - boundsWidth / 2
    const boundsY = attrs.y - boundsHeight

    return {
      bounds: { x: boundsX, y: boundsY, width: boundsWidth, height: boundsHeight },
      lines: [],
      font,
      textAlign,
      textBaseline,
      isSingleLine: true,
      lineCount: 0,
      ellipsis,
      ellipsisWidth,
      truncationReason
    }
  }

  // 计算换行
  let breakIndex: number[] = []
  let lineWidths: number[] = []

  if (maxWidth !== undefined) {
    // 场景 2, 6, 7, 8, 12, 13, 14, 16, 17: 有宽度约束
    const result = calcBreakIndex(displayText, maxWidth, font, effectiveMaxLines, ellipsisWidth)
    breakIndex = result.breakIndex
    lineWidths = result.lineWidths
  } else {
    // 场景 1, 3, 4, 5, 9, 10, 11, 15: 无宽度约束（单行或按字符/行数/高度截断）
    lineWidths = [calcTextWidth(displayText, font)]
  }

  // 计算实际行数和截断状态
  const isSingleLine = breakIndex.length === 0
  let actualLineCount = isSingleLine ? 1 : breakIndex.length + 1

  // 应用行数限制（场景 4, 7, 9, 11, 12, 14, 15, 16）
  let isLineTruncated = false
  if (actualLineCount > effectiveMaxLines) {
    actualLineCount = effectiveMaxLines
    isLineTruncated = true
    if (truncationReason === 'none') {
      truncationReason = maxHeight !== undefined && maxLinesFromHeight < (maxLines ?? Infinity)
        ? 'maxHeight'
        : 'maxLines'
    }
  }

  // 计算行布局
  const tmplines: Array<Omit<LineLayout, 'x' | 'y'>> = []

  if (isSingleLine) {
    // 单行场景（场景 1, 3, 17, 18）
    tmplines.push({
      startIndex: 0,
      endIndex: displayText.length,
      width: lineWidths[0],
      height: vLInfo.lineHeight,
      isTruncated: isCharTruncated
    })
  } else {
    // 多行
    let startIdx = 0
    for (let j = 0; j < breakIndex.length && j < actualLineCount; ++j) {
      const endIdx = breakIndex[j] + 1

      const isLastLine = j === actualLineCount - 1
      const hasMoreText = endIdx < displayText.length || isCharTruncated || isLineTruncated
      const isTruncated = isLastLine && hasMoreText

      tmplines.push({
        startIndex: startIdx,
        endIndex: endIdx,
        width: lineWidths[j],
        height: vLInfo.lineHeight,
        isTruncated
      })

      if (isLastLine) break
      startIdx = endIdx
    }

    // 最后一行（如果有剩余文本且未未达到行数限制）
    if (startIdx < displayText.length && tmplines.length < actualLineCount) {
      const lastLineWidth = lineWidths[lineWidths.length - 1]

      tmplines.push({
        startIndex: startIdx,
        endIndex: displayText.length,
        width: lastLineWidth,
        height: vLInfo.lineHeight,
        isTruncated: isCharTruncated
      })
    }
  }

  // 计算包围盒
  const maxLineWidth = Math.max(...tmplines.map(l => l.width + (l.isTruncated ? ellipsisWidth : 0)).slice(0, actualLineCount))

  const boundsHeight = attrs.height ?? paddingTop + vLInfo.lineHeight * actualLineCount + paddingBottom
  const boundsWidth = attrs.width ?? paddingLeft + maxLineWidth + paddingRight

  const boundsX = attrs.x - boundsWidth / 2
  const boundsY = attrs.y - boundsHeight

  const renderStartY = calculateStartY(paddingTop, vLInfo, textBaseline)
  const lines = tmplines.map((line, index) => {
    const renderStartX = calculateStartX(paddingLeft, boundsWidth - paddingLeft - paddingRight - line.width - (line.isTruncated ? ellipsisWidth : 0), textAlign)
    return {
      ...line,
      x: renderStartX,
      y: renderStartY + vLInfo.lineHeight * index
    }
  })

  return {
    bounds: { x: boundsX, y: boundsY, width: boundsWidth, height: boundsHeight },
    lines,
    font,
    textAlign,
    textBaseline,
    isSingleLine,
    lineCount: tmplines.length,
    ellipsis,
    ellipsisWidth,
    truncationReason
  }
}

// Paint 阶段：根据 Layout 信息绘制文本
function paintText (
  ctx: CanvasRenderingContext2D,
  text: string,
  layout: TextLayout,
  styles: Partial<TextBoxStyle>
) {
  const { bounds, lines, font, textBaseline, ellipsis } = layout
  const color = styles.color ?? 'currentColor'

  ctx.save()

  if (styles.backgroundColor) {
    drawRect(ctx, bounds, { ...styles, color: styles.backgroundColor })
  }

  // if (ctx.textAlign !== textAlign) ctx.textAlign = textAlign
  if (ctx.textBaseline !== textBaseline) ctx.textBaseline = textBaseline
  if (ctx.font !== font) ctx.font = font
  if (ctx.fillStyle !== color) ctx.fillStyle = color

  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i]
    const lineText = text.slice(line.startIndex, line.endIndex)

    const x = bounds.x + line.x
    const y = bounds.y + line.y
    ctx.fillText(lineText, x, y)
    // draw helper line
    /* ctx.strokeStyle = 'red'
    ctx.beginPath()
    ctx.moveTo(bounds.x + 4, bounds.y + 4)
    ctx.lineTo(bounds.x + 4 + line.width, bounds.y + 4)
    ctx.stroke() */

    ctx.strokeStyle = 'green'
    ctx.beginPath()
    ctx.moveTo(bounds.x + 4, bounds.y + 4)
    ctx.lineTo(bounds.x - 4 + bounds.width, bounds.y + 4)
    ctx.stroke()

    ctx.strokeStyle = 'green'
    ctx.beginPath()
    ctx.moveTo(bounds.x + 4, bounds.y + 4 + line.height)
    ctx.lineTo(bounds.x - 4 + bounds.width, bounds.y + 4 + line.height)
    ctx.stroke()

    // 如果该行被截断，添加省略号
    if (line.isTruncated) {
      ctx.fillText(ellipsis, bounds.x + line.x + line.width, line.y + bounds.y)
    }
  }

  ctx.restore()
}

// 主渲染函数：先 Layout，后 Paint
export function drawText (
  ctx: CanvasRenderingContext2D,
  attrs: TextBoxAttrs,
  styles: Partial<TextBoxStyle>
): RectAttrs {
  // Phase 1: Layout（布局计算）
  const layout = layoutText(attrs, styles)

  // Phase 2: Paint（绘制）
  paintText(ctx, attrs.text, layout, styles)

  return layout.bounds
}

export interface TextBoxAttrs {
  x: number
  y: number
  text: string
  width?: number
  height?: number
  // 缓存的 Layout 信息（包含矩形和其他布局数据）
  cachedLayout?: TextLayout
}

// 获取或创建 Layout（带缓存）
function getOrCreateLayout (attrs: TextBoxAttrs, styles: Partial<TextBoxStyle>): TextLayout {
  if (!attrs.cachedLayout) {
    attrs.cachedLayout = layoutText(attrs, styles)
  }
  return attrs.cachedLayout
}

// 碰撞检测
function isPointInBounds (coordinate: Coordinate, bounds: TextLayout['bounds']): boolean {
  return (
    coordinate.x >= bounds.x &&
    coordinate.x <= bounds.x + bounds.width &&
    coordinate.y >= bounds.y &&
    coordinate.y <= bounds.y + bounds.height
  )
}

const text: FigureTemplate<TextBoxAttrs, Partial<TextBoxStyle>> = {
  name: 'textBox',
  checkEventOn: (coordinate, attrs, styles) => {
    const layout = getOrCreateLayout(attrs, styles)
    return isPointInBounds(coordinate, layout.bounds)
  },
  draw: (ctx, attrs, styles) => {
    const layout = getOrCreateLayout(attrs, styles)
    paintText(ctx, attrs.text, layout, styles)
  }
}

export default text
