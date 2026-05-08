import type { Chart } from '../Chart'
import type KLineData from '../common/KLineData'
import { createDom } from '../common/utils/dom'
import { clamp } from '../common/utils/number'

const DEFAULT_HEIGHT = 32
const MIN_HEIGHT = 18
const VERTICAL_PADDING = 7
const HANDLE_WIDTH = 8
const HANDLE_HIT_SIZE = 12
const MOVE_HANDLE_WIDTH = 34
const MOVE_HANDLE_HEIGHT = 6
const BRUSH_DRAG_THRESHOLD = 2
const SHADOW_PADDING = 2
const SVG_NS = 'http://www.w3.org/2000/svg'

export class DataZoomSlider {
  private readonly _rootContainer: HTMLElement
  private readonly _chart: Chart
  private readonly _container: HTMLDivElement
  private readonly _track: HTMLDivElement
  private readonly _shadowSvg: SVGSVGElement
  private readonly _shadowPath: SVGPathElement
  private readonly _filler: HTMLDivElement
  private readonly _brushRect: HTMLDivElement
  private readonly _moveHandle: HTMLDivElement
  private readonly _startHandle: HTMLDivElement
  private readonly _endHandle: HTMLDivElement
  private readonly _layout = { left: 0, top: 0, width: 0, height: 0 }

  private _dragTarget?: 'start' | 'end' | 'range' | 'brush'
  private _dragStartX = 0
  private _dragStartRange = { start: 0, end: 100 }
  private _brushStartX = 0
  private _brushEndX = 0
  private _trackTop = 0
  private _trackHeight = 0

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
    this._shadowSvg = document.createElementNS(SVG_NS, 'svg')
    this._shadowSvg.style.position = 'absolute'
    this._shadowSvg.style.pointerEvents = 'none'
    this._shadowSvg.style.overflow = 'hidden'
    this._shadowPath = document.createElementNS(SVG_NS, 'path')
    this._shadowPath.setAttribute('fill', 'none')
    this._shadowPath.setAttribute('stroke-width', '1')
    this._shadowSvg.appendChild(this._shadowPath)
    this._filler = createDom('div', {
      position: 'absolute',
      boxSizing: 'border-box',
      borderRadius: '2px',
      cursor: 'grab'
    })
    this._brushRect = createDom('div', {
      position: 'absolute',
      display: 'none',
      boxSizing: 'border-box',
      pointerEvents: 'none'
    })
    this._moveHandle = createMoveHandle()
    this._startHandle = createHandle()
    this._endHandle = createHandle()

    this._container.appendChild(this._track)
    this._container.appendChild(this._shadowSvg)
    this._container.appendChild(this._filler)
    this._container.appendChild(this._brushRect)
    this._container.appendChild(this._moveHandle)
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
      this._shadowSvg.style.display = 'none'
      this._brushRect.style.display = 'none'
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
    this._trackTop = trackTop
    this._trackHeight = trackHeight
    this._track.style.left = '0px'
    this._track.style.top = `${trackTop}px`
    this._track.style.width = `${width}px`
    this._track.style.height = `${trackHeight}px`

    this._shadowSvg.style.left = '0px'
    this._shadowSvg.style.top = `${trackTop}px`
    this._shadowSvg.style.width = `${width}px`
    this._shadowSvg.style.height = `${trackHeight}px`
    this._shadowSvg.setAttribute('width', `${width}`)
    this._shadowSvg.setAttribute('height', `${trackHeight}`)
    this._shadowSvg.setAttribute('viewBox', `0 0 ${width} ${trackHeight}`)
    this.updateDataShadow(width, trackHeight)

    const range = this.getRange()
    const startX = range.start / 100 * width
    const endX = range.end / 100 * width
    const fillerLeft = Math.min(startX, endX)
    const fillerWidth = Math.max(0, Math.abs(endX - startX))

    this._filler.style.left = `${fillerLeft}px`
    this._filler.style.top = `${trackTop}px`
    this._filler.style.width = `${fillerWidth}px`
    this._filler.style.height = `${trackHeight}px`

