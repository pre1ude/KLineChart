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
    const coordinates: Coordinate[] = []
    let minY = Number.MAX_SAFE_INTEGER
    let areaStartX: number = Number.MIN_SAFE_INTEGER
    let ripplePointCoordinate: Nullable<Coordinate> = null

    const visibleDataList = chartStore.getVisibleDataList()
    const isTimeShare = chartStore.getIsTimeShare()
    const timeShareTicks = chartStore.getTimeShareTicks()
    const ticksPerDay = timeShareTicks.length

    visibleDataList.forEach((data: VisibleData, index: number) => {
      const { data: kLineData, x, dataIndex } = data
      const value = kLineData?.[styles.value]
      if (isNumber(value)) {
        const y = yAxis.convertToPixel(value)

        // 在多日分时图中，检查是否是新的一天的开始
        if (isTimeShare && ticksPerDay > 0 && index > 0) {
          // 如果跨天了，需要断开连接
          if (dataIndex % ticksPerDay === 0) {
            // 使用 NaN 分隔符
            coordinates.push({ x: NaN, y: NaN })
          }
        }

        if (areaStartX === Number.MIN_SAFE_INTEGER) {
          areaStartX = x
        }
        coordinates.push({ x, y })
        minY = Math.min(minY, y)
        if (dataIndex === lastDataIndex) {
          ripplePointCoordinate = { x, y }
        }
      }
    })

    if (coordinates.length > 0) {
      // 将坐标分割成多个线段（根据 NaN 分隔符）
      const segments: Coordinate[][] = []
      let currentSegment: Coordinate[] = []

      coordinates.forEach(coord => {
        if (isNaN(coord.x) || isNaN(coord.y)) {
          // 遇到分隔符，保存当前线段并开始新线段
          if (currentSegment.length > 0) {
            segments.push(currentSegment)
            currentSegment = []
          }
        } else {
          currentSegment.push(coord)
        }
      })

      // 最后一条线段
      if (currentSegment.length > 0) {
        segments.push(currentSegment)
      }

      // 绘制每个线段
      segments.forEach(segment => {
        if (segment.length > 0) {
          drawStaticFigure(ctx, 'line', {
            attrs: { coordinates: segment },
            styles: {
              color: styles.lineColor,
              size: styles.lineSize,
              smooth: styles.smooth
            }
          })

          if (!styles.lineOnly) {
            // render area
            const backgroundColor = styles.backgroundColor
            let color: string | CanvasGradient
            const segmentMinY = Math.min(...segment.map(c => c.y))
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
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.moveTo(segment[0].x, bounding.height)
            ctx.lineTo(segment[0].x, segment[0].y)
            lineTo(ctx, segment, styles.smooth)
            ctx.lineTo(segment[segment.length - 1].x, bounding.height)
            ctx.closePath()
            ctx.fill()
          }
        }
      })
    }

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
