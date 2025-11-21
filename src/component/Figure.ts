

import type Coordinate from '../common/Coordinate'

import Eventful from '../common/Eventful'
import { type MouseTouchEvent } from '../common/SyntheticEvent'

// 扩大选区以方便点击
export const DEVIATION = 2

export interface FigureApi<A = any, S = any> {
  name: string
  attrs: A
  styles: S
  draw: (ctx: CanvasRenderingContext2D, attrs: A, styles: S) => void
  checkEventOn: (coordinate: Coordinate, attrs: A, styles: S) => boolean
}

export type FigureTemplate<A = any, S = any> = Pick<FigureApi<A, S>, 'name' | 'draw' | 'checkEventOn'>
export type FigureCreate<A = any, S = any> = Pick<FigureApi<A, S>, 'name' | 'attrs' | 'styles'>

export class Figure<A = any, S = any, T = any> extends Eventful {
  attrs: A
  styles: S
  data: T

  private readonly _figure: FigureTemplate

  constructor (figure: FigureTemplate) {
    super()
    this._figure = figure
  }

  override checkEventOn (event: MouseTouchEvent): boolean {
    return this._figure.checkEventOn(event, this.attrs, this.styles)
  }

  setAttrs (attrs: A): this {
    this.attrs = attrs
    return this
  }

  setStyles (styles: S): this {
    this.styles = styles
    return this
  }

  setData (data: T): this {
    this.data = data
    return this
  }

  draw (ctx: CanvasRenderingContext2D): void {
    this._figure.draw(ctx, this.attrs, this.styles)
  }
}
