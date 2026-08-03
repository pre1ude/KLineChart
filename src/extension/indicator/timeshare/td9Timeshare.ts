import { LineType } from '../../../common/Styles'
import type { IndicatorTemplate } from '../../../component/Indicator'
import { drawStaticFigure } from '../../figure'
import type { LineAttrs } from '../../figure/line'
import type { TextAttrs } from '../../figure/text'
import td9 from '../td9'
import { TD9_SETUP_LENGTH } from '../td9/engine'
import type {
  TD9BarOutput,
  TD9Direction,
  TD9IndicatorExtendData,
  TD9RenderOptions
} from '../td9/types'

const TD9_PERFECTED_FONT_SIZE = 16
const TD9_TIMESHARE_LINE_SIZE = 2
const TD9_TIMESHARE_MARKER_LENGTH = 24
const TD9_TIMESHARE_MARKER_GAP = -2

type ResolvedTD9TimeshareRenderOptions = Required<Omit<
  TD9RenderOptions,
  'setupColor' | 'perfectedColor'
>>

const DEFAULT_RENDER_OPTIONS: ResolvedTD9TimeshareRenderOptions = {
  buySetupColor: '#D94A4A',
  sellSetupColor: '#16A085',
  fontSize: 10,
  fontWeight: 600,
  provisionalOpacity: 0.8
}

function resolveExtendData(value: unknown): TD9IndicatorExtendData {
  if (value === null || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  if ('config' in record || 'render' in record) return value as TD9IndicatorExtendData
  return {}
}

function resolveSetupColor(
  direction: TD9Direction,
  render?: TD9RenderOptions
): string {
  return direction === 'BUY'
    ? render?.buySetupColor ?? render?.setupColor ?? DEFAULT_RENDER_OPTIONS.buySetupColor
    : render?.sellSetupColor ?? render?.setupColor ?? DEFAULT_RENDER_OPTIONS.sellSetupColor
}

function withOpacity(
  ctx: CanvasRenderingContext2D,
  provisionalOpacity: number,
  provisional: boolean,
  draw: () => void
): void {
  ctx.save()
  if (provisional) ctx.globalAlpha *= provisionalOpacity
  try {
    draw()
  } finally {
    ctx.restore()
  }
}

function drawSetupSegment(
  ctx: CanvasRenderingContext2D,
  attrs: LineAttrs,
  color: string,
  options: ResolvedTD9TimeshareRenderOptions,
  provisional: boolean
): void {
  withOpacity(ctx, options.provisionalOpacity, provisional, () => {
    drawStaticFigure<LineAttrs, Record<string, unknown>>(ctx, 'line', {
      attrs,
      styles: {
        color,
        size: TD9_TIMESHARE_LINE_SIZE,
        style: LineType.Solid,
        smooth: false
      }
    })
  })
}

function drawSetupNine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  direction: TD9Direction,
  color: string,
  fontSize: number,
  options: ResolvedTD9TimeshareRenderOptions,
  provisional: boolean
): void {
  const requiredSpace = TD9_TIMESHARE_MARKER_LENGTH + TD9_TIMESHARE_MARKER_GAP + fontSize
  const defaultOffsetDirection = direction === 'BUY' ? 1 : -1
  const hasDefaultSpace = defaultOffsetDirection > 0
    ? height - y >= requiredSpace
    : y >= requiredSpace
  const offsetDirection = hasDefaultSpace ? defaultOffsetDirection : -defaultOffsetDirection
  const markerY = y + offsetDirection * TD9_TIMESHARE_MARKER_LENGTH
  withOpacity(ctx, options.provisionalOpacity, provisional, () => {
    drawStaticFigure<LineAttrs, Record<string, unknown>>(ctx, 'line', {
      attrs: { coordinates: [{ x, y }, { x, y: markerY }] },
      styles: {
        color,
        size: 1,
        style: LineType.Dashed,
        dashedValue: [2, 2],
        smooth: false,
      }
    })
    const attrs: TextAttrs = offsetDirection > 0
      ? {
        x,
        y: markerY + TD9_TIMESHARE_MARKER_GAP,
        text: '9',
        align: 'center',
        baseline: 'top'
      }
      : {
        x,
        y: markerY - TD9_TIMESHARE_MARKER_GAP,
        text: '9',
        align: 'center',
        baseline: 'bottom'
      }
    drawStaticFigure<TextAttrs, Record<string, unknown>>(ctx, 'text', {
      attrs,
      styles: {
        color,
        size: fontSize,
        weight: options.fontWeight,
        paddingLeft: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        borderSize: 0,
        borderColor: 'transparent',
        backgroundColor: 'transparent'
      }
    })
  })
}

const td9Timeshare: IndicatorTemplate<TD9BarOutput> = {
  ...td9,
  name: 'td9_timeshare',
  shortName: 'TD9 Timeshare',
  draw: ({ ctx, kLineDataList, indicator, visibleRange, bounding, xAxis, yAxis }) => {
    const result = indicator.result
    if (result.length === 0) return true
    const render = resolveExtendData(indicator.extendData).render
    const options = { ...DEFAULT_RENDER_OPTIONS, ...render }
    const from = Math.max(1, visibleRange.from)
    const to = Math.min(result.length - 1, visibleRange.to)

    for (let i = from; i <= to; i++) {
      const output = result[i]
      const setup = output?.setupMark
      const previousSetup = result[i - 1]?.setupMark
      const previousBar = kLineDataList[i - 1]
      const bar = kLineDataList[i]
      if (setup === undefined || previousBar === undefined || bar === undefined) continue

      const x = xAxis.convertToPixel(i)
      const y = yAxis.convertToPixel(bar.close)
      const perfected = setup.perfected === true
      const color = resolveSetupColor(setup.direction, render)
      if (setup.value > 1 && previousSetup?.setupId === setup.setupId) {
        drawSetupSegment(
          ctx,
          {
            coordinates: [
              { x: xAxis.convertToPixel(i - 1), y: yAxis.convertToPixel(previousBar.close) },
              { x, y }
            ]
          },
          color,
          options,
          output.provisional
        )
      }

      if (setup.value === TD9_SETUP_LENGTH) {
        drawSetupNine(
          ctx,
          x,
          y,
          bounding.height,
          setup.direction,
          color,
          perfected ? TD9_PERFECTED_FONT_SIZE : options.fontSize,
          options,
          output.provisional
        )
      }
    }
    return true
  }
}

export default td9Timeshare
