import type { Chart } from '../Chart'
import { createDom } from '../common/utils/dom'
import { clamp } from '../common/utils/number'

const DEFAULT_HEIGHT = 32
const MIN_HEIGHT = 18
const VERTICAL_PADDING = 7
const HANDLE_WIDTH = 8
const HANDLE_HIT_SIZE = 12

export class DataZoomSlider {
  private readonly _rootContainer: HTMLElement
  private readonly _chart: Chart
  private readonly _container: HTMLDivElement
  private readonly _track: HTMLDivElement
  private readonly _filler: HTMLDivElement
  private readonly _startHandle: HTMLDivElement
  private readonly _endHandle: HTMLDivElement
  private readonly _layout = { left: 0, top: 0, width: 0, height: 0 }

  private _dragTarget?: 'start' | 'end' | 'range'
  private _dragStartX = 0
  private _dragStartRange = { start: 0, end: 100 }

  constructor(rootContainer: HTMLElement, chart: Chart) {
    this._rootContainer = rootContainer
    this._chart = chart

    this._container = createDom('div', {
      position: 'absolute',
      display: 'none',
      boxSizing: 'border-box',
      zIndex: '4',
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none'
    })
    this._track = createDom('div', {
      position: 'absolute',
      boxSizing: 'border-box',
      borderRadius: '2px',
      overflow: 'hidden'
    })
    this._filler = createDom('div', {
      position: 'absolute',
      boxSizing: 'border-box',
      borderRadius: '2px',
      cursor: 'grab'
    })
    this._startHandle = createHandle()
    this._endHandle = createHandle()

    this._container.appendChild(this._track)
    this._container.appendChild(this._filler)
    this._container.appendChild(this._startHandle)
    this._container.appendChild(this._endHandle)
    this._rootContainer.appendChild(this._container)

    this._container.addEventListener('mousedown', this._mouseDown)
    this._container.addEventListener('touchstart', this._touchStart, { passive: false })
    this._container.addEventListener('click', this._stopClick)
  }

