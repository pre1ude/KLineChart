import type Bounding from './common/Bounding'
import type KLineData from './common/KLineData'
import type Coordinate from './common/Coordinate'
import type { IPoint, Point } from './common/Point'
import { UpdateLevel } from './common/Updater'
import { type DeepPartialStyles, type Styles, YAxisPosition } from './common/Styles'
import type Crosshair from './common/Crosshair'
import { ActionType, type ActionCallback, type ActionCallbackParams } from './common/Action'
import type LoadDataCallback from './common/LoadDataCallback'
import type Precision from './common/Precision'
import type VisibleRange from './common/VisibleRange'
import { type CustomApi, LayoutChildType, type Options } from './Options'
import Animation from './common/Animation'
import { createId } from './common/utils/id'
import { createDom } from './common/utils/dom'
import { initCanvas } from './common/utils/canvas'
import { isString, isArray, isValid, isNumber } from './common/utils/typeChecks'
import { logWarn } from './common/utils/logger'
import { cancelAnimationFrame, DEFAULT_REQUEST_ID, requestAnimationFrame } from './common/utils/compatible'
import { LoadDataType } from './common/LoadDataCallback'
import ChartStore, { StyleInvalidation } from './store/ChartStore'
import CandlePane from './pane/CandlePane'
import IndicatorPane from './pane/IndicatorPane'
import XAxisPane from './pane/XAxisPane'
import SeparatorPane from './pane/SeparatorPane'
import {
  calculatePaneHeights,
  type PaneOptions,
  PanePosition,
  PANE_DEFAULT_HEIGHT_SPEC,
  PaneIdConstants,
  parsePaneHeight,
  type DrawPane
} from './pane/types'
import { type IndicatorFilter, type Indicator, type IndicatorCreate, type IndicatorOverride, type IndicatorRemoveFilter } from './component/Indicator'
import { type Overlay, type OverlayCreate, type OverlayFilter } from './component/Overlay'
import { getIndicatorTemplate } from './extension/indicator/index'
// import { getStyles as getExtensionStyles } from './extension/styles/index'
import Event from './Event'
import { DataZoomSlider } from './component/DataZoomSlider'
import type XAxisWidget from './widget/XAxisWidget'
import type DualYPane from './pane/DualYPane'
import type { YAxisCreate, YAxisFilter, YAxisOptions, YAxisOverride } from './widget/YAxisWidget'
import { DEFAULT_Y_SCALE_ID, type YScaleCreate, type YScaleFilter, type YScaleOptions, type YScaleOverride } from './component/YScaleHost'
import { getTimezone } from './common/utils/dateTimeFormat'

export enum DomPosition {
  Root = 'root',
  Main = 'main',
  YAxis = 'yAxis'
}

/**
 * getPaneBounds scope mapping:
 * - candle: 主图 pane 整体
 * - candle_main: 主图 main 区
 * - content/content_main: 所有非 xAxis pane 的整体/main 并集
 * - indicators/indicators_main: 所有副图 pane 的整体/main 并集
 * - all: 所有 pane 整体并集
 */
export type PaneScope = 'content' | 'content_main' | 'candle' | 'candle_main' | 'indicators' | 'indicators_main' | 'all'

export interface ConvertFinder {
  paneId?: string
  absolute?: boolean
  yScaleId?: string
}

export type ResizeAnchor = 'domainFrom' | 'domainTo'

// Layout refresh is state-derived work: semantic entry points merge pending
// requests, then passes run until geometry settles before repainting.
const MAX_LAYOUT_DRAIN_PASSES = 10

type LayoutSettledCallback = () => void

type LayoutRequest = {
  stages: LayoutStage
  resizeAnchor?: ResizeAnchor
  afterLayoutSettledCallbacks: LayoutSettledCallback[]
  render: boolean
}

const enum LayoutStage {
  None = 0,
  VerticalLayout = 1 << 0,
  HorizontalLayout = 1 << 1,
  AxisTicks = 1 << 2,
  ForceAxisTicks = 1 << 3,
  AllowAxisWidthShrink = 1 << 4
}

const VIEWPORT_LAYOUT_STAGES =
  LayoutStage.HorizontalLayout |
  LayoutStage.AxisTicks

const EXACT_LAYOUT_STAGES =
  LayoutStage.HorizontalLayout |
  LayoutStage.AxisTicks |
  LayoutStage.ForceAxisTicks |
  LayoutStage.AllowAxisWidthShrink

const INITIAL_LAYOUT_STAGES =
  LayoutStage.VerticalLayout |
  LayoutStage.HorizontalLayout |
  LayoutStage.AxisTicks |
  LayoutStage.ForceAxisTicks

export interface Chart {
  id: string
  getDom: (paneId?: string, position?: DomPosition) => HTMLElement | null
  getSize: (paneId?: string, position?: DomPosition) => Bounding | null
  getPaneBounds: (scope?: PaneScope) => Bounding | null
  setOptions: (option: Options) => void
  setLocale: (locale: string) => void
  getLocale: () => string
  setStyles: (styles: string | DeepPartialStyles) => void
  getStyles: () => Styles
  setCustomApi: (customApi: Partial<CustomApi>) => void
  setPriceVolumePrecision: (pricePrecision: number, volumePrecision: number) => void
  getPriceVolumePrecision: () => Precision
  setTimeShareDays: (days: number) => void
  setTimeShareBasisPrice: (price: number) => void
  setTimezone: (timezone: string) => void
  getTimezone: () => string
  setOffsetRightDistance: (distance: number) => void
  getOffsetRightDistance: () => number
  setMaxOffsetLeftDistance: (distance: number) => void
  setMaxOffsetRightDistance: (distance: number) => void
  setLeftMinVisibleBarCount: (barCount: number) => void
  setRightMinVisibleBarCount: (barCount: number) => void
  setBarSpaceLimit: (limit: { min?: number, max?: number }) => void
  setBarSpace: (space: number) => void
  getBarSpace: () => number
  fitToWidth: (options?: { align?: 'left' | 'center' | 'right' | 'auto' }) => void
  getVisibleRange: () => VisibleRange
  clearData: () => void
  getDataList: () => KLineData[]
  getChartStore: () => ChartStore
  getDrawPaneById: (paneId: string) => DrawPane | undefined
  getDataByDataIndex: (dataIndex: number) => KLineData | undefined
  getDataByTimestamp: (timestamp: number, options?: { exact?: boolean }) => KLineData | undefined
  applyNewData: (dataList: KLineData[], more?: boolean, callback?: () => void) => void
  prependData: (dataList: KLineData[], more?: boolean, callback?: () => void) => void
  appendData: (dataList: KLineData[], more?: boolean, callback?: () => void) => void
  updateData: (data: KLineData, callback?: () => void) => void
  replaceData: (dataList: KLineData[], more?: boolean, callback?: () => void) => void
  setLoadDataCallback: (cb: LoadDataCallback) => void
  createYScale: (yScale: YScaleCreate) => string | undefined
  getYScales: (filter?: YScaleFilter) => YScaleOptions[]
  overrideYScale: (yScale: YScaleOverride) => void
  removeYScale: (filter: YScaleFilter) => boolean
  createYAxis: (yAxis: YAxisCreate) => string | undefined
  getYAxes: (filter?: YAxisFilter) => YAxisOptions[]
  overrideYAxis: (yAxis: YAxisOverride) => void
  removeYAxis: (filter: YAxisFilter) => boolean
  createIndicator: (value: string | IndicatorCreate, isStack?: boolean, paneOptions?: PaneOptions, callback?: () => void) => string | undefined
  overrideIndicator: (override: IndicatorOverride, paneId?: string, callback?: () => void) => void
  /**
   * @deprecated
   */
  getIndicatorByPaneId: (paneId?: string, name?: string) => Indicator | Map<string, Indicator> | Map<string, Map<string, Indicator>> | null
  getIndicators: (filter?: IndicatorFilter) => Indicator[]
  removeIndicator: {
    (paneId: string, name?: string): void
    (filter: IndicatorRemoveFilter): void
  }
  createOverlay: {
    (value: string, paneId?: string): string | undefined
    (value: OverlayCreate, paneId?: string): string | undefined
    (value: Array<string | OverlayCreate>, paneId?: string): Array<string | undefined>
  }
  resetOverlay: (id: string) => void
  getOverlayById: (id: string) => Overlay | undefined
  getOverlays: (filter?: OverlayFilter) => Overlay[]
  overrideOverlay: (override: Partial<OverlayCreate>) => void
  removeOverlay: (remove?: string | OverlayFilter) => void
  deselectOverlay: () => void
  setPaneOptions: (options: PaneOptions) => void
  setZoomEnabled: (enabled: boolean) => void
  isZoomEnabled: () => boolean
  setScrollEnabled: (enabled: boolean) => void
  isScrollEnabled: () => boolean
  scrollByBar: (count: number, animationDuration?: number) => void
  scrollByDistance: (distance: number, animationDuration?: number) => void
  scrollToRealTime: (animationDuration?: number) => void
  scrollToDataIndex: (dataIndex: number, animationDuration?: number) => void
  scrollToTimestamp: (timestamp: number, animationDuration?: number) => void
  alignLeft: () => void
  alignRight: () => void
  alignCenter: () => void
  setAutoInitialAlignment: (enabled: boolean) => void
  getAutoInitialAlignment: () => boolean
  zoomAtCoordinate: (scale: number, coordinate?: Coordinate, animationDuration?: number) => void
  zoomAtDataIndex: (scale: number, dataIndex: number, animationDuration?: number) => void
  zoomAtTimestamp: (scale: number, timestamp: number, animationDuration?: number) => void
  convertToPixel(point: Partial<Point>, finder: ConvertFinder): Partial<Coordinate>
  convertToPixel(points: Array<Partial<Point>>, finder: ConvertFinder): Array<Partial<Coordinate>>
  convertFromPixel(coordinate: Partial<Coordinate>, finder: ConvertFinder): Partial<Point>
  convertFromPixel(coordinates: Array<Partial<Coordinate>>, finder: ConvertFinder): Array<Partial<Point>>
  externalToInternal: (point: Partial<Point>) => Partial<IPoint>
  internalToExternal: (point: Partial<IPoint>) => Partial<Point>
  coordinateToDataIndex: (x: number) => number
  executeAction: (type: ActionType, data: object) => void
  subscribeAction: <T extends ActionType>(type: T, callback: ActionCallback<ActionCallbackParams[T]>) => void
  unsubscribeAction: <T extends ActionType>(type: T, callback?: ActionCallback<ActionCallbackParams[T]>) => void
  getConvertPictureUrl: (includeOverlay?: boolean, type?: string, backgroundColor?: string) => string
  resize: (anchor?: ResizeAnchor) => void
  focus: () => void
}

