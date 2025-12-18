
import type Coordinate from '../common/Coordinate'

import Eventful from '../common/Eventful'
import { type MouseTouchEvent } from '../common/SyntheticEvent'

// 扩大选区以方便点击
export const DEVIATION = 2

export interface FigureApi<A = unknown, S = unknown> {
  name: string
  attrs: A
  styles: S
  draw: (ctx: CanvasRenderingContext2D, attrs: A, styles: S) => void
  checkEventOn: (coordinate: Coordinate, attrs: A, styles: S) => boolean
}

export type FigureTemplate<A = unknown, S = unknown> = Pick<FigureApi<A, S>, 'name' | 'draw' | 'checkEventOn'>
export type FigureCreate<A = unknown, S = unknown> = Pick<FigureApi<A, S>, 'name' | 'attrs' | 'styles'>

export class Figure<A = unknown, S = unknown, T = unknown> extends Eventful {
  attrs: A | undefined
  styles: S | undefined
  data: T | undefined

  private readonly _figure: FigureTemplate
  public readonly id: string | undefined
  private _ignoreEvent?: boolean | string[]

  constructor(figure: FigureTemplate, id?: string) {
    super()
    this._figure = figure
    if (typeof id === 'string') {
      this.id = id
    }
  }

  override checkEventOn(event: MouseTouchEvent, name?: string): boolean {
    // 完全忽略
    if (this._ignoreEvent === true) {
      return false
    }

    // 部分忽略
    if (Array.isArray(this._ignoreEvent) && name && this._ignoreEvent.includes(name)) {
      return false
    }

    return this._figure.checkEventOn(event, this.attrs, this.styles)
  }

  setAttrs(attrs: A): this {
    this.attrs = attrs
    return this
  }

  setStyles(styles: S): this {
    this.styles = styles
    return this
  }

  setData(data: T): this {
    this.data = data
    return this
  }

  setIgnoreEvent(ignoreEvent?: boolean | string[]): this {
    this._ignoreEvent = ignoreEvent
    return this
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this._figure.draw(ctx, this.attrs, this.styles)
  }
}
