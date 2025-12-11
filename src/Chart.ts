import type DeepPartial from './common/DeepPartial'
import type Bounding from './common/Bounding'
import type KLineData from './common/KLineData'
import type Coordinate from './common/Coordinate'
import type Point from './common/Point'
import { UpdateLevel } from './common/Updater'
import { type Styles, YAxisPosition } from './common/Styles'
import type Crosshair from './common/Crosshair'
import { ActionType, type ActionCallback } from './common/Action'
import type LoadMoreCallback from './common/LoadMoreCallback'
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
import { binarySearchNearest } from './common/utils/number'
import { LoadDataType } from './common/LoadDataCallback'
import ChartStore from './store/ChartStore'
import CandlePane from './pane/CandlePane'
import IndicatorPane from './pane/IndicatorPane'
import XAxisPane from './pane/XAxisPane'
import SeparatorPane from './pane/SeparatorPane'
import { type PaneOptions, PanePosition, PANE_DEFAULT_HEIGHT, PaneIdConstants, type DrawPane } from './pane/types'
import { type IndicatorFilter, type Indicator, type IndicatorCreate } from './component/Indicator'
import { type Overlay, type OverlayCreate, type OverlayFilter } from './component/Overlay'
import { getIndicatorTemplate } from './extension/indicator/index'
// import { getStyles as getExtensionStyles } from './extension/styles/index'
import Event from './Event'
import type XAxisWidget from './widget/XAxisWidget'
import type DualYPane from './pane/DualYPane'
import { getTimezone } from './common/utils/dateTimeFormat'

export enum DomPosition {
  Root = 'root',
  Main = 'main',
  YAxis = 'yAxis'
}

export interface ConvertFinder {
  paneId?: string
  absolute?: boolean
  yAxisPosition?: 'left' | 'right'
}

export interface Chart {
  id: string
  getDom: (paneId?: string, position?: DomPosition) => HTMLElement | null
  getSize: (paneId?: string, position?: DomPosition) => Bounding | null
  setLocale: (locale: string) => void
  getLocale: () => string
  setStyles: (styles: string | DeepPartial<Styles>) => void
  getStyles: () => Styles
  setCustomApi: (customApi: Partial<CustomApi>) => void
  setPriceVolumePrecision: (pricePrecision: number, volumePrecision: number) => void
  getPriceVolumePrecision: () => Precision
  setTimeShareDays: (days: number) => void
  setTimezone: (timezone: string) => void
  getTimezone: () => string
  setOffsetRightDistance: (distance: number) => void
  getOffsetRightDistance: () => number
  setMaxOffsetLeftDistance: (distance: number) => void
  setMaxOffsetRightDistance: (distance: number) => void
  setLeftMinVisibleBarCount: (barCount: number) => void
  setRightMinVisibleBarCount: (barCount: number) => void
  setBarSpace: (space: number) => void
  getBarSpace: () => number
  getVisibleRange: () => VisibleRange
  clearData: () => void
  getDataList: () => KLineData[]
  getDataByDataIndex: (dataIndex: number) => KLineData | undefined
  getDataByTimestamp: (timestamp: number, options?: { exact?: boolean }) => KLineData | undefined
  applyNewData: (dataList: KLineData[], more?: boolean, callback?: () => void) => void
  /**
   * @deprecated
   * Since v9.8.0 deprecated, since v10 removed
   */
  applyMoreData: (dataList: KLineData[], more?: boolean, callback?: () => void) => void
  updateData: (data: KLineData, callback?: () => void) => void
  /**
   * @deprecated
   * Since v9.8.0 deprecated, since v10 removed
   */
  loadMore: (cb: LoadMoreCallback) => void
  setLoadDataCallback: (cb: LoadDataCallback) => void
  createIndicator: (value: string | IndicatorCreate, isStack?: boolean, paneOptions?: PaneOptions, callback?: () => void) => string | undefined
  overrideIndicator: (override: IndicatorCreate, paneId?: string, callback?: () => void) => void
  getIndicatorByPaneId: (paneId?: string, name?: string) => Indicator | Map<string, Indicator> | Map<string, Map<string, Indicator>> | null
  removeIndicator: (paneId: string, name?: string) => void
  createOverlay: (value: string | OverlayCreate | Array<string | OverlayCreate>, paneId?: string) => undefined | string | Array<string | undefined>
  getOverlayById: (id: string) => Overlay | undefined
  overrideOverlay: (override: Partial<OverlayCreate>) => void
  removeOverlay: (remove?: string | OverlayFilter) => void
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
  zoomAtCoordinate: (scale: number, coordinate?: Coordinate, animationDuration?: number) => void
  zoomAtDataIndex: (scale: number, dataIndex: number, animationDuration?: number) => void
  zoomAtTimestamp: (scale: number, timestamp: number, animationDuration?: number) => void
  convertToPixel(point: Partial<Point>, finder: ConvertFinder): Partial<Coordinate>
  convertToPixel(points: Array<Partial<Point>>, finder: ConvertFinder): Array<Partial<Coordinate>>
  convertFromPixel(coordinate: Partial<Coordinate>, finder: ConvertFinder): Partial<Point>
  convertFromPixel(coordinates: Array<Partial<Coordinate>>, finder: ConvertFinder): Array<Partial<Point>>
  executeAction: (type: ActionType, data: object) => void
  subscribeAction: (type: ActionType, callback: ActionCallback) => void
  unsubscribeAction: (type: ActionType, callback?: ActionCallback) => void
  getConvertPictureUrl: (includeOverlay?: boolean, type?: string, backgroundColor?: string) => string
  resize: () => void
}

