import type DualYPane from '../pane/DualYPane'
import {
  type TooltipIconStyle,
  type TooltipLegend,
  type TooltipLegendChild,
  type TooltipTextStyle
} from '../common/Styles'
import type { TooltipIconClickEventData } from '../common/Action'
import type { TooltipIconIdentity } from '../common/Tooltip'
import { getTooltipDirectionVisual, type TooltipDirectionStyle } from '../common/TooltipDirection'
import type DrawWidget from '../widget/DrawWidget'
import { PaneIdConstants } from '../pane/types'
import type {
  RectTooltipBlock,
  StandardTooltipBlock,
  TooltipBlock,
  TooltipRenderModel
} from './TooltipModel'
import { CandleTooltipRectPosition } from '../common/Styles'

type BlockState = {
  root: HTMLDivElement
  type: TooltipBlock['type']
  contentNodes: HTMLSpanElement[]
  rowNodes: HTMLDivElement[]
  height: number
  resizeObserver?: ResizeObserver
}

export interface TooltipDomRendererInteractions {
  onIconEnter: (icon: TooltipIconClickEventData) => void
  onIconLeave: (icon: TooltipIconClickEventData) => void
  onIconClick: (icon: TooltipIconClickEventData) => void
}

function px(value: number): string {
  return `${value}px`
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    const textNode = element.firstChild
    if (textNode?.nodeType === Node.TEXT_NODE) {
      textNode.textContent = text
    } else {
      element.textContent = text
    }
  }
}

export default class TooltipDomRenderer {
  private readonly _widget: DrawWidget<DualYPane>
  private readonly _interactions: TooltipDomRendererInteractions
  private readonly _root: HTMLDivElement
  private readonly _blockStates: BlockState[] = []
  private readonly _iconCleanups = new Map<HTMLButtonElement, () => void>()
  private readonly _iconNodes = new Map<string, HTMLButtonElement>()
  private readonly _iconStyles = new Map<string, TooltipIconStyle>()
  private readonly _iconData = new WeakMap<HTMLButtonElement, TooltipIconClickEventData>()
  private _hoveredIconKey: string | null = null
  private _lastModel: TooltipRenderModel | null = null

  constructor(widget: DrawWidget<DualYPane>, interactions: TooltipDomRendererInteractions) {
    this._widget = widget
    this._interactions = interactions
    this._root = document.createElement('div')
    this._root.className = 'klinechart-tooltip'
    this._root.dataset.klinechartTooltipKind = widget.getPane().getId() === PaneIdConstants.CANDLE ? 'candle' : 'indicator'
    this._root.dataset.klinechartTooltipPaneId = widget.getPane().getId()
    this._root.hidden = true
    this._root.setAttribute('role', 'tooltip')
  }

  getElement(): HTMLElement {
    return this._root
  }

  attach(): void {
    if (this._root.parentElement == null) {
      this._widget.getContainer().appendChild(this._root)
    }
  }

  render(model: TooltipRenderModel): void {
    this._lastModel = model
    this.attach()
    if (!model.visible || model.blocks.length === 0) {
      this.hide()
      return
    }

    this._root.hidden = false
    this._root.dataset.klinechartTooltipPaneId = model.paneId
    const visibleStates: BlockState[] = []
    model.blocks.forEach((block, index) => {
      const state = this._ensureBlock(index, block.type)
      state.root.hidden = false
      state.root.style.marginTop = index === 0 ? px(block.top) : '0'
      if (block.type === 'standard') {
        this._renderStandardBlock(state, block, block.indicatorId.length > 0 ? model.directionStyle : undefined)
      } else {
        this._renderRectBlock(state, block, model.directionStyle)
      }
      visibleStates.push(state)
    })
    this._blockStates.slice(visibleStates.length).forEach(state => {
      state.root.hidden = true
    })
    this._repositionRectBlocks()
  }

  hide(): void {
    this._root.hidden = true
    this.setHoveredIcon(null)
  }

  destroy(): void {
    this._iconCleanups.forEach(cleanup => cleanup())
    this._iconCleanups.clear()
    this._blockStates.forEach(state => state.resizeObserver?.disconnect())
    this._iconNodes.clear()
    this._iconStyles.clear()
    this._lastModel = null
    this._root.remove()
    this._blockStates.length = 0
  }