export default class ChartImp implements Chart {
  id: string

  private _container: HTMLElement
  private _chartContainer: HTMLElement
  private readonly _chartEvent: Event
  private readonly _chartStore: ChartStore
  private readonly _dataZoomSlider: DataZoomSlider
  // Includes CandlePane (main), IndicatorPane (sub panes), XAxisPane (x-axis pane)
  private _drawPanes: (DrawPane)[] = []
  private _candlePane?: CandlePane
  private _xAxisPane!: XAxisPane
  private readonly _separatorPanes = new Map<DrawPane, SeparatorPane>()
  private _layoutFrameId = DEFAULT_REQUEST_ID
  private _isFlushingLayout = false
  private _pendingLayoutRequest?: LayoutRequest

  constructor(container: HTMLElement, options?: Options) {
    this.id = createId('chart_')
    this._container = container
    this._chartContainer = createDom('div', {
      position: 'relative',
      width: '100%',
      outline: 'none',
      borderStyle: 'none',
      cursor: 'crosshair',
      boxSizing: 'border-box',
      userSelect: 'none',
      webkitUserSelect: 'none',
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      msUserSelect: 'none',
      MozUserSelect: 'none',
      webkitTapHighlightColor: 'transparent'
    })
    this._chartContainer.tabIndex = 1
    container.appendChild(this._chartContainer)
    this._chartEvent = new Event(this._chartContainer, this)
    this._chartStore = new ChartStore(this, options)
    this._initPanes(options)
    this._dataZoomSlider = new DataZoomSlider(this._chartContainer, this)
    this._refreshInitialLayout()
  }

  private _initPanes(options?: Options): void {
    const layout = options?.layout ?? [{ type: LayoutChildType.Candle }]
    let candlePaneInitialized = false
    let xAxisPaneInitialized = false

    const createXAxisPane: ((ops?: PaneOptions) => void) = (ops?: PaneOptions) => {
      if (!xAxisPaneInitialized) {
        this._xAxisPane = this._createPane<XAxisPane>(XAxisPane, PaneIdConstants.X_AXIS, ops ?? {})
        xAxisPaneInitialized = true
      }
    }

    layout.forEach(child => {
      switch (child.type) {
        case LayoutChildType.Candle: {
          if (!candlePaneInitialized) {
            const opts = child.options ?? {}
            const paneOptions = {
              ...opts,
              id: PaneIdConstants.CANDLE
            }
            this._candlePane = this._createPane<CandlePane>(CandlePane, PaneIdConstants.CANDLE, paneOptions)
            const content = child.content ?? []
            content.forEach(v => {
              this.createIndicator(v, true, paneOptions)
            })
            candlePaneInitialized = true
          }
          break
        }
        case LayoutChildType.Indicator: {
          const content = child.content ?? []
          if (content.length > 0) {
            let paneId: string | undefined
            content.forEach(v => {
              if (isValid(paneId)) {
                this.createIndicator(v, true, { id: paneId })
              } else {
                paneId = this.createIndicator(v, true, child.options)
              }
            })
          }
          break
        }
        case LayoutChildType.XAxis: {
          createXAxisPane(child.options)
          break
        }
      }
    })
    createXAxisPane({ position: PanePosition.Bottom })
  }

  private _createPane<P extends DrawPane>(
    drawPaneClass: new (rootContainer: HTMLElement, afterElement: HTMLElement | null, chart: ChartImp, id: string, options: Omit<PaneOptions, 'id' | 'height'>) => P,
    id: string,
    options?: PaneOptions
  ): P {
    let index: number | undefined
    let pane: P | undefined
    const position = options?.position
    switch (position) {
      case PanePosition.Top: {
        const firstPane = this._drawPanes[0]
        if (isValid(firstPane)) {
          pane = new drawPaneClass(this._chartContainer, firstPane.getContainer(), this, id, options ?? {})
          index = 0
        }
        break
      }
      case PanePosition.Bottom: { break }
      default: {
        for (let i = this._drawPanes.length - 1; i > -1; i--) {
          const p = this._drawPanes[i]
          const prevP = this._drawPanes[i - 1]
          if (
            p?.getOptions().position === PanePosition.Bottom &&
            prevP?.getOptions().position !== PanePosition.Bottom
          ) {
            pane = new drawPaneClass(this._chartContainer, p.getContainer(), this, id, options ?? {})
            index = i
            break
          }
        }
      }
    }
    if (!isValid(pane)) {
      pane = new drawPaneClass(this._chartContainer, null, this, id, options ?? {})
    }
    // insert pane and auto add SeparatorPane
    let newIndex: number
    if (isNumber(index)) {
      this._drawPanes.splice(index, 0, pane)
      newIndex = index
    } else {
      this._drawPanes.push(pane)
      newIndex = this._drawPanes.length - 1
    }
    if (pane.getId() !== PaneIdConstants.X_AXIS) {
      let nextPane = this._drawPanes[newIndex + 1]
      if (isValid(nextPane)) {
        if (nextPane.getId() === PaneIdConstants.X_AXIS) {
          nextPane = this._drawPanes[newIndex + 2]
        }
      }
      if (isValid(nextPane)) {
        let separatorPane = this._separatorPanes.get(nextPane)
        if (isValid(separatorPane)) {
          separatorPane.setTopPane(pane)
        } else {
          separatorPane = new SeparatorPane(this._chartContainer, nextPane.getContainer(), this, '', pane, nextPane)
          this._separatorPanes.set(nextPane, separatorPane)
        }
      }
      let prevPane = this._drawPanes[newIndex - 1]
      if (isValid(prevPane)) {
        if (prevPane.getId() === PaneIdConstants.X_AXIS) {
          prevPane = this._drawPanes[newIndex - 2]
        }
      }
      if (isValid(prevPane)) {
        const separatorPane = new SeparatorPane(this._chartContainer, pane.getContainer(), this, '', prevPane, pane)
        this._separatorPanes.set(pane, separatorPane)
      }
    }
    return pane
  }

  private _applyVerticalLayout(): void {
    const totalHeight = Math.floor(this._container.clientHeight)
    const separatorSize = this._chartStore.getStyles().separator.size
    const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
    const xAxisHeight = xAxisWidget.getAxisComponent().getAutoSize()
    const dataZoomSliderHeight = this._dataZoomSlider.getHeight()
    let paneExcludeXAxisHeight = totalHeight - xAxisHeight - dataZoomSliderHeight - this._separatorPanes.size * separatorSize
    if (paneExcludeXAxisHeight < 0) {
      paneExcludeXAxisHeight = 0
    }
    const indicatorPanes = this._drawPanes.filter(
      pane => pane.getId() !== PaneIdConstants.CANDLE && pane.getId() !== PaneIdConstants.X_AXIS
    ) as DualYPane[]
    const layout = calculatePaneHeights(
      indicatorPanes.map(pane => ({
        height: pane.getHeightSpec() ?? PANE_DEFAULT_HEIGHT_SPEC,
        minHeight: pane.getOptions().minHeight
      })),
      paneExcludeXAxisHeight
    )
    indicatorPanes.forEach((pane, index) => {
      pane.setBounding({ height: layout.heights[index] })
    })
    this._candlePane?.setBounding({ height: layout.remainingHeight })
    this._xAxisPane.setBounding({ height: xAxisHeight })

    let top = 0
    this._drawPanes.forEach(pane => {
      const separatorPane = this._separatorPanes.get(pane)
      if (isValid(separatorPane)) {
        separatorPane.setBounding({ height: separatorSize, top })
        top += separatorSize
      }
      pane.setBounding({ top })
      top += pane.getBounding().height
    })
    this._dataZoomSlider.setLayout({
      top,
      height: dataZoomSliderHeight
    })
  }

