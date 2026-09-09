import { LineType } from '../../../common/Styles'
import type KLineData from '../../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../../component/Indicator'
import { drawStaticFigure } from '../../figure'
import type { LineAttrs } from '../../figure/line'
import type { TextAttrs } from '../../figure/text'
import { resolveTDSequentialConfig } from './config'
import { calculateTDSequential } from './engine'
import type {
  TDSequentialBarOutput,
  TDSequentialConfig,
  TDSequentialCountdownMark,
  TDSequentialDirection,
  TDSequentialIndicatorExtendData,
  TDSequentialIndicatorRenderOptions,
  TDSequentialInputBar,
  TDSequentialSetup
} from './types'

const SETUP_DISPLAY_CONFIRMATION_COUNT = 6

type ResolvedRenderOptions = Required<Omit<
  TDSequentialIndicatorRenderOptions,
  'setupColor' | 'perfectedColor'
>>

const DEFAULT_RENDER_OPTIONS: ResolvedRenderOptions = {
  buySetupColor: '#D94A4A',
  sellSetupColor: '#16A085',
  buyCountdownColor: '#D94A4A',
  sellCountdownColor: '#16A085',
  resistanceColor: '#F05A67',
  supportColor: '#1EA672',
  fontSize: 10,
  fontWeight: 600,
  layerGap: 12,
  provisionalOpacity: 0.55,
  showCancelled: false
}

