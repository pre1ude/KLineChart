import Eventful from '../common/Eventful'
import { Figure } from './Figure'

/**
 * FigureGroup - 用于将多个 Figure 组合在一起，统一处理事件
 * 子 Figure 的事件会冒泡到 Group 层级
 */
export class FigureGroup extends Eventful {
  draw (ctx: CanvasRenderingContext2D): void {
    const children = this.getChildren()
    for (const child of children) {
      if (child instanceof Figure || child instanceof FigureGroup) {
        child.draw(ctx)
      }
    }
  }
}
