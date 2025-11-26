import { UpdateLevel } from '../common/Updater'
import type Bounding from '../common/Bounding'
import { merge } from '../common/utils/typeChecks'
import { initCanvas } from '../common/utils/canvas'
import type Chart from '../Chart'
import Pane from './Pane'
import SeparatorWidget from '../widget/SeparatorWidget'

export default class SeparatorPane extends Pane {
  private _topPane: Pane
  private _bottomPane: Pane

  private readonly _separatorWidget: SeparatorWidget

  constructor(rootContainer: HTMLElement, afterElement: HTMLElement | null, chart: Chart, id: string, topPane: Pane, bottomPane: Pane) {
    super(rootContainer, afterElement, chart, id)
    this.getContainer().style.overflow = ''
    this._topPane = topPane
    this._bottomPane = bottomPane
    this._separatorWidget = new SeparatorWidget(this.getContainer(), this)
  }

  override setBounding(rootBounding: Partial<Bounding>): Pane {
    merge(this.getBounding(), rootBounding)
    return this
  }

  getTopPane(): Pane {
    return this._topPane
  }

  setTopPane(pane: Pane): Pane {
    this._topPane = pane
    return this
  }

  getBottomPane(): Pane {
    return this._bottomPane
  }

  setBottomPane(pane: Pane): Pane {
    this._bottomPane = pane
    return this
  }

  getWidget(): SeparatorWidget { return this._separatorWidget }

  override getImage(_includeOverlay: boolean): HTMLCanvasElement {
    const { width, height } = this.getBounding()

    const { ctx, canvas } = initCanvas(width, height)

    const styles = this.getChart().getStyles().separator
    ctx.fillStyle = styles.color
    ctx.fillRect(0, 0, width, height)
    return canvas
  }

  override updateImp(level: UpdateLevel, container: HTMLElement, bounding: Bounding): void {
    if (level === UpdateLevel.All || level === UpdateLevel.Separator) {
      const styles = this.getChart().getStyles().separator
      container.style.backgroundColor = styles.color
      container.style.height = `${bounding.height}px`
      container.style.marginLeft = `${bounding.left}px`
      container.style.width = `${bounding.width}px`
      this._separatorWidget.update(level)
    }
  }
}
