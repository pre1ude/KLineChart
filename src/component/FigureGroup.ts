import Eventful from '../common/Eventful'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { Figure } from './Figure'

/**
 * FigureGroup - 用于将多个 Figure 组合在一起，统一处理事件
 * 子 Figure 的事件会冒泡到 Group 层级
 */
export class FigureGroup extends Eventful {
  private _lastCheckEvent: any = null
  private _lastCheckResult = false

  addFigure (figure: Figure<any, any>): this {
    return this.addChild(figure)
  }

  draw (ctx: CanvasRenderingContext2D): void {
    const children = this.getChildren()
    for (const child of children) {
      if (child instanceof Figure || child instanceof FigureGroup) {
        child.draw(ctx)
      }
    }
  }

  override checkEventOn (event: MouseTouchEvent): boolean {
    if (this._lastCheckEvent === event) {
      return this._lastCheckResult
    }

    this._lastCheckEvent = event
    this._lastCheckResult = super.checkEventOn(event)
    return this._lastCheckResult
  }

  override clear (): void {
    super.clear()
    this._lastCheckEvent = null
    this._lastCheckResult = false
  }
}
