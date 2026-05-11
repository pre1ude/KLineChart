import type { Chart } from '../Chart'
import type KLineData from '../common/KLineData'
import { createDom } from '../common/utils/dom'
import { clamp } from '../common/utils/number'
import type { DataZoomSliderTheme } from '../Options'

const DEFAULT_HEIGHT = 32
const MIN_HEIGHT = 18
const HANDLE_WIDTH = 10
const MOVE_HANDLE_HEIGHT = 7
const MOVE_HANDLE_ICON_SIZE = MOVE_HANDLE_HEIGHT * 0.8
const BRUSH_DRAG_THRESHOLD = 2
const SHADOW_PADDING = 2
const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_HANDLE_SYMBOL_PATH = 'M-9.35,34.56V42m0-40V9.5m-2,0h4a2,2,0,0,1,2,2v21a2,2,0,0,1-2,2h-4a2,2,0,0,1-2-2v-21A2,2,0,0,1-11.35,9.5Z'
const DEFAULT_MOVE_HANDLE_SYMBOL_PATH = 'M-320.9-50L-320.9-50c18.1,0,27.1,9,27.1,27.1V85.7c0,18.1-9,27.1-27.1,27.1l0,0c-18.1,0-27.1-9-27.1-27.1V-22.9C-348-41-339-50-320.9-50z M-212.3-50L-212.3-50c18.1,0,27.1,9,27.1,27.1V85.7c0,18.1-9,27.1-27.1,27.1l0,0c-18.1,0-27.1-9-27.1-27.1V-22.9C-239.4-41-230.4-50-212.3-50z M-103.7-50L-103.7-50c18.1,0,27.1,9,27.1,27.1V85.7c0,18.1-9,27.1-27.1,27.1l0,0c-18.1,0-27.1-9-27.1-27.1V-22.9C-130.9-41-121.8-50-103.7-50z'
type SliderResolvedTheme = Exclude<DataZoomSliderTheme, 'auto'>

type SliderPalette = {
  trackBackground: string
  trackBorder: string
  selectedBackground: string
  shadowArea: string
  shadowLine: string
  handleFill: string
  handleStroke: string
  handleHoverStroke: string
  moveHandleBackground: string
  moveHandleHoverBackground: string
  moveHandleIcon: string
}

type SliderLayout = {
  width: number
  trackTop: number
  trackHeight: number
  startX: number
  endX: number
  selectedRangeLeft: number
  selectedRangeWidth: number
}

type PercentRange = {
  start: number
  end: number
}

type SliderElements = {
  container: HTMLDivElement
  track: HTMLDivElement
  shadowSvg: SVGSVGElement
  shadowAreaPath: SVGPathElement
  shadowPath: SVGPathElement
  selectedRange: HTMLDivElement
  brushRect: HTMLDivElement
  moveHandle: HTMLDivElement
  moveZone: HTMLDivElement
  moveHandleSymbol: SVGPathElement
  startHandle: HTMLDivElement
  endHandle: HTMLDivElement
  startHandleSymbol: SVGPathElement
  endHandleSymbol: SVGPathElement
}

type DataShadowPaths = {
  line: string
  area: string
}

type BrushRange = {
  left: number
  right: number
  width: number
}

type DragTarget = 'start' | 'end' | 'range' | 'brush'
type HoverTarget = 'move' | 'start' | 'end'
type SliderHitTarget = 'start' | 'end' | 'move' | 'range' | 'background'

