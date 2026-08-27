import type DeepRequired from '../common/DeepRequired'
import { type UpdateLevel } from '../common/Updater'
import type Bounding from '../common/Bounding'
import { isValid, merge } from '../common/utils/typeChecks'
import type { Indicator } from '../component/Indicator'
import type DrawWidget from '../widget/DrawWidget'
import YAxisWidget, { type YAxisOptions } from '../widget/YAxisWidget'
import Pane from './Pane'
import { type PaneOptions, PANE_MIN_HEIGHT, PaneIdConstants } from './types'
import type Chart from '../Chart'
import { initCanvas } from '../common/utils/canvas'
import type PickPartial from '../common/PickPartial'
import { YAxisPosition, YAxisType } from '../common/Styles'
import { setCursor } from '../common/utils/cursor'

export const Y_AXIS_LEFT_ID = 'y_axis_left'
export const Y_AXIS_RIGHT_ID = 'y_axis_right'

export default abstract class DualYPane extends Pane {
  private readonly _mainWidget: DrawWidget<DualYPane>
  private readonly _yAxisWidgets = new Map<string, YAxisWidget>()
  // Kept as optional projections for prototype-based integrations and tests
  // that predate the registry.
  private readonly _yLeftAxisWidget?: YAxisWidget
  private readonly _yRightAxisWidget?: YAxisWidget
  private readonly _explicitYAxisIds = new Set<string>()
  private _yAxesBounding: Record<string, Partial<Bounding>> = {}

  private readonly _options: PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> = {
    minHeight: PANE_MIN_HEIGHT,
    dragEnabled: true,
    gap: { top: 0, bottom: 0 },
    reservedSpace: { top: 0, bottom: 0 },
    axisOptions: {
      name: 'default',
      scrollZoomEnabled: true,
      YAxis: {
        left: { type: YAxisType.Normal, nice: true }, right: { type: YAxisType.Normal, nice: true }
      }
    }
  }

  constructor(rootContainer: HTMLElement, afterElement: HTMLElement | null, chart: Chart, id: string, options: Omit<PaneOptions, 'id' | 'height'>) {
    super(rootContainer, afterElement, chart, id)
    const container = this.getContainer()
    this._mainWidget = this.createMainWidget(container)
    this.setOptions(options)
    this.createOrOverrideYAxis({ id: Y_AXIS_LEFT_ID, position: YAxisPosition.Left })
    this.createOrOverrideYAxis({ id: Y_AXIS_RIGHT_ID, position: YAxisPosition.Right })
    this.setContainerCursorStyle()
  }

  setOptions(options: Omit<PaneOptions, 'id' | 'height'>): this {
    merge(this._options, options)
    this._yAxisWidgets.forEach(widget => {
      const currentOptions = widget.getOptions()
      const sideOptions = options.axisOptions?.YAxis?.[currentOptions.position]
      const nextOptions: Partial<YAxisOptions> = {}
      if (options.axisOptions?.name !== undefined) nextOptions.name = options.axisOptions.name
      if (options.axisOptions?.scrollZoomEnabled !== undefined) nextOptions.scrollZoomEnabled = options.axisOptions.scrollZoomEnabled
      if (sideOptions?.type !== undefined) nextOptions.type = sideOptions.type
      if (sideOptions?.nice !== undefined) nextOptions.nice = sideOptions.nice
      if (sideOptions?.axisTitle !== undefined) nextOptions.axisTitle = sideOptions.axisTitle
      widget.setOptions(nextOptions)
      if (sideOptions?.type !== undefined || sideOptions?.nice !== undefined) {
        widget.getAxisComponent().setAutoCalcTickFlag(true)
      }
    })
    this.setContainerCursorStyle()
    return this
  }

  createOrOverrideYAxis(options: Pick<YAxisOptions, 'id'> & Partial<YAxisOptions>): YAxisWidget {
    const current = this._yAxisWidgets.get(options.id)
    if (current) {
      const previous = current.getOptions()
      current.setOptions(options)
      if (options.name !== undefined || options.type !== undefined || options.nice !== undefined) {
        current.getAxisComponent().setAutoCalcTickFlag(true)
      }
      if (previous.position !== current.getOptions().position) this._yAxesBounding = {}
      this.setContainerCursorStyle()
      return current
    }

    const position = options.position ?? YAxisPosition.Right
    const sideOptions = this._options.axisOptions?.YAxis?.[position]
    const yAxisOptions: YAxisOptions = {
      id: options.id,
      paneId: this.getId(),
      name: options.name ?? this._options.axisOptions?.name ?? 'default',
      scrollZoomEnabled: options.scrollZoomEnabled ?? this._options.axisOptions?.scrollZoomEnabled ?? true,
      needWidget: options.needWidget ?? true,
      position,
      type: options.type ?? sideOptions?.type ?? YAxisType.Normal,
      nice: options.nice ?? sideOptions?.nice ?? true,
      axisTitle: options.axisTitle ?? sideOptions?.axisTitle ?? ''
    }
    const widget = this.createYAxisWidget(this.getContainer(), this._options, yAxisOptions)
    this._yAxisWidgets.set(yAxisOptions.id, widget)
    const bounding = this.getBounding()
    widget.setBounding({ width: 1, height: bounding.height, top: bounding.top, left: -1 })
    this.setContainerCursorStyle()
    return widget
  }

