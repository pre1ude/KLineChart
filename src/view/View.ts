
import { type MouseTouchEventCallback, type EventHandler, type EventName } from '../common/SyntheticEvent'
import Eventful from '../common/Eventful'
import type DrawWidget from '../widget/DrawWidget'
import type Pane from '../pane/Pane'

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

  /**
   * 注册事件到 Eventful 对象
   * @param eventful - Figure 或 FigureGroup
   * @param events - 事件处理器映射
   */
  registerFigureEvents(eventful: Eventful, events: EventHandler): void {
    for (const name in events) {
      if (Object.prototype.hasOwnProperty.call(events, name)) {
        eventful.addEventListener(name as EventName, events[name] as MouseTouchEventCallback)
      }
    }
  }

  /**
   * @todo deprecated
   */
  bindFigureEvent(eventful: Eventful, events: EventHandler): void {
    this.registerFigureEvents(eventful, events)
    this.addChild(eventful)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.clear()
    this.drawImp(ctx)
  }

  protected abstract drawImp(ctx: CanvasRenderingContext2D): void
}