  getHeight(): number {
    const chartStore = this._chart.getChartStore()
    const options = chartStore.getDataZoomSliderOptions()
    if (!chartStore.getDataZoomEnabled() || chartStore.getIsTimeShare() || options.show !== true) {
      return 0
    }
    const height = options.height
    if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
      return Math.max(MIN_HEIGHT, Math.floor(height))
    }
    return DEFAULT_HEIGHT
  }

  setLayout(layout: Partial<{ left: number, top: number, width: number, height: number }>): void {
    this._layout.left = layout.left ?? this._layout.left
    this._layout.top = layout.top ?? this._layout.top
    this._layout.width = layout.width ?? this._layout.width
    this._layout.height = layout.height ?? this._layout.height
    this.update()
  }

  update(): void {
    const height = this.getHeight()
    const width = Math.max(0, this._layout.width)
    if (height <= 0 || width <= 0) {
      this._container.style.display = 'none'
      return
    }

    this._layout.height = height
    this._container.style.display = 'block'
    this._container.style.left = `${this._layout.left}px`
    this._container.style.top = `${this._layout.top}px`
    this._container.style.width = `${width}px`
    this._container.style.height = `${height}px`

    this.applyStyles()

    const trackTop = Math.min(VERTICAL_PADDING, Math.floor((height - MIN_HEIGHT) / 2))
    const trackHeight = Math.max(8, height - trackTop * 2)
    this._track.style.left = '0px'
    this._track.style.top = `${trackTop}px`
    this._track.style.width = `${width}px`
    this._track.style.height = `${trackHeight}px`

    const range = this.getRange()
    const startX = range.start / 100 * width
    const endX = range.end / 100 * width
    const fillerLeft = Math.min(startX, endX)
    const fillerWidth = Math.max(0, Math.abs(endX - startX))

    this._filler.style.left = `${fillerLeft}px`
    this._filler.style.top = `${trackTop}px`
    this._filler.style.width = `${fillerWidth}px`
    this._filler.style.height = `${trackHeight}px`

    this.layoutHandle(this._startHandle, startX, trackTop, trackHeight)
    this.layoutHandle(this._endHandle, endX, trackTop, trackHeight)

    const interactive = this._chart.getDataList().length > 3
    this._container.style.opacity = interactive ? '1' : '0.56'
  }

  destroy(): void {
    this.removeDocumentListeners()
    this._container.removeEventListener('mousedown', this._mouseDown)
    this._container.removeEventListener('touchstart', this._touchStart)
    this._container.removeEventListener('click', this._stopClick)
    if (this._container.parentElement === this._rootContainer) {
      this._rootContainer.removeChild(this._container)
    }
  }

  private layoutHandle(handle: HTMLDivElement, x: number, trackTop: number, trackHeight: number): void {
    const left = clamp(x - HANDLE_WIDTH / 2, 0, Math.max(0, this._layout.width - HANDLE_WIDTH))
    handle.style.left = `${left}px`
    handle.style.top = `${trackTop}px`
    handle.style.width = `${HANDLE_WIDTH}px`
    handle.style.height = `${trackHeight}px`
  }

  private applyStyles(): void {
    const styles = this._chart.getStyles()
    const axisLineColor = styles.xAxis.axisLine.color
    const textColor = styles.xAxis.tickText.color
    this._track.style.background = 'rgba(118, 128, 143, 0.10)'
    this._track.style.border = `1px solid ${axisLineColor}`
    this._filler.style.background = 'rgba(22, 119, 255, 0.18)'
    this._startHandle.style.background = '#FFFFFF'
    this._startHandle.style.border = `1px solid ${textColor}`
    this._endHandle.style.background = '#FFFFFF'
    this._endHandle.style.border = `1px solid ${textColor}`
  }

  private getRange(): { start: number, end: number } {
    return this._chart.getChartStore().getTimeScaleStore().getDataZoomRange() ?? { start: 0, end: 100 }
  }

  private _mouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return
    }
    this.startInteraction(event.clientX, event)
  }

  private _touchStart = (event: TouchEvent): void => {
    const touch = event.touches[0]
    if (touch == null) {
      return
    }
    this.startInteraction(touch.clientX, event)
  }

  private _stopClick = (event: MouseEvent): void => {
    event.stopPropagation()
  }

  private startInteraction(clientX: number, event: MouseEvent | TouchEvent): void {
    if (this._chart.getDataList().length <= 3 || this._layout.width <= 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const x = this.clientXToLocal(clientX)
    const target = this.pickTarget(x)
    if (target === 'background') {
      this.moveRangeCenterTo(x)
      return
    }

    this._dragTarget = target
    this._dragStartX = x
    this._dragStartRange = this.getRange()
    this._filler.style.cursor = 'grabbing'
    document.addEventListener('mousemove', this._mouseMove)
    document.addEventListener('mouseup', this._mouseUp)
    document.addEventListener('touchmove', this._touchMove, { passive: false })
    document.addEventListener('touchend', this._touchEnd)
    document.addEventListener('touchcancel', this._touchEnd)
  }

  private _mouseMove = (event: MouseEvent): void => {
    this.dragTo(event.clientX, event)
  }

  private _touchMove = (event: TouchEvent): void => {
    const touch = event.touches[0]
    if (touch == null) {
      return
    }
    this.dragTo(touch.clientX, event)
  }

  private dragTo(clientX: number, event: MouseEvent | TouchEvent): void {
    const target = this._dragTarget
    if (target == null) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const x = this.clientXToLocal(clientX)
    const percent = this.localXToPercent(x)
    const range = this._dragStartRange
    const minSpan = this._chart.getChartStore().getTimeScaleStore().getDataZoomMinSpan()

    if (target === 'start') {
      this.setRange(clamp(percent, 0, range.end - minSpan), range.end)
      return
    }
    if (target === 'end') {
      this.setRange(range.start, clamp(percent, range.start + minSpan, 100))
      return
    }

    const span = range.end - range.start
    const delta = this.localDistanceToPercent(x - this._dragStartX)
    const start = clamp(range.start + delta, 0, 100 - span)
    this.setRange(start, start + span)
  }

  private _mouseUp = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    this.endDrag()
  }

  private _touchEnd = (event: TouchEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    this.endDrag()
  }

  private endDrag(): void {
    this._dragTarget = undefined
    this._filler.style.cursor = 'grab'
    this.removeDocumentListeners()
  }

  private removeDocumentListeners(): void {
    document.removeEventListener('mousemove', this._mouseMove)
    document.removeEventListener('mouseup', this._mouseUp)
    document.removeEventListener('touchmove', this._touchMove)
    document.removeEventListener('touchend', this._touchEnd)
    document.removeEventListener('touchcancel', this._touchEnd)
  }

  private pickTarget(x: number): 'start' | 'end' | 'range' | 'background' {
    const range = this.getRange()
    const startX = range.start / 100 * this._layout.width
    const endX = range.end / 100 * this._layout.width
    const startDistance = Math.abs(x - startX)
    const endDistance = Math.abs(x - endX)
    if (Math.min(startDistance, endDistance) <= HANDLE_HIT_SIZE) {
      return startDistance <= endDistance ? 'start' : 'end'
    }
    if (x > startX && x < endX) {
      return 'range'
    }
    return 'background'
  }

  private moveRangeCenterTo(x: number): void {
    const range = this.getRange()
    const span = range.end - range.start
    const center = this.localXToPercent(x)
    const start = clamp(center - span / 2, 0, 100 - span)
    this.setRange(start, start + span)
  }

  private setRange(start: number, end: number): void {
    const changed = this._chart.getChartStore().getTimeScaleStore().setDataZoomRange(start, end)
    if (!changed) {
      this.update()
    }
  }

  private clientXToLocal(clientX: number): number {
    const rect = this._container.getBoundingClientRect()
    return clamp(clientX - rect.left, 0, this._layout.width)
  }

  private localXToPercent(x: number): number {
    if (this._layout.width <= 0) {
      return 0
    }
    return clamp(x / this._layout.width * 100, 0, 100)
  }

  private localDistanceToPercent(distance: number): number {
    if (this._layout.width <= 0) {
      return 0
    }
    return distance / this._layout.width * 100
  }
}

function createHandle(): HTMLDivElement {
  const handle = createDom('div', {
    position: 'absolute',
    boxSizing: 'border-box',
    borderRadius: '2px',
    cursor: 'ew-resize'
  })
  return handle
}