    this.layoutMoveHandle(startX, endX, trackTop)
    this.layoutHandle(this._startHandle, startX, trackTop, trackHeight)
    this.layoutHandle(this._endHandle, endX, trackTop, trackHeight)

    const interactive = this._chart.getDataList().length > 3
    this._container.style.opacity = interactive ? '1' : '0.56'
    this.updateCursor()
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

  private layoutMoveHandle(startX: number, endX: number, trackTop: number): void {
    const selectedWidth = Math.abs(endX - startX)
    if (selectedWidth <= 0) {
      this._moveHandle.style.display = 'none'
      return
    }
    const handleWidth = Math.min(MOVE_HANDLE_WIDTH, Math.max(MOVE_HANDLE_HEIGHT * 2, selectedWidth))
    const left = clamp((startX + endX - handleWidth) / 2, 0, Math.max(0, this._layout.width - handleWidth))
    const top = clamp(trackTop - Math.ceil(MOVE_HANDLE_HEIGHT / 2), 0, Math.max(0, this._layout.height - MOVE_HANDLE_HEIGHT))
    this._moveHandle.style.display = 'block'
    this._moveHandle.style.left = `${left}px`
    this._moveHandle.style.top = `${top}px`
    this._moveHandle.style.width = `${handleWidth}px`
    this._moveHandle.style.height = `${MOVE_HANDLE_HEIGHT}px`
  }

  private updateDataShadow(width: number, height: number): void {
    const options = this._chart.getChartStore().getDataZoomSliderOptions()
    if (options.showDataShadow === false) {
      this._shadowSvg.style.display = 'none'
      this._shadowPath.setAttribute('d', '')
      return
    }

    const path = buildCloseLinePath(this._chart.getDataList(), width, height)
    if (path === '') {
      this._shadowSvg.style.display = 'none'
      this._shadowPath.setAttribute('d', '')
      return
    }
    this._shadowSvg.style.display = 'block'
    this._shadowPath.setAttribute('d', path)
  }

  private applyStyles(): void {
    const styles = this._chart.getStyles()
    const axisLineColor = styles.xAxis.axisLine.color
    const textColor = styles.xAxis.tickText.color
    this._track.style.background = 'rgba(118, 128, 143, 0.10)'
    this._track.style.border = `1px solid ${axisLineColor}`
    this._shadowPath.setAttribute('stroke', textColor)
    this._shadowPath.setAttribute('stroke-opacity', '0.32')
    this._filler.style.background = 'rgba(22, 119, 255, 0.18)'
    this._brushRect.style.background = 'rgba(22, 119, 255, 0.16)'
    this._brushRect.style.border = '1px solid rgba(22, 119, 255, 0.55)'
    this._moveHandle.style.background = textColor
    this._moveHandle.style.opacity = '0.75'
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
    const target = this.pickTarget(x, event.target)
    if (target === 'background') {
      if (this._chart.getChartStore().getDataZoomSliderOptions().brushSelect === true) {
        this.startBrush(x)
      } else {
        this.moveRangeCenterTo(x)
      }
      return
    }

    if (target === 'range' && this._chart.getChartStore().getDataZoomSliderOptions().brushSelect === true) {
      this.startBrush(x)
      return
    }

    this._dragTarget = target === 'move' ? 'range' : target
    this._dragStartX = x
    this._dragStartRange = this.getRange()
    this._filler.style.cursor = 'grabbing'
    this._moveHandle.style.cursor = 'grabbing'
    this.addDocumentListeners()
  }

  private startBrush(x: number): void {
    this._dragTarget = 'brush'
    this._dragStartX = x
    this._dragStartRange = this.getRange()
    this._brushStartX = x
    this._brushEndX = x
    this._container.style.cursor = 'crosshair'
    this.layoutBrushRect()
    this.addDocumentListeners()
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
    if (target === 'brush') {
      this._brushEndX = x
      this.layoutBrushRect()
      return
    }

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
    if (this._dragTarget === 'brush') {
      this.endBrush()
    }
    this._dragTarget = undefined
    this._container.style.cursor = ''
    this._moveHandle.style.cursor = 'grab'
    this.updateCursor()
    this.removeDocumentListeners()
  }

