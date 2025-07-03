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

import type DeepRequired from '../common/DeepRequired'
import type Nullable from '../common/Nullable'
import { type UpdateLevel } from '../common/Updater'
import type Bounding from '../common/Bounding'

import { isValid, merge } from '../common/utils/typeChecks'

import type DrawWidget from '../widget/DrawWidget'
import YAxisWidget from '../widget/YAxisWidget'

import Pane from './Pane'
import { type PaneOptions, PANE_MIN_HEIGHT, PaneIdConstants } from './types'

import type Chart from '../Chart'

import { createDom } from '../common/utils/dom'
import { getPixelRatio } from '../common/utils/canvas'
import type PickPartial from '../common/PickPartial'
import { YAxisPosition, YAxisType } from '../common/Styles'

// todo should support two axisWidget
export default abstract class DualYPane extends Pane {
  private readonly _mainWidget: DrawWidget<DualYPane>
  private readonly _yLeftAxisWidget: YAxisWidget
  private readonly _yRightAxisWidget: YAxisWidget

  private readonly _options: PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> = {
    minHeight: PANE_MIN_HEIGHT,
    dragEnabled: true,
    gap: { top: 0.2, bottom: 0.1 },
    axisOptions: {
      name: 'default',
      scrollZoomEnabled: true,
      YAxis: {
        left: { type: YAxisType.Normal }, right: { type: YAxisType.Percentage }
      }
    }
  }

  constructor (rootContainer: HTMLElement, afterElement: Nullable<HTMLElement>, chart: Chart, id: string, options: Omit<PaneOptions, 'id' | 'height'>) {
    super(rootContainer, afterElement, chart, id)
    const container = this.getContainer()
    this._mainWidget = this.createMainWidget(container)
    this.setOptions(options)
    this._yLeftAxisWidget = this.createYAxisWidget(container, this._options, YAxisPosition.Left)
    this._yRightAxisWidget = this.createYAxisWidget(container, this._options, YAxisPosition.Right)
    this.setContainerCursorStyle()
  }

  setOptions (options: Omit<PaneOptions, 'id' | 'height'>): this {
    merge(this._options, options)
    return this
  }

  setContainerCursorStyle (): void {
    const scrollZoomEnabled = this._options.axisOptions?.scrollZoomEnabled ?? true
    if (this.getId() === PaneIdConstants.X_AXIS) {
      const container = this.getMainWidget().getContainer()
      container.style.cursor = scrollZoomEnabled ? 'ew-resize' : 'default'
    } else {
      const leftContainer = this._yLeftAxisWidget.getContainer()
      const rightContainer = this._yRightAxisWidget.getContainer()
      leftContainer.style.cursor = scrollZoomEnabled ? 'ns-resize' : 'default'
      rightContainer.style.cursor = scrollZoomEnabled ? 'ns-resize' : 'default'
    }
  }

  getOptions (): PickPartial<DeepRequired<Omit<PaneOptions, 'id' | 'height'>>, 'position'> { return this._options }

  override setBounding (rootBounding: Partial<Bounding>, mainBounding?: Partial<Bounding>, yLeftAxisBounding?: Partial<Bounding>, yRightAxisBounding?: Partial<Bounding>): this {
    merge(this.getBounding(), rootBounding)
    const contentBounding: Partial<Bounding> = {}
    if (isValid(rootBounding.height)) {
      contentBounding.height = rootBounding.height
    }
    if (isValid(rootBounding.top)) {
      contentBounding.top = rootBounding.top
    }
    this._mainWidget.setBounding(contentBounding)
    this._yLeftAxisWidget?.setBounding(contentBounding)
    this._yRightAxisWidget?.setBounding(contentBounding)
    if (isValid(mainBounding)) {
      this._mainWidget.setBounding(mainBounding)
    }
    if (isValid(yLeftAxisBounding)) {
      this._yLeftAxisWidget?.setBounding(yLeftAxisBounding)
    }
    if (isValid(yRightAxisBounding)) {
      this._yRightAxisWidget?.setBounding(yRightAxisBounding)
    }
    return this
  }

  getMainWidget (): DrawWidget<DualYPane> { return this._mainWidget }

  getAxisWidget (position: string): YAxisWidget {
    if (position === 'left') {
      return this._yLeftAxisWidget
    } else if (position === 'right') {
      return this._yRightAxisWidget
    }
    throw new Error(`Invalid axis position: ${position}. Use 'left' or 'right'.`)
  }

  getYLeftAxisWidget (): YAxisWidget { return this._yLeftAxisWidget }
  getYRightAxisWidget (): YAxisWidget { return this._yRightAxisWidget }

  override updateImp (level: UpdateLevel): void {
    this._mainWidget.update(level)
    this._yLeftAxisWidget?.update(level)
    this._yRightAxisWidget?.update(level)
  }

  destroy (): void {
    super.destroy()
    this._mainWidget.destroy()
    this._yLeftAxisWidget?.destroy()
    this._yRightAxisWidget?.destroy()
  }

  override getImage (includeOverlay: boolean): HTMLCanvasElement {
    const { width, height } = this.getBounding()
    const canvas = createDom('canvas', {
      width: `${width}px`,
      height: `${height}px`,
      boxSizing: 'border-box'
    })
    const ctx = canvas.getContext('2d')!
    const pixelRatio = getPixelRatio(canvas)
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio
    ctx.scale(pixelRatio, pixelRatio)

    const mainBounding = this._mainWidget.getBounding()
    ctx.drawImage(
      this._mainWidget.getImage(includeOverlay),
      mainBounding.left, 0,
      mainBounding.width, mainBounding.height
    )

    // todo check here
    if (this._yLeftAxisWidget !== null) {
      const yAxisBounding = this._yLeftAxisWidget.getBounding()
      ctx.drawImage(
        this._yLeftAxisWidget.getImage(includeOverlay),
        yAxisBounding.left, 0,
        yAxisBounding.width, yAxisBounding.height
      )
    }
    return canvas
  }

  protected createYAxisWidget (container: HTMLElement, options: PaneOptions, position: Exclude<YAxisPosition, 'both'>): YAxisWidget { return new YAxisWidget(container, this, options, position) }

  protected abstract createMainWidget (container: HTMLElement): DrawWidget<DualYPane>
}
