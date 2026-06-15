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
    this._yLeftAxisWidget = this.createYAxisWidget(container, this._options, YAxisPosition.Left)
    this._yRightAxisWidget = this.createYAxisWidget(container, this._options, YAxisPosition.Right)
    this.setContainerCursorStyle()
  }

  setOptions(options: Omit<PaneOptions, 'id' | 'height'>): this {
    merge(this._options, options)

    // 更新Y轴Widget配置（如果已创建且有新的配置）
    if (options.axisOptions?.YAxis) {
      const yAxisConfig = options.axisOptions.YAxis
      if (this._yLeftAxisWidget && (yAxisConfig.left?.type !== undefined || yAxisConfig.left?.nice !== undefined)) {
        const currentOptions = this._yLeftAxisWidget.getOptions()
        this._yLeftAxisWidget.setOptions({
          ...currentOptions,
          type: yAxisConfig.left.type ?? currentOptions.type,
          nice: yAxisConfig.left.nice ?? currentOptions.nice
        })
        this._yLeftAxisWidget.getAxisComponent().setAutoCalcTickFlag(true)
      }
      if (this._yRightAxisWidget && (yAxisConfig.right?.type !== undefined || yAxisConfig.right?.nice !== undefined)) {
        const currentOptions = this._yRightAxisWidget.getOptions()
        this._yRightAxisWidget.setOptions({
          ...currentOptions,
          type: yAxisConfig.right.type ?? currentOptions.type,
          nice: yAxisConfig.right.nice ?? currentOptions.nice
        })
        this._yRightAxisWidget.getAxisComponent().setAutoCalcTickFlag(true)
      }
    }

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

  getAxisWidget(position: 'left' | 'right'): YAxisWidget {
    if (position === YAxisPosition.Left) {
      return this._yLeftAxisWidget
    } else if (position === YAxisPosition.Right) {
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

    // Draw left Y axis (only if width > 0)
    if (this._yLeftAxisWidget) {
      const yLeftAxisBounding = this._yLeftAxisWidget.getBounding()
      if (yLeftAxisBounding.width > 0 && yLeftAxisBounding.height > 0) {
        ctx.drawImage(
          this._yLeftAxisWidget.getImage(includeOverlay),
          yLeftAxisBounding.left, 0,
          yLeftAxisBounding.width, yLeftAxisBounding.height
        )
      }
    }

    // Draw right Y axis (only if width > 0)
    if (this._yRightAxisWidget) {
      const yRightAxisBounding = this._yRightAxisWidget.getBounding()
      if (yRightAxisBounding.width > 0 && yRightAxisBounding.height > 0) {
        ctx.drawImage(
          this._yRightAxisWidget.getImage(includeOverlay),
          yRightAxisBounding.left, 0,
          yRightAxisBounding.width, yRightAxisBounding.height
        )
      }
    }

    return canvas
  }

  protected createYAxisWidget(container: HTMLElement, options: PaneOptions, position: Exclude<YAxisPosition, 'both'>): YAxisWidget { return new YAxisWidget(container, this, options, position) }

  protected abstract createMainWidget(container: HTMLElement): DrawWidget<DualYPane>
}