function resolveExtendData(value: unknown): TDSequentialIndicatorExtendData {
  if (value === null || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  if ('config' in record || 'render' in record) {
    return value as TDSequentialIndicatorExtendData
  }
  return { config: value as Partial<TDSequentialConfig> }
}

function getRenderOptions(indicator: Indicator<TDSequentialBarOutput>): ResolvedRenderOptions {
  const extendData = resolveExtendData(indicator.extendData)
  return { ...DEFAULT_RENDER_OPTIONS, ...extendData.render }
}

export function resolveSetupMarkColor(
  direction: TDSequentialDirection,
  perfected: boolean,
  render: TDSequentialIndicatorRenderOptions = {}
): string {
  if (perfected && render.perfectedColor !== undefined) return render.perfectedColor
  return direction === 'BUY'
    ? render.buySetupColor ?? render.setupColor ?? DEFAULT_RENDER_OPTIONS.buySetupColor
    : render.sellSetupColor ?? render.setupColor ?? DEFAULT_RENDER_OPTIONS.sellSetupColor
}

export function resolveCountdownMarkColor(
  direction: TDSequentialDirection,
  render: TDSequentialIndicatorRenderOptions = {}
): string {
  return direction === 'BUY'
    ? render.buyCountdownColor ?? DEFAULT_RENDER_OPTIONS.buyCountdownColor
    : render.sellCountdownColor ?? DEFAULT_RENDER_OPTIONS.sellCountdownColor
}

function getConfig(indicator: Indicator<TDSequentialBarOutput>): TDSequentialConfig {
  return resolveTDSequentialConfig(resolveExtendData(indicator.extendData).config)
}

function filterCancelledMarks(
  outputs: TDSequentialBarOutput[],
  cancelledIds: Set<string>,
  showCancelled: boolean
): TDSequentialBarOutput[] {
  if (showCancelled || cancelledIds.size === 0) return outputs
  return outputs.map(output => ({
    ...output,
    countdownMarks: output.countdownMarks.filter(mark => !cancelledIds.has(mark.countdownId))
  }))
}

export function filterSetupMarksForDisplay(
  outputs: TDSequentialBarOutput[],
  setups: TDSequentialSetup[]
): TDSequentialBarOutput[] {
  const visibleSetupIds = new Set(setups.map(setup => setup.id))
  const terminalSetupMark = outputs[outputs.length - 1]?.setupMark
  if (
    terminalSetupMark !== undefined &&
    terminalSetupMark.value >= SETUP_DISPLAY_CONFIRMATION_COUNT
  ) {
    visibleSetupIds.add(terminalSetupMark.setupId)
  }

  return outputs.map(output => (
    output.setupMark === undefined || visibleSetupIds.has(output.setupMark.setupId)
      ? output
      : { ...output, setupMark: undefined }
  ))
}

export function filterCountdownMarksForDisplay(
  outputs: TDSequentialBarOutput[]
): TDSequentialBarOutput[] {
  return outputs.map(output => ({
    ...output,
    countdownMarks: output.countdownMarks.filter(mark => mark.kind !== 'COUNT')
  }))
}

function drawTDSTSegments(
  result: TDSequentialBarOutput[],
  from: number,
  to: number,
  valueKey: 'tdstResistance' | 'tdstSupport',
  idKey: 'currentTDSTResistanceId' | 'currentTDSTSupportId',
  color: string,
  xAxis: { convertToPixel: (value: number) => number },
  yScale: { convertToPixel: (value: number) => number },
  halfBar: number,
  provisionalOpacity: number,
  ctx: CanvasRenderingContext2D
): void {
  let segmentId: string | undefined
  let segmentValue: number | undefined
  let segmentProvisional = false
  let segmentStart = -1

  const flush = (end: number): void => {
    if (segmentId === undefined || segmentValue === undefined || segmentStart < 0 || end < segmentStart) return
    const y = yScale.convertToPixel(segmentValue)
    const attrs: LineAttrs = {
      coordinates: [
        { x: xAxis.convertToPixel(segmentStart) - halfBar, y },
        { x: xAxis.convertToPixel(end) + halfBar, y }
      ]
    }
    ctx.save()
    if (segmentProvisional) ctx.globalAlpha *= provisionalOpacity
    try {
      drawStaticFigure<LineAttrs, Record<string, unknown>>(ctx, 'line', {
        attrs,
        styles: {
          color,
          size: 1,
          style: LineType.Solid,
          dashedValue: [2, 2],
          smooth: false,
          pixelSnap: 'y'
        }
      })
    } finally {
      ctx.restore()
    }
  }

  for (let i = from; i <= to; i++) {
    const output = result[i]
    const id = output?.[idKey]
    const value = output?.[valueKey]
    const provisional = output?.provisional === true
    if (id !== segmentId || value !== segmentValue || provisional !== segmentProvisional) {
      flush(i - 1)
      segmentId = id
      segmentValue = value
      segmentProvisional = provisional
      segmentStart = id !== undefined && value !== undefined ? i : -1
    }
  }
  flush(to)
}

function drawTextMark(
  ctx: CanvasRenderingContext2D,
  attrs: TextAttrs,
  color: string,
  options: ResolvedRenderOptions,
  provisional: boolean
): void {
  ctx.save()
  if (provisional) ctx.globalAlpha *= options.provisionalOpacity
  try {
    drawStaticFigure<TextAttrs, Record<string, unknown>>(ctx, 'text', {
      attrs,
      styles: {
        color,
        size: options.fontSize,
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
  } finally {
    ctx.restore()
  }
}

const tdSequential: IndicatorTemplate<TDSequentialBarOutput> = {
  name: 'TDSEQ',
  shortName: 'TD Sequential',
  series: IndicatorSeries.Price,
  precision: 2,
  shouldOhlc: true,
  calcParams: [],
  figures: [
    { key: 'tdstResistance', title: 'TDST Resistance: ', type: 'line' },
    { key: 'tdstSupport', title: 'TDST Support: ', type: 'line' }
  ],
  calc: (dataList: KLineData[], indicator: Indicator<TDSequentialBarOutput>) => {
    const calculation = calculateTDSequential(dataList as TDSequentialInputBar[], getConfig(indicator))
    const renderOptions = getRenderOptions(indicator)
    const cancelledIds = new Set(
      calculation.countdowns
        .filter(countdown => countdown.disposition === 'CANCELLED')
        .map(countdown => countdown.id)
    )
    const outputs = calculation.provisional === undefined
      ? calculation.bars
      : [...calculation.bars, calculation.provisional]
    const setupFilteredOutputs = filterSetupMarksForDisplay(outputs, calculation.setups)
    const countdownFilteredOutputs = filterCountdownMarksForDisplay(setupFilteredOutputs)
    return filterCancelledMarks(countdownFilteredOutputs, cancelledIds, renderOptions.showCancelled)
  },
  createTooltipDataSource: ({ indicator, crosshair }) => {
    const output = indicator.result[crosshair.dataIndex ?? 0] as TDSequentialBarOutput | undefined
    if (output === undefined) return { name: indicator.shortName, values: [] }
    const setup = output.setupMark === undefined
      ? '—'
      : `${output.setupMark.direction} ${output.setupMark.value}`
    const countdown = output.countdownMarks.length === 0
      ? '—'
      : output.countdownMarks.map((mark: TDSequentialCountdownMark) => `${mark.direction} ${String(mark.value)}`).join(', ')
    return {
      name: indicator.shortName,
      calcParamsText: '',
      values: [
        { title: 'Setup: ', value: setup },
        { title: 'Countdown: ', value: countdown },
        { title: 'TDST Resistance: ', value: output.tdstResistance?.toString() ?? '—' },
        { title: 'TDST Support: ', value: output.tdstSupport?.toString() ?? '—' }
      ]
    }
  },
  draw: ({
    ctx,
    kLineDataList,
    indicator,
    visibleRange,
    barSpace,
    xAxis,
    yScale
  }) => {
    const result = indicator.result
    if (result.length === 0) return true
    const options = getRenderOptions(indicator)
    const renderOverrides = resolveExtendData(indicator.extendData).render
    const from = Math.max(0, visibleRange.from)
    const to = Math.min(result.length - 1, visibleRange.to)
    if (to < from) return true

    const resistanceFigure = indicator.figures.find(figure => figure.key === 'tdstResistance')
    const supportFigure = indicator.figures.find(figure => figure.key === 'tdstSupport')
    const resistanceVisible = resistanceFigure !== undefined &&
      resistanceFigure.visible !== false &&
      indicator.styles?.figures?.tdstResistance?.visible !== false
    const supportVisible = supportFigure !== undefined &&
      supportFigure.visible !== false &&
      indicator.styles?.figures?.tdstSupport?.visible !== false
    const resistanceColor = (indicator.styles?.figures?.tdstResistance as { color?: string } | undefined)?.color ?? options.resistanceColor
    const supportColor = (indicator.styles?.figures?.tdstSupport as { color?: string } | undefined)?.color ?? options.supportColor

    if (resistanceVisible) {
      drawTDSTSegments(
        result,
        from,
        to,
        'tdstResistance',
        'currentTDSTResistanceId',
        resistanceColor,
        xAxis,
        yScale,
        barSpace.halfBar,
        options.provisionalOpacity,
        ctx
      )
    }
    if (supportVisible) {
      drawTDSTSegments(
        result,
        from,
        to,
        'tdstSupport',
        'currentTDSTSupportId',
        supportColor,
        xAxis,
        yScale,
        barSpace.halfBar,
        options.provisionalOpacity,
        ctx
      )
    }

    for (let i = from; i <= to; i++) {
      const output = result[i]
      const bar = kLineDataList[i]
      if (output === undefined || bar === undefined) continue
      const x = xAxis.convertToPixel(i)
      const setup = output.setupMark
      if (setup !== undefined) {
        const perfected = output.perfectedSetupIds.includes(setup.setupId)
        const text = `${setup.value}${perfected ? '•' : ''}`
        const attrs: TextAttrs = setup.direction === 'BUY'
          ? { x, y: yScale.convertToPixel(bar.low) + 3, text, align: 'center', baseline: 'top' }
          : { x, y: yScale.convertToPixel(bar.high) - 3, text, align: 'center', baseline: 'bottom' }
        drawTextMark(
          ctx,
          attrs,
          resolveSetupMarkColor(setup.direction, perfected, renderOverrides),
          options,
          setup.provisional
        )
      }

      output.countdownMarks.forEach((mark, markIndex) => {
        const layer = markIndex + 1
        const attrs: TextAttrs = mark.direction === 'BUY'
          ? {
            x,
            y: yScale.convertToPixel(bar.low) + 3 + layer * options.layerGap,
            text: String(mark.value),
            align: 'center',
            baseline: 'top'
          }
          : {
            x,
            y: yScale.convertToPixel(bar.high) - 3 - layer * options.layerGap,
            text: String(mark.value),
            align: 'center',
            baseline: 'bottom'
          }
        drawTextMark(
          ctx,
          attrs,
          resolveCountdownMarkColor(mark.direction, renderOverrides),
          options,
          mark.provisional
        )
      })
    }
    return true
  }
}

export default tdSequential

export { calculateTDSequential, TDSequentialEngine } from './engine'
export {
  PUBLIC_BASELINE_V0_2,
  TRADINGVIEW_STYLE_PUBLIC_V0_2,
  getTDSequentialConfigHash,
  resolveTDSequentialConfig,
  validateTDSequentialConfig
} from './config'
export type * from './types'