  // todo read the pane axisOptions
  // todo deprecated partial of yAxis style
  private _applyHorizontalLayout(resizeAnchor?: ResizeAnchor, allowAxisWidthShrink: boolean = true): boolean {
    const totalWidth = Math.floor(this._container.clientWidth)
    const styles = this._chartStore.getStyles()
    const yAxisStyles = styles.yAxis
    const isOutside = !yAxisStyles.inside
    const axisWidths: Record<'left' | 'right', number[]> = { left: [], right: [] }
    const dualYPanes: DualYPane[] = []

    this._drawPanes.forEach(pane => {
      if (pane.getId() !== PaneIdConstants.X_AXIS) {
        const dualYPane = pane as DualYPane
        dualYPanes.push(dualYPane)
        ;([YAxisPosition.Left, YAxisPosition.Right] as const).forEach(position => {
          const widgets = dualYPane.getYAxisWidgetsByPosition(position, true)
          widgets.forEach((widget, index) => {
            const autoSize = widget.getAutoSize()
            const currentWidth = yAxisStyles.size === 'auto' ? widget.getBounding().width : 0
            const width = allowAxisWidthShrink ? autoSize : Math.max(autoSize, currentWidth)
            axisWidths[position][index] = Math.max(axisWidths[position][index] ?? 0, width)
          })
        })
      }
    })

    let yLeftAxisWidth = axisWidths.left.reduce((sum, width) => sum + width, 0)
    let yRightAxisWidth = axisWidths.right.reduce((sum, width) => sum + width, 0)
    const totalAxisWidth = yLeftAxisWidth + yRightAxisWidth
    if (isOutside && totalAxisWidth > totalWidth && totalAxisWidth > 0) {
      const scale = totalWidth / totalAxisWidth
      axisWidths.left = axisWidths.left.map(width => width * scale)
      axisWidths.right = axisWidths.right.map(width => width * scale)
      yLeftAxisWidth = axisWidths.left.reduce((sum, width) => sum + width, 0)
      yRightAxisWidth = axisWidths.right.reduce((sum, width) => sum + width, 0)
    }

    let mainWidth: number
    let mainLeft: number
    if (isOutside) {
      mainLeft = yLeftAxisWidth
      mainWidth = Math.max(totalWidth - yLeftAxisWidth - yRightAxisWidth, 0)
    } else {
      mainWidth = totalWidth
      mainLeft = 0
    }

    const prevMainWidth = this._chartStore.mainWidth
    this._chartStore.mainWidth = mainWidth
    const timeScaleStore = this._chartStore.getTimeScaleStore()
    if (resizeAnchor !== undefined) {
      timeScaleStore.adjustBarSpaceForMainWidthChange(prevMainWidth, mainWidth, resizeAnchor)
    }
    timeScaleStore.adjustVisibleRange()
    this._chartStore.getTooltipStore().recalculateCrosshair(true)

    const paneBounding = { width: totalWidth }
    const mainBounding = { width: mainWidth, left: mainLeft }
    const separatorFill = styles.separator.fill
    let separatorBounding: Partial<Bounding>
    if (isOutside && !separatorFill) {
      separatorBounding = mainBounding
    } else {
      separatorBounding = paneBounding
    }
    dualYPanes.forEach(pane => {
      const yAxesBounding: Record<string, Partial<Bounding>> = {}
      pane.getYAxisWidgets().forEach(widget => {
        yAxesBounding[widget.getOptions().id] = { width: 1, left: -1 }
      })

      const leftWidgets = pane.getYAxisWidgetsByPosition(YAxisPosition.Left, true)
      let leftOffset = 0
      leftWidgets.forEach((widget, index) => {
        const width = axisWidths.left[index] ?? 0
        const left = isOutside
          ? mainLeft - leftOffset - width
          : leftOffset
        yAxesBounding[widget.getOptions().id] = { width, left }
        leftOffset += width
      })

      const rightWidgets = pane.getYAxisWidgetsByPosition(YAxisPosition.Right, true)
      let rightOffset = 0
      rightWidgets.forEach((widget, index) => {
        const width = axisWidths.right[index] ?? 0
        const left = isOutside
          ? mainLeft + mainWidth + rightOffset
          : totalWidth - rightOffset - width
        yAxesBounding[widget.getOptions().id] = { width, left }
        rightOffset += width
      })
      pane.setYAxesBounding(yAxesBounding)
    })

    this._drawPanes.forEach(pane => {
      this._separatorPanes.get(pane)?.setBounding(separatorBounding)
      pane.setBounding(paneBounding, mainBounding)
    })
    this._dataZoomSlider.setLayout(mainBounding)
    return mainWidth !== prevMainWidth
  }

  private _setPaneOptions(options: PaneOptions, forceShouldAdjust: boolean): void {
    if (isString(options.id)) {
      const pane = this.getDrawPaneById(options.id)
      let shouldMeasureHeight = false
      if (pane) {
        let shouldAdjust = forceShouldAdjust
        if (isValid(options.height)) {
          if (options.id === PaneIdConstants.CANDLE || options.id === PaneIdConstants.X_AXIS) {
            if (isNumber(options.height) && options.height < 1) {
              logWarn('setPaneOptions', 'height', 'percentage height only supports indicator panes.')
            }
          } else {
            const heightSpec = this._parsePaneHeight(options.height, 'setPaneOptions')
            if (heightSpec !== null) {
              pane.setHeightSpec(heightSpec)
              shouldAdjust = true
              shouldMeasureHeight = true
            }
          }
        }
        // 检查是否需要调整视图
        if (isString(options.axisOptions?.name) || isValid(options.gap) || isValid(options.reservedSpace)) {
          shouldAdjust = true
        }
        pane.setOptions(options)
        if (shouldAdjust) {
          this._refreshExactLayout(shouldMeasureHeight)
        }
      }
    }
  }

  getDrawPaneById(paneId: string): DrawPane | undefined {
    if (paneId === PaneIdConstants.CANDLE) {
      return this._candlePane
    }
    if (paneId === PaneIdConstants.X_AXIS) {
      return this._xAxisPane
    }
    const pane = this._drawPanes.find(p => p.getId() === paneId)
    return pane
  }

  getContainer(): HTMLElement { return this._container }

  syncOverlayCursor(): void { this._chartEvent?.syncCursor() }

  getChartStore(): ChartStore { return this._chartStore }

  getXAxisPane(): XAxisPane { return this._xAxisPane }

  getAllDrawPanes(): DrawPane[] { return this._drawPanes }

  getAllSeparatorPanes(): Map<DrawPane, SeparatorPane> { return this._separatorPanes }

  /**
   * Layout refresh pipeline.
   *
   * Keep external callers on the semantic entry points below. This block is the
   * boundary where semantic refresh reasons become layout requests, passes
   * converge geometry, and panes repaint only after layout settles.
   */
  refreshViewportLayout(afterLayoutSettled?: LayoutSettledCallback): void {
    this._runSynchronousLayoutRequest(this._createLayoutRequest(VIEWPORT_LAYOUT_STAGES, {
      afterLayoutSettled,
      render: true
    }))
  }

  requestViewportLayout(): void {
    this._mergeLayoutRequest(this._createViewportLayoutRequest())
    if (this._isFlushingLayout) {
      return
    }
    const layoutFrameId = this._layoutFrameId ?? DEFAULT_REQUEST_ID
    if (layoutFrameId !== DEFAULT_REQUEST_ID) {
      return
    }
    const frameId = requestAnimationFrame(() => {
      if (this._layoutFrameId !== frameId) {
        return
      }
      this._layoutFrameId = DEFAULT_REQUEST_ID
      this._flushPendingLayout()
    })
    this._layoutFrameId = frameId
  }

  refreshPaneLayout(): void {
    this._refreshExactLayout()
  }

  refreshMetricLayout(): void {
    this._refreshExactLayout()
  }

  refreshResizeLayout(anchor?: ResizeAnchor): void {
    this._runSynchronousLayoutRequest(this._createLayoutRequest(LayoutStage.VerticalLayout | EXACT_LAYOUT_STAGES, {
      resizeAnchor: anchor,
      render: true
    }))
  }

  private _refreshInitialLayout(): void {
    this._runSynchronousLayoutRequest(this._createLayoutRequest(INITIAL_LAYOUT_STAGES, { render: true }))
  }

