import type Coordinate from '../../common/Coordinate'
import { type TextBoxStyle } from '../../common/Styles'
import {
  calcBreakIndex,
  calcTextWidth,
  createFont
} from '../../common/utils/canvas'
import { type FigureTemplate } from '../../component/Figure'
import { type RectAttrs, drawRect } from './rect'

// 默认省略号
const DEFAULT_ELLIPSIS = '...'

// 缓存 Layout 信息，使用 WeakMap 避免内存泄漏
const layoutCache = new WeakMap<TextBoxAttrs, TextLayout>()

interface LineLayout {
  // 该行的文本内容
  text: string
  // 该行在原文本中的索引范围 [start, end)
  indexRange: [number, number]
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
  // 文本垂直对齐方式
  textBaseline: CanvasTextBaseline

  // ===== 优化信息 =====
  // 省略号文本
  ellipsis: string
  // 省略号文本宽度
  ellipsisWidth: number
}

// 提取公共的对齐计算逻辑
function calculateStartX(x: number, width: number, textAlign: CanvasTextAlign = 'left'): number {
  switch (textAlign) {
    case 'left':
    case 'start':
      return x
    case 'right':
    case 'end':
      return x + width
    default: // center
      return x + width / 2
  }
}

interface VerticalLayoutInfo {
  lineHeight: number
  hangingline: number
  baseline: number
  ideographicline: number
}

function calculateStartY(y: number, info: VerticalLayoutInfo, testBaseline: CanvasTextBaseline = 'top'): number {
  switch (testBaseline) {
    case 'top':
      return y
    case 'hanging':
      return y + info.hangingline
    case 'bottom':
      return y + info.lineHeight
    case 'alphabetic':
      return y + info.baseline
    case 'ideographic':
      return y + info.ideographicline
    default: // middle
      return y + info.lineHeight / 2
  }
}

function createVerticalLayoutInfo(fontSize: number): VerticalLayoutInfo {
  // 简易排版模型：
  // 真正的精准排版需要 TextMetrics 的 fontBoundingBoxAscent，但会有性能损耗。
  // 这里使用常见的倍率估算。
  return {
    lineHeight: 1.4 * fontSize,
    baseline: 1.1 * fontSize,
    ideographicline: 1.2 * fontSize,
    hangingline: 0.2 * fontSize
  }
}

// Layout 阶段：计算文本的布局信息（不涉及绘制）
function layoutText(attrs: TextBoxAttrs, styles: Partial<TextBoxStyle>): TextLayout {
  const text = attrs.text

  // 提取样式参数
  const fontSize = styles.size ?? 12
  const fontWeight = styles.weight ?? 'normal'
  const fontFamily = styles.fontFamily ?? 'Trebuchet MS, sans-serif'
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
  let isCharTruncated = false

  // 字符数约束
  if (maxChars !== undefined && text.length > maxChars) {
    displayText = text.slice(0, maxChars)
    isCharTruncated = true
  }

  // 边界情况: 空文本
  if (displayText.length === 0) {
    const boundsWidth = attrs.width ?? paddingLeft + paddingRight
    const boundsHeight = attrs.height ?? paddingTop + paddingBottom

    const boundsX = attrs.x - boundsWidth / 2
    const boundsY = attrs.y - boundsHeight / 2

    return {
      bounds: { x: boundsX, y: boundsY, width: boundsWidth, height: boundsHeight },
      lines: [],
      font,
      textAlign,
      textBaseline,
      ellipsis,
      ellipsisWidth,
    }
  }

  // 计算换行（包括手动换行符处理）
  let lineSegments: Array<{ text: string, width: number, indexRange: [number, number] }>
  let isTruncated = false

  if (maxWidth !== undefined) {
    const result = calcBreakIndex(displayText, maxWidth, font, effectiveMaxLines, ellipsisWidth)
    lineSegments = result.segments
    isTruncated = result.isTruncated
  } else {
    // 无宽度约束，只按换行符分割
    const textLines = displayText.split('\n')
    isTruncated = textLines.length > effectiveMaxLines
    let charIndex = 0
    lineSegments = textLines.slice(0, effectiveMaxLines).map(line => {
      const segment = {
        text: line,
        width: calcTextWidth(line, font),
        indexRange: [charIndex, charIndex + line.length] as [number, number]
      }
      charIndex += line.length + 1 // +1 for \n
      return segment
    })
  }

  const actualLineCount = lineSegments.length

  // 计算行布局（直接使用 lineSegments 的数据）
  const tmplines: Array<Omit<LineLayout, 'x' | 'y'>> = lineSegments
    .map((segment, i) => {
      const isLastLine = i === actualLineCount - 1

      return {
        text: segment.text,
        indexRange: segment.indexRange,
        width: segment.width,
        height: vLInfo.lineHeight,
        isTruncated: isLastLine && (isCharTruncated || isTruncated)
      }
    })

  // 计算包围盒
  const maxLineWidth = Math.ceil(Math.max(...tmplines.map(l => l.width + (l.isTruncated ? ellipsisWidth : 0))))

  const boundsHeight = attrs.height ?? paddingTop + vLInfo.lineHeight * actualLineCount + paddingBottom
  const boundsWidth = attrs.width ?? paddingLeft + maxLineWidth + paddingRight

  const boundsX = attrs.x - boundsWidth / 2
  const boundsY = attrs.y - boundsHeight / 2

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
    ellipsis,
    ellipsisWidth,
  }
}

