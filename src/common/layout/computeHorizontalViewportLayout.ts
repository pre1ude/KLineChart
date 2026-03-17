import { YAxisPosition } from '../Styles'

export type HorizontalViewportSizes = [leftWidth: number, mainWidth: number, rightWidth: number]

export interface HorizontalViewportBounds {
  totalWidth: number
  main: { left: number, width: number }
  leftAxis: { left: number, width: number }
  rightAxis: { left: number, width: number }
}

function normalizePx(value: number): number {
  return Math.max(0, Math.ceil(value))
}

export function computeHorizontalViewportSizes(params: {
  totalWidth: number
  leftAxisWidth: number
  rightAxisWidth: number
  inside: boolean
  position: YAxisPosition
}): HorizontalViewportSizes {
  const totalWidth = normalizePx(params.totalWidth)
  let leftAxisWidth = Math.min(normalizePx(params.leftAxisWidth), totalWidth)
  let rightAxisWidth = Math.min(normalizePx(params.rightAxisWidth), totalWidth)
  let mainWidth = totalWidth

  if (!params.inside) {
    if (params.position === YAxisPosition.Left) {
      rightAxisWidth = 0
    } else if (params.position === YAxisPosition.Right) {
      leftAxisWidth = 0
    }
    mainWidth = Math.max(0, totalWidth - leftAxisWidth - rightAxisWidth)
  }

  return [leftAxisWidth, mainWidth, rightAxisWidth]
}

export function materializeHorizontalViewportBounds(
  sizes: HorizontalViewportSizes,
  params: { inside: boolean, position: YAxisPosition }
): HorizontalViewportBounds {
  const [leftAxisWidth, mainWidth, rightAxisWidth] = sizes
  const totalWidth = params.inside ? mainWidth : leftAxisWidth + mainWidth + rightAxisWidth
  if (params.inside) {
    return {
      totalWidth,
      main: { left: 0, width: mainWidth },
      leftAxis: { left: 0, width: leftAxisWidth },
      rightAxis: { left: totalWidth - rightAxisWidth, width: rightAxisWidth }
    }
  }

  if (params.position === YAxisPosition.Left) {
    return {
      totalWidth,
      main: { left: leftAxisWidth, width: Math.max(0, totalWidth - leftAxisWidth) },
      leftAxis: { left: 0, width: leftAxisWidth },
      rightAxis: { left: totalWidth, width: 0 }
    }
  }

  if (params.position === YAxisPosition.Right) {
    return {
      totalWidth,
      main: { left: 0, width: Math.max(0, totalWidth - rightAxisWidth) },
      leftAxis: { left: 0, width: 0 },
      rightAxis: { left: totalWidth - rightAxisWidth, width: rightAxisWidth }
    }
  }

  return {
    totalWidth,
    main: { left: leftAxisWidth, width: Math.max(0, totalWidth - leftAxisWidth - rightAxisWidth) },
    leftAxis: { left: 0, width: leftAxisWidth },
    rightAxis: { left: totalWidth - rightAxisWidth, width: rightAxisWidth }
  }
}

export function sameHorizontalViewportSizes(
  left: HorizontalViewportSizes,
  right: HorizontalViewportSizes
): boolean {
  return left[0] === right[0] &&
    left[1] === right[1] &&
    left[2] === right[2]
}

export function getHorizontalViewportSizesSignature(sizes: HorizontalViewportSizes): string {
  return sizes.join(':')
}
