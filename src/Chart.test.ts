import { describe, expect, it, vi } from 'vitest'
import ChartImp from './Chart'
import type KLineData from './common/KLineData'
import { LoadDataType } from './common/LoadDataCallback'
import { YAxisPosition } from './common/Styles'
import { PaneIdConstants } from './pane/types'
import ChartStore from './store/ChartStore'

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

const FOLLOW_UP_EXACT_AXIS_LAYOUT_STAGES =
  FOLLOW_UP_AXIS_LAYOUT_STAGES |
  TestLayoutStage.AllowAxisWidthShrink

const EXACT_LAYOUT_REQUEST_STAGES =
  TestLayoutStage.VerticalLayout |
  TestLayoutStage.HorizontalLayout |
  TestLayoutStage.AxisTicks |
  TestLayoutStage.ForceAxisTicks |
  TestLayoutStage.AllowAxisWidthShrink

type TestLayoutSettledCallback = () => void

type TestLayoutRequest = {
  stages: TestLayoutStage
  resizeAnchor?: 'domainFrom' | 'domainTo'
  afterLayoutSettledCallbacks: TestLayoutSettledCallback[]
  render: boolean
}

function createLayoutRequest(
  stages: TestLayoutStage,
  options: {
    resizeAnchor?: 'domainFrom' | 'domainTo'
    afterLayoutSettledCallbacks?: TestLayoutSettledCallback[]
    render?: boolean
  } = {}
): TestLayoutRequest {
  return {
    stages,
    resizeAnchor: options.resizeAnchor,
    afterLayoutSettledCallbacks: options.afterLayoutSettledCallbacks ?? [],
    render: options.render === true
  }
}

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

