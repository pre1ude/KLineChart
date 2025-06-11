/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type DualYPane from '../pane/DualYPane'
import { WidgetNameConstants } from './types'
import DrawWidget from './DrawWidget'
import type YAxis from '../component/YAxis'
import YAxisView from '../view/YAxisView'
import CandleLastPriceLabelView from '../view/CandleLastPriceLabelView'
import IndicatorLastValueView from '../view/IndicatorLastValueView'
import OverlayYAxisView from '../view/OverlayYAxisView'
import CrosshairHorizontalLabelView from '../view/CrosshairHorizontalLabelView'
import { YAxisPosition, YAxisType } from '../common/Styles'
import { PaneIdConstants, PaneOptions } from '../pane/types'
import { isString, isValid } from '../common/utils/typeChecks'
import { getYAxisClass } from '../extension/y-axis'

interface YAxisOptions {
  name?: string
  scrollZoomEnabled?: boolean
  position: Exclude<YAxisPosition, 'both'>,
  type: YAxisType
}

export default class YAxisWidget extends DrawWidget<DualYPane> {
  private _axis: YAxis
  private _axisOptions: YAxisOptions
  private readonly _yAxisView = new YAxisView(this)
  private readonly _candleLastPriceLabelView = new CandleLastPriceLabelView(this)
  private readonly _indicatorLastValueView = new IndicatorLastValueView(this)
  private readonly _overlayYAxisView = new OverlayYAxisView(this)
  private readonly _crosshairHorizontalLabelView = new CrosshairHorizontalLabelView(this)

  constructor (rootContainer: HTMLElement, pane: DualYPane, options: PaneOptions, position: Exclude<YAxisPosition, 'both'>) {
    super(rootContainer, pane)
    this.getContainer().style.cursor = 'ns-resize'
    this.addChild(this._overlayYAxisView)

    const axisType = options.axisOptions?.YAxis?.[position]?.type ?? YAxisType.Normal
    this.setOptions({
      name: options.axisOptions?.name,
      scrollZoomEnabled: options.axisOptions?.scrollZoomEnabled,
      position,
      type: axisType
    })
  }

  getOptions() {
    return this._axisOptions
  }

  setOptions(options: YAxisOptions) {
    const name = options?.name
    if (
      (this._axisOptions.name !== name && isString(name)) ||
      !isValid(this._axis)
    ) {
      this._axis = this.createAxisComponent(name ?? 'default')
    }
    this._axisOptions = options
  }

  createAxisComponent (name: string): YAxis {
    const YAxisClass = getYAxisClass(name)
    return new YAxisClass(this)
  }

  isInCandle (): boolean {
    return this.getPane().getId() === PaneIdConstants.CANDLE
  }

  isAlignLeft (): boolean {
    const position = this._axisOptions.position
    const yAxisStyles = this.getPane().getChart().getStyles().yAxis
    const inside = yAxisStyles.inside
    return (
      (position === YAxisPosition.Left && inside) ||
      (position === YAxisPosition.Right && !inside)
    )
  }

  getAxisType (): YAxisType {
    return this._axisOptions.type
  }

  getAxisComponent (): YAxis {
    return this._axis
  }

  override getName (): string {
    return WidgetNameConstants.Y_AXIS
  }

  override updateMain (ctx: CanvasRenderingContext2D): void {
    this._yAxisView.draw(ctx)
    if (this.getAxisComponent().isInCandle()) {
      this._candleLastPriceLabelView.draw(ctx)
    }
    this._indicatorLastValueView.draw(ctx)
  }

  override updateOverlay (ctx: CanvasRenderingContext2D): void {
    this._overlayYAxisView.draw(ctx)
    this._crosshairHorizontalLabelView.draw(ctx)
  }
}