  private _refreshExactLayout(shouldApplyVerticalLayout: boolean = true): void {
    let stages = EXACT_LAYOUT_STAGES
    if (shouldApplyVerticalLayout) {
      stages |= LayoutStage.VerticalLayout
    }
    this._runSynchronousLayoutRequest(this._createLayoutRequest(stages, { render: true }))
  }

  private _refreshPaneViews(): void {
    this._renderLayoutNow()
  }

  private _runSynchronousLayoutRequest(request: LayoutRequest): void {
    this._cancelPendingLayoutFrame()
    this._mergeLayoutRequest(request)
    this._flushPendingLayout()
  }

  private _createViewportLayoutRequest(): LayoutRequest {
    return this._createLayoutRequest(VIEWPORT_LAYOUT_STAGES, { render: true })
  }

  private _createLayoutRequest(
    stages: LayoutStage,
    options: {
      resizeAnchor?: ResizeAnchor
      afterLayoutSettled?: LayoutSettledCallback
      render?: boolean
    } = {}
  ): LayoutRequest {
    const afterLayoutSettledCallbacks = options.afterLayoutSettled === undefined
      ? []
      : [options.afterLayoutSettled]
    return {
      stages,
      resizeAnchor: options.resizeAnchor,
      afterLayoutSettledCallbacks,
      render: options.render === true
    }
  }

  private _mergeLayoutRequest(request: LayoutRequest): void {
    if (this._pendingLayoutRequest === undefined) {
      this._pendingLayoutRequest = this._cloneLayoutRequest(request)
      return
    }
    this._pendingLayoutRequest = this._mergeLayoutRequests(this._pendingLayoutRequest, request)
  }

  private _cloneLayoutRequest(request: LayoutRequest): LayoutRequest {
    return {
      stages: request.stages,
      resizeAnchor: request.resizeAnchor,
      afterLayoutSettledCallbacks: [...request.afterLayoutSettledCallbacks],
      render: request.render
    }
  }

  private _mergeLayoutRequests(baseRequest: LayoutRequest, request: LayoutRequest): LayoutRequest {
    const mergedRequest = this._cloneLayoutRequest(baseRequest)
    mergedRequest.stages |= request.stages
    if (request.resizeAnchor !== undefined) {
      mergedRequest.resizeAnchor = request.resizeAnchor
    }
    mergedRequest.afterLayoutSettledCallbacks.push(...request.afterLayoutSettledCallbacks)
    mergedRequest.render = mergedRequest.render || request.render
    return mergedRequest
  }

  private _mergeWithPendingAfterCurrent(carriedRequest: LayoutRequest): LayoutRequest {
    const pendingRequest = this._consumePendingLayoutRequest()
    if (pendingRequest === undefined) {
      return carriedRequest
    }
    return this._mergeLayoutRequests(carriedRequest, pendingRequest)
  }

  private _consumePendingLayoutRequest(): LayoutRequest | undefined {
    const request = this._pendingLayoutRequest
    this._pendingLayoutRequest = undefined
    return request
  }

  private _cancelPendingLayoutFrame(): void {
    const layoutFrameId = this._layoutFrameId ?? DEFAULT_REQUEST_ID
    if (layoutFrameId === DEFAULT_REQUEST_ID) {
      return
    }
    cancelAnimationFrame(layoutFrameId)
    this._layoutFrameId = DEFAULT_REQUEST_ID
  }

  private _flushPendingLayout(): void {
    if (this._isFlushingLayout) {
      return
    }
    this._isFlushingLayout = true
    let drainPasses = 0
    let currentRequest = this._consumePendingLayoutRequest()
    try {
      while (currentRequest !== undefined) {
        if (drainPasses >= MAX_LAYOUT_DRAIN_PASSES) {
          logWarn('layout', 'request', 'layout request did not settle before the drain pass limit.')
          this._pendingLayoutRequest = undefined
          break
        }
        drainPasses++
        const nextStages = this._runLayoutPass(currentRequest.stages, currentRequest.resizeAnchor)
        if (nextStages !== LayoutStage.None) {
          currentRequest = this._mergeWithPendingAfterCurrent({
            stages: nextStages,
            resizeAnchor: currentRequest.resizeAnchor,
            afterLayoutSettledCallbacks: [...currentRequest.afterLayoutSettledCallbacks],
            render: currentRequest.render
          })
          continue
        }
        if (this._pendingLayoutRequest !== undefined) {
          currentRequest = this._mergeWithPendingAfterCurrent({
            stages: LayoutStage.None,
            afterLayoutSettledCallbacks: [...currentRequest.afterLayoutSettledCallbacks],
            render: currentRequest.render
          })
          continue
        }
        this._runLayoutSettledCallbacks(currentRequest.afterLayoutSettledCallbacks)
        if (this._pendingLayoutRequest !== undefined) {
          currentRequest = this._mergeWithPendingAfterCurrent({
            stages: LayoutStage.None,
            afterLayoutSettledCallbacks: [],
            render: currentRequest.render
          })
          continue
        }
        if (currentRequest.render) {
          this._renderLayoutNow()
        }
        currentRequest = this._consumePendingLayoutRequest()
      }
    } finally {
      this._isFlushingLayout = false
    }
  }

  private _runLayoutPass(stages: LayoutStage, resizeAnchor?: ResizeAnchor): LayoutStage {
    if ((stages & LayoutStage.VerticalLayout) !== 0) {
      this._applyVerticalLayout()
    }
    return this._applyAxisAndHorizontalLayout(stages, resizeAnchor)
  }

  private _runLayoutSettledCallbacks(callbacks: LayoutSettledCallback[]): void {
    callbacks.forEach(callback => {
      callback()
    })
  }

  private _applyAxisAndHorizontalLayout(stages: LayoutStage, resizeAnchor?: ResizeAnchor): LayoutStage {
    const adjustAxis = (stages & LayoutStage.AxisTicks) !== 0
    const forceAdjustAxis = (stages & LayoutStage.ForceAxisTicks) !== 0
    const allowAxisWidthShrink = (stages & LayoutStage.AllowAxisWidthShrink) !== 0
    let shouldApplyHorizontalLayout = (stages & LayoutStage.HorizontalLayout) !== 0
    if (adjustAxis || forceAdjustAxis) {
      shouldApplyHorizontalLayout = this._buildAxisTicks(forceAdjustAxis) || shouldApplyHorizontalLayout
    }
    if (!shouldApplyHorizontalLayout) {
      return LayoutStage.None
    }

    const mainWidthChanged = this._applyHorizontalLayout(resizeAnchor, allowAxisWidthShrink)
    if (!mainWidthChanged || (!adjustAxis && !forceAdjustAxis)) {
      return LayoutStage.None
    }

    let nextStages = LayoutStage.AxisTicks | LayoutStage.ForceAxisTicks
    if (allowAxisWidthShrink) {
      nextStages |= LayoutStage.AllowAxisWidthShrink
    }
    return nextStages
  }

  private _buildAxisTicks(forceAdjustAxis: boolean): boolean {
    let adjust = false
    this._drawPanes.forEach(pane => {
      if (pane.getId() === PaneIdConstants.X_AXIS) {
        adjust = (pane.getMainWidget() as XAxisWidget).getAxisComponent().buildTicks(forceAdjustAxis) || adjust
      } else {
        const dualYPane = pane as DualYPane
        dualYPane.getYScales().forEach(scale => {
          adjust = scale.getComponent().buildTicks(forceAdjustAxis) || adjust
        })
      }
    })
    return adjust
  }

  private _renderLayoutNow(): void {
    this._renderPaneViews(UpdateLevel.All)
  }

  updatePane(level: UpdateLevel, paneId?: string): void {
    this._renderPaneViews(level, paneId)
  }

  private _renderPaneViews(level: UpdateLevel, paneId?: string): void {
    if (isValid(paneId)) {
      const pane = this.getDrawPaneById(paneId)
      pane?.update(level)
    } else {
      this._separatorPanes.forEach(pane => {
        pane.update(level)
      })
      this._drawPanes.forEach(pane => {
        pane.update(level)
      })
      this._dataZoomSlider.update()
    }
  }

  onCrosshairChange(crosshair: Crosshair): void {
    const actionStore = this._chartStore.getActionStore()
    if (actionStore.has(ActionType.OnCrosshairChange)) {
      const indicatorData: Record<string, Record<string, unknown>> = {}
      this._drawPanes.forEach(pane => {
        const id = pane.getId()
        const paneIndicatorData: Record<string, unknown> = {}
        const indicators = this._chartStore.getIndicatorStore().getInstances(id)
        indicators.forEach(indicator => {
          const result = indicator.result
          paneIndicatorData[indicator.name] = result[crosshair.dataIndex ?? result.length - 1]
        })
        indicatorData[id] = paneIndicatorData
      })
      if (isString(crosshair.paneId)) {
        actionStore.execute(ActionType.OnCrosshairChange, {
          ...crosshair,
          indicatorData
        })
      }
    }
  }