  private endBrush(): void {
    const distance = Math.abs(this._brushEndX - this._brushStartX)
    this._brushRect.style.display = 'none'
    if (distance <= BRUSH_DRAG_THRESHOLD) {
      this.moveRangeCenterTo(this._brushStartX)
      return
    }

    const left = Math.min(this._brushStartX, this._brushEndX)
    const right = Math.max(this._brushStartX, this._brushEndX)
    const start = this.localXToPercent(left)
    const end = this.localXToPercent(right)
    const minSpan = this._chart.getChartStore().getTimeScaleStore().getDataZoomMinSpan()
    const span = end - start
    if (span >= minSpan) {
      this.setRange(start, end)
      return
    }
    const center = (start + end) / 2
    const nextStart = clamp(center - minSpan / 2, 0, 100 - minSpan)
    this.setRange(nextStart, nextStart + minSpan)
  }

  private layoutBrushRect(): void {
    const left = Math.min(this._brushStartX, this._brushEndX)
    const width = Math.abs(this._brushEndX - this._brushStartX)
    this._brushRect.style.display = 'block'
    this._brushRect.style.left = `${left}px`
    this._brushRect.style.top = `${this._trackTop}px`
    this._brushRect.style.width = `${width}px`
    this._brushRect.style.height = `${this._trackHeight}px`
  }

  private addDocumentListeners(): void {
    document.addEventListener('mousemove', this._mouseMove)
    document.addEventListener('mouseup', this._mouseUp)
    document.addEventListener('touchmove', this._touchMove, { passive: false })
    document.addEventListener('touchend', this._touchEnd)
    document.addEventListener('touchcancel', this._touchEnd)
  }

  private removeDocumentListeners(): void {
    document.removeEventListener('mousemove', this._mouseMove)
    document.removeEventListener('mouseup', this._mouseUp)
    document.removeEventListener('touchmove', this._touchMove)
    document.removeEventListener('touchend', this._touchEnd)
    document.removeEventListener('touchcancel', this._touchEnd)
  }

  private pickTarget(x: number, eventTarget: EventTarget | null): 'start' | 'end' | 'move' | 'range' | 'background' {
    if (eventTarget === this._startHandle) {
      return 'start'
    }
    if (eventTarget === this._endHandle) {
      return 'end'
    }
    if (eventTarget === this._moveHandle) {
      return 'move'
    }
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

  private updateCursor(): void {
    const options = this._chart.getChartStore().getDataZoomSliderOptions()
    this._filler.style.cursor = options.brushSelect === true ? 'default' : 'grab'
    this._filler.style.pointerEvents = options.brushSelect === true ? 'none' : 'auto'
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

function createMoveHandle(): HTMLDivElement {
  return createDom('div', {
    position: 'absolute',
    boxSizing: 'border-box',
    borderRadius: '999px',
    cursor: 'grab'
  })
}

export function buildCloseLinePath(dataList: KLineData[], width: number, height: number): string {
  if (dataList.length === 0 || width <= 0 || height <= 0) {
    return ''
  }

  let min = Number.MAX_SAFE_INTEGER
  let max = Number.MIN_SAFE_INTEGER
  dataList.forEach(data => {
    min = Math.min(min, data.close)
    max = Math.max(max, data.close)
  })

  const lastIndex = dataList.length - 1
  const padding = Math.min(SHADOW_PADDING, height / 4)
  const availableHeight = Math.max(0, height - padding * 2)
  return dataList.map((data, index) => {
    const x = lastIndex === 0 ? width / 2 : index / lastIndex * width
    const y = max === min ? height / 2 : padding + (max - data.close) / (max - min) * availableHeight
    return `${index === 0 ? 'M' : 'L'} ${formatSvgNumber(x)} ${formatSvgNumber(y)}`
  }).join(' ')
}

function formatSvgNumber(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`
  }
  return value.toFixed(2)
}
