

import type BarSpace from '../common/BarSpace'
import { CandleType, type CandleBarColor, type RectStyle, PolygonType } from '../common/Styles'
import type ChartStore from '../store/ChartStore'
import { type FigureCreate } from '../component/Figure'
import { FigureGroup } from '../component/FigureGroup'
import { type RectAttrs } from '../extension/figure/rect'
import View from './View'
import { isValid } from '../common/utils/typeChecks'
import type DualYPane from '../pane/DualYPane'
import { createFigure } from '../extension/figure'
import { PaneIdConstants } from '../pane/types'

export interface CandleBarOptions {
  type: Exclude<CandleType, CandleType.Area>
  styles: CandleBarColor
}

export default class CandleBarView extends View {
  override drawImp (ctx: CanvasRenderingContext2D): void {
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
        halfOhlcSize = Math.floor(halfOhlcSize / 2)
      }
      // todo use left
      const widget = (pane as DualYPane).getYLeftAxisWidget()
      const yAxis = widget.getAxisComponent()
      const visibleDataList = chartStore.getVisibleDataList()
      const barSpace = chartStore.getTimeScaleStore().getBarSpace()

      visibleDataList.forEach((data) => {
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
                      width: barSpace.halfGapBar,
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
          // 使用 FigureGroup 将同一个蜡烛的所有图形组合在一起
          const group = new FigureGroup()

          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i]
            const { attrs, styles } = rect
            const attrsArr = Array.isArray(attrs) ? attrs : [attrs]
            const figureInstance = createFigure(rect.name)
            figureInstance.setAttrs(attrsArr).setStyles(styles).setData(data.dataIndex)
            group.addChild(figureInstance)
          }

          group.draw(ctx)
          this.addChild(group)
        }
      })
    }
  }

  protected getCandleBarOptions (chartStore: ChartStore): CandleBarOptions | undefined {
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
    } else {
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
    }
    return undefined
  }

  private _createSolidBar (x: number, priceY: number[], barSpace: BarSpace, colors: string[]): Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> {
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

  private _createStrokeBar (x: number, priceY: number[], barSpace: BarSpace, colors: string[]): Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> {
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
