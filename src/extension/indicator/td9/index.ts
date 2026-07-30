import type KLineData from '../../../common/KLineData'
import { type Indicator, type IndicatorTemplate, IndicatorSeries } from '../../../component/Indicator'
import { drawStaticFigure } from '../../figure'
import type { TextAttrs } from '../../figure/text'
import { calculateTD9, TD9_SETUP_LENGTH } from './engine'
import type {
  TD9BarOutput,
  TD9Config,
  TD9Direction,
  TD9IndicatorExtendData,
  TD9InputBar,
  TD9RenderOptions
} from './types'

const TD9_DISPLAY_CONFIRMATION_COUNT = 6

type ResolvedTD9RenderOptions = Required<Omit<
  TD9RenderOptions,
  'setupColor' | 'perfectedColor'
>>

const DEFAULT_RENDER_OPTIONS: ResolvedTD9RenderOptions = {
  buySetupColor: '#D94A4A',
  sellSetupColor: '#16A085',
  fontSize: 10,
  fontWeight: 600,
  provisionalOpacity: 0.55
}

function resolveExtendData(value: unknown): TD9IndicatorExtendData {
  if (value === null || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  if ('config' in record || 'render' in record) return value as TD9IndicatorExtendData
  return { config: value as Partial<TD9Config> }
}

function resolveSetupMarkColor(
  direction: TD9Direction,
  perfected: boolean,
  render?: TD9RenderOptions
): string {
  if (perfected && render?.perfectedColor !== undefined) return render.perfectedColor
  return direction === 'BUY'
    ? render?.buySetupColor ?? render?.setupColor ?? DEFAULT_RENDER_OPTIONS.buySetupColor
    : render?.sellSetupColor ?? render?.setupColor ?? DEFAULT_RENDER_OPTIONS.sellSetupColor
}

function filterSetupMarksForDisplay(
  outputs: TD9BarOutput[]
): TD9BarOutput[] {
  const visibleSetupIds = new Set<string>()
  outputs.forEach(output => {
    const setup = output.setupMark
    if (setup?.value === TD9_SETUP_LENGTH) visibleSetupIds.add(setup.setupId)
  })
  const terminalSetupMark = outputs[outputs.length - 1]?.setupMark
  if (
    terminalSetupMark !== undefined &&
    terminalSetupMark.value >= TD9_DISPLAY_CONFIRMATION_COUNT
  ) {
    visibleSetupIds.add(terminalSetupMark.setupId)
  }

  return outputs.map(output => (
    output.setupMark === undefined || visibleSetupIds.has(output.setupMark.setupId)
      ? output
      : { ...output, setupMark: undefined }
  ))
}

function drawTextMark(
  ctx: CanvasRenderingContext2D,
  attrs: TextAttrs,
  color: string,
  options: ResolvedTD9RenderOptions,
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

export function calculateTD9Outputs(
  dataList: readonly TD9InputBar[],
  config: Partial<TD9Config> = {}
): TD9BarOutput[] {
  const calculation = calculateTD9(dataList, config)
  const outputs = calculation.provisional === undefined
    ? calculation.bars
    : [...calculation.bars, calculation.provisional]
  return filterSetupMarksForDisplay(outputs)
}

const td9: IndicatorTemplate<TD9BarOutput> = {
  name: 'TD9',
  shortName: 'TD9',
  series: IndicatorSeries.Price,
  precision: 2,
  shouldOhlc: true,
  calcParams: [],
  figures: [],
  calc: (dataList: KLineData[], indicator: Indicator<TD9BarOutput>) => (
    calculateTD9Outputs(
      dataList as TD9InputBar[],
      resolveExtendData(indicator.extendData).config
    )
  ),
  createTooltipDataSource: ({ indicator, crosshair }) => {
    const output = indicator.result[crosshair.dataIndex ?? 0] as TD9BarOutput | undefined
    const setup = output?.setupMark === undefined
      ? '—'
      : `${output.setupMark.direction} ${output.setupMark.value}`
    return {
      name: indicator.shortName,
      calcParamsText: '',
      values: [{ title: 'Setup: ', value: setup }]
    }
  },
  draw: ({ ctx, kLineDataList, indicator, visibleRange, xAxis, yAxis }) => {
    const result = indicator.result
    if (result.length === 0) return true
    const render = resolveExtendData(indicator.extendData).render
    const options = { ...DEFAULT_RENDER_OPTIONS, ...render }
    const from = Math.max(0, visibleRange.from)
    const to = Math.min(result.length - 1, visibleRange.to)

    for (let i = from; i <= to; i++) {
      const output = result[i]
      const bar = kLineDataList[i]
      const setup = output?.setupMark
      if (setup === undefined || bar === undefined) continue
      const x = xAxis.convertToPixel(i)
      const perfected = setup.perfected === true
      const text = `${setup.value}${perfected ? '•' : ''}`
      const attrs: TextAttrs = setup.direction === 'BUY'
        ? { x, y: yAxis.convertToPixel(bar.low) + 3, text, align: 'center', baseline: 'top' }
        : { x, y: yAxis.convertToPixel(bar.high) - 3, text, align: 'center', baseline: 'bottom' }
      drawTextMark(
        ctx,
        attrs,
        resolveSetupMarkColor(setup.direction, perfected, render),
        options,
        output.provisional
      )
    }
    return true
  }
}

export default td9

export { DEFAULT_TD9_CONFIG, resolveTD9Config, validateTD9Config } from './config'
export { calculateTD9 } from './engine'
export type * from './types'
