import type { Layer } from './Layer'
import type DrawWidget from '../DrawWidget'
import type DualYPane from '../../pane/DualYPane'
import IndicatorView from '../../view/IndicatorView'
import CandleBarView from '../../view/CandleBarView'
import { PaneIdConstants } from '../../pane/types'
import type { MouseTouchEvent } from '../../common/SyntheticEvent'
import type { Figure } from '../../component/Figure'
import type { Indicator, IndicatorFigure } from '../../component/Indicator'

export interface IndicatorFigureData {
  dataIndex: number
  figure: IndicatorFigure
  indicator: Indicator
}

export type IndicatorFigureInstance = Figure<unknown, unknown, IndicatorFigureData>

/**
 * 指标图层
 * 负责绘制所有指标
 */
export class IndicatorLayer implements Layer {
  readonly name = 'indicator'
  private _indicatorView: IndicatorView
  private _candleBarView?: CandleBarView

  constructor(widget: DrawWidget<DualYPane>) {
    this._indicatorView = new IndicatorView(widget)

    // 初始化事件处理
    this._initEvent(widget)
    widget.addChild(this._indicatorView)

    // 如果不是主图，可能需要绘制 OHLC 蜡烛图（仅用于渲染，不需要事件处理）
    const pane = widget.getPane()
    const isMain = pane.getId() === PaneIdConstants.CANDLE
    if (!isMain) {
      this._candleBarView = new CandleBarView(widget)
    }
  }

  private _isSameFigure(a: IndicatorFigureData | null, b: IndicatorFigureData | null): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    return a.indicator.id === b.indicator.id && a.figure.key === b.figure.key
  }

  private _isSameIndicator(a: IndicatorFigureData | null, b: IndicatorFigureData | null): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    return a.indicator.id === b.indicator.id
  }

  private _initEvent(widget: DrawWidget<DualYPane>): void {
    this._indicatorView.addEventListener('mouseMoveEvent', (e: MouseTouchEvent) => {
      const currentHoverInfo = e.target as IndicatorFigureInstance | undefined
      const currentFigureData = currentHoverInfo?.data ?? null
      const lastHoverFigureData = this._indicatorView.getHoverInfo()

      if (!this._isSameFigure(lastHoverFigureData, currentFigureData)) {
        const chartStore = widget.getPane().getChart().getChartStore()
        const dataList = chartStore.getDataList()

        // 触发 onMouseLeave（当从一个 figure 切换到另一个，或者移出所有 figure）
        if (lastHoverFigureData != null) {
          const { dataIndex, indicator, figure } = lastHoverFigureData
          figure.onMouseLeave?.(e, { dataIndex, dataList, figure, indicator })
          if (!this._isSameIndicator(lastHoverFigureData, currentFigureData)) {
            indicator.onMouseLeave?.(e, { dataIndex, dataList, figure, indicator })
          }
        }

        // 触发 onMouseEnter（仅当移入一个新的 figure）
        if (currentFigureData != null) {
          const { dataIndex, indicator, figure } = currentFigureData
          figure.onMouseEnter?.(e, { dataIndex, dataList, figure, indicator })
          if (!this._isSameIndicator(lastHoverFigureData, currentFigureData)) {
            indicator.onMouseEnter?.(e, { dataIndex, dataList, figure, indicator })
          }
        }

        this._indicatorView.setHoverInfo(currentFigureData)
      }
    })

    // 鼠标点击事件
    this._indicatorView.addEventListener('mouseClickEvent', (e: MouseTouchEvent) => {
      const chartStore = widget.getPane().getChart().getChartStore()
      const dataList = chartStore.getDataList()
      const target = e.target as IndicatorFigureInstance | undefined

      if (target != null) {
        const figureData = target.data
        if (figureData != null) {
          const { dataIndex, indicator, figure } = figureData

          // 触发指标的 figure 点击事件
          figure.onClick?.(e, { dataIndex, dataList, figure, indicator })

          // 触发指标的通用点击事件
          indicator.onClick?.(e, { dataIndex, dataList, figure, indicator })
        }
      }
    })
  }

  drawMain = (ctx: CanvasRenderingContext2D): void => {
    // 先绘制 OHLC 蜡烛图（如果有）
    this._candleBarView?.draw(ctx)
    // 再绘制指标
    this._indicatorView.draw(ctx)
  }
}
