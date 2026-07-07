import { describe, expect, it, vi } from 'vitest'
import type KLineData from '../common/KLineData'
import { LoadDataType } from '../common/LoadDataCallback'
import type Chart from '../Chart'
import ChartStore from './ChartStore'
import { PANE_DEFAULT_HEIGHT } from '../pane/types'

describe('ChartStore', () => {
  it('uses main-flex pane resizing by default and accepts adjacent mode', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart

    const store = new ChartStore(chart)
    expect(store.getPaneResizeMode()).toBe('main-flex')

    store.setOptions({ paneResizeMode: 'adjacent' })

    expect(store.getPaneResizeMode()).toBe('adjacent')
  })

  it('uses built-in indicator pane defaults and accepts global overrides', () => {
    const chart = {
      refreshViewportLayout: vi.fn()
    } as unknown as Chart

    const store = new ChartStore(chart)
    expect(store.getIndicatorPaneDefaultHeight()).toBe(PANE_DEFAULT_HEIGHT)
    expect(store.getMinIndicatorPaneHeight()).toBe(30)

    store.setOptions({
      indicatorPaneDefaultHeight: 120,
      minIndicatorPaneHeight: 50
    })

    expect(store.getIndicatorPaneDefaultHeight()).toBe(120)
    expect(store.getMinIndicatorPaneHeight()).toBe(50)
  })

  it('applies initial auto alignment before the first init data render', () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    try {
      const chart = {
        refreshViewportLayout: vi.fn((afterLayoutSettled?: () => void) => {
          afterLayoutSettled?.()
        })
      } as unknown as Chart
      const store = new ChartStore(chart)
      store.mainWidth = 100

      store.addData(createDataList(5), LoadDataType.Init)

      expect(timeoutSpy).not.toHaveBeenCalled()
      expect(chart.refreshViewportLayout).toHaveBeenNthCalledWith(1, expect.any(Function))
      expect(store.getTimeScaleStore().getOffsetRightDistance()).toBe(60)
      expect(store.getTimeScaleStore().getVisibleRange()).toMatchObject({
        from: 0,
        domainFrom: 0
      })
      expect(chart.refreshViewportLayout).toHaveBeenCalledTimes(2)
    } finally {
      timeoutSpy.mockRestore()
    }
  })
})

function createDataList(count: number): KLineData[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: index,
    open: index,
    high: index,
    low: index,
    close: index
  }))
}