const SLIDER_PALETTES: Record<SliderResolvedTheme, SliderPalette> = {
  dark: {
    trackBackground: '#37465C',
    trackBorder: '#37465C',
    selectedBackground: 'rgba(104, 132, 173, 0.4)',
    shadowArea: 'rgba(86, 100, 121, 1)',
    shadowLine: 'rgba(221, 231, 243, 0.78)',
    handleFill: 'rgba(225, 235, 248, 0.96)',
    handleStroke: 'rgba(242, 247, 255, 0.92)',
    handleHoverStroke: 'rgba(255, 255, 255, 0.58)',
    moveHandleBackground: 'rgba(151, 162, 182, 1)',
    moveHandleHoverBackground: 'rgba(104, 132, 188, 1)',
    moveHandleIcon: 'rgba(242, 247, 255, 0.90)'
  },
  light: {
    trackBackground: 'transparent',
    trackBorder: 'rgba(216, 224, 240, 0.96)',
    selectedBackground: 'rgba(135, 175, 255, 0.22)',
    shadowArea: 'rgba(135, 175, 255, 0.16)',
    shadowLine: 'rgba(135, 175, 255, 0.58)',
    handleFill: 'rgba(255, 255, 255, 0.98)',
    handleStroke: 'rgba(210, 218, 236, 0.98)',
    handleHoverStroke: 'rgba(135, 175, 255, 0.9)',
    moveHandleBackground: 'rgba(192, 200, 229, 1)',
    moveHandleHoverBackground: 'rgba(156, 167, 214, 1)',
    moveHandleIcon: 'rgba(255, 255, 255, 0.92)'
  }
}

export class DataZoomSlider {
  private readonly _rootContainer: HTMLElement
  private readonly _chart: Chart
  private readonly _container: HTMLDivElement
  private readonly _track: HTMLDivElement
  private readonly _shadowSvg: SVGSVGElement
  private readonly _shadowAreaPath: SVGPathElement
  private readonly _shadowPath: SVGPathElement
  private readonly _selectedRange: HTMLDivElement
  private readonly _brushRect: HTMLDivElement
  private readonly _moveHandle: HTMLDivElement
  private readonly _moveZone: HTMLDivElement
  private readonly _moveHandleSymbol: SVGPathElement
  private readonly _startHandle: HTMLDivElement
  private readonly _endHandle: HTMLDivElement
  private readonly _startHandleSymbol: SVGPathElement
  private readonly _endHandleSymbol: SVGPathElement
  private readonly _layout = { left: 0, top: 0, width: 0, height: 0 }
  private readonly _shadowCache = { dataVersion: -1, width: -1, height: -1, show: false }
  private readonly _elementEventDisposers: Array<() => void> = []
  private readonly _documentEventDisposers: Array<() => void> = []
  private readonly _drag: {
    target?: DragTarget
    startX: number
    startRange: PercentRange
  } = {
    startX: 0,
    startRange: { start: 0, end: 100 }
  }
  private readonly _brush = {
    startX: 0,
    endX: 0
  }
  private _appliedTheme?: SliderResolvedTheme
  private _handleRange?: PercentRange
  private _hoverTarget?: HoverTarget
  private _activePointerId?: number
  private _trackTop = 0
  private _trackHeight = 0

  constructor(rootContainer: HTMLElement, chart: Chart) {
    this._rootContainer = rootContainer
    this._chart = chart

    const elements = createSliderElements()
    this._container = elements.container
    this._track = elements.track
    this._shadowSvg = elements.shadowSvg
    this._shadowAreaPath = elements.shadowAreaPath
    this._shadowPath = elements.shadowPath
    this._selectedRange = elements.selectedRange
    this._brushRect = elements.brushRect
    this._moveHandle = elements.moveHandle
    this._moveZone = elements.moveZone
    this._moveHandleSymbol = elements.moveHandleSymbol
    this._startHandle = elements.startHandle
    this._endHandle = elements.endHandle
    this._startHandleSymbol = elements.startHandleSymbol
    this._endHandleSymbol = elements.endHandleSymbol
    this.applyTheme()
    this._rootContainer.appendChild(this._container)

    this.listenElement(this._container, 'pointerdown', this._pointerDown)
    this.listenElement(this._container, 'click', this._stopClick)
    this.listenElement(this._moveZone, 'mouseenter', this._moveHandleMouseEnter)
    this.listenElement(this._moveZone, 'mouseleave', this._moveHandleMouseLeave)
    this.listenElement(this._startHandle, 'mouseenter', this._startHandleMouseEnter)
    this.listenElement(this._startHandle, 'mouseleave', this._startHandleMouseLeave)
    this.listenElement(this._endHandle, 'mouseenter', this._endHandleMouseEnter)
    this.listenElement(this._endHandle, 'mouseleave', this._endHandleMouseLeave)
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
      this.hideDataShadow()
      this._shadowCache.width = -1
      this._brushRect.style.display = 'none'
      return
    }