function createDataList(count: number): KLineData[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: index,
    open: index,
    high: index,
    low: index,
    close: index
  }))
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
  it('maps semantic refresh methods to layout requests', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runSynchronousLayoutRequest = vi.fn()
    Reflect.set(chart, '_runSynchronousLayoutRequest', runSynchronousLayoutRequest)

    chart.refreshPaneLayout()
    chart.refreshViewportLayout()
    chart.refreshMetricLayout()
    chart.refreshResizeLayout('domainTo')

    expect(runSynchronousLayoutRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({ stages: EXACT_LAYOUT_REQUEST_STAGES, render: true }))
    expect(runSynchronousLayoutRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({ stages: VIEWPORT_LAYOUT_STAGES, render: true }))
    expect(runSynchronousLayoutRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({ stages: EXACT_LAYOUT_REQUEST_STAGES, render: true }))
    expect(runSynchronousLayoutRequest).toHaveBeenNthCalledWith(4, expect.objectContaining({ stages: EXACT_LAYOUT_REQUEST_STAGES, resizeAnchor: 'domainTo', render: true }))
  })

  it('merges re-entrant layout requests until the current request settles', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const horizontalLayoutStage = TestLayoutStage.HorizontalLayout
    const forceAxisTicksStage = TestLayoutStage.ForceAxisTicks
    const runLayoutPass = vi.fn(() => {
      if (runLayoutPass.mock.calls.length === 1) {
        Reflect.get(chart, '_runSynchronousLayoutRequest').call(chart, createLayoutRequest(forceAxisTicksStage))
      }
      return TestLayoutStage.None
    })
    const renderLayoutNow = vi.fn()
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    Reflect.get(chart, '_runSynchronousLayoutRequest').call(chart, createLayoutRequest(horizontalLayoutStage, { render: true }))

    expect(runLayoutPass).toHaveBeenNthCalledWith(1, horizontalLayoutStage, undefined)
    expect(runLayoutPass).toHaveBeenNthCalledWith(2, forceAxisTicksStage, undefined)
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(Reflect.get(chart, '_pendingLayoutRequest')).toBeUndefined()
    expect(Reflect.get(chart, '_isFlushingLayout')).toBe(false)
  })

  it('coalesces viewport requests during a running layout into one final render', () => {
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

    Reflect.get(chart, '_runSynchronousLayoutRequest').call(
      chart,
      createLayoutRequest(TestLayoutStage.HorizontalLayout, { render: true })
    )

    expect(runLayoutPass).toHaveBeenCalledTimes(2)
    expect(runLayoutPass).toHaveBeenNthCalledWith(1, TestLayoutStage.HorizontalLayout, undefined)
    expect(runLayoutPass).toHaveBeenNthCalledWith(2, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(Reflect.get(chart, '_pendingLayoutRequest')).toBeUndefined()
    expect(Reflect.get(chart, '_isFlushingLayout')).toBe(false)
  })

  it('preserves current settled callbacks before pending callbacks when merging requests', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const currentSettled = vi.fn()
    const pendingSettled = vi.fn()
    const runLayoutPass = vi.fn(() => {
      if (runLayoutPass.mock.calls.length === 1) {
        Reflect.get(chart, '_runSynchronousLayoutRequest').call(
          chart,
          createLayoutRequest(TestLayoutStage.ForceAxisTicks, {
            afterLayoutSettledCallbacks: [pendingSettled]
          })
        )
      }
      return TestLayoutStage.None
    })
    const renderLayoutNow = vi.fn()
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    Reflect.get(chart, '_runSynchronousLayoutRequest').call(
      chart,
      createLayoutRequest(TestLayoutStage.HorizontalLayout, {
        afterLayoutSettledCallbacks: [currentSettled],
        render: true
      })
    )

    expect(runLayoutPass).toHaveBeenCalledTimes(2)
    expect(currentSettled).toHaveBeenCalledOnce()
    expect(pendingSettled).toHaveBeenCalledOnce()
    expect(currentSettled.mock.invocationCallOrder[0]).toBeLessThan(pendingSettled.mock.invocationCallOrder[0])
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(pendingSettled.mock.invocationCallOrder[0])
  })

  it('batches requested viewport layout refreshes into one frame', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const flushPendingLayout = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_flushPendingLayout', flushPendingLayout)

    try {
      chart.requestViewportLayout()
      chart.requestViewportLayout()

      expect(requestFrame).toHaveBeenCalledTimes(1)
      expect(flushPendingLayout).not.toHaveBeenCalled()
      expect(Reflect.get(chart, '_pendingLayoutRequest')).toEqual(expect.objectContaining({ stages: VIEWPORT_LAYOUT_STAGES, render: true }))

      frameCallback?.(0)

      expect(flushPendingLayout).toHaveBeenCalledOnce()
      expect(cancelFrame).not.toHaveBeenCalled()
      expect(Reflect.get(chart, '_layoutFrameId')).toBe(-1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('runs consecutive viewport requests as one frame layout pass and render', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutPass = vi.fn(() => TestLayoutStage.None)
    const renderLayoutNow = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    try {
      chart.requestViewportLayout()
      chart.requestViewportLayout()

      expect(requestFrame).toHaveBeenCalledTimes(1)
      expect(runLayoutPass).not.toHaveBeenCalled()
      expect(renderLayoutNow).not.toHaveBeenCalled()

      frameCallback?.(0)

      expect(runLayoutPass).toHaveBeenCalledOnce()
      expect(runLayoutPass).toHaveBeenCalledWith(VIEWPORT_LAYOUT_STAGES, undefined)
      expect(renderLayoutNow).toHaveBeenCalledOnce()
      expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(runLayoutPass.mock.invocationCallOrder[0])
      expect(cancelFrame).not.toHaveBeenCalled()
      expect(Reflect.get(chart, '_pendingLayoutRequest')).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('flushes requested viewport layout synchronously when a sync request arrives', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const flushPendingLayout = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_flushPendingLayout', flushPendingLayout)

    try {
      chart.requestViewportLayout()
      chart.refreshPaneLayout()

      expect(cancelFrame).toHaveBeenCalledWith(7)
      expect(flushPendingLayout).toHaveBeenCalledOnce()
      expect(Reflect.get(chart, '_pendingLayoutRequest')).toEqual(expect.objectContaining({ stages: EXACT_LAYOUT_REQUEST_STAGES, render: true }))

      frameCallback?.(0)

      expect(flushPendingLayout).toHaveBeenCalledOnce()
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

  it('renders once after init auto alignment queues a follow-up viewport layout', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutPass = vi.fn(() => TestLayoutStage.None)
    const renderLayoutNow = vi.fn()
    const chartStore = new ChartStore(chart)
    chartStore.mainWidth = 100
    Reflect.set(chart, '_chartStore', chartStore)
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chartStore.addData(createDataList(5), LoadDataType.Init)

    expect(runLayoutPass).toHaveBeenCalledTimes(2)
    expect(runLayoutPass).toHaveBeenNthCalledWith(1, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(runLayoutPass).toHaveBeenNthCalledWith(2, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(runLayoutPass.mock.invocationCallOrder[1])
    expect(Reflect.get(chart, '_pendingLayoutRequest')).toBeUndefined()
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

  it('carries render intent when a settled callback submits layout-only pending work', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutPass = vi.fn(() => TestLayoutStage.None)
    const renderLayoutNow = vi.fn()
    const onLayoutSettled = vi.fn(() => {
      Reflect.get(chart, '_runSynchronousLayoutRequest').call(
        chart,
        createLayoutRequest(TestLayoutStage.ForceAxisTicks)
      )
    })
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chart.refreshViewportLayout(onLayoutSettled)

    expect(runLayoutPass).toHaveBeenCalledTimes(2)
    expect(runLayoutPass).toHaveBeenNthCalledWith(1, VIEWPORT_LAYOUT_STAGES, undefined)
    expect(runLayoutPass).toHaveBeenNthCalledWith(2, TestLayoutStage.ForceAxisTicks, undefined)
    expect(onLayoutSettled).toHaveBeenCalledOnce()
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(runLayoutPass.mock.invocationCallOrder[1])
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

    Reflect.get(chart, '_runSynchronousLayoutRequest').call(chart, createLayoutRequest(VIEWPORT_LAYOUT_STAGES, { render: true }))

    expect(buildTicks).toHaveBeenCalledTimes(2)
    expect(buildTicks).toHaveBeenNthCalledWith(1, false)
    expect(buildTicks).toHaveBeenNthCalledWith(2, true)
    expect(applyHorizontalLayout).toHaveBeenCalledTimes(2)
    expect(renderLayoutNow).toHaveBeenCalledTimes(1)
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(applyHorizontalLayout.mock.invocationCallOrder[1])
  })

  it('preserves resize anchor across follow-up layout passes', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutPass = vi.fn(() => (
      runLayoutPass.mock.calls.length === 1
        ? FOLLOW_UP_EXACT_AXIS_LAYOUT_STAGES
        : TestLayoutStage.None
    ))
    const renderLayoutNow = vi.fn()
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chart.refreshResizeLayout('domainFrom')

    expect(runLayoutPass).toHaveBeenCalledTimes(2)
    expect(runLayoutPass).toHaveBeenNthCalledWith(1, EXACT_LAYOUT_REQUEST_STAGES, 'domainFrom')
    expect(runLayoutPass).toHaveBeenNthCalledWith(2, FOLLOW_UP_EXACT_AXIS_LAYOUT_STAGES, 'domainFrom')
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(runLayoutPass.mock.invocationCallOrder[1])
  })

  it('stops draining non-settling layout passes at the safety limit without rendering', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutPass = vi.fn(() => FOLLOW_UP_AXIS_LAYOUT_STAGES)
    const renderLayoutNow = vi.fn()
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chart.refreshViewportLayout()

    expect(runLayoutPass).toHaveBeenCalledTimes(10)
    expect(renderLayoutNow).not.toHaveBeenCalled()
    expect(Reflect.get(chart, '_pendingLayoutRequest')).toBeUndefined()
    expect(Reflect.get(chart, '_isFlushingLayout')).toBe(false)
  })

  it('expands auto y-axis width during a viewport refresh before the final render', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const buildTicks = vi.fn(() => true)
    const adjustVisibleRange = vi.fn()
    const recalculateCrosshair = vi.fn()
    const setDataZoomLayout = vi.fn()
    const renderLayoutNow = vi.fn()
    const pane = {
      getId: () => PaneIdConstants.CANDLE,
      getYLeftAxisWidget: () => ({
        getAxisComponent: () => ({ buildTicks, getAutoSize: () => 20 }),
        getBounding: () => ({ width: 10 })
      }),
      getYRightAxisWidget: () => ({
        getAxisComponent: () => ({ buildTicks, getAutoSize: () => 30 }),
        getBounding: () => ({ width: 10 })
      }),
      setBounding: vi.fn()
    }
    const xAxisPane = {
      getId: () => PaneIdConstants.X_AXIS,
      getMainWidget: () => ({
        getAxisComponent: () => ({ buildTicks })
      }),
      setBounding: vi.fn()
    }
    const chartStore = {
      mainWidth: 100,
      getStyles: () => ({
        yAxis: {
          size: 'auto',
          inside: false,
          position: YAxisPosition.Both
        },
        separator: { fill: true }
      }),
      getTimeScaleStore: () => ({ adjustVisibleRange }),
      getTooltipStore: () => ({ recalculateCrosshair })
    }

    Reflect.set(chart, '_container', { clientWidth: 120 })
    Reflect.set(chart, '_chartStore', chartStore)
    Reflect.set(chart, '_drawPanes', [pane, xAxisPane])
    Reflect.set(chart, '_separatorPanes', new Map())
    Reflect.set(chart, '_dataZoomSlider', { setLayout: setDataZoomLayout })
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    chart.refreshViewportLayout()

    expect(buildTicks).toHaveBeenCalledTimes(6)
    expect(buildTicks).toHaveBeenNthCalledWith(1, false)
    expect(buildTicks).toHaveBeenNthCalledWith(4, true)
    expect(chartStore.mainWidth).toBe(70)
    expect(adjustVisibleRange).toHaveBeenCalledTimes(2)
    expect(recalculateCrosshair).toHaveBeenCalledTimes(2)
    expect(setDataZoomLayout).toHaveBeenLastCalledWith({ width: 70, left: 20 })
    expect(pane.setBounding).toHaveBeenLastCalledWith(
      { width: 120 },
      { width: 70, left: 20 },
      { width: 20, left: 0 },
      { width: 30, left: 90 }
    )
    expect(renderLayoutNow).toHaveBeenCalledOnce()
    expect(renderLayoutNow.mock.invocationCallOrder[0]).toBeGreaterThan(pane.setBounding.mock.invocationCallOrder[1])
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

  it('cancels a pending viewport frame during destroy before it can render', () => {
    const chart = Object.create(ChartImp.prototype) as ChartImp
    const runLayoutPass = vi.fn(() => TestLayoutStage.None)
    const renderLayoutNow = vi.fn()
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 7
    })
    const cancelFrame = vi.fn()
    const chartStore = { destroy: vi.fn() }
    const chartEvent = { destroy: vi.fn() }
    const drawPane = { destroy: vi.fn() }
    const separatorPane = { destroy: vi.fn() }
    const dataZoomSlider = { destroy: vi.fn() }
    const chartContainer = {}
    const removeChild = vi.fn()
    vi.stubGlobal('window', { requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame })
    Reflect.set(chart, '_chartStore', chartStore)
    Reflect.set(chart, '_chartEvent', chartEvent)
    Reflect.set(chart, '_drawPanes', [drawPane])
    Reflect.set(chart, '_separatorPanes', new Map([[drawPane, separatorPane]]))
    Reflect.set(chart, '_dataZoomSlider', dataZoomSlider)
    Reflect.set(chart, '_container', { removeChild })
    Reflect.set(chart, '_chartContainer', chartContainer)
    Reflect.set(chart, '_runLayoutPass', runLayoutPass)
    Reflect.set(chart, '_renderLayoutNow', renderLayoutNow)

    try {
      chart.requestViewportLayout()
      chart.destroy()
      frameCallback?.(0)

      expect(cancelFrame).toHaveBeenCalledWith(7)
      expect(Reflect.get(chart, '_pendingLayoutRequest')).toBeUndefined()
      expect(Reflect.get(chart, '_layoutFrameId')).toBe(-1)
      expect(runLayoutPass).not.toHaveBeenCalled()
      expect(renderLayoutNow).not.toHaveBeenCalled()
      expect(chartStore.destroy).toHaveBeenCalledOnce()
      expect(chartEvent.destroy).toHaveBeenCalledOnce()
      expect(drawPane.destroy).toHaveBeenCalledOnce()
      expect(separatorPane.destroy).toHaveBeenCalledOnce()
      expect(dataZoomSlider.destroy).toHaveBeenCalledOnce()
      expect(removeChild).toHaveBeenCalledWith(chartContainer)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
