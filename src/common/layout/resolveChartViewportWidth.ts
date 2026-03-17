import type { YAxisPosition } from '../Styles'
import {
  computeHorizontalViewportSizes,
  getHorizontalViewportSizesSignature,
  sameHorizontalViewportSizes,
  type HorizontalViewportSizes
} from './computeHorizontalViewportLayout'
import { solveFeedbackLayout } from './solveFeedbackLayout'

export function resolveChartViewportWidth(host: {
  getTotalWidth: () => number
  getLayoutOptions: () => { inside: boolean, position: YAxisPosition }
  snapshotSizes: (totalWidth: number) => HorizontalViewportSizes
  buildYAxisTicks: (force: boolean) => void
  buildXAxisTicks: (force: boolean) => void
  measureYAxisWidthDemand: (totalWidth: number) => { left: number, right: number }
  applySizes: (sizes: HorizontalViewportSizes) => void
}, options?: {
  maxCycles?: number
}): {
  value: HorizontalViewportSizes
  cycleCount: number
  converged: boolean
} {
  const totalWidth = host.getTotalWidth()
  const initial = host.snapshotSizes(totalWidth)
  const { inside, position } = host.getLayoutOptions()
  const result = solveFeedbackLayout({
    initial,
    maxCycles: options?.maxCycles,
    isSame: sameHorizontalViewportSizes,
    getSignature: getHorizontalViewportSizesSignature,
    iterate: (current, _cycle) => {
      host.buildYAxisTicks(true)
      const demand = host.measureYAxisWidthDemand(totalWidth)
      const next = computeHorizontalViewportSizes({
        totalWidth,
        leftAxisWidth: demand.left,
        rightAxisWidth: demand.right,
        inside,
        position
      })
      if (!sameHorizontalViewportSizes(current, next)) {
        host.applySizes(next)
      }
      return next
    }
  })
  host.buildYAxisTicks(true)
  host.buildXAxisTicks(true)
  return result
}