    this._layout.height = height
    this._container.style.display = 'block'
    this._container.style.left = `${this._layout.left}px`
    this._container.style.top = `${this._layout.top}px`
    this._container.style.width = `${width}px`
    this._container.style.height = `${height}px`

    this.applyTheme()
    this.renderLayout(computeSliderLayout(width, height, this.getHandleRange()))

    const interactive = this._chart.getDataList().length > 3
    this._container.style.opacity = interactive ? '1' : '0.56'
    this.updateCursor()
  }

  destroy(): void {
    this.removeDocumentListeners()
    this._elementEventDisposers.forEach(dispose => { dispose() })
    this._elementEventDisposers.length = 0
    if (this._container.parentElement === this._rootContainer) {
      this._rootContainer.removeChild(this._container)
    }
  }

  private listenElement<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(type, listener, options)
    this._elementEventDisposers.push(() => {
      element.removeEventListener(type, listener, options)
    })
  }

  private listenDocument<K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void {
    document.addEventListener(type, listener, options)
    this._documentEventDisposers.push(() => {
      document.removeEventListener(type, listener, options)
    })
  }

  private renderLayout(layout: SliderLayout): void {
    this._trackTop = layout.trackTop
    this._trackHeight = layout.trackHeight
    this._track.style.left = '0px'
    this._track.style.top = `${layout.trackTop}px`
    this._track.style.width = `${layout.width}px`
    this._track.style.height = `${layout.trackHeight}px`

    this._shadowSvg.style.left = '0px'
    this._shadowSvg.style.top = `${layout.trackTop}px`
    this._shadowSvg.style.width = `${layout.width}px`
    this._shadowSvg.style.height = `${layout.trackHeight}px`
    this._shadowSvg.setAttribute('width', `${layout.width}`)
    this._shadowSvg.setAttribute('height', `${layout.trackHeight}`)
    this._shadowSvg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.trackHeight}`)
    this.updateDataShadow(layout.width, layout.trackHeight)

    this._selectedRange.style.left = `${layout.selectedRangeLeft}px`
    this._selectedRange.style.top = `${layout.trackTop}px`
    this._selectedRange.style.width = `${layout.selectedRangeWidth}px`
    this._selectedRange.style.height = `${layout.trackHeight}px`
    this.layoutHandle(this._startHandle, layout.startX, layout.trackTop, layout.trackHeight)
    this.layoutHandle(this._endHandle, layout.endX, layout.trackTop, layout.trackHeight)
    this.layoutMoveHandle(layout.startX, layout.endX, layout.trackTop, layout.trackHeight)
  }

  private layoutHandle(handle: HTMLDivElement, x: number, trackTop: number, trackHeight: number): void {
    handle.style.left = `${x}px`
    handle.style.top = `${trackTop}px`
    handle.style.width = `${HANDLE_WIDTH}px`
    handle.style.height = `${trackHeight}px`
  }

  private layoutMoveHandle(startX: number, endX: number, trackTop: number, trackHeight: number): void {
    const selectedWidth = Math.abs(endX - startX)
    if (selectedWidth <= 0) {
      this._moveHandle.style.display = 'none'
      this._moveZone.style.display = 'none'
      return
    }
    const left = Math.min(startX, endX)
    const handleWidth = selectedWidth
    const top = clamp(trackTop - MOVE_HANDLE_HEIGHT, 0, Math.max(0, this._layout.height - MOVE_HANDLE_HEIGHT))
    const zoneExpandSize = Math.min(trackHeight / 2, Math.max(MOVE_HANDLE_HEIGHT, 10))
    this._moveHandle.style.display = 'flex'
    this._moveHandle.style.left = `${left}px`
    this._moveHandle.style.top = `${top}px`
    this._moveHandle.style.width = `${handleWidth}px`
    this._moveHandle.style.height = `${MOVE_HANDLE_HEIGHT}px`
    this._moveHandleSymbol.style.display = handleWidth >= MOVE_HANDLE_ICON_SIZE ? '' : 'none'

    this._moveZone.style.display = 'block'
    this._moveZone.style.left = `${left}px`
    this._moveZone.style.top = `${top}px`
    this._moveZone.style.width = `${handleWidth}px`
    this._moveZone.style.height = `${MOVE_HANDLE_HEIGHT + zoneExpandSize}px`
  }

  private updateDataShadow(width: number, height: number): void {
    const chartStore = this._chart.getChartStore()
    const dataVersion = chartStore.getDataVersion()
    const show = chartStore.getDataZoomSliderOptions().showDataShadow !== false
    if (
      this._shadowCache.dataVersion === dataVersion &&
      this._shadowCache.width === width &&
      this._shadowCache.height === height &&
      this._shadowCache.show === show
    ) {
      return
    }

    this._shadowCache.dataVersion = dataVersion
    this._shadowCache.width = width
    this._shadowCache.height = height
    this._shadowCache.show = show

    if (!show) {
      this.hideDataShadow()
      return
    }

    const paths = buildCloseShadowPaths(chartStore.getDataList(), width, height)
    if (paths.line === '') {
      this.hideDataShadow()
      return
    }
    this.showDataShadow(paths.area, paths.line)
  }

  private applyTheme(): void {
    const theme = this.getResolvedTheme()
    if (this._appliedTheme === theme) {
      this.applyHoverState()
      return
    }

    this._appliedTheme = theme
    const palette = SLIDER_PALETTES[theme]

    this._track.style.background = palette.trackBackground
    this._track.style.border = `1px solid ${palette.trackBorder}`
    this._shadowAreaPath.setAttribute('fill', palette.shadowArea)
    this._shadowPath.setAttribute('stroke', palette.shadowLine)
    this._selectedRange.style.background = palette.selectedBackground
    this._selectedRange.style.border = 'none'
    this._brushRect.style.background = 'rgba(135, 175, 247, 0.15)'
    this.applySideHandleTheme(this._startHandleSymbol, palette)
    this.applySideHandleTheme(this._endHandleSymbol, palette)
    this.applyMoveHandleTheme(palette)
    this.applyHoverState()
  }

  private showDataShadow(areaPath: string, linePath: string): void {
    this._shadowSvg.style.display = 'block'
    this._shadowAreaPath.setAttribute('d', areaPath)
    this._shadowPath.setAttribute('d', linePath)
  }

  private hideDataShadow(): void {
    this._shadowSvg.style.display = 'none'
    this._shadowAreaPath.setAttribute('d', '')
    this._shadowPath.setAttribute('d', '')
  }

  private applySideHandleTheme(symbol: SVGPathElement, palette: SliderPalette): void {
    symbol.setAttribute('fill', palette.handleFill)
  }

  private applyMoveHandleTheme(palette: SliderPalette): void {
    this._moveHandleSymbol.setAttribute('fill', palette.moveHandleIcon)
  }

  private setHoverTarget(target?: HoverTarget): void {
    this._hoverTarget = target
    this.applyHoverState()
  }

  private applyHoverState(): void {
    const palette = SLIDER_PALETTES[this.getResolvedTheme()]
    const moveHandleActive = this._hoverTarget === 'move' || (this._drag.target != null && this._drag.target !== 'brush')
    this._moveHandle.style.backgroundColor = moveHandleActive ? palette.moveHandleHoverBackground : palette.moveHandleBackground
    this._startHandleSymbol.setAttribute('stroke', this._hoverTarget === 'start' ? palette.handleHoverStroke : palette.handleStroke)
    this._endHandleSymbol.setAttribute('stroke', this._hoverTarget === 'end' ? palette.handleHoverStroke : palette.handleStroke)
  }

  private getResolvedTheme(): SliderResolvedTheme {
    const chartStore = this._chart.getChartStore()
    const sliderTheme = chartStore.getDataZoomSliderOptions().theme
    return resolveDataZoomSliderTheme(sliderTheme, chartStore.getStyleTheme())
  }

  private getRange(): PercentRange {
    return this._chart.getChartStore().getTimeScaleStore().getDataZoomRange() ?? { start: 0, end: 100 }
  }

  private getHandleRange(): PercentRange {
    const range = this.getRange()
    const handleRange = this._handleRange
    if (handleRange == null) {
      return range
    }
    if (!isSameRange(toOrderedRange(handleRange.start, handleRange.end), range)) {
      this._handleRange = undefined
      return range
    }
    return handleRange
  }

  private _pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary || this._activePointerId != null) {
      return
    }
    this.startInteraction(event.clientX, event)
  }

  private _stopClick = (event: MouseEvent): void => {
    event.stopPropagation()
  }

  private _moveHandleMouseEnter = (): void => {
    this.setHoverTarget('move')
  }

  private _moveHandleMouseLeave = (): void => {
    this.setHoverTarget(undefined)
  }

  private _startHandleMouseEnter = (): void => {
    this.setHoverTarget('start')
  }

  private _startHandleMouseLeave = (): void => {
    this.setHoverTarget(undefined)
  }

  private _endHandleMouseEnter = (): void => {
    this.setHoverTarget('end')
  }

  private _endHandleMouseLeave = (): void => {
    this.setHoverTarget(undefined)
  }

  private startInteraction(clientX: number, event: PointerEvent): void {
    if (this._chart.getDataList().length <= 3 || this._layout.width <= 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const x = this.clientXToLocal(clientX)
    const target = this.pickTarget(x, event.target)
    if (target === 'background') {
      if (this._chart.getChartStore().getDataZoomSliderOptions().brushSelect === true) {
        this.startBrush(x, event.pointerId)
      } else {
        this.moveRangeCenterTo(x)
      }
      return
    }

    if (target === 'range' && this._chart.getChartStore().getDataZoomSliderOptions().brushSelect === true) {
      this.startBrush(x, event.pointerId)
      return
    }

    this._activePointerId = event.pointerId
    this._drag.target = target === 'move' ? 'range' : target
    this._drag.startX = x
    this._drag.startRange = this.getHandleRange()
    this.applyHoverState()
    this.addDocumentListeners()
  }

  private startBrush(x: number, pointerId: number): void {
    this._activePointerId = pointerId
    this._drag.target = 'brush'
    this._brush.startX = x
    this._brush.endX = x
    this._container.style.cursor = 'crosshair'
    this.layoutBrushRect()
    this.addDocumentListeners()
  }

  private _pointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this._activePointerId) {
      return
    }
    this.dragTo(event.clientX, event)
  }

  private dragTo(clientX: number, event: PointerEvent): void {
    const target = this._drag.target
    if (target == null) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const x = this.clientXToLocal(clientX)
    if (target === 'brush') {
      this._brush.endX = x
      this.layoutBrushRect()
      return
    }

    const percent = this.localXToPercent(x)
    const range = this._drag.startRange

    if (target === 'start') {
      const nextRange = this.moveRange(range.start, range.end, percent - range.start, 0)
      this.updateDragRange(x, nextRange)
      return
    }
    if (target === 'end') {
      const nextRange = this.moveRange(range.start, range.end, percent - range.end, 1)
      this.updateDragRange(x, nextRange)
      return
    }

    this._handleRange = undefined
    const delta = this.localDistanceToPercent(x - this._drag.startX)
    const nextRange = this.moveRange(range.start, range.end, delta, 'all')
    this.updateDragRange(x, nextRange)
  }

  private _pointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this._activePointerId) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    this.endDrag()
  }

  private endDrag(): void {
    if (this._drag.target === 'brush') {
      this.endBrush()
    }
    this._drag.target = undefined
    this._activePointerId = undefined
    this._container.style.cursor = ''
    this.updateCursor()
    this.applyHoverState()
    this.removeDocumentListeners()
  }

  private endBrush(): void {
    const brushRange = getBrushRange(this._brush)
    this._brushRect.style.display = 'none'
    if (brushRange.width <= BRUSH_DRAG_THRESHOLD) {
      this.moveRangeCenterTo(brushRange.left)
      return
    }

    const start = this.localXToPercent(brushRange.left)
    const end = this.localXToPercent(brushRange.right)
    this.setRange(start, end)
  }

  private layoutBrushRect(): void {
    const brushRange = getBrushRange(this._brush)
    this._brushRect.style.display = 'block'
    this._brushRect.style.left = `${brushRange.left}px`
    this._brushRect.style.top = `${this._trackTop}px`
    this._brushRect.style.width = `${brushRange.width}px`
    this._brushRect.style.height = `${this._trackHeight}px`
  }

  private addDocumentListeners(): void {
    this.removeDocumentListeners()
    this.listenDocument('pointermove', this._pointerMove)
    this.listenDocument('pointerup', this._pointerEnd)
    this.listenDocument('pointercancel', this._pointerEnd)
  }

  private removeDocumentListeners(): void {
    this._documentEventDisposers.forEach(dispose => { dispose() })
    this._documentEventDisposers.length = 0
  }

  private pickTarget(x: number, eventTarget: EventTarget | null): SliderHitTarget {
    if (eventTarget instanceof Node && this._startHandle.contains(eventTarget)) {
      return 'start'
    }
    if (eventTarget instanceof Node && this._endHandle.contains(eventTarget)) {
      return 'end'
    }
    if (eventTarget instanceof Node && this._moveZone.contains(eventTarget)) {
      return 'move'
    }
    const range = this.getHandleRange()
    const startX = range.start / 100 * this._layout.width
    const endX = range.end / 100 * this._layout.width
    const left = Math.min(startX, endX)
    const right = Math.max(startX, endX)
    return x > left && x < right ? 'range' : 'background'
  }

  private updateCursor(): void {
    const brushSelect = this._chart.getChartStore().getDataZoomSliderOptions().brushSelect === true
    const cursor = brushSelect ? 'crosshair' : 'default'
    this._track.style.cursor = cursor
    this._selectedRange.style.cursor = cursor
  }

  private moveRangeCenterTo(x: number): void {
    const range = this.getRange()
    const center = this.localXToPercent(x)
    this._handleRange = undefined
    const nextRange = centerRangeAt(range, center)
    this.setRange(nextRange.start, nextRange.end)
  }

  private setRange(start: number, end: number): void {
    const range = toOrderedRange(start, end)
    const changed = this._chart.getChartStore().getTimeScaleStore().setDataZoomRange(range.start, range.end)
    if (!changed) {
      this.update()
    }
  }

  private updateDragRange(x: number, range?: PercentRange): void {
    updateDragRange(this._drag, x, range)
  }

  private moveRange(start: number, end: number, delta: number, handleIndex: 'all' | 0 | 1): PercentRange | undefined {
    const timeScaleStore = this._chart.getChartStore().getTimeScaleStore()
    const result = timeScaleStore.setDataZoomRangeByMove(start, end, delta, handleIndex)
    if (result == null) {
      this.update()
      return undefined
    }
    if (handleIndex !== 'all') {
      this._handleRange = { start: result.start, end: result.end }
    }
    if (!result.changed) {
      this.update()
    }
    return { start: result.start, end: result.end }
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

function createHandle(): { container: HTMLDivElement, symbol: SVGPathElement } {
  const container = createDom('div', {
    position: 'absolute',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    top: '0px',
    width: `${HANDLE_WIDTH}px`,
    height: '0px',
    transform: 'translateX(-50%)',
    background: 'transparent',
    backgroundImage: 'none',
    border: 'none',
    boxShadow: 'none',
    cursor: 'ew-resize'
  })
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.style.width = '10px'
  svg.style.height = '100%'
  svg.style.overflow = 'visible'
  svg.style.pointerEvents = 'none'
  svg.setAttribute('viewBox', '-13.35 2 8 40')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  const symbol = document.createElementNS(SVG_NS, 'path')
  symbol.setAttribute('d', DEFAULT_HANDLE_SYMBOL_PATH)
  symbol.setAttribute('stroke-width', '1')
  symbol.setAttribute('vector-effect', 'non-scaling-stroke')
  svg.appendChild(symbol)
  container.appendChild(svg)
  return { container, symbol }
}

function createMoveHandle(): { container: HTMLDivElement, symbol: SVGPathElement } {
  const container = createDom('div', {
    position: 'absolute',
    boxSizing: 'border-box',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    backgroundImage: 'none',
    boxShadow: 'none',
    borderTopLeftRadius: '2px',
    borderTopRightRadius: '2px',
    borderBottomLeftRadius: '0',
    borderBottomRightRadius: '0'
  })
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.style.width = `${MOVE_HANDLE_ICON_SIZE}px`
  svg.style.height = `${MOVE_HANDLE_ICON_SIZE}px`
  svg.style.overflow = 'visible'
  svg.style.pointerEvents = 'none'
  svg.setAttribute('viewBox', '-350 -55 280 175')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  const symbol = document.createElementNS(SVG_NS, 'path')
  symbol.setAttribute('d', DEFAULT_MOVE_HANDLE_SYMBOL_PATH)
  symbol.setAttribute('stroke', 'none')
  svg.appendChild(symbol)
  container.appendChild(svg)
  return { container, symbol }
}

function createMoveZone(): HTMLDivElement {
  return createDom('div', {
    position: 'absolute',
    display: 'none',
    boxSizing: 'border-box',
    background: 'transparent',
    cursor: 'default'
  })
}

function createSliderElements(): SliderElements {
  const container = createDom('div', {
    position: 'absolute',
    display: 'none',
    boxSizing: 'border-box',
    zIndex: '4',
    userSelect: 'none',
    touchAction: 'none'
  })
  const track = createDom('div', {
    position: 'absolute',
    boxSizing: 'border-box',
    cursor: 'default',
    overflow: 'hidden'
  })
  const shadowSvg = document.createElementNS(SVG_NS, 'svg')
  shadowSvg.style.position = 'absolute'
  shadowSvg.style.pointerEvents = 'none'
  shadowSvg.style.overflow = 'hidden'
  const shadowAreaPath = document.createElementNS(SVG_NS, 'path')
  shadowAreaPath.setAttribute('stroke', 'none')
  const shadowPath = document.createElementNS(SVG_NS, 'path')
  shadowPath.setAttribute('fill', 'none')
  shadowPath.setAttribute('stroke-width', '1')
  shadowSvg.appendChild(shadowAreaPath)
  shadowSvg.appendChild(shadowPath)

  const selectedRange = createDom('div', {
    position: 'absolute',
    boxSizing: 'border-box',
    cursor: 'default',
    overflow: 'visible'
  })
  const brushRect = createDom('div', {
    position: 'absolute',
    display: 'none',
    boxSizing: 'border-box',
    pointerEvents: 'none'
  })
  const moveHandle = createMoveHandle()
  const moveZone = createMoveZone()
  const startHandle = createHandle()
  const endHandle = createHandle()
  container.appendChild(track)
  container.appendChild(shadowSvg)
  container.appendChild(selectedRange)
  container.appendChild(moveHandle.container)
  container.appendChild(moveZone)
  container.appendChild(startHandle.container)
  container.appendChild(endHandle.container)
  container.appendChild(brushRect)

  return {
    container,
    track,
    shadowSvg,
    shadowAreaPath,
    shadowPath,
    selectedRange,
    brushRect,
    moveHandle: moveHandle.container,
    moveZone,
    moveHandleSymbol: moveHandle.symbol,
    startHandle: startHandle.container,
    endHandle: endHandle.container,
    startHandleSymbol: startHandle.symbol,
    endHandleSymbol: endHandle.symbol
  }
}

function computeSliderLayout(width: number, height: number, range: PercentRange): SliderLayout {
  const trackTop = MOVE_HANDLE_HEIGHT
  const trackHeight = Math.max(8, height - trackTop)
  const startX = range.start / 100 * width
  const endX = range.end / 100 * width
  return {
    width,
    trackTop,
    trackHeight,
    startX,
    endX,
    selectedRangeLeft: Math.min(startX, endX),
    selectedRangeWidth: Math.max(0, Math.abs(endX - startX))
  }
}

export function buildCloseLinePath(dataList: KLineData[], width: number, height: number): string {
  return buildCloseShadowPaths(dataList, width, height).line
}

export function buildCloseAreaPath(dataList: KLineData[], width: number, height: number): string {
  return buildCloseShadowPaths(dataList, width, height).area
}

export function resolveDataZoomSliderTheme(theme: DataZoomSliderTheme | undefined, chartTheme: SliderResolvedTheme): SliderResolvedTheme {
  return theme === 'dark' || theme === 'light' ? theme : chartTheme
}

function buildCloseShadowPaths(dataList: KLineData[], width: number, height: number): DataShadowPaths {
  if (dataList.length === 0 || width <= 0 || height <= 0) {
    return { line: '', area: '' }
  }

  let min = Number.MAX_SAFE_INTEGER
  let max = Number.MIN_SAFE_INTEGER
  dataList.forEach(data => {
    min = Math.min(min, data.close)
    max = Math.max(max, data.close)
  })

  const dataLastIndex = dataList.length - 1
  const maxPointCount = Math.max(1, Math.floor(width) + 1)
  const pointCount = Math.min(dataList.length, maxPointCount)
  const pointLastIndex = pointCount - 1
  const padding = Math.min(SHADOW_PADDING, height / 4)
  const availableHeight = Math.max(0, height - padding * 2)
  let firstX = 0
  let lastX = 0
  const commands: string[] = []
  for (let index = 0; index < pointCount; index++) {
    const dataIndex = pointLastIndex === 0 ? 0 : Math.round(index / pointLastIndex * dataLastIndex)
    const data = dataList[dataIndex]
    const x = pointLastIndex === 0 ? width / 2 : index / pointLastIndex * width
    const y = max === min ? height / 2 : padding + (max - data.close) / (max - min) * availableHeight
    if (index === 0) {
      firstX = x
    }
    lastX = x
    commands.push(`${index === 0 ? 'M' : 'L'} ${formatSvgNumber(x)} ${formatSvgNumber(y)}`)
  }
  const line = commands.join(' ')
  return {
    line,
    area: `${line} L ${formatSvgNumber(lastX)} ${formatSvgNumber(height)} L ${formatSvgNumber(firstX)} ${formatSvgNumber(height)} Z`
  }
}

function formatSvgNumber(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`
  }
  return value.toFixed(2)
}

function toOrderedRange(start: number, end: number): PercentRange {
  return start <= end ? { start, end } : { start: end, end: start }
}

function isSameRange(a: PercentRange, b: PercentRange): boolean {
  return a.start === b.start && a.end === b.end
}

export function updateDragRange(drag: { startX: number, startRange: PercentRange }, x: number, range?: PercentRange): void {
  if (range == null) {
    return
  }
  drag.startX = x
  drag.startRange = range
}

function centerRangeAt(range: PercentRange, center: number): PercentRange {
  const span = range.end - range.start
  const start = clamp(center - span / 2, 0, 100 - span)
  return {
    start,
    end: start + span
  }
}

function getBrushRange(brush: { startX: number, endX: number }): BrushRange {
  const left = Math.min(brush.startX, brush.endX)
  const right = Math.max(brush.startX, brush.endX)
  return {
    left,
    right,
    width: right - left
  }
}
