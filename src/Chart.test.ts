import { describe, expect, it, vi } from 'vitest'
import ChartImp from './Chart'
import { YAxisPosition } from './common/Styles'
import { PaneIdConstants } from './pane/types'

const VIEWPORT_LAYOUT_INVALIDATION_MASK = 14
const EXACT_LAYOUT_INVALIDATION_MASK = 63

function createPendingIndicatorChart(ready = true): {
  chart: ChartImp
  addInstance: ReturnType<typeof vi.fn>
  refreshPaneLayout: ReturnType<typeof vi.fn>
  createPane: ReturnType<typeof vi.fn>
  pane: {
    setHeightSpec: ReturnType<typeof vi.fn>
    setBounding: ReturnType<typeof vi.fn>
  }
} {
  const chart = Object.create(ChartImp.prototype) as ChartImp
  const pane = {
    setHeightSpec: vi.fn(),
    setBounding: vi.fn()
  }
  const addInstance = vi.fn(() => new Promise<boolean>(() => {}))
  const refreshPaneLayout = vi.fn()
  const createPane = vi.fn(() => pane)

  Reflect.set(chart, '_chartStore', {
    getIndicatorPaneDefaultHeight: () => 0.25,
    getMinIndicatorPaneHeight: () => 80,
    getIndicatorStore: () => ({ addInstance })
  })
  Reflect.set(chart, '_createPane', createPane)
  Reflect.set(chart, 'getDrawPaneById', vi.fn(() => undefined))
  Reflect.set(chart, 'refreshPaneLayout', refreshPaneLayout)
  if (ready) {
    Reflect.set(chart, '_dataZoomSlider', {})
  }

  return { chart, addInstance, refreshPaneLayout, createPane, pane }
}

describe('ChartImp.createIndicator', () => {
  it('lays out a new percentage pane before indicator calculation settles', () => {
    const { chart, addInstance, refreshPaneLayout, pane } = createPendingIndicatorChart()

    const paneId = chart.createIndicator('VOL', false, { height: 0.25 })

    expect(paneId?.startsWith(PaneIdConstants.INDICATOR)).toBe(true)
    expect(pane.setHeightSpec).toHaveBeenCalledWith({ unit: 'percent', value: 0.25 })
    expect(pane.setBounding).toHaveBeenCalledWith({ height: 0 })
    expect(addInstance).toHaveBeenCalledOnce()
    expect(refreshPaneLayout).toHaveBeenCalledOnce()
  })

  it('defers provisional layout while constructor layout dependencies are not ready', () => {
    const { chart, refreshPaneLayout } = createPendingIndicatorChart(false)

    chart.createIndicator('VOL', false, { height: 0.25 })

    expect(refreshPaneLayout).not.toHaveBeenCalled()
  })

  it('uses global indicator pane defaults when pane options omit them', () => {
    const { chart, createPane, pane } = createPendingIndicatorChart()

    chart.createIndicator('VOL')

    expect(createPane).toHaveBeenCalledWith(expect.any(Function), expect.any(String), {
      height: 0.25,
      minHeight: 80
    })
    expect(pane.setHeightSpec).toHaveBeenCalledWith({ unit: 'percent', value: 0.25 })
  })

  it('keeps explicit indicator pane height and min height above global defaults', () => {
    const { chart, createPane, pane } = createPendingIndicatorChart()

    chart.createIndicator('VOL', false, { height: 120, minHeight: 60 })

    expect(createPane).toHaveBeenCalledWith(expect.any(Function), expect.any(String), {
      height: 120,
      minHeight: 60
    })
    expect(pane.setHeightSpec).toHaveBeenCalledWith({ unit: 'pixel', value: 120 })
  })
})

