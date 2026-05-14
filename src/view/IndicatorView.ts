import { type IndicatorFigureData } from '@/widget/layer/IndicatorLayer'
import type Coordinate from '../common/Coordinate'
import { type IndicatorStyle, YAxisPosition } from '../common/Styles'
import type { EventName, MouseTouchEvent } from '../common/SyntheticEvent'
import { isNumber, isValid } from '../common/utils/typeChecks'
import { getFigureBaseStyles, getMergedDefaultStyles, isIndicatorFigureVisible, type Indicator, type IndicatorFigure, type IndicatorFigureAttrs, type IndicatorFigureStyle } from '../component/Indicator'
import { getIndicatorYAxisPosition } from '../component/YAxis'
import type YAxisImp from '../component/YAxis'
import { createFigure, drawStaticFigure } from '../extension/figure'
import { getLineSymbolStepBySpacing, resolveLineSymbolStyle } from '../extension/figure/line'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'
import type XAxisWidget from '../widget/XAxisWidget'
import View from './View'

// 指标结果数据类型，支持通过字符串键访问
type IndicatorResultData = Record<string, unknown>

export default class IndicatorView extends View {
  private _hoverInfo: IndicatorFigureData | null = null

  setHoverInfo(info: IndicatorFigureData | null): void {
    this._hoverInfo = info
  }

  getHoverInfo(): IndicatorFigureData | null {
    return this._hoverInfo
  }

  override checkEventOn(_event: MouseTouchEvent, name: EventName): boolean {
    return name === 'mouseMoveEvent' && this._hoverInfo != null
  }

  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const isMain = pane.getId() === PaneIdConstants.CANDLE
    const chart = pane.getChart()
    const globalYAxisPosition = chart.getStyles().yAxis.position
    const bounding = widget.getBounding()
    const xAxis = (chart.getXAxisPane().getMainWidget() as XAxisWidget).getAxisComponent()
    const yLeftAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
    const yRightAxis = (pane as DualYPane).getYRightAxisWidget().getAxisComponent()
    const chartStore = chart.getChartStore()
    const dataList = chartStore.getDataList()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const visibleRange = timeScaleStore.getVisibleRange()
    const paneIndicators = chartStore.getIndicatorStore().getInstances(pane.getId())
    const visibleDataList = chartStore.getVisibleDataList()
    const barSpace = chartStore.getTimeScaleStore().getBarSpace()
    const isTimeShare = chartStore.getIsTimeShare()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const ticksPerDay = timeShareTicks.length
    const breakOnCrossDays = chartStore.getTimeShareBreakOnCrossDays()

    function filterIndicatorsByAxisPosition(
      indicators: Indicator[],
      position: 'left' | 'right',
      yAxisPosition: YAxisPosition
    ): Indicator[] {
      const defaultPosition = yAxisPosition === YAxisPosition.Right
        ? YAxisPosition.Right
        : YAxisPosition.Left
      return indicators.filter(indicator => getIndicatorYAxisPosition(indicator, defaultPosition) === position)
    }

    function setCompositeOperation(zLevel: number): void {
      ctx.globalCompositeOperation = zLevel < 0 ? 'destination-over' : 'source-over'
    }

    function tryCustomDraw(indicator: Indicator, yAxis: YAxisImp, defaultStyles: IndicatorStyle): boolean {
      if (indicator.draw == null) return false

      ctx.save()
      const isCover = indicator.draw({
        ctx,
        kLineDataList: dataList,
        indicator,
        visibleRange,
        bounding,
        barSpace: timeScaleStore.getBarSpace(),
        defaultStyles,
        xAxis,
        yAxis
      }) ?? false
      ctx.restore()

      return isCover
    }

    const drawForAxis = (indicators: Indicator[], yAxis: YAxisImp): void => {
      indicators.forEach(indicator => {
        if (!indicator.visible) return

        setCompositeOperation(indicator.zLevel)

        const mergedDefaultStyles = getMergedDefaultStyles(indicator, chartStore.getStyles().indicator)

        const customDrawCovered = tryCustomDraw(indicator, yAxis, mergedDefaultStyles)
        if (customDrawCovered) return

        indicator.figures
          .map((figure, figureIndex) => ({
            figure,
            figureIndex,
            drawOrder: figure.drawOrder ?? 0
          }))
          .sort((a, b) => a.drawOrder - b.drawOrder || a.figureIndex - b.figureIndex)
          .forEach(({ figure, figureIndex }) => {
            drawSingleFigure(figure, figureIndex, indicator, mergedDefaultStyles, yAxis)
          })
      })
    }

