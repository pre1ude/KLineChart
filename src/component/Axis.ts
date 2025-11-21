
import type VisibleRange from '../common/VisibleRange'
// import { getPrecision, nice, round } from '../common/utils/number'
import type Bounding from '../common/Bounding'
import type XAxisWidget from '../widget/XAxisWidget'
import type YAxisWidget from '../widget/YAxisWidget'

export interface AxisTick {
  coord: number
  value: number | string
  text: string
  colorHint?: -1 | 0 | 1
}

export interface Axis {
  convertToPixel: (value: number) => number
  convertFromPixel: (px: number) => number
}

export interface AxisCreateTicksParams {
  range: VisibleRange
  bounding: Bounding
  defaultTicks: AxisTick[]
}

export type AxisCreateTicksCallback = (params: AxisCreateTicksParams) => AxisTick[]

export interface AxisTemplate {
  name: string
  createTicks: AxisCreateTicksCallback
}

export default abstract class AxisImp implements Pick<AxisTemplate, 'createTicks'>, Axis {
  private readonly _parent: XAxisWidget | YAxisWidget

  // todo parent should be the axisWidget
  constructor(parent: XAxisWidget | YAxisWidget) {
    this._parent = parent
  }

  getParent(): XAxisWidget | YAxisWidget { return this._parent }

  getScrollZoomEnabled(): boolean {
    return this.getParent().getPane().getOptions().axisOptions?.scrollZoomEnabled ?? true
  }

  protected abstract calcRange(): VisibleRange

  protected abstract optimalTicks(ticks: AxisTick[]): AxisTick[]

  abstract createTicks(params: AxisCreateTicksParams): AxisTick[]

  abstract getAutoSize(): number

  abstract getSelfBounding(): Bounding

  abstract convertToPixel(value: number): number
  abstract convertFromPixel(px: number): number
}
