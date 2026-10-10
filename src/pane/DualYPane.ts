import type DeepRequired from '../common/DeepRequired'
import { type UpdateLevel } from '../common/Updater'
import type Bounding from '../common/Bounding'
import { isValid, merge } from '../common/utils/typeChecks'
import type { Indicator } from '../component/Indicator'
import YScaleHost, { createDefaultYScaleOptions, DEFAULT_Y_AXIS_ID, DEFAULT_Y_SCALE_ID, type YScaleOptions } from '../component/YScaleHost'
import type DrawWidget from '../widget/DrawWidget'
import YAxisWidget, { YAxisLabelDisplay, type YAxisOptions } from '../widget/YAxisWidget'
import Pane from './Pane'
import { type PaneOptions, PANE_MIN_HEIGHT, PaneIdConstants } from './types'
import type Chart from '../Chart'
import { initCanvas } from '../common/utils/canvas'
import type PickPartial from '../common/PickPartial'
import { YAxisPosition } from '../common/Styles'
import { setCursor } from '../common/utils/cursor'

export default abstract class DualYPane extends Pane {
  private readonly _mainWidget: DrawWidget<DualYPane>
  private readonly _yScales = new Map<string, YScaleHost>()
  private readonly _yAxisWidgets = new Map<string, YAxisWidget>()
  private _yAxesBounding: Record<string, Partial<Bounding>> = {}
  private _defaultYScaleId = DEFAULT_Y_SCALE_ID

  private readonly _options: PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> = {
    minHeight: PANE_MIN_HEIGHT,
    dragEnabled: true,
    gap: { top: 0, bottom: 0 },
    reservedSpace: { top: 0, bottom: 0 },
    axisOptions: {
      name: 'default',
      scrollZoomEnabled: true
    }
  }

  constructor(rootContainer: HTMLElement, afterElement: HTMLElement | null, chart: Chart, id: string, options: Omit<PaneOptions, 'id' | 'height'>) {
    super(rootContainer, afterElement, chart, id)
    const container = this.getContainer()
    this._mainWidget = this.createMainWidget(container)
    this.setOptions(options)
    this.createOrOverrideYScale({
      ...createDefaultYScaleOptions(id),
      name: this._options.axisOptions?.name ?? 'default',
      scrollZoomEnabled: this._options.axisOptions?.scrollZoomEnabled ?? true
    })
    this.createOrOverrideYAxis({
      id: DEFAULT_Y_AXIS_ID,
      yScaleId: DEFAULT_Y_SCALE_ID,
      position: YAxisPosition.Left
    })
    this.setContainerCursorStyle()
  }

  setOptions(options: Omit<PaneOptions, 'id' | 'height'>): this {
    merge(this._options, options)
    const defaultScale = this._yScales.get(this._defaultYScaleId)
    if (defaultScale) {
      const nextOptions: Partial<YScaleOptions> = {}
      if (options.axisOptions?.name !== undefined) nextOptions.name = options.axisOptions.name
      if (options.axisOptions?.scrollZoomEnabled !== undefined) nextOptions.scrollZoomEnabled = options.axisOptions.scrollZoomEnabled
      defaultScale.setOptions(nextOptions)
    }
    this.setContainerCursorStyle()
    return this
  }

  createOrOverrideYScale(options: Pick<YScaleOptions, 'id'> & Partial<YScaleOptions>): YScaleHost {
    const current = this._yScales.get(options.id)
    if (current) {
      current.setOptions(options)
      if (options.name !== undefined || options.type !== undefined || options.reverse !== undefined || options.nice !== undefined) {
        current.getComponent().setAutoCalcTickFlag(true)
      }
      this.setContainerCursorStyle()
      return current
    }

    const defaults = createDefaultYScaleOptions(this.getId())
    const scale = new YScaleHost(this, { ...defaults, ...options, id: options.id, paneId: this.getId() })
    this._yScales.set(options.id, scale)
    this.setContainerCursorStyle()
    return scale
  }

  removeYScale(id: string): boolean {
    if (id === this._defaultYScaleId || !this._yScales.has(id)) return false
    const referencedByAxis = this.getYAxisWidgets()
      .some(widget => widget.getOptions().yScaleId === id)
    const referencedByIndicator = this.getChart().getChartStore().getIndicatorStore().getInstances(this.getId())
      .some(indicator => this.resolveIndicatorYScaleId(indicator) === id)
    if (referencedByAxis || referencedByIndicator) return false
    this._yScales.delete(id)
    return true
  }

  getYScaleById(id?: string): YScaleHost | undefined { return this._yScales.get(id ?? this._defaultYScaleId) }

  getYScales(): YScaleHost[] { return Array.from(this._yScales.values()) }

  getDefaultYScaleId(): string { return this._defaultYScaleId }

  getDefaultYScale(): YScaleHost { return this._yScales.get(this._defaultYScaleId)! }

  isDefaultYScale(id: string): boolean { return id === this._defaultYScaleId }

