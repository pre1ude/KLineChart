import { isPointInBounding } from '@/common/Bounding'
import { type EventName, type MouseTouchEvent } from '@/common/SyntheticEvent'
import type BarSpace from '../common/BarSpace'
import { CandleType, PolygonType, type CandleBarColor, type RectStyle } from '../common/Styles'
import { isValid } from '../common/utils/typeChecks'
import { type FigureCreate } from '../component/Figure'
import { createFigure } from '../extension/figure'
import { type RectAttrs } from '../extension/figure/rect'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'
import type ChartStore from '../store/ChartStore'
import View from './View'

export interface CandleBarOptions {
  type: Exclude<CandleType, CandleType.Area>
  styles: CandleBarColor
}

export type CandleHitTestMode = 'body' | 'full'

export default class CandleBarView extends View {
  // 响应点击和右键事件，仅蜡烛图类型走命中测试
  override checkEventOn(event: MouseTouchEvent, name: EventName): boolean {
    if (name !== 'contextMenuEvent' && name !== 'mouseClickEvent') {
      return false
    }
    const pane = this.getWidget().getPane()
    const chartStore = pane.getChart().getChartStore()
    const candleBarOptions = this.getCandleBarOptions(chartStore)
    if (candleBarOptions == null) {
      return false
    }
    // 仅蜡烛图类型走 hitTest，非蜡烛图类型返回 false
    const isCandleType = candleBarOptions.type !== CandleType.Ohlc
    if (!isCandleType) {
      return false
    }
    return this.candleBarHitTest('body', { x: event.x, y: event.y })
  }

  /**
   * K线命中测试
   * @param mode 命中测试模式：'body' 只检测实体部分，'full' 检测整个K线范围(high-low)
   * @returns 是否命中K线
   */
  candleBarHitTest(mode: CandleHitTestMode, point: { x: number, y: number }): boolean {
    const pane = this.getWidget().getPane()
    const chartStore = pane.getChart().getChartStore()
    const candleBarOptions = this.getCandleBarOptions(chartStore)
    if (candleBarOptions == null) {
      return false
    }

    const timeScaleStore = chartStore.getTimeScaleStore()
    const dataIndex = timeScaleStore.coordinateToDataIndex(point.x)
    if (dataIndex == null) {
      return false
    }

    const visibleDataList = chartStore.getVisibleDataList()
    const visibleData = visibleDataList.find(d => d.dataIndex === dataIndex)
    if (visibleData?.data == null) {
      return false
    }

    const { data: kLineData, x: barX } = visibleData
    const { open, high, low, close } = kLineData
    const barSpace = timeScaleStore.getBarSpace()

    const widget = (pane as DualYPane).getYLeftAxisWidget()
    const yAxis = widget.getAxisComponent()

    let top: number
    let bottom: number

    if (mode === 'full') {
      // full 模式：使用 high-low 范围
      const highY = yAxis.convertToPixel(high)
      const lowY = yAxis.convertToPixel(low)
      top = Math.min(highY, lowY)
      bottom = Math.max(highY, lowY)
    } else {
      // body 模式：使用 open-close 实体范围
      const openY = yAxis.convertToPixel(open)
      const closeY = yAxis.convertToPixel(close)
      top = Math.min(openY, closeY)
      bottom = Math.max(openY, closeY)
    }

    const height = Math.max(1, bottom - top)
    const left = barX - barSpace.halfGapBar

    return isPointInBounding({ left, top, width: barSpace.gapBar, height }, point)
  }

