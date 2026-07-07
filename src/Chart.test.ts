import { describe, expect, it, vi } from 'vitest'
import ChartImp from './Chart'
import { YAxisPosition } from './common/Styles'
import { PaneIdConstants } from './pane/types'

const enum TestLayoutStage {
  None = 0,
  VerticalLayout = 1 << 0,
  HorizontalLayout = 1 << 1,
  AxisTicks = 1 << 2,
  ForceAxisTicks = 1 << 3,
  AllowAxisWidthShrink = 1 << 4
}

const VIEWPORT_LAYOUT_STAGES =
  TestLayoutStage.HorizontalLayout |
  TestLayoutStage.AxisTicks

const FOLLOW_UP_AXIS_LAYOUT_STAGES =
  TestLayoutStage.AxisTicks |
  TestLayoutStage.ForceAxisTicks

const EXACT_LAYOUT_TRANSACTION_STAGES =
  TestLayoutStage.VerticalLayout |
  TestLayoutStage.HorizontalLayout |
  TestLayoutStage.AxisTicks |
  TestLayoutStage.ForceAxisTicks |
  TestLayoutStage.AllowAxisWidthShrink

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
  it('maps semantic refresh methods to layout transactions', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutTransaction = vi.fn()
    Reflect.set(chart, '_runLayoutTransaction', runLayoutTransaction)

    chart.refreshPaneLayout()
    chart.refreshViewportLayout()
    chart.refreshMetricLayout()
    chart.refreshResizeLayout('domainTo')

    expect(runLayoutTransaction).toHaveBeenNthCalledWith(1, { stages: EXACT_LAYOUT_TRANSACTION_STAGES, render: true })
    expect(runLayoutTransaction).toHaveBeenNthCalledWith(2, { stages: VIEWPORT_LAYOUT_STAGES, afterLayoutSettled: undefined, render: true })
    expect(runLayoutTransaction).toHaveBeenNthCalledWith(3, { stages: EXACT_LAYOUT_TRANSACTION_STAGES, render: true })
    expect(runLayoutTransaction).toHaveBeenNthCalledWith(4, { stages: EXACT_LAYOUT_TRANSACTION_STAGES, resizeAnchor: 'domainTo', render: true })
  })

  it('queues re-entrant layout transactions until the current transaction finishes', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const horizontalLayoutStage = TestLayoutStage.HorizontalLayout
    const forceAxisTicksStage = TestLayoutStage.ForceAxisTicks
    const runLayoutPass = vi.fn(() => {
      if (runLayoutPass.mock.calls.length === 1) {
        Reflect.get(chart, '_runLayoutTransaction').call(chart, { stages: forceAxisTicksStage })
      }
      return TestLayoutStage.None
    })
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)

    Reflect.get(chart, '_runLayoutTransaction').call(chart, { stages: horizontalLayoutStage })

    expect(runLayoutPass).toHaveBeenNthCalledWith(1, horizontalLayoutStage, undefined)
    expect(runLayoutPass).toHaveBeenNthCalledWith(2, forceAxisTicksStage, undefined)
    expect(Reflect.get(chart, '_queuedLayoutTransactions')).toEqual([])
    expect(Reflect.get(chart, '_isRunningLayoutTransaction')).toBe(false)
  })

  it('coalesces viewport requests queued during a running transaction', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutPass = vi.fn(() => {
      if (runLayoutPass.mock.calls.length === 1) {
        chart.requestViewportLayout()
        chart.requestViewportLayout()
      }
      return TestLayoutStage.None
    })
    const renderLayoutNow = vi.fn()
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    Reflect.get(chart, '_runLayoutTransaction').call(chart, {
      stages: TestLayoutStage.HorizontalLayout,
      render: true
    })

    expect(runLayoutPass).toHaveBeenCalledTimes(2)
    expect(runLayoutPass).toHaveBeenNthCalledWith(1, TestLayoutStage.HorizontalLayout, undefined)
    expect(runLayoutPass).toHaveBeenNthCalledWith(2, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(renderLayoutNow).toHaveBeenCalledTimes(2)
    expect(Reflect.get(chart, '_queuedLayoutTransactions')).toEqual([])
    expect(Reflect.get(chart, '_isRunningLayoutTransaction')).toBe(false)
  })

  it('batches requested viewport layout refreshes into one frame', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutTransaction = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_runLayoutTransaction', runLayoutTransaction)

    try {
      chart.requestViewportLayout()
      chart.requestViewportLayout()

      expect(requestFrame).toHaveBeenCalledTimes(1)
      expect(runLayoutTransaction).not.toHaveBeenCalled()

      frameCallback?.(0)

      expect(runLayoutTransaction).toHaveBeenCalledOnce()
      expect(runLayoutTransaction).toHaveBeenCalledWith({ stages: VIEWPORT_LAYOUT_STAGES, render: true })
      expect(cancelFrame).not.toHaveBeenCalled()
      expect(Reflect.get(chart, '_layoutFrameId')).toBe(-1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('flushes requested viewport layout synchronously when a sync transaction arrives', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutTransaction = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_runLayoutTransaction', runLayoutTransaction)

    try {
      chart.requestViewportLayout()
      chart.refreshPaneLayout()

      expect(cancelFrame).toHaveBeenCalledWith(7)
      expect(runLayoutTransaction).toHaveBeenCalledOnce()
      expect(runLayoutTransaction).toHaveBeenCalledWith({ stages: EXACT_LAYOUT_TRANSACTION_STAGES, render: true })

      frameCallback?.(0)

      expect(runLayoutTransaction).toHaveBeenCalledOnce()
      expect(Reflect.get(chart, '_layoutFrameId')).toBe(-1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('runs viewport layout settled callbacks before the final pane update', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const applyAxisAndHorizontalLayout = vi.fn(() => TestLayoutStage.None)
    const renderLayoutNow = vi.fn()
    const onLayoutSettled = vi.fn(() => {
      chart.refreshViewportLayout()
    })
    Reflect.set(chart, '_applyAxisAndHorizontalLayout', applyAxisAndHorizontalLayout)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chart.refreshViewportLayout(onLayoutSettled)

    expect(applyAxisAndHorizontalLayout).toHaveBeenCalledTimes(2)
    expect(applyAxisAndHorizontalLayout).toHaveBeenNthCalledWith(1, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(applyAxisAndHorizontalLayout).toHaveBeenNthCalledWith(2, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(onLayoutSettled).toHaveBeenCalledOnce()
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(onLayoutSettled.mock.invocationCallOrder[0])
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(applyAxisAndHorizontalLayout.mock.invocationCallOrder[1])
  })

  it('keeps layout settled callbacks until follow-up layout passes settle', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const applyAxisAndHorizontalLayout = vi.fn(() => (
      applyAxisAndHorizontalLayout.mock.calls.length === 1
        ? FOLLOW_UP_AXIS_LAYOUT_STAGES
        : TestLayoutStage.None
    ))
    const renderLayoutNow = vi.fn()
    const onLayoutSettled = vi.fn()
    Reflect.set(chart, '_applyAxisAndHorizontalLayout', applyAxisAndHorizontalLayout)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chart.refreshViewportLayout(onLayoutSettled)

    expect(applyAxisAndHorizontalLayout).toHaveBeenCalledTimes(2)
    expect(applyAxisAndHorizontalLayout).toHaveBeenNthCalledWith(1, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(applyAxisAndHorizontalLayout).toHaveBeenNthCalledWith(2, FOLLOW_UP_AXIS_LAYOUT_STAGES, undefined)
    expect(onLayoutSettled).toHaveBeenCalledOnce()
    expect(onLayoutSettled.mock.invocationCallOrder[0]).toBeGreaterThan(applyAxisAndHorizontalLayout.mock.invocationCallOrder[1])
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(onLayoutSettled.mock.invocationCallOrder[0])
  })

  it('uses follow-up layout passes to converge when measured axis width changes main width', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const buildTicks = vi.fn(() => true)
    const applyHorizontalLayout = vi.fn(() => applyHorizontalLayout.mock.calls.length === 1)
    const renderLayoutNow = vi.fn()

    Reflect.set(chart, '_drawPanes', [
      {
        getId: () => PaneIdConstants.X_AXIS,
        getMainWidget: () => ({
          getAxisComponent: () => ({ buildTicks })
        })
      }
    ])
    Reflect.set(chart, '_applyHorizontalLayout', applyHorizontalLayout)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    Reflect.get(chart, '_runLayoutTransaction').call(chart, { stages: VIEWPORT_LAYOUT_STAGES, render: true })

    expect(buildTicks).toHaveBeenCalledTimes(2)
    expect(buildTicks).toHaveBeenNthCalledWith(1, false)
    expect(buildTicks).toHaveBeenNthCalledWith(2, true)
    expect(applyHorizontalLayout).toHaveBeenCalledTimes(2)
    expect(renderLayoutNow).toHaveBeenCalledTimes(1)
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(applyHorizontalLayout.mock.invocationCallOrder[1])
  })

  it('keeps viewport refreshes grow-only for auto y-axis width', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const applyVerticalLayout = vi.fn()
    const applyHorizontalLayout = vi.fn(() => false)
    const renderLayoutNow = vi.fn()

    Reflect.set(chart, '_chartStore', { mainWidth: 100 })
    Reflect.set(chart, '_drawPanes', [])
    Reflect.set(chart, '_applyVerticalLayout', applyVerticalLayout)
    Reflect.set(chart, '_applyHorizontalLayout', applyHorizontalLayout)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chart.refreshViewportLayout()
    chart.refreshPaneLayout()
    chart.refreshMetricLayout()
    chart.refreshResizeLayout('domainFrom')

    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(1, undefined, false)
    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(2, undefined, true)
    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(3, undefined, true)
    expect(applyHorizontalLayout).toHaveBeenNthCalledWith(4, 'domainFrom', true)
    expect(applyVerticalLayout).toHaveBeenCalledTimes(3)
    expect(renderLayoutNow).toHaveBeenCalledTimes(4)
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
