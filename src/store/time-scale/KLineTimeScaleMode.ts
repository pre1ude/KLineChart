import { clamp } from '../../common/utils/number'
import type { ResizeAnchor } from '../../Chart'
import { TimeScaleMode } from './TimeScaleMode'

export class KLineTimeScaleMode extends TimeScaleMode {
  override scroll(distance: number): boolean {
    this.context.setOffsetRightDistance(this.context.getOffsetRightDistance() - distance)
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
    const nextOffsetRight = (this.context.getOffsetRightDistance() - offsetX) * realScaleRatio + offsetX

    this.context.setOffsetRightDistance(nextOffsetRight)
    this.context.setBarWidth(nextBarWidth)

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

    const totalBarWidth = totalBarCount * nextBarWidth

    switch (align) {
      case 'auto':
        this.context.setOffsetRightDistance(totalBarWidth <= mainWidth ? mainWidth - totalBarWidth : 0)
        break
      case 'left':
        this.context.setOffsetRightDistance(mainWidth - totalBarWidth)
        break
      case 'center':
        this.context.setOffsetRightDistance((mainWidth - totalBarWidth) / 2)
        break
      case 'right':
        this.context.setOffsetRightDistance(0)
        break
    }

    return true
  }

  override adjustBarSpaceForMainWidthChange(prevMainWidth: number, nextMainWidth: number, anchor: ResizeAnchor): void {
    if (prevMainWidth <= 0 || nextMainWidth <= 0 || prevMainWidth === nextMainWidth) {
      return
    }

    const prevBarWidth = this.context.getBarWidth()
    const prevOffsetRight = this.context.getOffsetRightDistance()
    const widthRatio = nextMainWidth / prevMainWidth
    const nextBarWidth = clamp(prevBarWidth * widthRatio, this.context.getBarSpaceLimit().min, this.context.getBarSpaceLimit().max)
    const realScaleRatio = nextBarWidth / prevBarWidth

    this.context.setBarWidth(nextBarWidth)
    if (anchor === 'domainTo') {
      this.context.setOffsetRightDistance(prevOffsetRight * realScaleRatio)
      return
    }
    this.context.setOffsetRightDistance((prevOffsetRight - prevMainWidth) * realScaleRatio + nextMainWidth)
  }

  override alignLeft(): boolean {
    const totalBarCount = this.context.getDataList().length
    if (totalBarCount === 0) {
      return false
    }

    this.context.setOffsetRightDistance(this.context.getMainWidth() - totalBarCount * this.context.getBarWidth())
    return true
  }

  override alignRight(): boolean {
    this.context.setOffsetRightDistance(this.context.getInitialOffsetRightDistance())
    return true
  }

  override alignCenter(): boolean {
    const totalBarCount = this.context.getDataList().length
    if (totalBarCount === 0) {
      return false
    }

    const totalBarWidth = totalBarCount * this.context.getBarWidth()
    const mainWidth = this.context.getMainWidth()

    if (totalBarWidth >= mainWidth) {
      const centerDataIndex = Math.floor(totalBarCount / 2)
      const visibleBarCount = Math.floor(mainWidth / this.context.getBarWidth())
      const startIndex = Math.max(0, centerDataIndex - Math.floor(visibleBarCount / 2))
      this.context.setOffsetRightDistance(mainWidth - (totalBarCount - startIndex) * this.context.getBarWidth())
    } else {
      this.context.setOffsetRightDistance((mainWidth - totalBarWidth) / 2 + this.context.getInitialOffsetRightDistance())
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

  override onAppendData(): void {
    this.context.setOffsetRightDistance(this.context.getOffsetRightDistance() - this.context.getBarSpace().bar)
  }
}