  override drawImp(ctx: CanvasRenderingContext2D): void {
    const pane = this.getWidget().getPane()
    const chartStore = pane.getChart().getChartStore()
    const candleBarOptions = this.getCandleBarOptions(chartStore)
    if (candleBarOptions != null) {
      let ohlcSize = 0
      let halfOhlcSize = 0
      if (candleBarOptions.type === CandleType.Ohlc) {
        const gapBar = chartStore.getTimeScaleStore().getBarSpace().gapBar
        ohlcSize = Math.min(Math.max(Math.round(gapBar * 0.2), 1), 8)
        if (ohlcSize > 2 && ohlcSize % 2 === 1) {
          ohlcSize--
        }
        halfOhlcSize = Math.floor(ohlcSize / 2)
      }
      // todo use left
      const widget = (pane as DualYPane).getYLeftAxisWidget()
      const yAxis = widget.getAxisComponent()
      const visibleDataList = chartStore.getVisibleDataList()
      const barSpace = chartStore.getTimeScaleStore().getBarSpace()

      visibleDataList.forEach(data => {
        const { data: kLineData, x } = data
        if (isValid(kLineData)) {
          const { open, high, low, close } = kLineData
          const { type, styles } = candleBarOptions
          const colors: string[] = []
          if (close > open) {
            colors[0] = styles.upColor
            colors[1] = styles.upBorderColor
            colors[2] = styles.upWickColor
          } else if (close < open) {
            colors[0] = styles.downColor
            colors[1] = styles.downBorderColor
            colors[2] = styles.downWickColor
          } else {
            colors[0] = styles.noChangeColor
            colors[1] = styles.noChangeBorderColor
            colors[2] = styles.noChangeWickColor
          }
          const openY = yAxis.convertToPixel(open)
          const closeY = yAxis.convertToPixel(close)
          const priceY = [
            openY, closeY,
            yAxis.convertToPixel(high),
            yAxis.convertToPixel(low)
          ]
          priceY.sort((a, b) => a - b)

          let rects: Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> = []
          switch (type) {
            case CandleType.CandleSolid: {
              rects = this._createSolidBar(x, priceY, barSpace, colors)
              break
            }
            case CandleType.CandleStroke: {
              rects = this._createStrokeBar(x, priceY, barSpace, colors)
              break
            }
            case CandleType.CandleUpStroke: {
              if (close > open) {
                rects = this._createStrokeBar(x, priceY, barSpace, colors)
              } else {
                rects = this._createSolidBar(x, priceY, barSpace, colors)
              }
              break
            }
            case CandleType.CandleDownStroke: {
              if (open > close) {
                rects = this._createStrokeBar(x, priceY, barSpace, colors)
              } else {
                rects = this._createSolidBar(x, priceY, barSpace, colors)
              }
              break
            }
            case CandleType.Ohlc: {
              rects = [
                {
                  name: 'rect',
                  attrs: [
                    {
                      x: x - halfOhlcSize,
                      y: priceY[0],
                      width: ohlcSize,
                      height: priceY[3] - priceY[0]
                    },
                    {
                      x: x - barSpace.halfGapBar,
                      y: openY + ohlcSize > priceY[3] ? priceY[3] - ohlcSize : openY,
                      width: barSpace.halfGapBar - halfOhlcSize,
                      height: ohlcSize
                    },
                    {
                      x: x + halfOhlcSize,
                      y: closeY + ohlcSize > priceY[3] ? priceY[3] - ohlcSize : closeY,
                      width: barSpace.halfGapBar - halfOhlcSize,
                      height: ohlcSize
                    }
                  ],
                  styles: { color: colors[0] }
                }
              ]
              break
            }
          }

          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i]
            const { attrs, styles } = rect
            const attrsArr = Array.isArray(attrs) ? attrs : [attrs]
            const figureInstance = createFigure(rect.name)
            figureInstance.setAttrs(attrsArr).setStyles(styles).draw(ctx)
          }
        }
      })
    }
  }

  protected getCandleBarOptions(chartStore: ChartStore): CandleBarOptions | undefined {
    const pane = this.getWidget().getPane()
    const paneId = pane.getId()
    const isMain = paneId === PaneIdConstants.CANDLE

    if (isMain) {
      // 主图：使用蜡烛图样式
      const candleStyles = chartStore.getStyles().candle
      return {
        type: candleStyles.type as Exclude<CandleType, CandleType.Area>,
        styles: candleStyles.bar
      }
    }
    // 副图：检查是否有指标需要 OHLC
    const indicators = chartStore.getIndicatorStore().getInstances(paneId)
    for (const indicator of indicators) {
      if (indicator.shouldOhlc && indicator.visible) {
        const defaultOhlcStyles = chartStore.getStyles().indicator.ohlc
        const ohlcStyles = {
          ...defaultOhlcStyles,
          ...indicator.styles?.ohlc
        }
        const upColor = ohlcStyles.upColor
        const downColor = ohlcStyles.downColor
        const noChangeColor = ohlcStyles.noChangeColor
        return {
          type: CandleType.Ohlc,
          styles: {
            upColor,
            downColor,
            noChangeColor,
            upBorderColor: upColor,
            downBorderColor: downColor,
            noChangeBorderColor: noChangeColor,
            upWickColor: upColor,
            downWickColor: downColor,
            noChangeWickColor: noChangeColor
          }
        }
      }
    }

    return undefined
  }

  private _createSolidBar(x: number, priceY: number[], barSpace: BarSpace, colors: string[]): Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> {
    return [
      {
        name: 'rect',
        attrs: {
          x,
          y: priceY[0],
          width: 1,
          height: priceY[3] - priceY[0]
        },
        styles: { color: colors[2] }
      },
      {
        name: 'rect',
        attrs: {
          x: x - barSpace.halfGapBar,
          y: priceY[1],
          width: barSpace.gapBar,
          height: Math.max(1, priceY[2] - priceY[1])
        },
        styles: {
          style: PolygonType.StrokeFill,
          color: colors[0],
          borderColor: colors[1]
        }
      }
    ]
  }

  private _createStrokeBar(x: number, priceY: number[], barSpace: BarSpace, colors: string[]): Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> {
    return [
      {
        name: 'rect',
        attrs: [
          {
            x,
            y: priceY[0],
            width: 1,
            height: priceY[1] - priceY[0]
          },
          {
            x,
            y: priceY[2],
            width: 1,
            height: priceY[3] - priceY[2]
          }
        ],
        styles: { color: colors[2] }
      },
      {
        name: 'rect',
        attrs: {
          x: x - barSpace.halfGapBar,
          y: priceY[1],
          width: barSpace.gapBar,
          height: Math.max(1, priceY[2] - priceY[1])
        },
        styles: {
          style: PolygonType.Stroke,
          borderColor: colors[1]
        }
      }
    ]
  }
}
