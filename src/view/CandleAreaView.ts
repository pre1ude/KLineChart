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

import type Coordinate from '../common/Coordinate'
import type VisibleData from '../common/VisibleData'
import { type GradientColor } from '../common/Styles'
import Animation from '../common/Animation'
import { isNumber, isArray, isValid } from '../common/utils/typeChecks'
import { UpdateLevel } from '../common/Updater'
import View from './View'
import { lineTo } from '../extension/figure/line'
import type Nullable from '../common/Nullable'
import type DualYPane from '../pane/DualYPane'
import { createFigure, drawStaticFigure } from '../extension/figure'

export default class CandleAreaView extends View {
  private readonly _ripplePoint = createFigure('circle')

  private _animationFrameTime = 0

  private readonly _animation = new Animation({ iterationCount: Infinity }).doFrame((time) => {
    this._animationFrameTime = time
    const pane = this.getWidget().getPane()
    pane.getChart().updatePane(UpdateLevel.Main, pane.getId())
  })

  override drawImp (ctx: CanvasRenderingContext2D): void {
    const widget = this.getWidget()
    const pane = widget.getPane()
    const chart = pane.getChart()
    const chartStore = chart.getChartStore()
    const dataList = chart.getDataList()
    const lastDataIndex = dataList.length - 1
    const bounding = widget.getBounding()
    const yAxis = (pane as DualYPane).getYLeftAxisWidget().getAxisComponent()
    const styles = chart.getStyles().candle.area
    let ripplePointCoordinate: Nullable<Coordinate> = null

    const visibleDataList = chartStore.getVisibleDataList()
    const isTimeShare = chartStore.getIsTimeShare()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const ticksPerDay = timeShareTicks.length
    const breakOnCrossDays = chartStore.getTimeShareBreakOnCrossDays()

    // 流式绘制：收集连续的坐标点
    const currentPath: Coordinate[] = []
    let lastVisitedIndex = -1

    // 绘制当前路径并重置
    const drawCurrentPath = (): void => {
      if (currentPath.length >= 2) {
        // 绘制线条
        drawStaticFigure(ctx, 'line', {
          attrs: { coordinates: currentPath },
          styles: {
            color: styles.lineColor,
            size: styles.lineSize,
            smooth: styles.smooth
          }
        })

        // 绘制区域填充
        if (!styles.lineOnly) {
          const backgroundColor = styles.backgroundColor
          let color: string | CanvasGradient
          const segmentMinY = Math.min(...currentPath.map(c => c.y))
          if (isArray<GradientColor>(backgroundColor)) {
            const gradient = ctx.createLinearGradient(0, bounding.height, 0, segmentMinY)
            try {
              backgroundColor.forEach(({ offset, color }) => {
                gradient.addColorStop(offset, color)
              })
            } catch (e) {
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
          lineTo(ctx, currentPath, styles.smooth)
          ctx.lineTo(currentPath[currentPath.length - 1].x, bounding.height)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }
      currentPath.length = 0
      lastVisitedIndex = -1
    }

    // 流式处理每个数据点
    visibleDataList.forEach((data: VisibleData, index: number) => {
      const { data: kLineData, x, dataIndex } = data
      const value = kLineData?.[styles.value]

      // 值无效 → 绘制当前路径并重置
      if (!isNumber(value)) {
        drawCurrentPath()
        return
      }

      // 跨日检查 → 绘制当前路径并重置（仅当配置启用时）
      if (breakOnCrossDays && isTimeShare && ticksPerDay > 0 && index > 0) {
        if (dataIndex % ticksPerDay === 0) {
          drawCurrentPath()
        }
      }

      // 数据不连续 → 绘制当前路径并重置
      if (lastVisitedIndex !== -1 && lastVisitedIndex + 1 !== dataIndex) {
        drawCurrentPath()
      }

      const y = yAxis.convertToPixel(value)
      currentPath.push({ x, y })
      lastVisitedIndex = dataIndex

      // 记录最后一个点用于涟漪效果
      if (dataIndex === lastDataIndex) {
        ripplePointCoordinate = { x, y }
      }
    })

    // 绘制最后一段路径
    drawCurrentPath()

    const pointStyles = styles.point
    if (pointStyles.show && isValid(ripplePointCoordinate)) {
      drawStaticFigure(ctx, 'circle', {
        attrs: {
          x: ripplePointCoordinate!.x,
          y: ripplePointCoordinate!.y,
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
          x: ripplePointCoordinate!.x,
          y: ripplePointCoordinate!.y,
          r: rippleRadius
        })
        .setStyles({ style: 'fill', color: pointStyles.rippleColor }).draw(ctx)
    } else {
      this.stopAnimation()
    }
  }

  stopAnimation (): void {
    this._animation.stop()
  }
}
