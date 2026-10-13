import { clamp } from '../../common/utils/number'
import type { ResizeAnchor } from '../../Chart'
import { TimeScaleMode } from './TimeScaleMode'

export class KLineTimeScaleMode extends TimeScaleMode {
  override scroll(distance: number): boolean {
    this.context.setRightLogicalIndex(this.context.getRightLogicalIndex() - distance / this.context.getBarWidth())
    return true
  }

  override zoom(scaleDelta: number, xCoord?: number): number | undefined {
    const x = this.context.getZoomCoordinate(xCoord)
    const scaleRatio = 1 + scaleDelta
    const prevBarWidth = this.context.getBarWidth()
    const nextBarWidth = clamp(prevBarWidth * scaleRatio, this.context.getBarSpaceLimit().min, this.context.getBarSpaceLimit().max)
    const realScaleRatio = nextBarWidth / prevBarWidth
    const mainWidth = this.context.getMainWidth()
    const offsetX = mainWidth - x
    const anchor = this.context.getRightLogicalIndex() - offsetX / prevBarWidth

    this.context.setBarWidth(nextBarWidth)
    this.context.setRightLogicalIndex(anchor + offsetX / nextBarWidth)

    return realScaleRatio
  }

  override fitToWidth(align: 'left' | 'center' | 'right' | 'auto'): boolean {
    const totalBarCount = this.context.getDataList().length
    const mainWidth = this.context.getMainWidth()

    if (totalBarCount === 0 || mainWidth <= 0) {
      return false
    }

    const nextBarWidth = clamp(mainWidth / totalBarCount, this.context.getBarSpaceLimit().min, this.context.getBarSpaceLimit().max)
    this.context.setBarWidth(nextBarWidth)

    const first = this.context.getFirstLogicalIndex()
    const visibleCount = mainWidth / nextBarWidth

    switch (align) {
      case 'auto':
        this.context.setRightLogicalIndex(first + Math.max(totalBarCount, visibleCount))
        break
      case 'left':
        this.context.setRightLogicalIndex(first + visibleCount)
        break
      case 'center':
        this.context.setRightLogicalIndex(first + (totalBarCount + visibleCount) / 2)
        break
      case 'right':
        this.context.setRightLogicalIndex(first + totalBarCount)
        break
    }

    return true
  }

  override adjustBarSpaceForMainWidthChange(prevMainWidth: number, nextMainWidth: number, anchor: ResizeAnchor): void {
    if (prevMainWidth <= 0 || nextMainWidth <= 0 || prevMainWidth === nextMainWidth) {
      return
    }

    const prevBarWidth = this.context.getBarWidth()
    const right = this.context.getRightLogicalIndex()
    const left = right - prevMainWidth / prevBarWidth
    const widthRatio = nextMainWidth / prevMainWidth
    const nextBarWidth = clamp(prevBarWidth * widthRatio, this.context.getBarSpaceLimit().min, this.context.getBarSpaceLimit().max)
    this.context.setBarWidth(nextBarWidth)
    this.context.setRightLogicalIndex(anchor === 'domainTo' ? right : left + nextMainWidth / nextBarWidth)
  }

  override alignLeft(): boolean {
    const totalBarCount = this.context.getDataList().length
    if (totalBarCount === 0) {
      return false
    }

    this.context.setRightLogicalIndex(this.context.getFirstLogicalIndex() + this.context.getMainWidth() / this.context.getBarWidth())
    return true
  }

  override alignRight(): boolean {
    this.context.setRightLogicalIndex(this.context.getFirstLogicalIndex() + this.context.getDataList().length + this.context.getInitialOffsetRightDistance() / this.context.getBarWidth())
    return true
  }

  override alignCenter(): boolean {
    const totalBarCount = this.context.getDataList().length
    if (totalBarCount === 0) {
      return false
    }

    const totalBarWidth = totalBarCount * this.context.getBarWidth()
    const mainWidth = this.context.getMainWidth()
    const first = this.context.getFirstLogicalIndex()
    const visibleCount = mainWidth / this.context.getBarWidth()

    if (totalBarWidth >= mainWidth) {
      const center = first + Math.floor(totalBarCount / 2)
      const left = Math.max(first, center - Math.floor(Math.floor(visibleCount) / 2))
      this.context.setRightLogicalIndex(left + visibleCount)
    } else {
      this.context.setRightLogicalIndex(first + (totalBarCount + visibleCount) / 2 + this.context.getInitialOffsetRightDistance() / this.context.getBarWidth())
    }

    return true
  }

  override autoInitialAlignment(): boolean {
    const totalBarCount = this.context.getDataList().length
    if (totalBarCount === 0) {
      return false
    }

    const totalBarWidth = totalBarCount * this.context.getBarWidth()
    if (totalBarWidth < this.context.getMainWidth()) {
      return this.alignLeft()
    }
    return this.alignRight()
  }
}
