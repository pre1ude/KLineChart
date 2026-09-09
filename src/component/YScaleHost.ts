import type Bounding from '../common/Bounding'
import { isString, isValid } from '../common/utils/typeChecks'
import { getYScaleClass } from '../extension/y-scale'
import type DualYPane from '../pane/DualYPane'
import { YScaleType, type YScale } from './YScale'

export interface YScaleOptions {
  id: string
  paneId: string
  name: string
  scrollZoomEnabled: boolean
  type: YScaleType
  reverse: boolean
  nice: boolean
  axisTitle: string
  formatter?: (value: number) => string
}

export type YScaleCreate = Partial<Omit<YScaleOptions, 'id' | 'paneId'>> & { id?: string, paneId: string }
export type YScaleOverride = Partial<Omit<YScaleOptions, 'id' | 'paneId'>> & { id: string, paneId?: string }

export interface YScaleFilter {
  id?: string
  paneId?: string
  name?: string
}

/**
 * Pane-scoped value scale. Visual Y-axis widgets reference this object and
 * never own range or transform state themselves.
 */
export default class YScaleHost {
  private _component!: YScale
  private _options: YScaleOptions
  private readonly _pane: DualYPane

  constructor(pane: DualYPane, options: YScaleOptions) {
    this._pane = pane
    this._options = options
    this.setOptions(options)
  }

  getPane(): DualYPane { return this._pane }

  getBounding(): Bounding { return this._pane.getMainWidget().getBounding() }

  getOptions(): YScaleOptions { return this._options }

  setOptions(options: Partial<YScaleOptions>): void {
    const name = options.name
    if ((isString(name) && name !== this._options.name) || !isValid(this._component)) {
      const YScaleClass = getYScaleClass(name ?? this._options.name ?? 'default')
      this._component = new YScaleClass(this)
    }
    this._options = { ...this._options, ...options }
  }

  getComponent(): YScale { return this._component }
}

export const DEFAULT_Y_SCALE_ID = 'default'
export const DEFAULT_Y_AXIS_ID = 'default'

export function createDefaultYScaleOptions(paneId: string): YScaleOptions {
  return {
    id: DEFAULT_Y_SCALE_ID,
    paneId,
    name: 'default',
    scrollZoomEnabled: true,
    type: YScaleType.Normal,
    reverse: false,
    nice: true,
    axisTitle: '',
    formatter: undefined
  }
}
