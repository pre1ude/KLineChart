import { UpdateLevel } from '../common/Updater'
import { isValid, isString, isNumber } from '../common/utils/typeChecks'
import { createId } from '../common/utils/id'
import { isValidPointOffset, type IPoint, type Point } from '../common/Point'
import type { EventOverlayInfo, OverlayCreate, OverlayFilter, OverlayProps } from '../component/Overlay'
import { OVERLAY_ID_PREFIX, Overlay } from '../component/Overlay'
import { getOverlayTemplate } from '../extension/overlay'
import type ChartStore from './ChartStore'
import { PaneIdConstants } from '../pane/types'
import { logWarn } from '@/common/utils/logger'

export type ProgressOverlay = Overlay

interface OverlayProjectionCache {
  dataVersion: number
  points: Array<{ timestamp: number, offset: number, dataIndex: number | undefined }>
}

export default class OverlayStore {
  private readonly _chartStore: ChartStore

  private _instances = new Map<string, Overlay[]>()
  private readonly _projectionCache = new WeakMap<Pick<Overlay, 'points'>, OverlayProjectionCache>()

  /**
   * Overlay in painting
   */
  private _progressOverlay?: ProgressOverlay
  private _progressPaneId = ''

  /**
   * 全局选中的 overlay（用于跨 pane 共享选中状态）
   */
  private _selectedInfo?: EventOverlayInfo
  private _hoverInfo?: EventOverlayInfo
  private _isPressed = false
  private _isDragging = false

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  /** Shared derived geometry; the Overlay itself never retains chart services. */
  getProjectedPoints(overlay: Pick<Overlay, 'points'>): IPoint[] | undefined {
    const dataVersion = this._chartStore.getDataVersion()
    let cache = this._projectionCache.get(overlay)
    if (cache?.dataVersion !== dataVersion) {
      cache = { dataVersion, points: [] }
      this._projectionCache.set(overlay, cache)
    }
    const indices = cache.points
    indices.length = overlay.points.length
    const projected: IPoint[] = []
    let resolved = true
    overlay.points.forEach((point, index) => {
      const offset = point.offset ?? 0
      let cached = indices[index]
      if (cached?.timestamp !== point.timestamp || cached?.offset !== offset) {
        cached = {
          timestamp: point.timestamp,
          offset,
          dataIndex: this._chartStore.externalToInternal(point).dataIndex
        }
        indices[index] = cached
      }
      if (isNumber(cached.dataIndex)) {
        projected.push({ dataIndex: cached.dataIndex, value: point.value })
      } else {
        resolved = false
      }
    })
    return resolved ? projected : undefined
  }

  setSelectedInfo(info?: EventOverlayInfo): void {
    this._selectedInfo = info
  }

  getSelectedInfo(): EventOverlayInfo | undefined {
    return this._selectedInfo
  }

  clearSelectedInfo(): void {
    this._selectedInfo = undefined
  }

  setHoverInfo(info?: EventOverlayInfo): void {
    this._hoverInfo = info
  }

  getHoverInfo(): EventOverlayInfo | undefined {
    return this._hoverInfo
  }

  clearHoverInfo(): EventOverlayInfo | undefined {
    const info = this._hoverInfo
    this._hoverInfo = undefined
    return info
  }

  setPressed(pressed: boolean): void {
    this._isPressed = pressed
  }

  isPressed(): boolean {
    return this._isPressed
  }

  setDragging(dragging: boolean): void {
    this._isDragging = dragging
  }

  isDragging(): boolean {
    return this._isDragging
  }

  getInstanceById(id: string): Overlay | undefined {
    for (const entry of this._instances) {
      const paneShapes = entry[1]
      const overlay = paneShapes.find(s => s.id === id)
      if (isValid(overlay)) {
        return overlay
      }
    }
    if (this._progressOverlay?.id === id) {
      return this._progressOverlay
    }
    return undefined
  }

  /**
   * 导出 overlay 数据为外部格式（用于持久化）
   * 直接复制时间点，不依赖当前行情窗口或绘图缓存
   */
  exportOverlay(id: string): { points: Point[], [key: string]: unknown } | undefined {
    const overlay = this.getInstanceById(id)
    if (!overlay) return undefined

    const externalPoints = overlay.points.map(point => ({ ...point }))

    return {
      id: overlay.id,
      groupId: overlay.groupId,
      paneId: overlay.paneId,
      name: overlay.name,
      lock: overlay.lock,
      visible: overlay.visible,
      zLevel: overlay.zLevel,
      mode: overlay.mode,
      modeSensitivity: overlay.modeSensitivity,
      extendData: overlay.extendData,
      styles: overlay.styles,
      points: externalPoints
    }
  }

  /**
   * 导出所有 overlay 数据为外部格式
   */
  exportAllOverlays(): Array<{ points: Point[], [key: string]: unknown }> {
    const result: Array<{ points: Point[], [key: string]: unknown }> = []
    this._instances.forEach(overlays => {
      overlays.forEach(overlay => {
        const exported = this.exportOverlay(overlay.id)
        if (exported) {
          result.push(exported)
        }
      })
    })
    return result
  }

