import Animation from '../common/Animation'
import type Coordinate from '../common/Coordinate'
import { type GradientColor } from '../common/Styles'
import { UpdateLevel } from '../common/Updater'
import { isArray, isNumber, isValid } from '../common/utils/typeChecks'
import { createFigure, drawStaticFigure } from '../extension/figure'
import { getLineSymbolStepBySpacing, lineTo, smoothNormalize } from '../extension/figure/line'
import type DualYPane from '../pane/DualYPane'
import View from './View'

export default class CandleAreaView extends View {
  private readonly _ripplePoint = createFigure('circle')

  private _animationFrameTime = 0

  private readonly _animation = new Animation({ iterationCount: Infinity }).doFrame(time => {
    this._animationFrameTime = time
    const pane = this.getWidget().getPane()
    pane.getChart().updatePane(UpdateLevel.Main, pane.getId())
  })

  override drawImp(ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const chart = pane.getChart()
    const chartStore = chart.getChartStore()
    const timeScaleStore = chartStore.getTimeScaleStore()
    const dataList = chart.getDataList()
    const lastDataIndex = dataList.length - 1
    const bounding = widget.getBounding()
    const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
    const styles = chart.getStyles().candle.area
    let ripplePointCoordinate: Coordinate | undefined

    const visibleRange = timeScaleStore.getVisibleRange()
    const barSpace = timeScaleStore.getBarSpace()
    const isTimeShare = chartStore.getIsTimeShare()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const ticksPerDay = timeShareTicks.length
    const breakOnCrossDays = chartStore.getTimeShareBreakOnCrossDays()
    const lineSymbolStep = getLineSymbolStepBySpacing(
      {
        color: styles.lineColor,
        symbol: styles.symbol
      },
      barSpace.bar
    )
    const startDataIndex = Math.max(0, visibleRange.from)
    const endDataIndex = Math.min(lastDataIndex, visibleRange.to - 1)
    const isLastDataVisible = lastDataIndex >= visibleRange.from && lastDataIndex < visibleRange.to

    // 流式绘制：收集连续的坐标点
    const currentPath: Coordinate[] = []
    let currentPathStartDataIndex = -1
    let lastVisitedIndex = -1

    // 绘制当前路径并重置
    const drawCurrentPath = (): void => {
      if (currentPath.length >= 2) {
        // 绘制线条
        drawStaticFigure(ctx, 'line', {
          attrs: {
            coordinates: currentPath,
            startDataIndex: currentPathStartDataIndex,
            symbolStep: lineSymbolStep
          },
          styles: {
            color: styles.lineColor,
            size: styles.lineSize,
            smooth: styles.smooth,
            symbol: styles.symbol
          }
        })

        // 绘制区域填充
        if (!styles.lineOnly) {
          const backgroundColor = styles.backgroundColor
          let color: string | CanvasGradient
          let segmentMinY = currentPath[0].y
          for (let i = 1; i < currentPath.length; i++) {
            segmentMinY = Math.min(segmentMinY, currentPath[i].y)
          }
          if (isArray<GradientColor>(backgroundColor)) {
            const gradient = ctx.createLinearGradient(0, bounding.height, 0, segmentMinY)
            try {
              backgroundColor.forEach(({ offset, color }) => {
                gradient.addColorStop(offset, color)
              })
            } catch (_e) {
            }
            color = gradient
          } else {
            color = backgroundColor
          }
          ctx.save()
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(currentPath[0].x, bounding.height)
          ctx.lineTo(currentPath[0].x, currentPath[0].y)
          lineTo(ctx, currentPath, smoothNormalize(styles.smooth))
          ctx.lineTo(currentPath[currentPath.length - 1].x, bounding.height)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }
      currentPath.length = 0
      currentPathStartDataIndex = -1
      lastVisitedIndex = -1
    }

    // 流式处理每个数据点
    for (let dataIndex = startDataIndex; dataIndex <= endDataIndex; dataIndex++) {
      const kLineData = dataList[dataIndex]
      const x = timeScaleStore.dataIndexToCoordinate(dataIndex)
      const value = kLineData?.[styles.value]

      // 值无效 → 绘制当前路径并重置
      if (!isNumber(value)) {
        drawCurrentPath()
        continue
      }

      // 跨日检查 → 绘制当前路径并重置（仅当配置启用时）
      if (breakOnCrossDays && isTimeShare && ticksPerDay > 0 && dataIndex > startDataIndex) {
        if (dataIndex % ticksPerDay === 0) {
          drawCurrentPath()
        }
      }

      // 数据不连续 → 绘制当前路径并重置
      if (lastVisitedIndex !== -1 && lastVisitedIndex + 1 !== dataIndex) {
        drawCurrentPath()
      }

      const y = yAxis.convertToPixel(value)
      if (currentPath.length === 0) {
        currentPathStartDataIndex = dataIndex
      }
      currentPath.push({ x, y })
      lastVisitedIndex = dataIndex

      // 记录最后一个点用于涟漪效果
      if (isLastDataVisible && dataIndex === lastDataIndex) {
        ripplePointCoordinate = { x, y }
      }
    }

    // 绘制最后一段路径
    drawCurrentPath()

    const pointStyles = styles.point
    if (pointStyles.show && isValid(ripplePointCoordinate)) {
      drawStaticFigure(ctx, 'circle', {
        attrs: {
          x: ripplePointCoordinate.x,
          y: ripplePointCoordinate.y,
          r: pointStyles.radius
        },
        styles: {
          style: 'fill',
          color: pointStyles.color
        }
      })
      let rippleRadius = pointStyles.rippleRadius
      if (pointStyles.animation) {
        rippleRadius = pointStyles.radius + this._animationFrameTime / pointStyles.animationDuration * (pointStyles.rippleRadius - pointStyles.radius)
        this._animation.setDuration(pointStyles.animationDuration).start()
      }
      // todo maybe we should just drawStaticFigure here
      this._ripplePoint
        ?.setAttrs({
          x: ripplePointCoordinate.x,
          y: ripplePointCoordinate.y,
          r: rippleRadius
        })
        .setStyles({ style: 'fill', color: pointStyles.rippleColor }).draw(ctx)
    } else {
      this.stopAnimation()
    }
  }

  stopAnimation(): void {
    this._animation.stop()
  }
}