export default class ChartImp implements Chart {
  id: string

  private _container: HTMLElement
  private _chartContainer: HTMLElement
  private readonly _chartEvent: Event
  private readonly _chartStore: ChartStore
  private _drawPanes: (DrawPane)[] = []
  private _candlePane?: CandlePane
  private _xAxisPane!: XAxisPane
  private readonly _separatorPanes = new Map<DrawPane, SeparatorPane>()

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
    this.adjustPaneViewport(true, true, true)
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

  private _measurePaneHeight(): void {
    const totalHeight = Math.floor(this._container.clientHeight)
    const separatorSize = this._chartStore.getStyles().separator.size
    const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
    const xAxisHeight = xAxisWidget.getAxisComponent().getAutoSize()
    let paneExcludeXAxisHeight = totalHeight - xAxisHeight - this._separatorPanes.size * separatorSize
    if (paneExcludeXAxisHeight < 0) {
      paneExcludeXAxisHeight = 0
    }
    let indicatorPaneTotalHeight = 0

    this._drawPanes.forEach(pane => {
      if (pane.getId() !== PaneIdConstants.CANDLE && pane.getId() !== PaneIdConstants.X_AXIS) {
        let paneHeight = pane.getBounding().height
        const paneMinHeight = pane.getOptions().minHeight
        if (paneHeight < paneMinHeight) {
          paneHeight = paneMinHeight
        }
        if (indicatorPaneTotalHeight + paneHeight > paneExcludeXAxisHeight) {
          indicatorPaneTotalHeight = paneExcludeXAxisHeight
          paneHeight = Math.max(paneExcludeXAxisHeight - indicatorPaneTotalHeight, 0)
        } else {
          indicatorPaneTotalHeight += paneHeight
        }
        pane.setBounding({ height: paneHeight })
      }
    })
    const candlePaneHeight = paneExcludeXAxisHeight - indicatorPaneTotalHeight
    this._candlePane?.setBounding({ height: candlePaneHeight })
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
  }