  createOrOverrideYAxis(options: Pick<YAxisOptions, 'id'> & Partial<YAxisOptions>): YAxisWidget {
    const current = this._yAxisWidgets.get(options.id)
    if (current) {
      const previous = current.getOptions()
      if (options.yScaleId && !this._yScales.has(options.yScaleId)) {
        throw new Error(`YScale '${options.yScaleId}' does not exist in pane '${this.getId()}'.`)
      }
      current.setOptions(options)
      if (previous.position !== current.getOptions().position) this._yAxesBounding = {}
      this.setContainerCursorStyle()
      return current
    }

    const yScaleId = options.yScaleId ?? this._defaultYScaleId
    if (!this._yScales.has(yScaleId)) {
      throw new Error(`YScale '${yScaleId}' does not exist in pane '${this.getId()}'.`)
    }
    const position = options.position ?? YAxisPosition.Right
    const yAxisOptions: YAxisOptions = {
      id: options.id,
      paneId: this.getId(),
      yScaleId,
      needWidget: options.needWidget ?? true,
      position,
      order: options.order ?? this._yAxisWidgets.size,
      labelDisplay: options.labelDisplay ?? YAxisLabelDisplay.Value,
      tickTextColor: options.tickTextColor,
      showTitle: options.showTitle
    }
    const widget = this.createYAxisWidget(this.getContainer(), yAxisOptions)
    this._yAxisWidgets.set(yAxisOptions.id, widget)
    const bounding = this.getBounding()
    widget.setBounding({ width: 1, height: bounding.height, top: bounding.top, left: -1 })
    this.setContainerCursorStyle()
    return widget
  }

  removeYAxis(id: string): boolean {
    const widget = this._yAxisWidgets.get(id)
    if (!widget) return false
    widget.destroy()
    this._yAxisWidgets.delete(id)
    delete this._yAxesBounding[id]
    return true
  }

  getYAxisWidgetById(id?: string): YAxisWidget | undefined {
    return this._yAxisWidgets.get(id ?? DEFAULT_Y_AXIS_ID)
  }

  getYAxisWidgets(): YAxisWidget[] { return Array.from(this._yAxisWidgets.values()) }

  getVisibleYAxisWidgets(): YAxisWidget[] {
    return this.getYAxisWidgets().filter(widget => widget.getOptions().needWidget)
  }

  getYAxisWidgetsByPosition(position: 'left' | 'right', visibleOnly = false): YAxisWidget[] {
    const widgets = visibleOnly ? this.getVisibleYAxisWidgets() : this.getYAxisWidgets()
    return widgets
      .filter(widget => widget.getOptions().position === position)
      .sort((a, b) => a.getOptions().order - b.getOptions().order)
  }

  resolveIndicatorYScaleId(indicator: Pick<Indicator, 'yScaleId'>): string {
    return indicator.yScaleId
  }

  setYAxesBounding(bounding: Record<string, Partial<Bounding>>): void { this._yAxesBounding = bounding }

  setContainerCursorStyle(): void {
    if (this.getId() === PaneIdConstants.X_AXIS) {
      const enabled = this._options.axisOptions?.scrollZoomEnabled ?? true
      setCursor(this.getMainWidget().getContainer(), enabled ? 'ew-resize' : 'default')
      return
    }
    this._yAxisWidgets.forEach(widget => {
      const enabled = widget.getScale().getOptions().scrollZoomEnabled
      setCursor(widget.getContainer(), enabled ? 'ns-resize' : 'default')
    })
  }

  getOptions(): PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> { return this._options }

  override setBounding(rootBounding: Partial<Bounding>, mainBounding?: Partial<Bounding>): this {
    merge(this.getBounding(), rootBounding)
    const contentBounding: Partial<Bounding> = {}
    if (isValid(rootBounding.height)) contentBounding.height = rootBounding.height
    if (isValid(rootBounding.top)) contentBounding.top = rootBounding.top
    this._mainWidget.setBounding(contentBounding)
    this._yAxisWidgets.forEach(widget => widget.setBounding(contentBounding))
    if (isValid(mainBounding)) this._mainWidget.setBounding(mainBounding)
    this._yAxisWidgets.forEach(widget => {
      const options = widget.getOptions()
      const axisBounding = this._yAxesBounding[options.id]
      if (isValid(axisBounding)) widget.setBounding(axisBounding)
      else widget.setBounding({ width: 1, left: -1 })
    })
    return this
  }

  getMainWidget(): DrawWidget<DualYPane> { return this._mainWidget }

  override updateImp(level: UpdateLevel): void {
    this._mainWidget.update(level)
    const visibleWidgets = new Set(this.getVisibleYAxisWidgets())
    this._yAxisWidgets.forEach(widget => {
      widget.getContainer().style.visibility = visibleWidgets.has(widget) ? 'visible' : 'hidden'
      widget.update(level)
    })
  }

  override destroy(): void {
    this._mainWidget.destroy()
    this._yAxisWidgets.forEach(widget => widget.destroy())
    this._yScales.clear()
    super.destroy()
  }

  override getImage(includeOverlay: boolean): HTMLCanvasElement {
    const { width, height } = this.getBounding()
    const { ctx, canvas } = initCanvas(width, height)
    const mainBounding = this._mainWidget.getBounding()
    ctx.drawImage(this._mainWidget.getImage(includeOverlay), mainBounding.left, 0, mainBounding.width, mainBounding.height)
    this.getVisibleYAxisWidgets().forEach(widget => {
      const bounding = widget.getBounding()
      if (bounding.width > 0 && bounding.height > 0) {
        ctx.drawImage(widget.getImage(includeOverlay), bounding.left, 0, bounding.width, bounding.height)
      }
    })
    return canvas
  }

  protected createYAxisWidget(container: HTMLElement, yAxisOptions: YAxisOptions): YAxisWidget {
    return new YAxisWidget(container, this, yAxisOptions)
  }

  protected abstract createMainWidget(container: HTMLElement): DrawWidget<DualYPane>
}