function paintText(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  styles: Partial<TextBoxStyle>
) {
  const { bounds, lines, font, textBaseline, ellipsis } = layout
  const color = styles.color ?? 'currentColor'

  ctx.save()

  if (styles.backgroundColor) {
    drawRect(ctx, bounds, { ...styles, color: styles.backgroundColor })
  }

  if (ctx.textBaseline !== textBaseline) ctx.textBaseline = textBaseline
  if (ctx.font !== font) ctx.font = font
  if (ctx.fillStyle !== color) ctx.fillStyle = color

  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i]

    const x = bounds.x + line.x
    const y = bounds.y + line.y
    ctx.fillText(line.text, x, y)
    // draw helper line
    /* ctx.strokeStyle = 'green'
    ctx.beginPath()
    ctx.moveTo(bounds.x + 4, bounds.y + 4)
    ctx.lineTo(bounds.x - 4 + bounds.width, bounds.y + 4)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(bounds.x + 4, bounds.y + 4 + line.height)
    ctx.lineTo(bounds.x - 4 + bounds.width, bounds.y + 4 + line.height)
    ctx.stroke() */

    // 如果该行被截断，添加省略号
    if (line.isTruncated) {
      ctx.fillText(ellipsis, bounds.x + line.x + line.width, line.y + bounds.y)
    }
  }

  ctx.restore()
}

// 主渲染函数：先 Layout，后 Paint
export function drawText(
  ctx: CanvasRenderingContext2D,
  attrs: TextBoxAttrs,
  styles: Partial<TextBoxStyle>
): RectAttrs {
  // Phase 1: Layout（布局计算）
  const layout = layoutText(attrs, styles)

  // Phase 2: Paint（绘制）
  paintText(ctx, layout, styles)

  return layout.bounds
}

export interface TextBoxAttrs {
  x: number
  y: number
  text: string
  width?: number
  height?: number
}

// 获取或创建 Layout（带缓存）
function getOrCreateLayout(attrs: TextBoxAttrs, styles: Partial<TextBoxStyle>): TextLayout {
  let layout = layoutCache.get(attrs)
  if (!layout) {
    layout = layoutText(attrs, styles)
    layoutCache.set(attrs, layout)
  }
  return layout
}

// 碰撞检测
function isPointInBounds(coordinate: Coordinate, bounds: TextLayout['bounds']): boolean {
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
    paintText(ctx, layout, styles)
  }
}

export default text