  // todo read the pane axisOptions
  // todo deprecated partial of yAxis style
  private _measurePaneWidth(): void {
    const totalWidth = Math.floor(this._container.clientWidth)
    const styles = this._chartStore.getStyles()
    const yAxisStyles = styles.yAxis
    const isOutside = !yAxisStyles.inside
    let mainWidth = 0
    let yLeftAxisWidth = 0
    let yRightAxisWidth = 0
    let yLeftAxisLeft = 0
    let yRightAxisLeft = 0
    let mainLeft = 0
    this._drawPanes.forEach(pane => {
      if (pane.getId() !== PaneIdConstants.X_AXIS) {
        yLeftAxisWidth = Math.max(yLeftAxisWidth, (pane as DualYPane).getYLeftAxisWidget()?.getAxisComponent().getAutoSize() ?? 0)
        yRightAxisWidth = Math.max(yRightAxisWidth, (pane as DualYPane).getYRightAxisWidget()?.getAxisComponent().getAutoSize() ?? 0)
      }
    })
    if (yLeftAxisWidth > totalWidth) {
      yLeftAxisWidth = totalWidth
    }
    if (yRightAxisWidth > totalWidth) {
      yRightAxisWidth = totalWidth
    }
    if (isOutside) {
      if (yAxisStyles.position === YAxisPosition.Left) {
        yLeftAxisLeft = 0
        mainLeft = yLeftAxisWidth
        yRightAxisWidth = 0
      } else if (yAxisStyles.position === YAxisPosition.Right) {
        yRightAxisLeft = totalWidth - yRightAxisWidth
        mainLeft = 0
        yLeftAxisWidth = 0
      } else {
        // both
        yLeftAxisLeft = 0
        mainLeft = yLeftAxisWidth
        yRightAxisLeft = totalWidth - yRightAxisWidth
      }
      mainWidth = totalWidth - yLeftAxisWidth - yRightAxisWidth
    } else {
      mainWidth = totalWidth
      mainLeft = 0
      yLeftAxisLeft = 0
      yRightAxisLeft = totalWidth - yRightAxisWidth
    }

    this._chartStore.mainWidth = mainWidth
    this._chartStore.getTimeScaleStore().adjustVisibleRange()
    this._chartStore.getTooltipStore().recalculateCrosshair(true)

    const paneBounding = { width: totalWidth }
    const mainBounding = { width: mainWidth, left: mainLeft }
    const yLeftAxisBounding = { width: yLeftAxisWidth, left: yLeftAxisLeft }
    const yRightAxisBounding = { width: yRightAxisWidth, left: yRightAxisLeft }
    const separatorFill = styles.separator.fill
    let separatorBounding: Partial<Bounding>
    if (isOutside && !separatorFill) {
      separatorBounding = mainBounding
    } else {
      separatorBounding = paneBounding
    }
    this._drawPanes.forEach(pane => {
      this._separatorPanes.get(pane)?.setBounding(separatorBounding)
      pane.setBounding(paneBounding, mainBounding, yLeftAxisBounding, yRightAxisBounding)
    })
  }