  getDom(paneId?: string, position?: DomPosition): HTMLElement | null {
    if (isString(paneId)) {
      const pane = this.getDrawPaneById(paneId)
      if (pane) {
        const pos = position ?? DomPosition.Root
        switch (pos) {
          case DomPosition.Root: {
            return pane.getContainer()
          }
          case DomPosition.Main: {
            return pane.getMainWidget().getContainer()
          }
          case DomPosition.YAxis: {
            // todo TBD
            return null
            // return pane.getYAxisWidget()?.getContainer() ?? null
          }
        }
      }
    } else {
      return this._chartContainer
    }
    return null
  }

  getSize(paneId?: string, position?: DomPosition): Bounding | null {
    if (isValid(paneId)) {
      const pane = this.getDrawPaneById(paneId)
      if (pane) {
        const pos = position ?? DomPosition.Root
        switch (pos) {
          case DomPosition.Root: {
            return pane.getBounding()
          }
          case DomPosition.Main: {
            return pane.getMainWidget().getBounding()
          }
          case DomPosition.YAxis: {
            // todo TBD
            return null
            // return pane.getYAxisWidget()?.getBounding() ?? null
          }
        }
      }
    } else {
      return {
        width: Math.floor(this._chartContainer.clientWidth),
        height: Math.floor(this._chartContainer.clientHeight),
        left: 0,
        top: 0
      }
    }
    return null
  }