  private _ensureBlock(index: number, type: TooltipBlock['type']): BlockState {
    let state = this._blockStates[index]
    if (state == null) {
      const root = document.createElement('div')
      root.dataset.klinechartTooltipBlock = type
      root.setAttribute('role', 'group')
      state = { root, type, contentNodes: [], rowNodes: [], height: 0 }
      state.resizeObserver = new ResizeObserver(entries => {
        if (this._root.hidden || state?.root.hidden) {
          return
        }
        const height = entries[0]?.contentRect.height ?? 0
        if (state?.height !== height) {
          state.height = height
          this._repositionRectBlocks()
        }
      })
      state.resizeObserver.observe(root)
      this._blockStates[index] = state
      this._root.appendChild(root)
    } else if (state.type !== type) {
      state.contentNodes.forEach(node => this._forgetIconNodes(node))
      state.root.replaceChildren()
      state.root.removeAttribute('style')
      state.root.dataset.klinechartTooltipBlock = type
      state.type = type
      state.contentNodes = []
      state.rowNodes = []
      state.height = 0
    }
    return state
  }

  private _renderStandardBlock(
    state: BlockState,
    block: StandardTooltipBlock,
    directionStyle?: TooltipDirectionStyle
  ): void {
    const { root } = state
    root.style.maxWidth = px(Math.max(0, block.maxWidth - block.left))
    root.style.marginLeft = px(block.left)
    root.style.backgroundColor = block.styles.showBackground ? block.styles.backgroundColor : 'transparent'
    root.dataset.klinechartTooltipBlock = 'standard'

    block.contents.forEach((content, index) => {
      const contentNode = this._ensureContentNode(state, index)
      contentNode.hidden = false
      contentNode.setAttribute('role', 'group')
      if (contentNode.dataset.klinechartTooltipContent !== content.type) {
        this._forgetIconNodes(contentNode)
        contentNode.replaceChildren()
        contentNode.dataset.klinechartTooltipContent = content.type
      }
      contentNode.dataset.klinechartTooltipSection = String(index)
      if (content.type === 'icons') {
        this._renderIconGroup(contentNode, content.icons, block)
      } else {
        this._renderLegendGroup(contentNode, content.legends, content.styles, directionStyle)
      }
    })
    state.contentNodes.slice(block.contents.length).forEach(node => {
      node.hidden = true
    })
  }