  find(filter: OverlayFilter): Overlay[] {
    const { id, groupId, paneId, name } = filter

    const match = (overlay: Overlay): boolean => {
      if (isValid(id)) {
        return overlay.id === id
      }

      if (isValid(groupId)) {
        return overlay.groupId === groupId && (!isValid(name) || overlay.name === name)
      }

      return !isValid(name) || overlay.name === name
    }

    let overlays: Overlay[] = []

    if (isValid(paneId)) {
      overlays = overlays.concat(this.getInstances(paneId).filter(match))
    } else {
      this._instances.forEach(paneInstances => {
        overlays = overlays.concat(paneInstances.filter(match))
      })
    }

    if (this._progressOverlay && match(this._progressOverlay)) {
      if (!isValid(paneId)) {
        overlays.push(this._progressOverlay)
      } else if (this.getProgressOverlayPaneId() === paneId) {
        overlays.push(this._progressOverlay)
      }
    }

    return overlays
  }

  private _sort(paneId?: string): void {
    const sortByExplicitZLevel = (paneInstances: Overlay[]): void => {
      const overlaysWithExplicitZLevel: Array<{ overlay: Overlay, zLevel: number }> = []
      const overlaysWithoutExplicitZLevel: Overlay[] = []

      paneInstances.forEach((overlay) => {
        if (isNumber(overlay.zLevel)) {
          overlaysWithExplicitZLevel.push({ overlay, zLevel: overlay.zLevel })
        } else {
          overlaysWithoutExplicitZLevel.push(overlay)
        }
      })

      if (overlaysWithExplicitZLevel.length === 0) {
        return
      }

      overlaysWithExplicitZLevel.sort((o1, o2) => o1.zLevel - o2.zLevel)

      paneInstances.length = 0
      paneInstances.push(
        ...overlaysWithoutExplicitZLevel,
        ...overlaysWithExplicitZLevel.map(item => item.overlay)
      )
    }

    if (isString(paneId)) {
      const paneInstances = this._instances.get(paneId)
      if (paneInstances) {
        sortByExplicitZLevel(paneInstances)
      }
    } else {
      this._instances.forEach(paneInstances => {
        sortByExplicitZLevel(paneInstances)
      })
    }
  }

  addInstances(overlays: OverlayCreate[], paneId?: string): Array<string | undefined> {
    const updatePaneIds: string[] = []

    const ids = overlays.map((overlay) => {
      if (overlay.points?.some(point => !isValidPointOffset(point))) {
        logWarn('createOverlay', 'points.offset', 'offset must be an integer.')
        return undefined
      }
      // 显式指定 pane 时直接使用；未显式指定时先不绑定 pane（首次点击再落位）
      const overlayPaneId = isString(overlay.paneId) && overlay.paneId.length > 0 ? overlay.paneId : undefined
      const fallbackPaneId = isString(paneId) && paneId.length > 0 ? paneId : undefined
      const targetPaneId = overlayPaneId ?? fallbackPaneId ?? ''

      // Check if ID already exists
      if (isValid(overlay.id)) {
        const existingOverlay = this.getInstanceById(overlay.id)
        if (existingOverlay) {
          return overlay.id
        }
      }

      const overlayTemplate = getOverlayTemplate(overlay.name)
      if (!overlayTemplate) {
        logWarn('createOverlay', overlay.name, 'overlay not supported, you may need to use registerOverlay to add one!!!')
        return undefined
      }

      const id = overlay.id ?? createId(OVERLAY_ID_PREFIX)
      const groupId = overlay.groupId ?? id
      const zLevel = overlay.zLevel ?? overlayTemplate.zLevel

      const overlayInstance = new Overlay(overlayTemplate, {
        ...overlay,
        id,
        groupId,
        paneId: targetPaneId,
        zLevel
      })

      // 已完成且未指定 pane 的 overlay 仍按历史行为回退到主图
      if (overlayInstance.isCompleted() && targetPaneId.length === 0) {
        overlayInstance.paneId = PaneIdConstants.CANDLE
      }

      if (!overlayInstance.isCompleted()) {
        const hoverInfo = this.clearHoverInfo()
        const hoverPaneId = hoverInfo?.paneId
        if (hoverPaneId != null && hoverPaneId.length > 0 && !updatePaneIds.includes(hoverPaneId)) {
          updatePaneIds.push(hoverPaneId)
        }
        this._progressOverlay = overlayInstance
        this._progressPaneId = targetPaneId
      } else {
        const completedPaneId = overlayInstance.paneId
        if (!this._instances.has(completedPaneId)) {
          this._instances.set(completedPaneId, [])
        }
        this._instances.get(completedPaneId)?.push(overlayInstance)
      }

      const redrawPaneId = overlayInstance.paneId
      if (redrawPaneId.length > 0 && !updatePaneIds.includes(redrawPaneId)) {
        updatePaneIds.push(redrawPaneId)
      }

      return id
    })

    if (updatePaneIds.length > 0) {
      this._sort()
      this._redraw(updatePaneIds)
    }

    return ids
  }

  getProgressOverlay(): ProgressOverlay | undefined {
    return this._progressOverlay
  }

