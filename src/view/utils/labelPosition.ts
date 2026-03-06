/**
 * 标签位置计算工具函数
 */

import type { AxisStyle, StateTextStyle } from '../../common/Styles'

export interface YAxisLabelLayout {
  x: number
  align: 'left' | 'right'
  paddingLeft: number
  paddingRight: number
}

export interface XAxisLabelLayout {
  y: number
  baseline: 'top'
  paddingTop: number
  paddingBottom: number
}

/**
 * 计算 Y 轴标签布局：
 * - 背景贴住 axisLine 外侧边缘（不压住 axisLine）
 * - 文本仍与 tick 文本对齐
 */
export function calculateYAxisLabelLayout(
  bounding: { width: number },
  yAxisStyles: AxisStyle,
  textStyles: { paddingLeft?: number, paddingRight?: number },
  isAlignLeft: boolean
): YAxisLabelLayout {
  const paddingLeft = textStyles.paddingLeft ?? 0
  const paddingRight = textStyles.paddingRight ?? 0
  const axisLineSize = yAxisStyles.axisLine.show ? yAxisStyles.axisLine.size : 0
  let axisTextOffset = isAlignLeft ? yAxisStyles.tickText.marginStart : yAxisStyles.tickText.marginEnd

  if (yAxisStyles.tickLine.show) {
    axisTextOffset += yAxisStyles.tickLine.length
  }

  if (isAlignLeft) {
    return {
      x: axisLineSize,
      align: 'left',
      paddingLeft: axisTextOffset,
      paddingRight
    }
  }

  return {
    x: bounding.width - axisLineSize,
    align: 'right',
    paddingLeft,
    paddingRight: axisTextOffset
  }
}

/**
 * 计算 X 轴标签布局：
 * - 背景贴住 axisLine 外侧边缘（不压住 axisLine）
 * - 文本仍与 tick 文本对齐
 */
export function calculateXAxisLabelLayout(
  xAxisStyles: AxisStyle,
  textStyles: StateTextStyle
): XAxisLabelLayout {
  const axisLineSize = xAxisStyles.axisLine.show ? xAxisStyles.axisLine.size : 0
  const tickLineLength = xAxisStyles.tickLine.show ? xAxisStyles.tickLine.length : 0
  const tickTextMarginStart = xAxisStyles.tickText.marginStart
  const paddingBottom = textStyles.paddingBottom ?? 0

  return {
    y: axisLineSize,
    baseline: 'top',
    paddingTop: tickLineLength + tickTextMarginStart,
    paddingBottom
  }
}
