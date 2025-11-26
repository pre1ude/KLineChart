import type DeepRequired from '../common/DeepRequired'
import { type UpdateLevel } from '../common/Updater'
import type Bounding from '../common/Bounding'
import { isValid, merge } from '../common/utils/typeChecks'
import type DrawWidget from '../widget/DrawWidget'
import YAxisWidget from '../widget/YAxisWidget'
import Pane from './Pane'
import { type PaneOptions, PANE_MIN_HEIGHT, PaneIdConstants } from './types'
import type Chart from '../Chart'
import { initCanvas } from '../common/utils/canvas'
import type PickPartial from '../common/PickPartial'
import { YAxisPosition, YAxisType } from '../common/Styles'
import { setCursor } from '../common/utils/cursor'

// todo should support two axisWidget
export default abstract class DualYPane extends Pane {
  private readonly _mainWidget: DrawWidget<DualYPane>
  private readonly _yLeftAxisWidget: YAxisWidget
  private readonly _yRightAxisWidget: YAxisWidget

  private readonly _options: PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> = {
    minHeight: PANE_MIN_HEIGHT,
    dragEnabled: true,
    gap: { top: 0.2, bottom: 0.1 },
    axisOptions: {
      name: 'default',
      scrollZoomEnabled: true,
      YAxis: {
        left: { type: YAxisType.Normal }, right: { type: YAxisType.Normal }
      }
    }
  }

  constructor(rootContainer: HTMLElement, afterElement: HTMLElement | null, chart: Chart, id: string, options: Omit<PaneOptions, 'id' | 'height'>) {
    super(rootContainer, afterElement, chart, id)
    const container = this.getContainer()
    this._mainWidget = this.createMainWidget(container)
    this.setOptions(options)
    this._yLeftAxisWidget = this.createYAxisWidget(container, this._options, YAxisPosition.Left)
    this._yRightAxisWidget = this.createYAxisWidget(container, this._options, YAxisPosition.Right)
    this.setContainerCursorStyle()
  }

  setOptions(options: Omit<PaneOptions, 'id' | 'height'>): this {
    merge(this._options, options)
    return this
  }

  setContainerCursorStyle(): void {
    const scrollZoomEnabled = this._options.axisOptions?.scrollZoomEnabled ?? true
    if (this.getId() === PaneIdConstants.X_AXIS) {
      const container = this.getMainWidget().getContainer()
      setCursor(container, scrollZoomEnabled ? 'ew-resize' : 'default')
    } else {
      const leftContainer = this._yLeftAxisWidget.getContainer()
      const rightContainer = this._yRightAxisWidget.getContainer()
      setCursor(leftContainer, scrollZoomEnabled ? 'ns-resize' : 'default')
      setCursor(rightContainer, scrollZoomEnabled ? 'ns-resize' : 'default')
    }
  }

  getOptions(): PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> { return this._options }

  override setBounding(rootBounding: Partial<Bounding>, mainBounding?: Partial<Bounding>, yLeftAxisBounding?: Partial<Bounding>, yRightAxisBounding?: Partial<Bounding>): this {
    merge(this.getBounding(), rootBounding)
    const contentBounding: Partial<Bounding> = {}
    if (isValid(rootBounding.height)) {
      contentBounding.height = rootBounding.height
    }
    if (isValid(rootBounding.top)) {
      contentBounding.top = rootBounding.top
    }
    this._mainWidget.setBounding(contentBounding)
    this._yLeftAxisWidget?.setBounding(contentBounding)
    this._yRightAxisWidget?.setBounding(contentBounding)
    if (isValid(mainBounding)) {
      this._mainWidget.setBounding(mainBounding)
    }
    if (isValid(yLeftAxisBounding)) {
      this._yLeftAxisWidget?.setBounding(yLeftAxisBounding)
    }
    if (isValid(yRightAxisBounding)) {
      this._yRightAxisWidget?.setBounding(yRightAxisBounding)
    }
    return this
  }

  getMainWidget(): DrawWidget<DualYPane> { return this._mainWidget }

  getMainAxisWidget(): YAxisWidget {
    // get style options
    const yAxisStyles = this.getChart().getStyles().yAxis
    const position = yAxisStyles.position
    if (position === YAxisPosition.Left) {
      return this._yLeftAxisWidget
    } else if (position === YAxisPosition.Right) {
      return this._yRightAxisWidget
    }
    // default to left if both are enabled
    return this._yLeftAxisWidget

  }

  getAxisWidget(position: string): YAxisWidget {
    if (position === 'left') {
      return this._yLeftAxisWidget
    } else if (position === 'right') {
      return this._yRightAxisWidget
    }
    throw new Error(`Invalid axis position: ${position}. Use 'left' or 'right'.`)
  }

  getYLeftAxisWidget(): YAxisWidget { return this._yLeftAxisWidget }
  getYRightAxisWidget(): YAxisWidget { return this._yRightAxisWidget }

  override updateImp(level: UpdateLevel): void {
    this._mainWidget.update(level)
    this._yLeftAxisWidget?.update(level)
    this._yRightAxisWidget?.update(level)
  }

  override destroy(): void {
    this._mainWidget.destroy()
    this._yLeftAxisWidget?.destroy()
    this._yRightAxisWidget?.destroy()
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

    // todo check here
    if (this._yLeftAxisWidget) {
      const yAxisBounding = this._yLeftAxisWidget.getBounding()
      ctx.drawImage(
        this._yLeftAxisWidget.getImage(includeOverlay),
        yAxisBounding.left, 0,
        yAxisBounding.width, yAxisBounding.height
      )
    }
    return canvas
  }

  protected createYAxisWidget(container: HTMLElement, options: PaneOptions, position: Exclude<YAxisPosition, 'both'>): YAxisWidget { return new YAxisWidget(container, this, options, position) }

  protected abstract createMainWidget(container: HTMLElement): DrawWidget<DualYPane>
}