  getProgressOverlayPaneId(): string {
    return this._progressOverlay ? this._progressPaneId : ''
  }

  progressOverlayComplete(): void {
    if (this._progressOverlay?.isCompleted()) {
      const paneId = this._progressPaneId.length > 0
        ? this._progressPaneId
        : PaneIdConstants.CANDLE
      this._progressOverlay.paneId = paneId
      if (!this._instances.has(paneId)) {
        this._instances.set(paneId, [])
      }
      this._instances.get(paneId)?.push(this._progressOverlay)
      this._sort(paneId)
      this._progressOverlay = undefined
      this._progressPaneId = ''
    }
  }

  updateProgressOverlayPane(paneId: string): void {
    if (this._progressOverlay && this._progressPaneId.length === 0 && paneId.length > 0) {
      this._progressPaneId = paneId
      this._progressOverlay.paneId = paneId
    }
  }

  getInstances(paneId?: string): Overlay[] {
    if (!isString(paneId)) {
      let instances: Overlay[] = []
      this._instances.forEach(paneInstances => {
        instances = instances.concat(paneInstances)
      })
      return instances
    }
    return this._instances.get(paneId) ?? []
  }

  update(filter: OverlayFilter, props: Partial<OverlayProps>): boolean {
    if (props.points?.some(point => !isValidPointOffset(point))) {
      logWarn('overrideOverlay', 'points.offset', 'offset must be an integer.')
      return false
    }
    const updatePaneIds: string[] = []
    let shouldSort = false

    const instances = this.find(filter)

    instances.forEach(instance => {
      const changes = instance.shouldUpdate(props)

      if (changes.sort) shouldSort = true
      if (changes.draw) {
        instance.update(props)
        if (instance.paneId.length > 0 && !updatePaneIds.includes(instance.paneId)) {
          updatePaneIds.push(instance.paneId)
        }
      }
    })

    // 应用副作用
    if (shouldSort) this._sort()
    if (updatePaneIds.length > 0) {
      this._redraw(updatePaneIds)
      return true
    }

    return false
  }

  _redraw(updatePaneIds: string[]): void {
    const chart = this._chartStore.getChart()
    updatePaneIds.forEach(paneId => {
      if (paneId.length > 0) {
        chart.updatePane(UpdateLevel.Overlay, paneId)
      }
    })
    chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
  }

  removeInstance(filter?: OverlayFilter): boolean {
    const updatePaneIds: string[] = []
    let shouldRedrawAllOverlay = false

    if (!isValid(filter)) {
      // Remove all overlays
      if (this._progressOverlay) {
        const progressPaneId = this.getProgressOverlayPaneId()
        if (progressPaneId.length > 0 && !updatePaneIds.includes(progressPaneId)) {
          updatePaneIds.push(progressPaneId)
        } else if (progressPaneId.length === 0) {
          // Progress overlay can be drawn on hovered pane before first click binding.
          // When it is removed while still unbound, we don't know a single target pane to refresh.
          shouldRedrawAllOverlay = true
        }
        this._progressOverlay.onRemoved?.()
        this._progressOverlay = undefined
        this._progressPaneId = ''
      }

      this._instances.forEach((paneInstances, paneId) => {
        updatePaneIds.push(paneId)
        paneInstances.forEach(instance => {
          instance.onRemoved?.()
        })
      })
      this._instances.clear()
      this._hoverInfo = undefined
      this._selectedInfo = undefined
      this._isPressed = false
      this._isDragging = false
    } else {
      // Remove filtered overlays
      const filterInstances = this.find(filter)

      filterInstances.forEach(instance => {
        const targetPaneId = instance.paneId
        const paneInstances = this.getInstances(targetPaneId)

        instance.onRemoved?.()

        if (!instance.isCompleted()) {
          const progressPaneId = this.getProgressOverlayPaneId()
          if (progressPaneId.length > 0 && !updatePaneIds.includes(progressPaneId)) {
            updatePaneIds.push(progressPaneId)
          } else if (progressPaneId.length === 0) {
            // Same reason as above: unbound progress overlay may have been rendered on hovered pane.
            shouldRedrawAllOverlay = true
          }
          this._progressOverlay = undefined
          this._progressPaneId = ''
        } else {
          if (!updatePaneIds.includes(targetPaneId)) {
            updatePaneIds.push(targetPaneId)
          }
          const index = paneInstances.findIndex(o => o.id === instance.id)
          if (index > -1) {
            paneInstances.splice(index, 1)
          }
        }

        // Clean up empty pane
        if (paneInstances.length === 0) {
          this._instances.delete(targetPaneId)
        }

        if (this._hoverInfo?.overlay === instance) {
          this._hoverInfo = undefined
        }

        if (this._selectedInfo?.overlay === instance) {
          this._selectedInfo = undefined
          this._isPressed = false
          this._isDragging = false
        }
      })
    }

    if (shouldRedrawAllOverlay) {
      this._chartStore.getChart().updatePane(UpdateLevel.Overlay)
      return true
    }

    if (updatePaneIds.length > 0) {
      this._redraw(updatePaneIds)
      return true
    }

    return false
  }
}