describe('ChartImp layout refresh methods', () => {
  it('maps semantic refresh methods to layout invalidation masks', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const flushLayout = vi.fn()
    Reflect.set(chart, '_flushLayout', flushLayout)

    chart.refreshPaneLayout()
    chart.refreshViewportLayout()
    chart.refreshMetricLayout()
    chart.refreshResizeLayout('domainTo')

    expect(flushLayout).toHaveBeenNthCalledWith(1, EXACT_LAYOUT_INVALIDATION_MASK)
    expect(flushLayout).toHaveBeenNthCalledWith(2, VIEWPORT_LAYOUT_INVALIDATION_MASK)
    expect(flushLayout).toHaveBeenNthCalledWith(3, EXACT_LAYOUT_INVALIDATION_MASK)
    expect(flushLayout).toHaveBeenNthCalledWith(4, EXACT_LAYOUT_INVALIDATION_MASK, 'domainTo')
  })

  it('merges pending layout invalidations before flushing', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const flushLayout = vi.fn()
    const measureWidthInvalidation = 2
    const adjustAxisInvalidation = 8
    Reflect.set(chart, '_flushLayout', flushLayout)
    Reflect.set(chart, '_pendingLayoutInvalidation', measureWidthInvalidation)
    Reflect.set(chart, '_pendingLayoutResizeAnchor', 'domainFrom')

    Reflect.get(chart, '_invalidateLayout').call(chart, adjustAxisInvalidation, 'domainTo')

    expect(flushLayout).toHaveBeenCalledWith(measureWidthInvalidation | adjustAxisInvalidation, 'domainTo')
    expect(Reflect.get(chart, '_pendingLayoutInvalidation')).toBe(0)
    expect(Reflect.get(chart, '_pendingLayoutResizeAnchor')).toBeUndefined()
  })

  it('batches requested viewport layout refreshes into one frame', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const flushLayout = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_flushLayout', flushLayout)

    try {
      chart.requestViewportLayout()
      chart.requestViewportLayout()

      expect(requestFrame).toHaveBeenCalledTimes(1)
      expect(flushLayout).not.toHaveBeenCalled()

      frameCallback?.(0)

      expect(flushLayout).toHaveBeenCalledOnce()
      expect(flushLayout).toHaveBeenCalledWith(VIEWPORT_LAYOUT_INVALIDATION_MASK)
      expect(cancelFrame).not.toHaveBeenCalled()
      expect(Reflect.get(chart, '_layoutFrameId')).toBe(-1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('flushes requested viewport layout synchronously when a sync invalidation arrives', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const flushLayout = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_flushLayout', flushLayout)

    try {
      chart.requestViewportLayout()
      chart.refreshPaneLayout()

      expect(cancelFrame).toHaveBeenCalledWith(7)
      expect(flushLayout).toHaveBeenCalledOnce()
      expect(flushLayout).toHaveBeenCalledWith(EXACT_LAYOUT_INVALIDATION_MASK)

      frameCallback?.(0)

      expect(flushLayout).toHaveBeenCalledOnce()
      expect(Reflect.get(chart, '_pendingLayoutInvalidation')).toBe(0)
      expect(Reflect.get(chart, '_layoutFrameId')).toBe(-1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('runs viewport layout settled callbacks before the final pane update', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const applyAxisAndHorizontalLayout = vi.fn(() => false)
    const updatePaneViews = vi.fn()
    const onLayoutSettled = vi.fn(() => {
      chart.refreshViewportLayout()
    })
    Reflect.set(chart, '_applyAxisAndHorizontalLayout', applyAxisAndHorizontalLayout)
    Reflect.set(chart, '_updatePaneViews', updatePaneViews)

    chart.refreshViewportLayout(onLayoutSettled)

    expect(applyAxisAndHorizontalLayout).toHaveBeenCalledTimes(2)
    expect(applyAxisAndHorizontalLayout).toHaveBeenNthCalledWith(1, VIEWPORT_LAYOUT_INVALIDATION_MASK, undefined)
    expect(applyAxisAndHorizontalLayout).toHaveBeenNthCalledWith(2, VIEWPORT_LAYOUT_INVALIDATION_MASK, undefined)
    expect(onLayoutSettled).toHaveBeenCalledOnce()
    expect(updatePaneViews).toHaveBeenCalledOnce()
    expect(updatePaneViews.mock.invocationCallOrder[0]).toBeGreaterThan(onLayoutSettled.mock.invocationCallOrder[0])
    expect(updatePaneViews.mock.invocationCallOrder[0]).toBeGreaterThan(applyAxisAndHorizontalLayout.mock.invocationCallOrder[1])
  })

  it('drains re-entrant layout invalidations after the current flush pass', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const measureWidthInvalidation = 2
    const adjustAxisInvalidation = 8
    const flushLayout = vi.fn(() => {
      if (flushLayout.mock.calls.length === 1) {
        Reflect.get(chart, '_invalidateLayout').call(chart, adjustAxisInvalidation)
      }
    })
    Reflect.set(chart, '_flushLayout', flushLayout)

    Reflect.get(chart, '_invalidateLayout').call(chart, measureWidthInvalidation)

    expect(flushLayout).toHaveBeenNthCalledWith(1, measureWidthInvalidation)
    expect(flushLayout).toHaveBeenNthCalledWith(2, adjustAxisInvalidation)
    expect(Reflect.get(chart, '_pendingLayoutInvalidation')).toBe(0)
    expect(Reflect.get(chart, '_isFlushingLayout')).toBe(false)
  })

  it('uses pending invalidations to converge when measured axis width changes main width', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const buildTicks = vi.fn(() => true)
    const applyHorizontalLayout = vi.fn(() => applyHorizontalLayout.mock.calls.length === 1)
    const updatePaneViews = vi.fn()

    Reflect.set(chart, '_drawPanes', [
      {
        getId: () => PaneIdConstants.X_AXIS,
        getMainWidget: () => ({
          getAxisComponent: () => ({ buildTicks })
        })
      }
    ])
    Reflect.set(chart, '_applyHorizontalLayout', applyHorizontalLayout)
    Reflect.set(chart, '_updatePaneViews', updatePaneViews)

    Reflect.get(chart, '_invalidateLayout').call(chart, VIEWPORT_LAYOUT_INVALIDATION_MASK)

    expect(buildTicks).toHaveBeenCalledTimes(2)
    expect(buildTicks).toHaveBeenNthCalledWith(1, false)
    expect(buildTicks).toHaveBeenNthCalledWith(2, true)
    expect(applyHorizontalLayout).toHaveBeenCalledTimes(2)
    expect(updatePaneViews).toHaveBeenCalledTimes(1)
    expect(updatePaneViews.mock.invocationCallOrder[0]).toBeGreaterThan(applyHorizontalLayout.mock.invocationCallOrder[1])
  })

  it('keeps viewport refreshes grow-only for auto y-axis width', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const applyVerticalLayout = vi.fn()
    const applyHorizontalLayout = vi.fn(() => false)
    const updatePaneViews = vi.fn()

    Reflect.set(chart, '_chartStore', { mainWidth: 100 })
    Reflect.set(chart, '_drawPanes', [])
    Reflect.set(chart, '_applyVerticalLayout', applyVerticalLayout)
    Reflect.set(chart, '_applyHorizontalLayout', applyHorizontalLayout)
    Reflect.set(chart, '_updatePaneViews', updatePaneViews)

    chart.refreshViewportLayout()
    chart.refreshPaneLayout()
    chart.refreshMetricLayout()
    chart.refreshResizeLayout('domainFrom')

    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(1, undefined, false)
    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(2, undefined, true)
    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(3, undefined, true)
    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(4, 'domainFrom', true)
    expect(applyVerticalLayout).toHaveBeenCalledTimes(3)
    expect(updatePaneViews).toHaveBeenCalledTimes(4)
  })

  it('preserves current auto y-axis width when shrink is not allowed', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const pane = {
      getId: () => PaneIdConstants.CANDLE,
      getYLeftAxisWidget: () => ({
        getAxisComponent: () => ({ getAutoSize: () => 10 }),
        getBounding: () => ({ width: 30 })
      }),
      getYRightAxisWidget: () => ({
        getAxisComponent: () => ({ getAutoSize: () => 20 }),
        getBounding: () => ({ width: 40 })
      }),
      setBounding: vi.fn()
    }
    const chartStore = {
      mainWidth: 75,
      getStyles: () => ({
        yAxis: {
          size: 'auto',
          inside: false,
          position: YAxisPosition.Both
        },
        separator: { fill: true }
      }),
      getTimeScaleStore: () => ({
        adjustVisibleRange: vi.fn()
      }),
      getTooltipStore: () => ({
        recalculateCrosshair: vi.fn()
      })
    }

    Reflect.set(chart, '_container', { clientWidth: 100 })
    Reflect.set(chart, '_chartStore', chartStore)
    Reflect.set(chart, '_drawPanes', [pane])
    Reflect.set(chart, '_separatorPanes', new Map())
    Reflect.set(chart, '_dataZoomSlider', { setLayout: vi.fn() })

    const applyHorizontalLayout = Reflect.get(chart, '_applyHorizontalLayout') as (resizeAnchor?: unknown, allowAxisWidthShrink?: boolean) => boolean

    expect(applyHorizontalLayout.call(chart, undefined, false)).toBe(true)
    expect(pane.setBounding).toHaveBeenLastCalledWith(
      { width: 100 },
      { width: 30, left: 30 },
      { width: 30, left: 0 },
      { width: 40, left: 60 }
    )

    pane.setBounding.mockClear()

    expect(applyHorizontalLayout.call(chart, undefined, true)).toBe(true)
    expect(pane.setBounding).toHaveBeenLastCalledWith(
      { width: 100 },
      { width: 70, left: 10 },
      { width: 10, left: 0 },
      { width: 20, left: 80 }
    )
  })
})
