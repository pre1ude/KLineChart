import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import type { Figure } from '../../component/Figure'
import { ActionType, type TooltipIconClickEventData } from '../../common/Action'
import type { TooltipIconIdentity } from '../../common/Tooltip'
import { UpdateLevel } from '../../common/Updater'
import IndicatorTooltipView from '../../view/IndicatorTooltipView'
import CandleTooltipView from '../../view/CandleTooltipView'
import TooltipDomRenderer from '../../view/TooltipDomRenderer'
import type { TooltipRenderModel } from '../../view/TooltipModel'
import type { TooltipRenderType } from '../../Options'

type TooltipView = IndicatorTooltipView | CandleTooltipView

abstract class BaseTooltipLayer implements Layer {
  abstract readonly name: string
  private readonly _widget: DrawWidget<DualYPane>
  private readonly _renderType: TooltipRenderType
  protected _tooltipView: TooltipView
  private _domRenderer: TooltipDomRenderer | null = null
  private _lastModel: TooltipRenderModel | null = null
  private _hoveredIcon: TooltipIconIdentity | null = null

  constructor(widget: DrawWidget<DualYPane>, view: TooltipView) {
    this._widget = widget
    this._renderType = widget.getPane().getChart().getChartStore().getTooltipStore().getRenderType()
    this._tooltipView = view
    this._initEvent()
    widget.addChild(this._tooltipView)
    if (this._renderType === 'dom') {
      this._domRenderer = new TooltipDomRenderer(this._widget, {
        onIconEnter: icon => { this._setHoveredIcon(icon) },
        onIconLeave: icon => {
          if (this._isSameIcon(this._hoveredIcon, icon)) {
            this._setHoveredIcon(null)
          }
        },
        onIconClick: icon => { this._executeIconClick(icon) }
      })
    }
  }

  isTooltipIconHovered = (): boolean => this._hoveredIcon != null

  private _extractIconInfo(target: unknown): TooltipIconClickEventData | null {
    const figure = target as Figure<unknown, unknown, TooltipIconClickEventData>
    return figure?.data ?? null
  }

  private _isSameIcon(a: TooltipIconIdentity | null, b: TooltipIconIdentity | null): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    return a.paneId === b.paneId && a.indicatorId === b.indicatorId && a.iconId === b.iconId
  }

  private _initEvent(): void {
    this._tooltipView.addEventListener('mouseMoveEvent', (event: MouseTouchEvent) => {
      const iconInfo = this._extractIconInfo(event.target)
      this._setHoveredIcon(iconInfo)
    })

    this._tooltipView.addEventListener('mouseClickEvent', (event: MouseTouchEvent) => {
      const iconInfo = this._extractIconInfo(event.target)
      if (iconInfo != null) {
        this._executeIconClick(iconInfo)
        // TODO: temp solution
        event.nativeEvent.stopPropagation()
      }
    })
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    const model = this._tooltipView.buildRenderModel()
    this._lastModel = model
    if (!this._modelContainsIcon(model, this._hoveredIcon)) {
      this._setHoveredIcon(null, false)
    }
    if (this._renderType === 'dom') {
      this._tooltipView.clear()
      this._domRenderer?.render(model)
    } else {
      this._tooltipView.drawModel(ctx, model, true, this._hoveredIcon)
    }
  }

  drawOverlayForExport = (ctx: CanvasRenderingContext2D): void => {
    if (this._renderType !== 'dom') {
      return
    }
    const model = this._lastModel
    if (model != null) {
      this._tooltipView.drawModel(ctx, model, false, null)
    }
  }

  destroy = (): void => {
    this._setHoveredIcon(null, false)
    this._domRenderer?.destroy()
    this._domRenderer = null
    this._lastModel = null
    this._tooltipView.clear()
  }

  private _setHoveredIcon(icon: TooltipIconIdentity | null, invalidateCanvas = true): void {
    if (this._isSameIcon(this._hoveredIcon, icon)) {
      return
    }
    this._hoveredIcon = icon
    const isCanvas = this._renderType === 'canvas'
    this._tooltipView.setHasHoverIcon(isCanvas && icon != null)
    this._domRenderer?.setHoveredIcon(icon)
    if (isCanvas && invalidateCanvas) {
      const chart = this._widget.getPane().getChart()
      chart.updatePane(UpdateLevel.Overlay, this._widget.getPane().getId())
    }
  }

  private _executeIconClick(icon: TooltipIconClickEventData): void {
    const actionStore = this._widget.getPane().getChart().getChartStore().getActionStore()
    actionStore.execute(ActionType.OnTooltipIconClick, { ...icon })
  }

  private _modelContainsIcon(model: TooltipRenderModel, icon: TooltipIconIdentity | null): boolean {
    if (icon == null || !model.visible) {
      return false
    }
    return model.blocks.some(block => (
      block.type === 'standard' &&
      block.paneId === icon.paneId &&
      block.indicatorId === icon.indicatorId &&
      block.contents.some(content => (
        content.type === 'icons' && content.icons.some(item => item.id === icon.iconId)
      ))
    ))
  }
}

export class IndicatorTooltipLayer extends BaseTooltipLayer {
  readonly name = 'indicatorTooltip'

  constructor(widget: DrawWidget<DualYPane>) {
    super(widget, new IndicatorTooltipView(widget))
  }
}

export class CandleTooltipLayer extends BaseTooltipLayer {
  readonly name = 'candleTooltip'

  constructor(widget: DrawWidget<DualYPane>) {
    super(widget, new CandleTooltipView(widget))
  }
}
