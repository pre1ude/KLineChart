import Eventful from '../common/Eventful'
import type Pane from '../pane/Pane'
import type DrawWidget from '../widget/DrawWidget'

export default abstract class View extends Eventful {
  /**
   * Parent widget
   */
  private readonly _widget: DrawWidget<Pane>

  constructor(widget: DrawWidget<Pane>) {
    super()
    this._widget = widget
  }

  getWidget(): DrawWidget<Pane> { return this._widget }

  draw(ctx: CanvasRenderingContext2D): void {
    this.clear()
    this.drawImp(ctx)
  }

  protected abstract drawImp(ctx: CanvasRenderingContext2D): void
}
