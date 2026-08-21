import { describe, expect, it, vi } from 'vitest'

import ChartImp from '../Chart'
import ChartStore from './ChartStore'
import TooltipStore from './TooltipStore'

describe('TooltipStore render type', () => {
  it('selects the renderer once at construction and falls back to Canvas', () => {
    expect(new TooltipStore({} as ChartStore).getRenderType()).toBe('canvas')
    expect(new TooltipStore({} as ChartStore, { renderType: 'dom' }).getRenderType()).toBe('dom')
    expect(new TooltipStore({} as ChartStore, { renderType: 'invalid' as never }).getRenderType()).toBe('canvas')
  })

  it('uses the initialization option and ignores runtime Chart.setOptions changes', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const chartStore = new ChartStore(chart, { tooltip: { renderType: 'dom' } })
    const refreshMetricLayout = vi.fn()
    Reflect.set(chart, '_chartStore', chartStore)
    Reflect.set(chart, 'refreshMetricLayout', refreshMetricLayout)

    expect(chartStore.getTooltipStore().getRenderType()).toBe('dom')

    chart.setOptions({ tooltip: { renderType: 'canvas' } })

    expect(chartStore.getTooltipStore().getRenderType()).toBe('dom')
    expect(refreshMetricLayout).toHaveBeenCalledTimes(1)
  })

  it('defaults direction arrows to enabled and supports runtime updates', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const chartStore = new ChartStore(chart)
    const refreshMetricLayout = vi.fn()
    Reflect.set(chart, '_chartStore', chartStore)
    Reflect.set(chart, 'refreshMetricLayout', refreshMetricLayout)

    expect(chartStore.getTooltipStore().getShowValueDirection()).toBe(true)

    chart.setOptions({ tooltip: { showValueDirection: false } })
    expect(chartStore.getTooltipStore().getShowValueDirection()).toBe(false)

    chart.setOptions({ tooltip: { showValueDirection: true } })
    expect(chartStore.getTooltipStore().getShowValueDirection()).toBe(true)
    expect(refreshMetricLayout).toHaveBeenCalledTimes(2)
  })
})