    const drawSingleFigure = (
      figure: IndicatorFigure,
      figureIndex: number,
      indicator: Indicator,
      mergedDefaultStyles: IndicatorStyle,
      yAxis: YAxisImp
    ): void => {
      const figureStaticStyles = indicator.styles?.figures?.[figure.key] ?? {}
      if (figure.visible === false || figureStaticStyles.visible === false) {
        return
      }

      const type = figure.type ?? 'line'
      const baseStyles = getFigureBaseStyles(type, figureIndex, mergedDefaultStyles)
      const createFigureStyles = (dataIndex: number): IndicatorFigureStyle => {
        const figureDynamicStyles = figure.styles?.(dataIndex, indicator, dataList, mergedDefaultStyles)
        // figureStaticStyles 来自 FigureStyleConfig 联合类型，需要断言
        return mergeIndicatorFigureStyles(
          baseStyles,
          figureStaticStyles as unknown as IndicatorFigureStyle,
          figureDynamicStyles
        )
      }

      if (type === 'line') {
        // 线段类型：流式绘制
        drawLineStreaming(figure, createFigureStyles, indicator, yAxis)
      } else {
        // 其他类型：逐个绘制，创建 Figure 实例以支持交互
        for (const data of visibleDataList) {
          const { dataIndex, x } = data
          const resultData = indicator.result[dataIndex] as IndicatorResultData | undefined
          if (!isIndicatorFigureVisible(indicator, figure) || !isValid(resultData?.[figure.key])) continue

          const figureStyles = createFigureStyles(dataIndex)

          const attrs = figure.attrs?.(dataIndex, indicator, dataList, x, bounding, barSpace, xAxis, yAxis) ??
            computeDefaultAttrs(figure, dataIndex, indicator.result, x, yAxis)

          if (isValid<IndicatorFigureAttrs>(attrs)) {
            const figureType = type === 'bar' ? 'rect' : type
            const figureInstance = createFigure(figureType)

            figureInstance
              .setAttrs(attrs)
              .setStyles(figureStyles)
              .setData({
                dataIndex,
                indicator,
                figure
              })

            figureInstance.draw(ctx)
            // TODO: only when figure has event
            this.addChild(figureInstance)
          }
        }
      }
    }

    function drawLineStreaming(
      figure: IndicatorFigure,
      createFigureStyles: (dataIndex: number) => IndicatorFigureStyle,
      indicator: Indicator,
      yAxis: YAxisImp
    ): void {
      const key = figure.key
      const result = indicator.result
      const startDataIndex = Math.max(0, visibleRange.from)
      const endDataIndex = Math.min(result.length - 1, visibleRange.to)

      const currentPath: Coordinate[] = []
      let currentStyles: IndicatorFigureStyle | null = null
      let currentSymbolStep = 1
      let currentPathStartDataIndex = -1
      let lastDataIndex = -1

      // 绘制当前 path 并重置
      const drawCurrentPath = (): void => {
        if (currentPath.length >= 2 && currentStyles) {
          drawStaticFigure(ctx, 'line', {
            attrs: {
              coordinates: currentPath,
              startDataIndex: currentPathStartDataIndex,
              symbolStep: currentSymbolStep
            },
            styles: currentStyles
          })
        }
        currentPath.length = 0
        currentStyles = null
        currentSymbolStep = 1
        currentPathStartDataIndex = -1
      }

      for (let dataIndex = startDataIndex; dataIndex < endDataIndex; dataIndex++) {
        const currentResultData = result[dataIndex] as IndicatorResultData | undefined
        const nextResultData = result[dataIndex + 1] as IndicatorResultData | undefined
        const currentValue = currentResultData?.[key]
        const nextValue = nextResultData?.[key]

        // 值无效 → 绘制当前 path 并重置
        if (!isNumber(currentValue) || !isNumber(nextValue)) {
          drawCurrentPath()
          lastDataIndex = -1
          continue
        }

        // 跨日检查 → 绘制当前 path 并重置（仅当配置启用时）
        if (breakOnCrossDays && isTimeShare && ticksPerDay > 0) {
          if ((dataIndex + 1) % ticksPerDay === 0) {
            drawCurrentPath()
            lastDataIndex = -1
            continue
          }
        }

        // 数据不连续 → 绘制当前 path 并重置
        if (lastDataIndex !== -1 && lastDataIndex !== dataIndex) {
          drawCurrentPath()
        }

        const figureStyles = createFigureStyles(dataIndex)

        // 样式变化 → 绘制当前 path 并重置
        if (currentStyles && !isSameStyle(currentStyles, figureStyles)) {
          drawCurrentPath()
        }

        const x = xAxis.convertToPixel(dataIndex)
        const y1 = yAxis.convertToPixel(currentValue)
        const x2 = xAxis.convertToPixel(dataIndex + 1)
        const y2 = yAxis.convertToPixel(nextValue)

        if (currentPath.length === 0) {
          currentPath.push({ x, y: y1 }, { x: x2, y: y2 })
          currentPathStartDataIndex = dataIndex
          currentStyles = figureStyles
          currentSymbolStep = getLineSymbolStepBySpacing(figureStyles, barSpace.bar)
        } else {
          currentPath.push({ x: x2, y: y2 })
        }

        lastDataIndex = dataIndex + 1
      }

      drawCurrentPath()
    }

