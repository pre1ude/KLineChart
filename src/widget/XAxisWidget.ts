
import { WidgetNameConstants } from './types'
import DrawWidget from './DrawWidget'
import type SingleWidgetPane from '../pane/SingleWidgetPane'
import type XAxis from '../component/XAxis'
import XAxisView from '../view/XAxisView'
import OverlayView from '../view/OverlayView'
import CrosshairVerticalLabelView from '../view/CrosshairVerticalLabelView'
import { isString, isValid } from '../common/utils/typeChecks'
import { getXAxisClass } from '../extension/x-axis'
import type { PaneAxisOptions, PaneOptions } from '../pane/types'
import { setCursor } from '../common/utils/cursor'

// ? XAxisWidget can only be used in SingleWidgetPane
export default class XAxisWidget extends DrawWidget<SingleWidgetPane> {
  private _axis!: XAxis
  private _axisOptions: PaneAxisOptions = {
    name: 'default',
    scrollZoomEnabled: true
  }

  private readonly _xAxisView = new XAxisView(this)
  private readonly _overlayXAxisView = new OverlayView(this, 'xAxis')
  private readonly _crosshairVerticalLabelView = new CrosshairVerticalLabelView(this)

  constructor(rootContainer: HTMLElement, pane: SingleWidgetPane, options: PaneOptions) {
    super(rootContainer, pane)

    setCursor(this.getContainer(), 'ew-resize')
    this.addChild(this._overlayXAxisView)
    this.setOptions(options.axisOptions ?? { name: 'default', scrollZoomEnabled: true })
  }

  getOptions(): PaneAxisOptions {
    return this._axisOptions
  }

  setOptions(options: PaneAxisOptions): void {
    const name = options?.name
    if (
      (this._axisOptions.name !== name && isString(name)) ||
      !isValid(this._axis)
    ) {
      this._axis = this.createAxisComponent(name ?? 'default')
    }
    this._axisOptions = options
  }

  createAxisComponent(name: string): XAxis {
    const XAxisClass = getXAxisClass(name)
    return new XAxisClass(this)
  }

  getAxisComponent(): XAxis {
    return this._axis
  }

  override getName(): string {
    return WidgetNameConstants.X_AXIS
  }

  override updateMain(ctx: CanvasRenderingContext2D): void {
    this._xAxisView.draw(ctx)
  }

  override updateOverlay(ctx: CanvasRenderingContext2D): void {
    this._overlayXAxisView.draw(ctx)
    this._crosshairVerticalLabelView.draw(ctx)
  }
}
