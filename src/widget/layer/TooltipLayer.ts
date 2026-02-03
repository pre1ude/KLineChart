import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import type { Figure } from '../../component/Figure'
import { type TooltipIcon } from '../../store/TooltipStore'
import { ActionType } from '../../common/Action'
import IndicatorTooltipView from '../../view/IndicatorTooltipView'
import CandleTooltipView from '../../view/CandleTooltipView'

type TooltipView = IndicatorTooltipView | CandleTooltipView

abstract class BaseTooltipLayer implements Layer {
  abstract readonly name: string
  protected _tooltipView: TooltipView
  private _hoverIconInfo: TooltipIcon | null = null

  constructor(widget: DrawWidget<DualYPane>, view: TooltipView) {
    this._tooltipView = view
    this._initEvent(widget)
    widget.addChild(this._tooltipView)
  }

  private _extractIconInfo(target: unknown): TooltipIcon | null {
    const figure = target as Figure<unknown, unknown, TooltipIcon>
    return figure?.data ?? null
  }

  private _isSameIcon(a: TooltipIcon | null, b: TooltipIcon | null): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    return a.paneId === b.paneId && a.indicatorId === b.indicatorId && a.iconId === b.iconId
  }

  private _initEvent(widget: DrawWidget<DualYPane>): void {
    const chart = widget.getPane().getChart()

    this._tooltipView.addEventListener('mouseMoveEvent', (event: MouseTouchEvent) => {
      const iconInfo = this._extractIconInfo(event.target)
      if (!this._isSameIcon(this._hoverIconInfo, iconInfo)) {
        this._hoverIconInfo = iconInfo
        this._tooltipView.setHasHoverIcon(iconInfo != null)
        chart.getChartStore().getTooltipStore().setActiveIcon(iconInfo)
      }
    })

    this._tooltipView.addEventListener('mouseClickEvent', (event: MouseTouchEvent) => {
      const iconInfo = this._extractIconInfo(event.target)
      if (iconInfo != null) {
        chart.getChartStore().getActionStore().execute(ActionType.OnTooltipIconClick, { ...iconInfo })
        // TODO: temp solution
        event.nativeEvent.stopPropagation()
      }
    })
  }

  drawOverlay = (ctx: CanvasRenderingContext2D): void => {
    this._tooltipView?.draw(ctx)
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