    function computeDefaultAttrs(
      figure: IndicatorFigure,
      dataIndex: number,
      result: unknown[],
      x: number,
      yAxis: YAxisImp
    ): IndicatorFigureAttrs | undefined {
      const type = figure.type ?? 'line'
      const resultData = result[dataIndex] as IndicatorResultData | undefined
      const value = resultData?.[figure.key]
      if (!isNumber(value)) return

      const { halfGapBar } = barSpace
      const valueY = yAxis.convertToPixel(value)

      if (type === 'circle') {
        return { x, y: valueY, r: Math.max(1, halfGapBar) }
      }

      if (type === 'rect' || type === 'bar') {
        const baseValue = figure.baseValue ?? yAxis.getRange().from
        const baseValueY = yAxis.convertToPixel(baseValue)
        let height = Math.abs(baseValueY - valueY)
        if (baseValue !== value) {
          height = Math.max(1, height)
        }
        const y = valueY > baseValueY ? baseValueY : valueY
        return {
          x: x - halfGapBar,
          y,
          width: Math.max(1, halfGapBar * 2),
          height
        }
      }

      return undefined
    }

    // 执行绘制
    ctx.save()
    if (isMain) {
      // 在主图
      drawForAxis(paneIndicators, yLeftAxis)
    } else {
      // 在副图
      drawForAxis(filterIndicatorsByAxisPosition(paneIndicators, YAxisPosition.Left, globalYAxisPosition), yLeftAxis)
      drawForAxis(filterIndicatorsByAxisPosition(paneIndicators, YAxisPosition.Right, globalYAxisPosition), yRightAxis)
    }
    ctx.restore()
  }
}

function mergeIndicatorFigureStyles(...stylesList: Array<IndicatorFigureStyle | undefined>): IndicatorFigureStyle {
  const result:IndicatorFigureStyle = {}
  let symbol = result.symbol

  stylesList.forEach(styles => {
    if (!styles) {
      return
    }

    Object.assign(result, styles)

    if (styles.symbol) {
      symbol = {
        ...(symbol ?? {}),
        ...styles.symbol
      }
    }
  })

  if (symbol) {
    result.symbol = symbol
  }

  return result
}

function isSameStyle(a: IndicatorFigureStyle, b: IndicatorFigureStyle): boolean {
  if (a === b) return true

  const symbolA = resolveLineSymbolStyle(a)
  const symbolB = resolveLineSymbolStyle(b)
  if (
    a.style !== b.style ||
    a.color !== b.color ||
    a.size !== b.size ||
    a.smooth !== b.smooth ||
    symbolA.show !== symbolB.show ||
    symbolA.radius !== symbolB.radius ||
    symbolA.borderSize !== symbolB.borderSize ||
    symbolA.fillColor !== symbolB.fillColor ||
    symbolA.borderColor !== symbolB.borderColor ||
    symbolA.minSpacing !== symbolB.minSpacing
  ) {
    return false
  }

  // 安全比较 dashedValue 数组
  const da = a.dashedValue
  const db = b.dashedValue
  if (da === db) return true
  if (da == null || db == null) return false
  if (da?.length !== db?.length) return false
  return da.every((v, i) => v === db[i])
}
