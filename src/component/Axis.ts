import type Bounding from '../common/Bounding'
import type { GridLineLevel } from '../common/Styles'
import type VisibleRange from '../common/VisibleRange'
import type Pane from '../pane/Pane'
import type { PaneOptions } from '../pane/types'

export interface AxisParent {
  getPane: () => Pane
  getBounding: () => Bounding
}

export interface AxisTick {
  coord: number
  value: number | string
  text: string
  colorHint?: -1 | 0 | 1
  gridLineLevel?: GridLineLevel
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
  private readonly _parent: AxisParent

  constructor(parent: AxisParent) {
    this._parent = parent
  }

  getParent(): AxisParent { return this._parent }

  getScrollZoomEnabled(): boolean {
    const pane = this.getParent().getPane() as Pane & { getOptions: () => PaneOptions }
    return pane.getOptions().axisOptions?.scrollZoomEnabled ?? true
  }

  protected abstract calcRange(): VisibleRange

  protected abstract optimalTicks(ticks: AxisTick[]): AxisTick[]

  abstract createTicks(params: AxisCreateTicksParams): AxisTick[]

  abstract getAutoSize(): number

  abstract getSelfBounding(): Bounding

  abstract convertToPixel(value: number): number
  abstract convertFromPixel(px: number): number
}