  private _renderIconGroup(node: HTMLSpanElement, icons: TooltipIconStyle[], block: StandardTooltipBlock): void {
    const existing = Array.from(node.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
    icons.forEach((icon, index) => {
      const iconNode = existing[index] ?? this._createIconNode()
      if (iconNode.parentElement !== node) {
        node.appendChild(iconNode)
      }
      iconNode.hidden = false
      iconNode.style.marginLeft = px(icon.marginLeft)
      iconNode.style.marginTop = px(icon.marginTop)
      iconNode.style.marginRight = px(icon.marginRight)
      iconNode.style.marginBottom = px(icon.marginBottom)
      iconNode.style.paddingLeft = px(icon.paddingLeft)
      iconNode.style.paddingTop = px(icon.paddingTop)
      iconNode.style.paddingRight = px(icon.paddingRight)
      iconNode.style.paddingBottom = px(icon.paddingBottom)
      iconNode.style.fontSize = px(icon.size)
      iconNode.style.lineHeight = px(icon.size)
      iconNode.style.fontFamily = icon.fontFamily
      const data: TooltipIconClickEventData = {
        paneId: block.paneId,
        indicatorId: block.indicatorId,
        indicatorName: block.indicatorName,
        iconId: icon.id
      }
      const key = this._iconKey(data)
      this._iconNodes.forEach((existingNode, existingKey) => {
        if (existingNode === iconNode && existingKey !== key) {
          this._iconNodes.delete(existingKey)
          this._iconStyles.delete(existingKey)
        }
      })
      this._iconData.set(iconNode, data)
      this._iconNodes.set(key, iconNode)
      this._iconStyles.set(key, icon)
      iconNode.dataset.klinechartTooltipRole = 'icon'
      iconNode.setAttribute('role', 'button')
      iconNode.dataset.klinechartTooltipIconId = icon.id
      iconNode.setAttribute('aria-label', `${block.indicatorName || 'candle'} ${icon.id}`)
      setText(iconNode, icon.icon)
      this._applyIconState(iconNode, icon, key)
    })
    existing.slice(icons.length).forEach(nodeToHide => {
      nodeToHide.hidden = true
    })
  }

  private _createIconNode(): HTMLButtonElement {
    const node = document.createElement('button')
    node.type = 'button'
    const onEnter = (): void => {
      const data = this._iconData.get(node)
      if (data) {
        this._interactions.onIconEnter(data)
      }
    }
    const onLeave = (): void => {
      const data = this._iconData.get(node)
      if (data) {
        this._interactions.onIconLeave(data)
      }
    }
    const onClick = (event: MouseEvent): void => {
      const data = this._iconData.get(node)
      if (data) {
        event.preventDefault()
        event.stopPropagation()
        this._interactions.onIconClick(data)
      }
    }
    const stopGesture = (event: Event): void => {
      event.stopPropagation()
    }
    node.addEventListener('mouseenter', onEnter)
    node.addEventListener('mouseleave', onLeave)
    node.addEventListener('click', onClick)
    node.addEventListener('mousedown', stopGesture)
    node.addEventListener('touchstart', stopGesture)
    this._iconCleanups.set(node, () => {
      node.removeEventListener('mouseenter', onEnter)
      node.removeEventListener('mouseleave', onLeave)
      node.removeEventListener('click', onClick)
      node.removeEventListener('mousedown', stopGesture)
      node.removeEventListener('touchstart', stopGesture)
    })
    return node
  }

  setHoveredIcon(icon: TooltipIconIdentity | null): void {
    const previousKey = this._hoveredIconKey
    const nextKey = icon ? this._iconKey(icon) : null
    if (previousKey === nextKey) {
      return
    }
    this._hoveredIconKey = nextKey
    if (previousKey != null) {
      this._patchIconState(previousKey)
    }
    if (nextKey != null) {
      this._patchIconState(nextKey)
    }
  }

  private _patchIconState(key: string): void {
    const node = this._iconNodes.get(key)
    const style = this._iconStyles.get(key)
    if (node && style) {
      node.style.outline = key === this._hoveredIconKey ? 'none' : ''
      this._applyIconState(node, style, key)
    }
  }

  private _applyIconState(node: HTMLButtonElement, icon: TooltipIconStyle, key: string): void {
    const active = key === this._hoveredIconKey
    node.style.color = active ? icon.activeColor : icon.color
    node.style.backgroundColor = active ? icon.activeBackgroundColor : icon.backgroundColor
  }

  private _renderLegendGroup(
    node: HTMLSpanElement,
    legends: TooltipLegend[],
    styles: TooltipTextStyle,
    directionStyle?: TooltipDirectionStyle
  ): void {
    const existing = Array.from(node.children).filter((child): child is HTMLSpanElement => child instanceof HTMLSpanElement)
    legends.forEach((legend, index) => {
      const row = existing[index] ?? document.createElement('span')
      if (row.parentElement !== node) {
        node.appendChild(row)
      }
      row.hidden = false
      row.style.marginLeft = px(styles.marginLeft)
      row.style.marginTop = px(styles.marginTop)
      row.style.marginRight = px(styles.marginRight)
      row.style.marginBottom = px(styles.marginBottom)
      row.style.fontSize = px(styles.size)
      row.style.lineHeight = px(styles.size)
      row.style.fontFamily = styles.fontFamily
      row.style.fontWeight = String(styles.weight)
      row.dataset.klinechartTooltipRole = 'legend'
      row.setAttribute('role', 'listitem')
      const title = this._ensureSpan(row, 0)
      const value = this._ensureSpan(row, 1)
      const titleData = this._getLegendChild(legend.title, styles.color)
      const valueData = this._getLegendChild(legend.value, styles.color)
      const directionData = getTooltipDirectionVisual(legend.direction, directionStyle)
      const valueText = this._ensureSpan(value, 0)
      const direction = this._ensureSpan(value, 1)
      title.dataset.klinechartTooltipRole = 'title'
      value.dataset.klinechartTooltipRole = 'value'
      valueText.dataset.klinechartTooltipRole = 'value-text'
      direction.dataset.klinechartTooltipRole = 'direction'
      title.style.color = titleData.color
      value.style.color = valueData.color
      valueText.style.color = valueData.color
      direction.style.color = directionData?.color ?? ''
      direction.hidden = directionData == null
      setText(title, titleData.text)
      setText(valueText, valueData.text)
      setText(direction, directionData?.text ?? '')
    })
    existing.slice(legends.length).forEach(row => {
      row.hidden = true
    })
  }

  private _renderRectBlock(
    state: BlockState,
    block: RectTooltipBlock,
    directionStyle?: TooltipDirectionStyle
  ): void {
    const { root } = state
    const candleTooltip = block.styles.candle.tooltip
    const indicatorTooltip = block.styles.indicator.tooltip
    root.dataset.klinechartTooltipBlock = 'rect'

    const rows: Array<{ legend: TooltipLegend, styles: TooltipTextStyle, showDirection: boolean }> = []
    if (block.drawCandle) {
      block.candleLegends.forEach(legend => rows.push({ legend, styles: candleTooltip.text, showDirection: false }))
    }
    if (block.drawIndicator) {
      block.indicatorLegends.forEach(legends => legends.forEach(legend => rows.push({ legend, styles: indicatorTooltip.text, showDirection: true })))
    }

    const rectStyle = candleTooltip.rect
    const height = rectStyle.borderSize * 2 + rectStyle.paddingTop + rectStyle.paddingBottom + rows.reduce((total, row) => total + row.styles.marginTop + row.styles.marginBottom + row.styles.size, 0)
    state.height = height
    root.style.height = px(height)
    const rect = this._ensureRectNode(root)
    rect.style.paddingLeft = px(rectStyle.paddingLeft)
    rect.style.paddingTop = px(rectStyle.paddingTop)
    rect.style.paddingRight = px(rectStyle.paddingRight)
    rect.style.paddingBottom = px(rectStyle.paddingBottom)
    rect.style.border = `${rectStyle.borderSize}px solid ${rectStyle.borderColor}`
    rect.style.borderRadius = px(rectStyle.borderRadius)
    rect.style.backgroundColor = typeof rectStyle.color === 'string' ? rectStyle.color : 'transparent'
    rect.style.height = px(height)
    rect.dataset.klinechartTooltipRole = 'rect'

    rows.forEach((rowData, index) => {
      const row = this._ensureRow(rect, state, index)
      row.hidden = false
      row.dataset.klinechartTooltipRole = 'rect-row'
      row.style.marginTop = px(rowData.styles.marginTop)
      row.style.marginLeft = px(rowData.styles.marginLeft)
      row.style.marginRight = px(rowData.styles.marginRight)
      row.style.marginBottom = px(rowData.styles.marginBottom)
      row.style.fontSize = px(rowData.styles.size)
      row.style.lineHeight = px(rowData.styles.size)
      row.style.fontFamily = rowData.styles.fontFamily
      row.style.fontWeight = String(rowData.styles.weight)
      const title = this._ensureSpan(row, 0)
      const value = this._ensureSpan(row, 1)
      const titleData = this._getLegendChild(rowData.legend.title, rowData.styles.color)
      const valueData = this._getLegendChild(rowData.legend.value, rowData.styles.color)
      const directionData = rowData.showDirection
        ? getTooltipDirectionVisual(rowData.legend.direction, directionStyle)
        : undefined
      const valueText = this._ensureSpan(value, 0)
      const direction = this._ensureSpan(value, 1)
      title.dataset.klinechartTooltipRole = 'title'
      value.dataset.klinechartTooltipRole = 'value'
      valueText.dataset.klinechartTooltipRole = 'value-text'
      direction.dataset.klinechartTooltipRole = 'direction'
      title.style.color = titleData.color
      value.style.color = valueData.color
      valueText.style.color = valueData.color
      direction.style.color = directionData?.color ?? ''
      direction.hidden = directionData == null
      setText(title, titleData.text)
      setText(valueText, valueData.text)
      setText(direction, directionData?.text ?? '')
    })
    state.rowNodes.slice(rows.length).forEach(row => {
      row.hidden = true
    })
  }

  private _positionRect(rect: HTMLDivElement, block: RectTooltipBlock, height: number, blockTop: number): void {
    const { bounding, crosshair, styles } = block
    const tooltip = styles.candle.tooltip
    const rectStyle = tooltip.rect
    const isPointer = rectStyle.position === CandleTooltipRectPosition.Pointer && crosshair.paneId === PaneIdConstants.CANDLE
    const isLeft = (crosshair.realX ?? 0) > bounding.width / 2
    const axisOffset = styles.yAxis.inside
      ? (isLeft ? block.yLeftAxisWidth : block.yRightAxisWidth)
      : 0
    rect.style.top = px(rectStyle.offsetTop)
    if (isPointer) {
      const x = crosshair.realX ?? 0
      rect.style.left = isLeft ? 'auto' : px(x + rectStyle.offsetLeft)
      rect.style.right = isLeft ? px(bounding.width - x + rectStyle.offsetRight) : 'auto'
      let y = (crosshair.y ?? 0) - height / 2 - blockTop
      y = Math.max(rectStyle.offsetTop + tooltip.offsetTop, y)
      y = Math.min(bounding.height - rectStyle.offsetBottom - height - tooltip.offsetBottom - blockTop, y)
      rect.style.top = px(Math.max(0, y))
    } else if (isLeft) {
      rect.style.left = px(rectStyle.offsetLeft + tooltip.offsetLeft + axisOffset)
      rect.style.right = 'auto'
    } else {
      rect.style.left = 'auto'
      rect.style.right = px(rectStyle.offsetRight + tooltip.offsetRight + axisOffset)
    }
  }

  private _ensureContentNode(state: BlockState, index: number): HTMLSpanElement {
    let node = state.contentNodes[index]
    if (node == null) {
      node = document.createElement('span')
      state.contentNodes[index] = node
      state.root.appendChild(node)
    }
    return node
  }

  private _forgetIconNodes(parent: HTMLElement): void {
    Array.from(parent.querySelectorAll('button')).forEach(node => {
      this._iconNodes.forEach((existingNode, key) => {
        if (existingNode === node) {
          this._iconNodes.delete(key)
          this._iconStyles.delete(key)
        }
      })
      this._iconCleanups.get(node)?.()
      this._iconCleanups.delete(node)
      this._iconData.delete(node)
    })
  }

  private _repositionRectBlocks(): void {
    const model = this._lastModel
    if (!model?.visible) {
      return
    }

    let flowTop = 0
    model.blocks.forEach((block, index) => {
      const state = this._blockStates[index]
      if (state == null) {
        return
      }
      const blockTop = flowTop + (index === 0 ? block.top : 0)
      if (block.type === 'rect') {
        const rect = this._ensureRectNode(state.root)
        this._positionRect(rect, block, state.height, blockTop)
      }
      flowTop = blockTop + state.height
    })
  }

  private _ensureRectNode(root: HTMLElement): HTMLDivElement {
    const existing = Array.from(root.children).find(child => child instanceof HTMLDivElement)
    if (existing) return existing
    const node = document.createElement('div')
    root.appendChild(node)
    return node
  }

  private _ensureRow(parent: HTMLElement, state: BlockState, index: number): HTMLDivElement {
    let row = state.rowNodes[index]
    if (row == null) {
      row = document.createElement('div')
      state.rowNodes[index] = row
      parent.appendChild(row)
    } else if (row.parentElement !== parent) {
      parent.appendChild(row)
    }
    return row
  }

  private _ensureSpan(parent: HTMLElement, index: number): HTMLSpanElement {
    let span = parent.children[index] as HTMLSpanElement | undefined
    if (!(span instanceof HTMLSpanElement)) {
      span = document.createElement('span')
      parent.appendChild(span)
    }
    return span
  }

  private _getLegendChild(value: string | TooltipLegendChild, color: string): TooltipLegendChild {
    return typeof value === 'string' ? { text: value, color } : value
  }

  private _iconKey(icon: TooltipIconIdentity): string {
    return `${icon.paneId}:${icon.indicatorId}:${icon.iconId}`
  }
}