  removeYAxis(id: string): boolean {
    const widget = this._yAxisWidgets.get(id)
    if (!widget || this.isCompatibilityYAxis(id)) return false
    widget.destroy()
    this._yAxisWidgets.delete(id)
    this._explicitYAxisIds.delete(id)
    delete this._yAxesBounding[id]
    return true
  }

  setExplicitYAxis(id: string, explicit: boolean): void {
    if (explicit) this._explicitYAxisIds.add(id)
    else this._explicitYAxisIds.delete(id)
  }

  isExplicitYAxis(id: string): boolean { return this._explicitYAxisIds.has(id) }
  isCompatibilityYAxis(id: string): boolean { return id === Y_AXIS_LEFT_ID || id === Y_AXIS_RIGHT_ID }
  isDefaultYAxis(id: string): boolean { return this.getDefaultYAxisId() === id }
  getDefaultYAxisId(): string { return this.getMainAxisWidget().getOptions().id }

  getYAxisWidgetById(id?: string): YAxisWidget | undefined {
    return this._yAxisWidgets.get(id ?? this.getDefaultYAxisId())
  }

  getYAxisWidgets(): YAxisWidget[] { return Array.from(this._yAxisWidgets.values()) }

  getVisibleYAxisWidgets(): YAxisWidget[] {
    const globalPosition = this.getChart().getStyles().yAxis.position
    return this.getYAxisWidgets().filter(widget => {
      const options = widget.getOptions()
      if (!options.needWidget) return false
      if (!this.isCompatibilityYAxis(options.id)) return true
      return globalPosition === YAxisPosition.Both || globalPosition === options.position
    })
  }

  getYAxisWidgetsByPosition(position: 'left' | 'right', visibleOnly = false): YAxisWidget[] {
    const widgets = visibleOnly ? this.getVisibleYAxisWidgets() : this.getYAxisWidgets()
    return widgets.filter(widget => widget.getOptions().position === position)
  }

  getYAxisIdByPosition(position: 'left' | 'right'): string {
    return position === YAxisPosition.Left ? Y_AXIS_LEFT_ID : Y_AXIS_RIGHT_ID
  }

  resolveIndicatorYAxisId(indicator: Pick<Indicator, 'yAxisId' | 'yAxisPosition'>): string {
    if (indicator.yAxisId && this._yAxisWidgets.has(indicator.yAxisId)) return indicator.yAxisId
    if (indicator.yAxisPosition) return this.getYAxisIdByPosition(indicator.yAxisPosition)
    return this.getDefaultYAxisId()
  }

  setYAxesBounding(bounding: Record<string, Partial<Bounding>>): void { this._yAxesBounding = bounding }

  setContainerCursorStyle(): void {
    if (this.getId() === PaneIdConstants.X_AXIS) {
      const enabled = this._options.axisOptions?.scrollZoomEnabled ?? true
      setCursor(this.getMainWidget().getContainer(), enabled ? 'ew-resize' : 'default')
      return
    }
    this._yAxisWidgets.forEach(widget => {
      const enabled = widget.getOptions().scrollZoomEnabled ?? true
      setCursor(widget.getContainer(), enabled ? 'ns-resize' : 'default')
    })
  }

  getOptions(): PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> { return this._options }

  override setBounding(rootBounding: Partial<Bounding>, mainBounding?: Partial<Bounding>, yLeftAxisBounding?: Partial<Bounding>, yRightAxisBounding?: Partial<Bounding>): this {
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
      else if (options.id === Y_AXIS_LEFT_ID && isValid(yLeftAxisBounding)) widget.setBounding(yLeftAxisBounding)
      else if (options.id === Y_AXIS_RIGHT_ID && isValid(yRightAxisBounding)) widget.setBounding(yRightAxisBounding)
      else widget.setBounding({ width: 1, left: -1 })
    })
    return this
  }

  getMainWidget(): DrawWidget<DualYPane> { return this._mainWidget }

  getMainAxisWidget(): YAxisWidget {
    const styles = this.getChart().getStyles().yAxis
    if (styles.position === YAxisPosition.Right ||
      (styles.position === YAxisPosition.Both && styles.mainPosition === YAxisPosition.Right)) {
      return this.getYRightAxisWidget()
    }
    return this.getYLeftAxisWidget()
  }

  getAxisWidget(position: 'left' | 'right'): YAxisWidget {
    return position === YAxisPosition.Left ? this.getYLeftAxisWidget() : this.getYRightAxisWidget()
  }

  getYLeftAxisWidget(): YAxisWidget {
    const widget = this._yAxisWidgets?.get(Y_AXIS_LEFT_ID) ?? this._yLeftAxisWidget
    if (!widget) throw new Error('Left Y axis is not initialized.')
    return widget
  }

  getYRightAxisWidget(): YAxisWidget {
    const widget = this._yAxisWidgets?.get(Y_AXIS_RIGHT_ID) ?? this._yRightAxisWidget
    if (!widget) throw new Error('Right Y axis is not initialized.')
    return widget
  }

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

  protected createYAxisWidget(container: HTMLElement, options: PaneOptions, yAxisOptions: YAxisOptions): YAxisWidget {
    return new YAxisWidget(container, this, options, yAxisOptions)
  }

  protected abstract createMainWidget(container: HTMLElement): DrawWidget<DualYPane>
}