  private _setPaneOptions(options: PaneOptions, forceShouldAdjust: boolean): void {
    if (isString(options.id)) {
      const pane = this.getDrawPaneById(options.id)
      let shouldMeasureHeight = false
      if (pane) {
        let shouldAdjust = forceShouldAdjust
        if (options.id !== PaneIdConstants.CANDLE && isNumber(options.height) && options.height > 0) {
          const minHeight = Math.max(options.minHeight ?? pane.getOptions().minHeight, 0)
          const height = Math.max(minHeight, options.height)
          pane.setBounding({ height })
          shouldAdjust = true
          shouldMeasureHeight = true
        }
        // 检查是否需要调整视图
        if (isString(options.axisOptions?.name) || isValid(options.gap) || isValid(options.axisOptions?.YAxis)) {
          shouldAdjust = true
        }
        pane.setOptions(options)
        if (shouldAdjust) {
          this.adjustPaneViewport(shouldMeasureHeight, true, true, true, true)
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

  getChartStore(): ChartStore { return this._chartStore }

  getXAxisPane(): XAxisPane { return this._xAxisPane }

  getAllDrawPanes(): DrawPane[] { return this._drawPanes }

  getAllSeparatorPanes(): Map<DrawPane, SeparatorPane> { return this._separatorPanes }

  adjustPaneViewport(
    shouldMeasureHeight: boolean,
    shouldMeasureWidth: boolean,
    shouldUpdate: boolean,
    shouldAdjustYAxis?: boolean,
    shouldForceAdjustYAxis?: boolean
  ): void {
    if (shouldMeasureHeight) {
      this._measurePaneHeight()
    }
    let forceMeasureWidth = shouldMeasureWidth
    const adjustYAxis = shouldAdjustYAxis ?? false
    const forceAdjustYAxis = shouldForceAdjustYAxis ?? false
    if (adjustYAxis || forceAdjustYAxis) {
      this._drawPanes.forEach(pane => {
        let adjust = false
        if (pane.getId() === PaneIdConstants.X_AXIS) {
          adjust = (pane.getMainWidget() as XAxisWidget).getAxisComponent().buildTicks(forceAdjustYAxis)
        } else {
          const leftAdjust = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent().buildTicks(forceAdjustYAxis)
          const rightAdjust = (pane as DualYPane).getYRightAxisWidget().getAxisComponent().buildTicks(forceAdjustYAxis)
          adjust = leftAdjust || rightAdjust
        }

        if (!forceMeasureWidth) {
          forceMeasureWidth = adjust
        }
      })
    }
    if (forceMeasureWidth) {
      this._measurePaneWidth()
    }
    if (shouldUpdate ?? false) {
      const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
      const xAxis = xAxisWidget.getAxisComponent()
      xAxis.buildTicks(true)
      this.updatePane(UpdateLevel.All)
    }
  }

  updatePane(level: UpdateLevel, paneId?: string): void {
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

  setStyles(styles: string | DeepPartial<Styles>): void {
    this._chartStore.setOptions({ styles })
    /* let realStyles: Nullable<DeepPartial<Styles>>
    if (isString(styles)) {
      realStyles = getExtensionStyles(styles)
    } else {
      realStyles = styles
    } */
    // todo check
    // if (isValid(realStyles?.yAxis?.type)) {
    this._candlePane?.getYLeftAxisWidget().getAxisComponent().setAutoCalcTickFlag(true)
    this._candlePane?.getYRightAxisWidget().getAxisComponent().setAutoCalcTickFlag(true)
    // }
    this.adjustPaneViewport(true, true, true, true, true)
  }

  getStyles(): Styles {
    return this._chartStore.getStyles()
  }

  setLocale(locale: string): void {
    this._chartStore.setOptions({ locale })
    this.adjustPaneViewport(true, true, true, true, true)
  }

  getLocale(): string {
    return this._chartStore.getLocale()
  }

  setCustomApi(customApi: Partial<CustomApi>): void {
    this._chartStore.setOptions({ customApi })
    this.adjustPaneViewport(true, true, true, true, true)
  }

  setPriceVolumePrecision(pricePrecision: number, volumePrecision: number): void {
    this._chartStore.setPrecision({ price: pricePrecision, volume: volumePrecision })
  }

  setTimeShareDays(days: number): void {
    this._chartStore.setTimeShareDays(days)
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

  setBarSpace(space: number): void {
    this._chartStore.getTimeScaleStore().setBarSpace(space)
  }

  getBarSpace(): number {
    return this._chartStore.getTimeScaleStore().getBarSpace().bar
  }

  getVisibleRange(): VisibleRange {
    return this._chartStore.getTimeScaleStore().getVisibleRange()
  }

  clearData(): void {
    this._chartStore.clear()
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
    this._chartStore.addData(data, LoadDataType.Init, more, callback)
  }

  applyMoreData(data: KLineData[], more?: boolean, callback?: () => void): void {
    this._chartStore.addData(data, LoadDataType.Backward, more ?? true, callback)
  }

  updateData(data: KLineData, callback?: () => void): void {
    this._chartStore.addData(data, undefined, undefined, callback)
  }

  loadMore(cb: LoadMoreCallback): void {
    logWarn('', '', 'Api `loadMore` has been deprecated since version 9.8.0, use `setLoadDataCallback` instead.')
    this._chartStore.setLoadMoreCallback(cb)
  }

  setLoadDataCallback(cb: LoadDataCallback): void {
    this._chartStore.setLoadDataCallback(cb)
  }

  createIndicator(value: string | IndicatorCreate, isStack?: boolean, paneOptions?: PaneOptions, callback?: () => void): string | undefined {
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
      if (realPaneId !== PaneIdConstants.CANDLE) {
        // is indicator pane
        const yAxisPosition = indicator.yAxisPosition ?? 'left'
        // get current pane yAxisWidget so the yAxisWidget now know what data to collect
        const yAxisWidget = currentPane.getAxisWidget(yAxisPosition)
        if (isValid(yAxisWidget)) {
          const axisComponent = yAxisWidget.getAxisComponent()
          axisComponent.addToCollect(indicator.name)
        } else {
          console.error('current pane does not have yAxisWidget for position:', yAxisPosition)
        }
      } else {
        // in candle pane just as usual
      }
      indicator.paneId = realPaneId
      this._chartStore.getIndicatorStore().addInstance(indicator, realPaneId, isStack ?? false).then(_ => {
        const forceShouldAdjustLeft = currentPane.getYLeftAxisWidget()?.getAxisComponent().buildTicks(true)
        const forceShouldAdjustRight = currentPane.getYRightAxisWidget()?.getAxisComponent().buildTicks(true)
        const forceShouldAdjust = forceShouldAdjustLeft || forceShouldAdjustRight

        this._setPaneOptions(paneOptions ?? {}, forceShouldAdjust ?? false)
      }).catch(_ => {})
    } else {
      realPaneId ??= createId(PaneIdConstants.INDICATOR)
      const pane = this._createPane(IndicatorPane, realPaneId, paneOptions ?? {})
      // let the yAxisWidget know what data to collect
      const yAxisPosition = indicator.yAxisPosition ?? 'left'
      // get current pane yAxisWidget so the yAxisWidget now know what data to collect
      const yAxisWidget = pane.getAxisWidget(yAxisPosition)
      if (isValid(yAxisWidget)) {
        const axisComponent = yAxisWidget.getAxisComponent()
        axisComponent.addToCollect(indicator.name)
      } else {
        console.error('current pane does not have yAxisWidget for position:', yAxisPosition)
      }
      const height = paneOptions?.height ?? PANE_DEFAULT_HEIGHT
      pane.setBounding({ height })
      indicator.paneId = realPaneId
      void this._chartStore.getIndicatorStore().addInstance(indicator, realPaneId, isStack ?? false).finally(() => {
        this.adjustPaneViewport(true, true, true, true, true)
        callback?.()
      })
    }
    return realPaneId
  }

  overrideIndicator(override: IndicatorCreate, paneId?: string, callback?: () => void): void {
    this._chartStore.getIndicatorStore().override(override, paneId).then(
      ([onlyUpdateFlag, resizeFlag]) => {
        if (onlyUpdateFlag || resizeFlag) {
          this.adjustPaneViewport(false, resizeFlag, true, resizeFlag)
          callback?.()
        }
      }
    ).catch(() => {})
  }

  getIndicatorByPaneId(paneId?: string, name?: string): Indicator | Map<string, Indicator> | Map<string, Map<string, Indicator>> | null {
    return this._chartStore.getIndicatorStore().getInstanceByPaneId(paneId, name)
  }

  getIndicators(filter?: IndicatorFilter): Indicator[] {
    return this._chartStore.getIndicatorStore().getIndicatorsByFilter(filter ?? {})
  }

  removeIndicator(paneId: string, name?: string): void {
    const indicatorStore = this._chartStore.getIndicatorStore()
    const removed = indicatorStore.removeInstance(paneId, name)
    if (removed) {
      let shouldMeasureHeight = false
      if (paneId !== PaneIdConstants.CANDLE) {
        // in indicator pane
        const pane = this.getDrawPaneById(paneId)
        if (pane) {
          const yLeftAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
          const yRightAxis = (pane as DualYPane).getYRightAxisWidget().getAxisComponent()
          if (name !== undefined) {
            yLeftAxis.removeFromCollect(name)
            yRightAxis.removeFromCollect(name)
          } else {
            yLeftAxis.clearCollect()
            yRightAxis.clearCollect()
          }
        }
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
      this.adjustPaneViewport(shouldMeasureHeight, true, true, true, true)
    }
  }

  createOverlay(value: string | OverlayCreate | Array<string | OverlayCreate>, paneId?: string): undefined | string | Array<string | undefined> {
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
      const overlay = value as OverlayCreate
      overlays = [overlay]
    }

    const ids = this._chartStore.getOverlayStore().addInstances(overlays, paneId)
    if (isArray(value)) {
      return ids
    }
    return ids[0]
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
    const dataIndex = binarySearchNearest(this.getDataList(), 'timestamp', timestamp)
    this.scrollToDataIndex(dataIndex, animationDuration)
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
    const dataIndex = binarySearchNearest(this.getDataList(), 'timestamp', timestamp)
    this.zoomAtDataIndex(scale, dataIndex, animationDuration)
  }

  convertToPixel(point: Partial<Point>, finder: ConvertFinder): Partial<Coordinate>
  convertToPixel(points: Array<Partial<Point>>, finder: ConvertFinder): Array<Partial<Coordinate>>
  convertToPixel(
    points: Partial<Point> | Array<Partial<Point>>,
    finder: ConvertFinder
  ): Partial<Coordinate> | Array<Partial<Coordinate>> {
    const { paneId = PaneIdConstants.CANDLE, absolute = false, yAxisPosition = 'left' } = finder
    const isArrayInput = isArray(points)
    let coordinates: Array<Partial<Coordinate>> = []

    if (paneId !== PaneIdConstants.X_AXIS) {
      const pane = this.getDrawPaneById(paneId)
      if (pane && pane.getId() !== PaneIdConstants.X_AXIS) {
        const bounding = pane.getBounding()
        const ps = isArrayInput ? points : [points]
        const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
        const xAxis = xAxisWidget.getAxisComponent()
        const yAxis = this._getYAxis(pane as DualYPane, yAxisPosition)

        coordinates = ps.map(point => {
          const coordinate: Partial<Coordinate> = {}
          let dataIndex = point.dataIndex
          if (isNumber(point.timestamp)) {
            dataIndex = this._chartStore.timestampToDataIndex(point.timestamp)
          }
          if (isNumber(dataIndex)) {
            coordinate.x = xAxis?.convertToPixel(dataIndex)
          }
          if (isNumber(point.value) && yAxis) {
            const y = yAxis.convertToPixel(point.value)
            coordinate.y = absolute ? bounding.top + y : y
          }
          return coordinate
        })
      }
    }

    return isArrayInput ? coordinates : (coordinates[0] ?? {})
  }

  private _getYAxis(pane: DualYPane, position: 'left' | 'right') {
    const yAxisWidget = position === 'left'
      ? pane.getYLeftAxisWidget()
      : pane.getYRightAxisWidget()
    return yAxisWidget?.getAxisComponent()
  }

  convertFromPixel(coordinate: Partial<Coordinate>, finder: ConvertFinder): Partial<Point>
  convertFromPixel(coordinates: Array<Partial<Coordinate>>, finder: ConvertFinder): Array<Partial<Point>>
  convertFromPixel(
    coordinates: Partial<Coordinate> | Array<Partial<Coordinate>>,
    finder: ConvertFinder
  ): Partial<Point> | Array<Partial<Point>> {
    const { paneId = PaneIdConstants.CANDLE, absolute = false, yAxisPosition = 'left' } = finder
    const isArrayInput = isArray(coordinates)
    let points: Array<Partial<Point>> = []

    if (paneId !== PaneIdConstants.X_AXIS) {
      const pane = this.getDrawPaneById(paneId)
      if (pane && pane.getId() !== PaneIdConstants.X_AXIS) {
        const bounding = pane.getBounding()
        const cs = isArrayInput ? coordinates : [coordinates]
        const xAxisWidget = this._xAxisPane.getMainWidget() as XAxisWidget
        const xAxis = xAxisWidget.getAxisComponent()
        const yAxis = this._getYAxis(pane as DualYPane, yAxisPosition)

        points = cs.map(coordinate => {
          const point: Partial<Point> = {}
          if (isNumber(coordinate.x)) {
            const dataIndex = xAxis?.convertFromPixel(coordinate.x) ?? -1
            point.dataIndex = dataIndex
            point.timestamp = this._chartStore.dataIndexToTimestamp(dataIndex) ?? undefined
          }
          if (isNumber(coordinate.y) && yAxis) {
            const y = absolute ? coordinate.y - bounding.top : coordinate.y
            point.value = yAxis.convertFromPixel(y)
          }
          return point
        })
      }
    }

    return isArrayInput ? points : (points[0] ?? {})
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

  subscribeAction(type: ActionType, callback: ActionCallback): void {
    this._chartStore.getActionStore().subscribe(type, callback)
  }

  unsubscribeAction(type: ActionType, callback?: ActionCallback): void {
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
    return canvas.toDataURL(`image/${type ?? 'jpeg'}`)
  }

  resize(): void {
    this.adjustPaneViewport(true, true, true, true, true)
  }

  destroy(): void {
    this._chartEvent.destroy()
    this._drawPanes.forEach(pane => {
      pane.destroy()
    })
    this._drawPanes = []
    this._separatorPanes.forEach(pane => {
      pane.destroy()
    })
    this._separatorPanes.clear()
    this._container.removeChild(this._chartContainer)
  }
}
