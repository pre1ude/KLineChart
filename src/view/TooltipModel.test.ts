import { describe, expect, it, vi } from 'vitest'

import ChartImp from '../Chart'
import type KLineData from '../common/KLineData'
import { TooltipShowRule, TooltipShowType, type TooltipLegend } from '../common/Styles'
import { PaneIdConstants } from '../pane/types'
import ChartStore from '../store/ChartStore'
import { drawStaticFigure } from '../extension/figure'
import CandleTooltipView from './CandleTooltipView'
import IndicatorTooltipView from './IndicatorTooltipView'
import type { Indicator, IndicatorTooltipData } from '../component/Indicator'

vi.mock('../common/utils/canvas', () => ({
  calcTextWidth: vi.fn((text: string) => text.length * 8),
  createFont: vi.fn(() => 'normal 12px sans-serif')
}))

vi.mock('../extension/figure', () => ({
  createFigure: vi.fn(),
  drawStaticFigure: vi.fn()
}))

describe('tooltip render model', () => {
  it('keeps candle formatter output in the normalized model and does not rebuild during rendering', () => {
    const { chartStore, widget } = createFixture()
    const data = createData()
    vi.spyOn(chartStore, 'getDataList').mockReturnValue([data])
    vi.spyOn(chartStore.getIndicatorStore(), 'getInstances').mockReturnValue([])
    vi.spyOn(chartStore.getTooltipStore(), 'getCrosshair').mockReturnValue({
      paneId: PaneIdConstants.CANDLE,
      dataIndex: 0,
      kLineData: data
    })

    const formatter = vi.fn((): TooltipLegend[] => [
      { title: 'Close', value: '{close}' }
    ])
    const styles = chartStore.getStyles()
    styles.candle.tooltip.showRule = TooltipShowRule.Always
    styles.candle.tooltip.showType = TooltipShowType.Standard
    styles.candle.tooltip.custom = formatter

    const view = new CandleTooltipView(widget)
    const model = view.buildRenderModel()
    expect(formatter).toHaveBeenCalledTimes(1)
    expect(model.visible).toBe(true)
    expect(model.blocks).toHaveLength(1)
    expect(model.blocks[0].type).toBe('standard')
    if (model.blocks[0].type === 'standard') {
      const legendContent = model.blocks[0].contents.find(content => content.type === 'legends')
      expect(legendContent?.type).toBe('legends')
      if (legendContent?.type === 'legends') {
        expect(legendContent.legends[0].title).toEqual(expect.objectContaining({ text: 'Close' }))
      }
    }

    const ctx = {} as CanvasRenderingContext2D
    view.drawModel(ctx, model, true)
    view.drawModel(ctx, model, false)
    expect(formatter).toHaveBeenCalledTimes(1)
  })

  it('preserves main-pane standard/rect ordering and show rules', () => {
    const { chartStore, widget } = createFixture()
    const data = createData()
    vi.spyOn(chartStore, 'getDataList').mockReturnValue([data])
    vi.spyOn(chartStore.getTooltipStore(), 'getCrosshair').mockReturnValue({
      paneId: PaneIdConstants.CANDLE,
      dataIndex: 0,
      kLineData: data,
      realX: 100,
      y: 80
    })
    vi.spyOn(chartStore.getIndicatorStore(), 'getInstances').mockReturnValue([createIndicator()])

    const styles = chartStore.getStyles()
    styles.candle.tooltip.showRule = TooltipShowRule.Always
    styles.indicator.tooltip.showRule = TooltipShowRule.Always
    styles.candle.tooltip.showType = TooltipShowType.Rect
    styles.indicator.tooltip.showType = TooltipShowType.Standard
    styles.candle.tooltip.custom = [{ title: 'Close', value: '{close}' }]

    const view = new CandleTooltipView(widget)
    const model = view.buildRenderModel()
    expect(model.blocks.map(block => block.type)).toEqual(['standard', 'rect'])

    styles.indicator.tooltip.showRule = TooltipShowRule.None
    const hiddenModel = view.buildRenderModel()
    expect(hiddenModel.blocks).toHaveLength(1)
    expect(hiddenModel.blocks[0].type).toBe('rect')
  })

  it('normalizes indicator tooltip data once per screen model build', () => {
    const { chartStore, widget } = createFixture()
    const data = createData()
    vi.spyOn(chartStore, 'getDataList').mockReturnValue([data])
    vi.spyOn(chartStore.getTooltipStore(), 'getCrosshair').mockReturnValue({
      paneId: 'indicator_vol',
      dataIndex: 0,
      kLineData: data
    })
    const indicator = createIndicator()
    vi.spyOn(chartStore.getIndicatorStore(), 'getInstances').mockReturnValue([indicator])

    const view = new IndicatorTooltipView(widget)
    const viewInternals = view as unknown as {
      getIndicatorTooltipData: (...args: never[]) => IndicatorTooltipData
    }
    const getTooltipData = vi.spyOn(viewInternals, 'getIndicatorTooltipData').mockReturnValue({
      name: 'VOL',
      calcParamsText: '',
      icons: [],
      values: [{ title: 'Volume', value: '100' }]
    })

    const model = view.buildRenderModel()
    expect(model.visible).toBe(true)
    expect(getTooltipData).toHaveBeenCalledTimes(1)
    view.drawModel({} as CanvasRenderingContext2D, model, false)
    expect(getTooltipData).toHaveBeenCalledTimes(1)
  })

  it('derives direction from adjacent raw indicator values with an epsilon', () => {
    const { chartStore, widget } = createFixture()
    const data = createData()
    const indicator = {
      id: 'custom',
      name: 'Custom',
      shortName: 'Custom',
      calcParams: [],
      figures: [{ key: 'value', title: 'Value' }],
      result: [{ value: 1 }, { value: 2 }, { value: 2 + 1e-12 }, { value: 1 }],
      visible: true,
      precision: 2,
      shouldFormatBigNumber: false,
      styles: undefined
    } as unknown as Indicator
    const view = new IndicatorTooltipView(widget)
    const viewInternals = view as unknown as {
      getIndicatorTooltipData: (...args: never[]) => IndicatorTooltipData
    }
    const styles = chartStore.getStyles().indicator
    const getData = (dataIndex: number): IndicatorTooltipData => viewInternals.getIndicatorTooltipData(
      [data, data, data, data],
      { dataIndex, kLineData: data },
      indicator,
      chartStore.getCustomApi(),
      chartStore.getThousandsSeparator(),
      chartStore.getDecimalFoldThreshold(),
      styles
    )

    expect(getData(0).values[0].direction).toBeUndefined()
    expect(getData(1).values[0].direction).toBe(1)
    expect(getData(2).values[0].direction).toBe(0)
    expect(getData(3).values[0].direction).toBe(-1)
  })

  it('draws indicator direction arrows in candle colors and honors the toggle', () => {
    const { chartStore, widget } = createFixture()
    const styles = chartStore.getStyles()
    const view = new IndicatorTooltipView(widget)
    const model = {
      visible: true,
      paneId: 'indicator',
      bounding: { width: 600, height: 400, left: 0, top: 0 },
      directionStyle: {
        show: true,
        upColor: styles.candle.bar.upColor,
        downColor: styles.candle.bar.downColor
      },
      blocks: [{
        type: 'standard' as const,
        paneId: 'indicator',
        indicatorId: 'ma',
        indicatorName: 'MA',
        left: 0,
        top: 0,
        maxWidth: 600,
        styles: styles.indicator.tooltip,
        contents: [{
          type: 'legends' as const,
          legends: [{ title: 'MA', value: '12.3', direction: 1 as const }],
          styles: styles.indicator.tooltip.text
        }]
      }]
    }

    view.drawModel({} as CanvasRenderingContext2D, model, false)
    const arrowCall = vi.mocked(drawStaticFigure).mock.calls.find(([, name, data]) => (
      name === 'text' && (data.attrs as { text?: string }).text === '↑'
    ))
    expect(arrowCall?.[2].styles).toEqual(expect.objectContaining({ color: styles.candle.bar.upColor }))

    vi.mocked(drawStaticFigure).mockClear()
    model.directionStyle.show = false
    view.drawModel({} as CanvasRenderingContext2D, model, false)
    expect(vi.mocked(drawStaticFigure).mock.calls.some(([, name, data]) => (
      name === 'text' && (data.attrs as { text?: string }).text === '↑'
    ))).toBe(false)
  })

  it('preserves an explicit custom indicator direction', () => {
    const { chartStore, widget } = createFixture()
    vi.spyOn(widget.getPane().getChart(), 'getXAxisPane').mockReturnValue({
      getMainWidget: () => ({ getAxisComponent: () => ({}) })
    } as never)
    Object.assign(widget.getPane(), {
      getYLeftAxisWidget: () => ({ getAxisComponent: () => ({}) })
    })
    const data = createData()
    const indicator = {
      id: 'custom',
      name: 'Custom',
      shortName: 'Custom',
      calcParams: [],
      figures: [],
      result: [],
      visible: true,
      precision: 2,
      shouldFormatBigNumber: false,
      styles: undefined,
      createTooltipDataSource: () => ({
        values: [{ title: 'Value', value: '1.2', direction: -1 as const }]
      })
    } as unknown as Indicator
    const view = new IndicatorTooltipView(widget)
    const viewInternals = view as unknown as {
      getIndicatorTooltipData: (...args: never[]) => IndicatorTooltipData
    }
    const tooltipData = viewInternals.getIndicatorTooltipData(
      [data],
      { dataIndex: 0, kLineData: data },
      indicator,
      chartStore.getCustomApi(),
      chartStore.getThousandsSeparator(),
      chartStore.getDecimalFoldThreshold(),
      chartStore.getStyles().indicator
    )

    expect(tooltipData.values[0].direction).toBe(-1)
  })
})

function createFixture(): { chartStore: ChartStore, widget: ConstructorParameters<typeof CandleTooltipView>[0] } {
  const chart = Object.create(ChartImp.prototype) as ChartImp
  const chartStore = new ChartStore(chart)
  Reflect.set(chart, '_chartStore', chartStore)
  const pane = {
    getId: () => PaneIdConstants.CANDLE,
    getChart: () => chart,
    getYLeftAxisWidget: () => ({ getBounding: () => ({ width: 20, height: 0, left: 0, top: 0 }) }),
    getYRightAxisWidget: () => ({ getBounding: () => ({ width: 20, height: 0, left: 0, top: 0 }) })
  }
  const widget = {
    getPane: () => pane,
    getBounding: () => ({ width: 600, height: 400, left: 0, top: 0 })
  }
  return { chartStore, widget: widget as never }
}

function createData(): KLineData {
  return { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }
}

function createIndicator(): never {
  return {
    id: 'vol',
    name: 'Volume',
    shortName: 'VOL',
    calcParams: [],
    figures: [],
    result: [],
    visible: true,
    styles: undefined
  } as never
}
