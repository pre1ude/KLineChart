import type DeepRequired from '../common/DeepRequired'
import { type UpdateLevel } from '../common/Updater'
import type Bounding from '../common/Bounding'
import { isValid, merge } from '../common/utils/typeChecks'
import type DrawWidget from '../widget/DrawWidget'
import Pane from './Pane'
import { type PaneOptions, PANE_MIN_HEIGHT, PaneIdConstants } from './types'
import type Chart from '../Chart'
import { initCanvas } from '../common/utils/canvas'
import type PickPartial from '../common/PickPartial'
import { setCursor } from '../common/utils/cursor'

export default abstract class SingleWidgetPane extends Pane {
  private readonly _mainWidget: DrawWidget<SingleWidgetPane>

  private readonly _options: PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> = {
    minHeight: PANE_MIN_HEIGHT,
    dragEnabled: true,
    gap: { top: 0.2, bottom: 0.1 },
    reservedSpace: { top: 0, bottom: 0 },
    axisOptions: {
      name: 'default', scrollZoomEnabled: true
    }
  }

  constructor(rootContainer: HTMLElement, afterElement: HTMLElement | null, chart: Chart, id: string, options: Omit<PaneOptions, 'id' | 'height'>) {
    super(rootContainer, afterElement, chart, id)
    const container = this.getContainer()
    this._mainWidget = this.createMainWidget(container, options)
    this.setOptions(options)
  }

  setOptions(options: Omit<PaneOptions, 'id' | 'height'>): this {
    merge(this._options, options)
    if (this.getId() === PaneIdConstants.X_AXIS) {
      const container = this.getMainWidget().getContainer()
      const cursor = (options.axisOptions?.scrollZoomEnabled ?? true) ? 'ew-resize' : 'default'
      setCursor(container, cursor)
    }
    return this
  }

  getOptions(): PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> { return this._options }

  override setBounding(rootBounding: Partial<Bounding>, mainBounding?: Partial<Bounding>): this {
    merge(this.getBounding(), rootBounding)
    const contentBounding: Partial<Bounding> = {}
    if (isValid(rootBounding.height)) {
      contentBounding.height = rootBounding.height
    }
    if (isValid(rootBounding.top)) {
      contentBounding.top = rootBounding.top
    }
    this._mainWidget.setBounding(contentBounding)
    if (isValid(mainBounding)) {
      this._mainWidget.setBounding(mainBounding)
    }
    return this
  }

  getMainWidget(): DrawWidget<SingleWidgetPane> { return this._mainWidget }

  override updateImp(level: UpdateLevel): void {
    this._mainWidget.update(level)
  }

  override destroy(): void {
    this._mainWidget.destroy()
    super.destroy()
  }

  override getImage(includeOverlay: boolean): HTMLCanvasElement {
    const { width, height } = this.getBounding()

    const { ctx, canvas } = initCanvas(width, height)

    const mainBounding = this._mainWidget.getBounding()
    ctx.drawImage(
      this._mainWidget.getImage(includeOverlay),
      mainBounding.left, 0,
      mainBounding.width, mainBounding.height
    )
    return canvas
  }

  protected abstract createMainWidget(container: HTMLElement, options: PaneOptions): DrawWidget<SingleWidgetPane>
}
