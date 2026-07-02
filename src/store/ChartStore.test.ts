import { describe, expect, it, vi } from 'vitest'
import type KLineData from '../common/KLineData'
import { LoadDataType } from '../common/LoadDataCallback'
import type Chart from '../Chart'
import ChartStore from './ChartStore'

describe('ChartStore', () => {
  it('uses main-flex pane resizing by default and accepts adjacent mode', () => {
    const chart = {
      adjustPaneViewport: vi.fn()
    } as unknown as Chart

    const store = new ChartStore(chart)
    expect(store.getPaneResizeMode()).toBe('main-flex')

    store.setOptions({ paneResizeMode: 'adjacent' })

    expect(store.getPaneResizeMode()).toBe('adjacent')
  })

  it('applies initial auto alignment before the first init data render', () => {
    vi.useFakeTimers()
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    try {
      const chart = {
        adjustPaneViewport: vi.fn()
      } as unknown as Chart
      const store = new ChartStore(chart)
      store.mainWidth = 100

      store.addData(createDataList(5), LoadDataType.Init)

      expect(timeoutSpy).not.toHaveBeenCalled()
      expect(store.getTimeScaleStore().getOffsetRightDistance()).toBe(60)
      expect(store.getTimeScaleStore().getVisibleRange()).toMatchObject({
        from: 0,
        domainFrom: 0
      })
      expect(chart.adjustPaneViewport).toHaveBeenCalledTimes(1)
    } finally {
      timeoutSpy.mockRestore()
      vi.useRealTimers()
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
