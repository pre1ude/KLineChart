export type TooltipValueDirection = -1 | 0 | 1

export interface TooltipDirectionStyle {
  show: boolean
  upColor: string
  downColor: string
}

export interface TooltipDirectionVisual {
  text: '↑' | '↓'
  color: string
}

const TOOLTIP_VALUE_DIRECTION_EPSILON = 1e-10

export function getTooltipValueDirection(curr: unknown, prev: unknown): TooltipValueDirection | undefined {
  if (typeof curr !== 'number' || !Number.isFinite(curr) || typeof prev !== 'number' || !Number.isFinite(prev)) {
    return undefined
  }
  const diff = curr - prev
  if (Math.abs(diff) <= TOOLTIP_VALUE_DIRECTION_EPSILON) {
    return 0
  }
  return diff > 0 ? 1 : -1
}

export function getTooltipDirectionVisual(
  direction: TooltipValueDirection | undefined,
  style: TooltipDirectionStyle | undefined
): TooltipDirectionVisual | undefined {
  if (!style?.show || (direction !== 1 && direction !== -1)) {
    return undefined
  }
  return {
    text: direction === 1 ? '↑' : '↓',
    color: direction === 1 ? style.upColor : style.downColor
  }
}