  getPaneBounds(scope: PaneScope = 'content'): Bounding | null {
    if (scope === 'candle') {
      return this._candlePane?.getBounding() ?? null
    }
    if (scope === 'candle_main') {
      return this._candlePane?.getMainWidget().getBounding() ?? null
    }

    const useMainBounding = scope === 'content_main' || scope === 'indicators_main'
    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    let found = false

    this._drawPanes.forEach((pane) => {
      const paneId = pane.getId()
      if (scope === 'content' || scope === 'content_main') {
        if (paneId === PaneIdConstants.X_AXIS) {
          return
        }
      } else if (scope === 'indicators' || scope === 'indicators_main') {
        if (paneId === PaneIdConstants.CANDLE || paneId === PaneIdConstants.X_AXIS) {
          return
        }
      } else if (scope !== 'all') {
        return
      }

      const bounding = useMainBounding
        ? pane.getMainWidget().getBounding()
        : pane.getBounding()
      left = Math.min(left, bounding.left)
      top = Math.min(top, bounding.top)
      right = Math.max(right, bounding.left + bounding.width)
      bottom = Math.max(bottom, bounding.top + bounding.height)
      found = true
    })

    if (!found) {
      return null
    }

    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    }
  }

  setStyles(styles: string | DeepPartialStyles): void {
    const invalidation = this._chartStore.updateOptions({ styles })
    this._applyExplicitStyleInvalidation(invalidation, true)
  }

  private _applyExplicitStyleInvalidation(
    invalidation: StyleInvalidation,
    resetYAxisAutoCalc: boolean
  ): void {
    if (invalidation !== StyleInvalidation.Metric) {
      this.updatePane(UpdateLevel.Overlay)
      return
    }
    if (resetYAxisAutoCalc) {
      this._candlePane?.getYScales().forEach(scale => {
        scale.getComponent().setAutoCalcTickFlag(true)
      })
    }
    this.refreshMetricLayout()
  }

  getStyles(): Styles {
    return this._chartStore.getStyles()
  }

  setOptions(options: Options): void {
    const styleInvalidation = this._chartStore.updateOptions(options)
    const optionKeys = Object.keys(options)
    const isStyleOnly = optionKeys.length === 1 && optionKeys[0] === 'styles' && isValid(options.styles)
    if (isStyleOnly) {
      this._applyExplicitStyleInvalidation(styleInvalidation, false)
    } else {
      this.refreshMetricLayout()
    }
  }

  setLocale(locale: string): void {
    this._chartStore.setOptions({ locale })
    this.refreshMetricLayout()
  }

  getLocale(): string {
    return this._chartStore.getLocale()
  }

  setCustomApi(customApi: Partial<CustomApi>): void {
    this._chartStore.setOptions({ customApi })
    this.refreshMetricLayout()
  }

  setPriceVolumePrecision(pricePrecision: number, volumePrecision: number): void {
    this._chartStore.setPrecision({ price: pricePrecision, volume: volumePrecision })
  }

  setTimeShareDays(days: number): void {
    this._chartStore.setTimeShareDays(days)
  }

  setTimeShareBasisPrice(price: number): void {
    this._chartStore.setTimeShareBasisPrice(price)
  }

  getPriceVolumePrecision(): Precision {
    return this._chartStore.getPrecision()
  }

  setTimezone(timezone: string): void {
    this._chartStore.setOptions({ timezone })
    const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
    xAxisWidget.getAxisComponent().buildTicks(true)
    this._xAxisPane.update(UpdateLevel.Drawer)
  }

  getTimezone(): string {
    return getTimezone()
  }

  setOffsetRightDistance(distance: number): void {
    this._chartStore.getTimeScaleStore().setOffsetRightDistance(distance, true)
  }

  getOffsetRightDistance(): number {
    return this._chartStore.getTimeScaleStore().getOffsetRightDistance()
  }

  setMaxOffsetLeftDistance(distance: number): void {
    if (distance < 0) {
      logWarn('setMaxOffsetLeftDistance', 'distance', 'distance must greater than zero!!!')
      return
    }
    this._chartStore.getTimeScaleStore().setMaxOffsetLeftDistance(distance)
  }

  setMaxOffsetRightDistance(distance: number): void {
    if (distance < 0) {
      logWarn('setMaxOffsetRightDistance', 'distance', 'distance must greater than zero!!!')
      return
    }
    this._chartStore.getTimeScaleStore().setMaxOffsetRightDistance(distance)
  }

  setLeftMinVisibleBarCount(barCount: number): void {
    if (barCount < 0) {
      logWarn('setLeftMinVisibleBarCount', 'barCount', 'barCount must greater than zero!!!')
      return
    }
    this._chartStore.getTimeScaleStore().setLeftMinVisibleBarCount(Math.ceil(barCount))
  }

  setRightMinVisibleBarCount(barCount: number): void {
    if (barCount < 0) {
      logWarn('setRightMinVisibleBarCount', 'barCount', 'barCount must greater than zero!!!')
      return
    }
    this._chartStore.getTimeScaleStore().setRightMinVisibleBarCount(Math.ceil(barCount))
  }

  setBarSpaceLimit(limit: { min?: number, max?: number } = {}): void {
    const min = limit?.min
    const max = limit?.max
    if (isValid(min) && (!isNumber(min) || min <= 0)) {
      logWarn('setBarSpaceLimit', 'min', 'min must greater than zero!!!')
      return
    }
    if (isValid(max) && (!isNumber(max) || max <= 0)) {
      logWarn('setBarSpaceLimit', 'max', 'max must greater than zero!!!')
      return
    }
    if (isValid(min) && isValid(max) && min > max) {
      logWarn('setBarSpaceLimit', 'min/max', 'min must less than or equal to max!!!')
      return
    }
    this._chartStore.getTimeScaleStore().setBarSpaceLimit(limit)
  }

  setBarSpace(space: number): void {
    this._chartStore.getTimeScaleStore().setBarSpace(space)
  }

  getBarSpace(): number {
    return this._chartStore.getTimeScaleStore().getBarSpace().bar
  }

  fitToWidth(options?: { align?: 'left' | 'center' | 'right' | 'auto' }): void {
    const align = options?.align ?? 'auto'
    if (align !== 'left' && align !== 'center' && align !== 'right' && align !== 'auto') {
      logWarn('fitToWidth', 'align', 'align only supports `left`, `center`, `right`, `auto`!!!')
      return
    }
    if (this._chartStore.getIsTimeShare()) {
      logWarn('fitToWidth', '', 'fitToWidth is not supported in timeShare mode!!!')
      return
    }
    this._chartStore.getTimeScaleStore().fitToWidth(align)
  }

  getVisibleRange(): VisibleRange {
    return this._chartStore.getTimeScaleStore().getVisibleRange()
  }

  clearData(): void {
    this._chartStore.clear()
    this.refreshViewportLayout()
  }

  getDataList(): KLineData[] {
    return this._chartStore.getDataList()
  }

  getDataByDataIndex(dataIndex: number): KLineData | undefined {
    return this._chartStore.getDataByDataIndex(dataIndex)
  }

  getDataByTimestamp(timestamp: number, options?: { exact?: boolean }): KLineData | undefined {
    return this._chartStore.getDataByTimestamp(timestamp, options)
  }

  applyNewData(data: KLineData[], more?: boolean, callback?: () => void): void {
    this._chartStore.applyDataSnapshot(data, more, callback)
  }

  prependData(data: KLineData[], more?: boolean, callback?: () => void): void {
    this._chartStore.addData(data, LoadDataType.Backward, more, callback)
  }

  appendData(data: KLineData[], more?: boolean, callback?: () => void): void {
    this._chartStore.addData(data, LoadDataType.Forward, more, callback)
  }

  updateData(data: KLineData, callback?: () => void): void {
    this._chartStore.addData(data, undefined, undefined, callback)
  }

  replaceData(dataList: KLineData[], more?: boolean, callback?: () => void): void {
    this._chartStore.replaceData(dataList, more, callback)
  }

  setLoadDataCallback(cb: LoadDataCallback): void {
    this._chartStore.setLoadDataCallback(cb)
  }

  createYScale(yScale: YScaleCreate): string | undefined {
    const pane = this.getDrawPaneById(yScale.paneId)
    if (!pane || pane.getId() === PaneIdConstants.X_AXIS) {
      logWarn('createYScale', 'paneId', 'pane does not exist or does not support yScale.')
      return undefined
    }
    const dualYPane = pane as DualYPane
    if (yScale.id !== undefined && (!isString(yScale.id) || yScale.id.length === 0)) {
      logWarn('createYScale', 'id', 'id must be a non-empty string.')
      return undefined
    }
    const id = yScale.id ?? createId('y_scale_')
    if (dualYPane.getYScaleById(id)) {
      logWarn('createYScale', 'id', `yScale '${id}' already exists.`)
      return undefined
    }
    dualYPane.createOrOverrideYScale({ ...yScale, id })
    this._refreshExactLayout(false)
    return id
  }

  getYScales(filter: YScaleFilter = {}): YScaleOptions[] {
    const result: YScaleOptions[] = []
    this._drawPanes.forEach(pane => {
      if (pane.getId() === PaneIdConstants.X_AXIS || (filter.paneId && filter.paneId !== pane.getId())) return
      ;(pane as DualYPane).getYScales().forEach(scale => {
        const options = scale.getOptions()
        if (filter.id && options.id !== filter.id) return
        if (filter.name && options.name !== filter.name) return
        result.push({ ...options })
      })
    })
    return result
  }

  overrideYScale(yScale: YScaleOverride): void {
    const scales = this.getYScales({ paneId: yScale.paneId, id: yScale.id })
    scales.forEach(scale => {
      const pane = this.getDrawPaneById(scale.paneId)
      if (pane?.getId() !== PaneIdConstants.X_AXIS) {
        ;(pane as DualYPane).createOrOverrideYScale({ ...yScale, paneId: scale.paneId })
      }
    })
    if (scales.length > 0) this._refreshExactLayout(false)
  }

  removeYScale(filter: YScaleFilter): boolean {
    if (!filter.id && !filter.name) {
      logWarn('removeYScale', 'filter', 'id or name is required.')
      return false
    }
    let removed = false
    this.getYScales(filter).forEach(scale => {
      const pane = this.getDrawPaneById(scale.paneId)
      if (!pane || pane.getId() === PaneIdConstants.X_AXIS) return
      removed = (pane as DualYPane).removeYScale(scale.id) || removed
    })
    if (removed) this._refreshExactLayout(false)
    return removed
  }

  createYAxis(yAxis: YAxisCreate): string | undefined {
    const pane = this.getDrawPaneById(yAxis.paneId)
    if (!pane || pane.getId() === PaneIdConstants.X_AXIS) {
      logWarn('createYAxis', 'paneId', 'pane does not exist or does not support yAxis.')
      return undefined
    }
    const dualYPane = pane as DualYPane
    if (!dualYPane.getYScaleById(yAxis.yScaleId)) {
      logWarn('createYAxis', 'yScaleId', `yScale '${yAxis.yScaleId}' does not exist.`)
      return undefined
    }
    if (yAxis.id !== undefined && (!isString(yAxis.id) || yAxis.id.length === 0)) {
      logWarn('createYAxis', 'id', 'id must be a non-empty string.')
      return undefined
    }
    const id = yAxis.id ?? createId('y_axis_')
    if (dualYPane.getYAxisWidgetById(id)) {
      logWarn('createYAxis', 'id', `yAxis '${id}' already exists.`)
      return undefined
    }
    dualYPane.createOrOverrideYAxis({ ...yAxis, id })
    this._refreshExactLayout(false)
    return id
  }

  getYAxes(filter: YAxisFilter = {}): YAxisOptions[] {
    const result: YAxisOptions[] = []
    this._drawPanes.forEach(pane => {
      if (pane.getId() === PaneIdConstants.X_AXIS || (filter.paneId && filter.paneId !== pane.getId())) return
      ;(pane as DualYPane).getYAxisWidgets().forEach(widget => {
        const options = widget.getOptions()
        if (filter.id && options.id !== filter.id) return
        if (filter.yScaleId && options.yScaleId !== filter.yScaleId) return
        result.push({ ...options })
      })
    })
    return result
  }

  overrideYAxis(yAxis: YAxisOverride): void {
    const axes = this.getYAxes({ paneId: yAxis.paneId, id: yAxis.id })
    axes.forEach(axis => {
      const pane = this.getDrawPaneById(axis.paneId)
      if (pane?.getId() !== PaneIdConstants.X_AXIS) {
        const dualYPane = pane as DualYPane
        if ('yScaleId' in yAxis && (!isString(yAxis.yScaleId) || yAxis.yScaleId.length === 0 || !dualYPane.getYScaleById(yAxis.yScaleId))) {
          logWarn('overrideYAxis', 'yScaleId', `yScale '${yAxis.yScaleId}' does not exist.`)
          return
        }
        dualYPane.createOrOverrideYAxis({ ...yAxis, paneId: axis.paneId })
      }
    })
    if (axes.length > 0) this._refreshExactLayout(false)
  }

  removeYAxis(filter: YAxisFilter): boolean {
    if (!filter.id && !filter.yScaleId) {
      logWarn('removeYAxis', 'filter', 'id or yScaleId is required.')
      return false
    }
    let removed = false
    this.getYAxes(filter).forEach(axis => {
      const pane = this.getDrawPaneById(axis.paneId)
      if (!pane || pane.getId() === PaneIdConstants.X_AXIS) return
      removed = (pane as DualYPane).removeYAxis(axis.id) || removed
    })
    if (removed) this._refreshExactLayout(false)
    return removed
  }

  createIndicator(value: string | IndicatorCreate, isStack?: boolean, paneOptions?: PaneOptions, callback?: () => void): string | undefined {
    const epoch = this._chartStore.getDatasetEpoch()
    let createdInstance: Indicator | undefined
    const isCurrent = (): boolean => !this._chartStore.isDestroyed() && epoch === this._chartStore.getDatasetEpoch() &&
      createdInstance !== undefined && this._chartStore.getIndicatorStore().getInstances(createdInstance.paneId).includes(createdInstance)
    const indicator = isString(value) ? { name: value } : value
    if (getIndicatorTemplate(indicator.name) == null) {
      logWarn('createIndicator', indicator.name, 'indicator not supported, you may need to use registerIndicator to add one!!!')
      return undefined
    }
    if (!isString(indicator.id)) {
      indicator.id = createId(indicator.name)
    }

    const paneId = paneOptions?.id
    const currentPane = this.getDrawPaneById(paneId ?? '') as DualYPane
    let realPaneId = paneId
    if (currentPane) {
      realPaneId = currentPane.getId()
      indicator.paneId = realPaneId
      indicator.yScaleId ??= currentPane.getDefaultYScaleId()
      if (!currentPane.getYScaleById(indicator.yScaleId)) {
        logWarn('createIndicator', 'yScaleId', `yScale '${indicator.yScaleId}' does not exist in pane '${realPaneId}'.`)
        return undefined
      }
      const creation = this._chartStore.getIndicatorStore().addInstance(indicator, realPaneId, isStack ?? false)
      createdInstance = this._chartStore.getIndicatorStore().getInstances(realPaneId).find(instance => instance.id === indicator.id)
      void creation.then(committed => {
        if (!committed || !isCurrent()) return
        let forceShouldAdjust = false
        currentPane.getYScales().forEach(scale => {
          forceShouldAdjust = scale.getComponent().buildTicks(true) || forceShouldAdjust
        })

        this._setPaneOptions(paneOptions ?? {}, forceShouldAdjust ?? false)
      }).catch(() => {})
    } else {
      if ('yScaleId' in indicator && (!isString(indicator.yScaleId) || indicator.yScaleId.length === 0 || indicator.yScaleId !== DEFAULT_Y_SCALE_ID)) {
        logWarn('createIndicator', 'yScaleId', `new panes only contain the '${DEFAULT_Y_SCALE_ID}' scale.`)
        return undefined
      }
      const height = paneOptions?.height ?? this._chartStore.getIndicatorPaneDefaultHeight()
      const resolvedPaneOptions = {
        ...paneOptions,
        height,
        minHeight: paneOptions?.minHeight ?? this._chartStore.getMinIndicatorPaneHeight()
      }
      realPaneId ??= createId(PaneIdConstants.INDICATOR)
      const pane = this._createPane(IndicatorPane, realPaneId, resolvedPaneOptions)
      const heightSpec = this._parsePaneHeight(height, 'createIndicator') ??
        PANE_DEFAULT_HEIGHT_SPEC
      pane.setHeightSpec(heightSpec)
      pane.setBounding({ height: heightSpec.unit === 'pixel' ? heightSpec.value : 0 })
      indicator.paneId = realPaneId
      indicator.yScaleId = pane.getDefaultYScaleId()
      const indicatorCalcPromise = this._chartStore.getIndicatorStore().addInstance(indicator, realPaneId, isStack ?? false)
      createdInstance = this._chartStore.getIndicatorStore().getInstances(realPaneId).find(instance => instance.id === indicator.id)
      this._refreshExactLayoutIfReady()
      void indicatorCalcPromise.then(committed => {
        if (!committed || !isCurrent()) return
        this.refreshPaneLayout()
        if (isCurrent()) callback?.()
      }).catch(() => {})
    }
    return realPaneId
  }

  private _refreshExactLayoutIfReady(): void {
    if (this._dataZoomSlider !== undefined) {
      this.refreshPaneLayout()
    }
  }

  private _parsePaneHeight(height: number, api: string): ReturnType<typeof parsePaneHeight> {
    const state = parsePaneHeight(height)
    if (state === null) {
      logWarn(api, 'height', 'height must be a positive number. Values less than 1 are treated as percentages; values greater than or equal to 1 are rounded pixels.')
    }
    return state
  }

  overrideIndicator(override: IndicatorOverride, paneId?: string, callback?: () => void): void {
    const filter: IndicatorFilter = 'id' in override
      ? { id: override.id, paneId }
      : { name: override.name, paneId }
    const matchingIndicators = this._chartStore.getIndicatorStore().getIndicatorsByFilter(filter)
    if ('yScaleId' in override) {
      const invalidPane = matchingIndicators.find(indicator => {
        const pane = this.getDrawPaneById(indicator.paneId)
        return pane?.getId() === PaneIdConstants.X_AXIS ||
          !isString(override.yScaleId) ||
          override.yScaleId.length === 0 ||
          !(pane as DualYPane | undefined)?.getYScaleById(override.yScaleId)
      })
      if (invalidPane) {
        logWarn('overrideIndicator', 'yScaleId', `yScale '${override.yScaleId}' does not exist in pane '${invalidPane.paneId}'.`)
        return
      }
    }
    this._chartStore.getIndicatorStore().override(override, paneId).then(
      ([onlyUpdateFlag, resizeFlag, isCurrent]) => {
        if (!isCurrent()) return
        if ('yScaleId' in override) {
          this._refreshExactLayout(false)
          if (isCurrent()) callback?.()
        } else if (resizeFlag) {
          this.refreshViewportLayout()
          if (isCurrent()) callback?.()
        } else if (onlyUpdateFlag) {
          this._refreshPaneViews()
          if (isCurrent()) callback?.()
        }
      }
    ).catch(() => {})
  }

  /**
   * @deprecated Use `getIndicators` instead.
   */
  getIndicatorByPaneId(paneId?: string, name?: string): Indicator | Map<string, Indicator> | Map<string, Map<string, Indicator>> | null {
    return this._chartStore.getIndicatorStore().getInstanceByPaneId(paneId, name)
  }

  getIndicators(filter?: IndicatorFilter): Indicator[] {
    return this._chartStore.getIndicatorStore().getIndicatorsByFilter(filter ?? {})
  }

  removeIndicator(paneId: string, name?: string): void
  removeIndicator(filter: IndicatorRemoveFilter): void
  removeIndicator(paneIdOrFilter: string | IndicatorRemoveFilter, name?: string): void {
    const indicatorStore = this._chartStore.getIndicatorStore()
    const filter: IndicatorFilter = isString(paneIdOrFilter)
      ? { paneId: paneIdOrFilter, name }
      : paneIdOrFilter
    const paneId = filter.paneId
    if (!paneId) {
      logWarn('removeIndicator', 'paneId', 'paneId is required.')
      return
    }
    const removedIndicators = indicatorStore.removeInstances(filter)
    if (removedIndicators.length > 0) {
      const pane = this.getDrawPaneById(paneId)
      let shouldMeasureHeight = false
      if (paneId !== PaneIdConstants.CANDLE) {
        if (!indicatorStore.hasInstances(paneId)) {
          const index = this._drawPanes.findIndex(p => p.getId() === paneId)
          if (pane) {
            shouldMeasureHeight = true
            const separatorPane = this._separatorPanes.get(pane)
            if (isValid(separatorPane)) {
              const topPane = separatorPane?.getTopPane()
              for (const item of this._separatorPanes) {
                if (item[1].getTopPane().getId() === pane.getId()) {
                  item[1].setTopPane(topPane)
                  break
                }
              }
              separatorPane.destroy()
              this._separatorPanes.delete(pane)
            }
            this._drawPanes.splice(index, 1)
            pane.destroy()

            let firstPane = this._drawPanes[0]
            if (isValid(firstPane)) {
              if (firstPane.getId() === PaneIdConstants.X_AXIS) {
                firstPane = this._drawPanes[1]
              }
            }
            this._separatorPanes.get(firstPane)?.destroy()
            this._separatorPanes.delete(firstPane)
          }
        }
      }
      this._refreshExactLayout(shouldMeasureHeight)
    }
  }

  createOverlay(value: string, paneId?: string): string | undefined
  createOverlay(value: OverlayCreate, paneId?: string): string | undefined
  createOverlay(value: Array<string | OverlayCreate>, paneId?: string): Array<string | undefined>
  createOverlay(value: string | OverlayCreate | Array<string | OverlayCreate>, paneId?: string): string | undefined | Array<string | undefined> {
    if (this._chartStore.isDestroyed()) throw new Error('Chart is destroyed.')
    let overlays: OverlayCreate[] = []
    if (isString(value)) {
      overlays = [{ name: value }]
    } else if (isArray<Array<string | OverlayCreate>>(value)) {
      overlays = (value as Array<string | OverlayCreate>).map((v: string | OverlayCreate) => {
        if (isString(v)) {
          return { name: v }
        }
        return v
      })
    } else {
      overlays = [value as OverlayCreate]
    }

    const ids = this._chartStore.getOverlayStore().addInstances(overlays, paneId)
    this.syncOverlayCursor()
    if (isArray(value)) {
      return ids
    }
    return ids[0]
  }

  resetOverlay(id: string): void {
    this._chartStore.getOverlayStore().resetInstance(id)
    this.updatePane(UpdateLevel.Overlay)
  }

  getOverlayById(id: string): Overlay | undefined {
    return this._chartStore.getOverlayStore().getInstanceById(id)
  }

  getOverlays(filter?: OverlayFilter): Overlay[] {
    return this._chartStore.getOverlayStore().find(filter ?? {})
  }

  overrideOverlay({ id, name, groupId, paneId, ...props }: Partial<OverlayCreate>): void {
    this._chartStore.getOverlayStore().update({ id, name, groupId, paneId }, props)
  }

  removeOverlay(remove?: string | OverlayFilter): void {
    let OverlayFilter: OverlayFilter | undefined
    if (isValid(remove)) {
      if (isString(remove)) {
        OverlayFilter = { id: remove }
      } else {
        OverlayFilter = remove
      }
    }
    this._chartStore.getOverlayStore().removeInstance(OverlayFilter)
    this.syncOverlayCursor()
  }

  deselectOverlay(): void {
    this._chartStore.getOverlayStore().deselectOverlay()
  }

  setPaneOptions(options: PaneOptions): void {
    this._setPaneOptions(options, false)
  }

  setZoomEnabled(enabled: boolean): void {
    this._chartStore.getTimeScaleStore().zoomEnabled = enabled
  }

  isZoomEnabled(): boolean {
    return this._chartStore.getTimeScaleStore().zoomEnabled
  }

  setScrollEnabled(enabled: boolean): void {
    this._chartStore.getTimeScaleStore().scrollEnabled = enabled
  }

  isScrollEnabled(): boolean {
    return this._chartStore.getTimeScaleStore().scrollEnabled
  }

  scrollByBar(count: number, animationDuration?: number): void {
    const barWidth = this.getBarSpace()
    this.scrollByDistance(count * barWidth, animationDuration)
  }

  scrollByDistance(distance: number, animationDuration?: number): void {
    const duration = isNumber(animationDuration) && animationDuration > 0 ? animationDuration : 0
    const timeScaleStore = this._chartStore.getTimeScaleStore()
    if (duration > 0) {
      const animation = new Animation({ duration })
      animation.doFrame(frameTime => {
        const progressDistance = distance * (frameTime / duration)
        timeScaleStore.scroll(progressDistance)
      })
      animation.start()
    } else {
      timeScaleStore.scroll(distance)
    }
  }

  scrollToRealTime(animationDuration?: number): void {
    const timeScaleStore = this._chartStore.getTimeScaleStore()
    const distance = timeScaleStore.getOffsetRightDistance() - timeScaleStore.getInitialOffsetRightDistance()
    this.scrollByDistance(distance, animationDuration)
  }

  scrollToDataIndex(dataIndex: number, animationDuration?: number): void {
    const timeScaleStore = this._chartStore.getTimeScaleStore()
    const distance = (
      timeScaleStore.getOffsetRightDistance() + (this.getDataList().length - 1 - dataIndex) * timeScaleStore.getBarSpace().bar
    )
    this.scrollByDistance(distance, animationDuration)
  }

  scrollToTimestamp(timestamp: number, animationDuration?: number): void {
    const dataIndex = this._chartStore.timestampToNearestDataIndex(timestamp)
    if (dataIndex !== undefined) {
      this.scrollToDataIndex(dataIndex, animationDuration)
    }
  }

  alignLeft(): void {
    this._chartStore.getTimeScaleStore().alignLeft()
  }

  alignRight(): void {
    this._chartStore.getTimeScaleStore().alignRight()
  }

  alignCenter(): void {
    this._chartStore.getTimeScaleStore().alignCenter()
  }

  setAutoInitialAlignment(enabled: boolean): void {
    this._chartStore.getTimeScaleStore().setAutoInitialAlignment(enabled)
  }

  getAutoInitialAlignment(): boolean {
    return this._chartStore.getTimeScaleStore().getAutoInitialAlignment()
  }

  zoomAtCoordinate(scale: number, coordinate?: Coordinate, animationDuration?: number): void {
    const duration = isNumber(animationDuration) && animationDuration > 0 ? animationDuration : 0
    const timeScaleStore = this._chartStore.getTimeScaleStore()
    const scaleDelta = scale - 1
    if (duration > 0) {
      let prev = 0
      const animation = new Animation({ duration })
      animation.doFrame(time => {
        const t = time / duration
        const cur = scaleDelta * t
        const scale = cur - prev
        timeScaleStore.zoom(scale, coordinate?.x)
        prev = cur
      })
      animation.start()
    } else {
      timeScaleStore.zoom(scaleDelta, coordinate?.x)
    }
  }

  zoomAtDataIndex(scale: number, dataIndex: number, animationDuration?: number): void {
    const x = this._chartStore.getTimeScaleStore().dataIndexToCoordinate(dataIndex)
    this.zoomAtCoordinate(scale, { x, y: 0 }, animationDuration)
  }

  zoomAtTimestamp(scale: number, timestamp: number, animationDuration?: number): void {
    const dataIndex = this._chartStore.timestampToNearestDataIndex(timestamp)
    if (dataIndex !== undefined) {
      this.zoomAtDataIndex(scale, dataIndex, animationDuration)
    }
  }

  convertToPixel(point: Partial<Point>, finder: ConvertFinder): Partial<Coordinate>
  convertToPixel(points: Array<Partial<Point>>, finder: ConvertFinder): Array<Partial<Coordinate>>
  convertToPixel(
    points: Partial<Point> | Array<Partial<Point>>,
    finder: ConvertFinder
  ): Partial<Coordinate> | Array<Partial<Coordinate>> {
    const { paneId = PaneIdConstants.CANDLE, absolute = false, yScaleId } = finder
    const isArrayInput = isArray(points)
    let coordinates: Array<Partial<Coordinate>> = []

    if (paneId !== PaneIdConstants.X_AXIS) {
      const pane = this.getDrawPaneById(paneId)
      if (pane && pane.getId() !== PaneIdConstants.X_AXIS) {
        const bounding = pane.getBounding()
        const ps = isArrayInput ? points : [points]
        const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
        const xAxis = xAxisWidget.getAxisComponent()
        const yAxis = this._getYScale(pane as DualYPane, yScaleId)

        coordinates = ps.map(externalPoint => {
          const coordinate: Partial<Coordinate> = {}
          // 外部 -> 内部转换
          const internalPoint = this._chartStore.externalToInternal(externalPoint)
          if (isNumber(internalPoint.dataIndex)) {
            coordinate.x = xAxis?.convertToPixel(internalPoint.dataIndex)
          }
          if (isNumber(internalPoint.value) && yAxis) {
            const y = yAxis.convertToPixel(internalPoint.value)
            coordinate.y = absolute ? bounding.top + y : y
          }
          return coordinate
        })
      }
    }

    return isArrayInput ? coordinates : (coordinates[0] ?? {})
  }

  private _getYScale(pane: DualYPane, id?: string) {
    return pane.getYScaleById(id)?.getComponent()
  }

  convertFromPixel(coordinate: Partial<Coordinate>, finder: ConvertFinder): Partial<Point>
  convertFromPixel(coordinates: Array<Partial<Coordinate>>, finder: ConvertFinder): Array<Partial<Point>>
  convertFromPixel(
    coordinates: Partial<Coordinate> | Array<Partial<Coordinate>>,
    finder: ConvertFinder
  ): Partial<Point> | Array<Partial<Point>> {
    const { paneId = PaneIdConstants.CANDLE, absolute = false, yScaleId } = finder
    const isArrayInput = isArray(coordinates)
    let points: Array<Partial<Point>> = []

    if (paneId !== PaneIdConstants.X_AXIS) {
      const pane = this.getDrawPaneById(paneId)
      if (pane && pane.getId() !== PaneIdConstants.X_AXIS) {
        const bounding = pane.getBounding()
        const cs = isArrayInput ? coordinates : [coordinates]
        const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
        const xAxis = xAxisWidget.getAxisComponent()
        const yAxis = this._getYScale(pane as DualYPane, yScaleId)

        points = cs.map(coordinate => {
          const internalPoint: Partial<IPoint> = {}
          if (isNumber(coordinate.x)) {
            internalPoint.dataIndex = xAxis?.convertFromPixel(coordinate.x) ?? 0
          }
          if (isNumber(coordinate.y) && yAxis) {
            const y = absolute ? coordinate.y - bounding.top : coordinate.y
            internalPoint.value = yAxis.convertFromPixel(y)
          }
          // 内部 -> 外部转换
          return this._chartStore.internalToExternal(internalPoint)
        })
      }
    }

    return isArrayInput ? points : (points[0] ?? {})
  }

  externalToInternal(point: Partial<Point>): Partial<IPoint> {
    return this._chartStore.externalToInternal(point)
  }

  internalToExternal(point: Partial<IPoint>): Partial<Point> {
    return this._chartStore.internalToExternal(point)
  }

  coordinateToDataIndex(x: number): number {
    return this._chartStore.getTimeScaleStore().coordinateToDataIndex(x)
  }

  executeAction(type: ActionType, data: object): void {
    switch (type) {
      case ActionType.OnCrosshairChange: {
        const crosshair: Crosshair = { ...data }
        crosshair.paneId = crosshair.paneId ?? PaneIdConstants.CANDLE
        this._chartStore.getTooltipStore().setCrosshair(crosshair, { notExecuteAction: true })
        break
      }
    }
  }

  subscribeAction<T extends ActionType>(type: T, callback: ActionCallback<ActionCallbackParams[T]>): void {
    this._chartStore.getActionStore().subscribe(type, callback)
  }

  unsubscribeAction<T extends ActionType>(type: T, callback?: ActionCallback<ActionCallbackParams[T]>): void {
    this._chartStore.getActionStore().unsubscribe(type, callback)
  }

  getConvertPictureUrl(includeOverlay?: boolean, type?: string, backgroundColor?: string): string {
    const width = this._chartContainer.clientWidth
    const height = this._chartContainer.clientHeight
    const { ctx, canvas } = initCanvas(width, height)

    ctx.save()
    ctx.fillStyle = backgroundColor ?? '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    const overlayFlag = includeOverlay ?? false
    this._drawPanes.forEach(pane => {
      const separatorPane = this._separatorPanes.get(pane)
      if (isValid(separatorPane)) {
        const separatorBounding = separatorPane.getBounding()
        ctx.drawImage(
          separatorPane.getImage(overlayFlag),
          separatorBounding.left, separatorBounding.top, separatorBounding.width, separatorBounding.height
        )
      }

      const bounding = pane.getBounding()
      ctx.drawImage(
        pane.getImage(overlayFlag),
        0, bounding.top, width, bounding.height
      )
    })
    ctx.restore()
    return canvas.toDataURL(`image/${type ?? 'png'}`)
  }

  resize(anchor?: ResizeAnchor): void {
    if (anchor !== undefined && anchor !== 'domainFrom' && anchor !== 'domainTo') {
      logWarn('resize', 'anchor', 'anchor only supports `domainFrom`, `domainTo`!!!')
      return
    }
    this.refreshResizeLayout(anchor)
  }

  focus(): void {
    this._chartContainer.focus()
  }

  destroy(): void {
    this._cancelPendingLayoutFrame()
    this._pendingLayoutRequest = undefined
    this._chartStore.destroy()
    this._chartEvent.destroy()
    this._drawPanes.forEach(pane => {
      pane.destroy()
    })
    this._drawPanes = []
    this._separatorPanes.forEach(pane => {
      pane.destroy()
    })
    this._separatorPanes.clear()
    this._dataZoomSlider.destroy()
    this._container.removeChild(this._chartContainer)
  }
}
