/**
 * 标签位置计算工具函数
 */

import type { AxisStyle, StateTextStyle } from '../../common/Styles'

/**
 * 计算 Y 轴标签的 X 坐标
 * 与 YAxisView.createTickTexts 保持一致的对齐逻辑
 */
export function calculateYAxisLabelX(
  bounding: { width: number },
  yAxisStyles: AxisStyle,
  textStyles: { paddingLeft?: number, paddingRight?: number },
  isAlignLeft: boolean
): number {
  let x = 0
  const paddingLeft = textStyles.paddingLeft ?? 0
  const paddingRight = textStyles.paddingRight ?? 0

  if (isAlignLeft) {
    x = yAxisStyles.tickText.marginStart
    if (yAxisStyles.axisLine.show) {
      x += yAxisStyles.axisLine.size
    }
    if (yAxisStyles.tickLine.show) {
      x += yAxisStyles.tickLine.length
    }
    // 减去 paddingLeft，因为 text figure 会在绘制时加上
    x -= paddingLeft
  } else {
    x = bounding.width - yAxisStyles.tickText.marginEnd
    if (yAxisStyles.axisLine.show) {
      x -= yAxisStyles.axisLine.size
    }
    if (yAxisStyles.tickLine.show) {
      x -= yAxisStyles.tickLine.length
    }
    // 加上 paddingRight，因为 text figure 会在绘制时减去（align: 'right'）
    x += paddingRight
  }

  return x
}

/**
 * 计算 X 轴标签的 Y 坐标
 * 与 XAxisView.createTickTexts 保持一致的对齐逻辑
 */
export function calculateXAxisLabelY(
  xAxisStyles: AxisStyle,
  textStyles: StateTextStyle
): number {
  const axisLineSize = xAxisStyles.axisLine.size
  const tickLineLength = xAxisStyles.tickLine.show ? xAxisStyles.tickLine.length : 0
  const tickTextMarginStart = xAxisStyles.tickText.marginStart
  const paddingTop = textStyles.paddingTop ?? 0

  // 需要减去 paddingTop，因为 text figure 会在绘制时加上 paddingTop
  return axisLineSize + tickLineLength + tickTextMarginStart - paddingTop
}
