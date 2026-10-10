import { isValid, isString, isNumber } from '../common/utils/typeChecks'
import { createId } from '../common/utils/id'
import { copyPoint, isValidPointOffset, type IPoint, type Point } from '../common/Point'
import type { EventOverlayInfo, OverlayCreate, OverlayFilter, OverlayPointsChangeEvent, OverlayProps } from '../component/Overlay'
import { OVERLAY_ID_PREFIX, Overlay } from '../component/Overlay'
import { getOverlayTemplate } from '../extension/overlay'
import type ChartStore from './ChartStore'
import { UpdateLevel } from '../common/Updater'
import { PaneIdConstants } from '../pane/types'
import { logWarn } from '@/common/utils/logger'
import { snapshotDrawingProperties } from '../component/drawing/snapshot'
import { EventPhase, type MouseTouchEvent } from '../common/SyntheticEvent'
import { createOverlayEventFromInfo } from '../common/utils/overlayEvent'

export type ProgressOverlay = Overlay

export default class OverlayStore {
  private readonly _chartStore: ChartStore
  private readonly _instances = new Map<string, Overlay[]>()
  private readonly _byId = new Map<string, Overlay>()
  private readonly _indexCache = new WeakMap<Pick<Overlay, 'points'>, { version: number, points: Array<{ timestamp: number, offset: number, dataIndex: number | undefined }> }>()
  private _progressOverlay?: ProgressOverlay
  private _progressPaneId = ''
  private _selectedInfo?: EventOverlayInfo
  private _hoverInfo?: EventOverlayInfo
  private _isPressed = false
  private _isDragging = false

  constructor(chartStore: ChartStore) { this._chartStore = chartStore }

  private _mutate<T>(operation: () => T): T { return this._chartStore.batchEffects(operation) }

  /** Shared geometry; callers receive their own array, not the source cache. */
  getProjectedPoints(overlay: Pick<Overlay, 'points'>): IPoint[] | undefined {
    const points = overlay.points
    const version = this._chartStore.getTimeIndexVersion()
    let cache = this._indexCache.get(overlay)
    if (cache?.version !== version) {
      cache = { version, points: [] }
      this._indexCache.set(overlay, cache)
    }
    cache.points.length = points.length
    const projected = points.map((point, index) => {
      let cached = cache.points[index]
      const offset = point.offset ?? 0
      if (cached?.timestamp !== point.timestamp || cached.offset !== offset) {
        cached = { timestamp: point.timestamp, offset, dataIndex: this._chartStore.externalToInternal(point).dataIndex }
        cache.points[index] = cached
      }
      return { dataIndex: cached.dataIndex, value: point.value }
    })
    return projected.every(point => isNumber(point.dataIndex) && isNumber(point.value)) ? projected as IPoint[] : undefined
  }

  notifyPointsChange(overlay: Overlay, source: OverlayPointsChangeEvent['source'], previous: Point[]): void {
    if (!overlay.onPointsChange) return
    const points = overlay.points.map(copyPoint)
    const previousPoints = previous.map(copyPoint)
    this._chartStore.dispatchEffect(() => {
      if (this.getInstanceById(overlay.id) === overlay) overlay.onPointsChange?.({ overlay, source, previousPoints, points })
    })
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

  deselectOverlay(event?: MouseTouchEvent): void {
    const selected = this.getSelectedInfo()
    if (!selected) return
    const input: MouseTouchEvent = event ?? { x: 0, y: 0, pageX: 0, pageY: 0, nativeEvent: new Event('drawing-deselect') as MouseEvent, eventPhase: EventPhase.AT_TARGET, propagationStopped: false, isImmediate: false, stopPropagation() {}, stopImmediatePropagation() {} }
    this.clearSelectedInfo()
    this._chartStore.getChart().updatePane(UpdateLevel.Overlay, selected.paneId)
    this._chartStore.getChart().updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
    selected.overlay.onDeselected?.(createOverlayEventFromInfo(input, selected, this._chartStore))
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
    return this._byId.get(id)
  }

  /**
   * 导出 overlay 数据为外部格式（用于持久化）
   * 直接复制时间点，不依赖当前行情窗口或绘图缓存
   */
  exportOverlay(id: string): OverlayCreate | undefined {
    const overlay = this.getInstanceById(id)
    if (!overlay) return undefined

    const externalPoints = overlay.points.map(copyPoint)

    return {
      ...snapshotDrawingProperties(overlay),
      id: overlay.id,
      name: overlay.name,
      points: externalPoints
    }
  }

  /**
   * 导出所有 overlay 数据为外部格式
   */
  exportAllOverlays(): OverlayCreate[] {
    const result: OverlayCreate[] = []
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
    if (isValid(id)) {
      const overlay = this.getInstanceById(id)
      const targetPane = overlay === this._progressOverlay ? this._progressPaneId : overlay?.paneId
      return overlay && (!isValid(paneId) || targetPane === paneId) ? [overlay] : []
    }

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
    return this._mutate(() => this._addInstances(overlays, paneId))
  }

  private _addInstances(overlays: OverlayCreate[], paneId?: string): Array<string | undefined> {
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
        // Ordinary creation can replace the single unfinished drawing too.
        if (this._progressOverlay) this._byId.delete(this._progressOverlay.id)
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
      this._byId.set(id, overlayInstance)

      const redrawPaneId = overlayInstance.paneId
      if (redrawPaneId.length > 0 && !updatePaneIds.includes(redrawPaneId)) {
        updatePaneIds.push(redrawPaneId)
      }

      this._chartStore.dispatchLifecycleEffect(() => {
        if (this.getInstanceById(id) === overlayInstance) overlayInstance.onCreated?.()
      })
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
    return this._mutate(() => this._update(filter, props))
  }

  private _update(filter: OverlayFilter, props: Partial<OverlayProps>): boolean {
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
        const previousPoints = props.points ? instance.points.map(point => ({ ...point })) : undefined
        instance.update(props)
        if (previousPoints) this.notifyPointsChange(instance, 'api', previousPoints)
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

  private _notifyRemoved(overlay: Overlay): void {
    this._chartStore.dispatchLifecycleEffect(() => overlay.onRemoved?.())
  }

  resetInstance(id: string): void {
    this._mutate(() => {
      const overlay = this.getInstanceById(id)
      if (!overlay) return
      const previous = overlay.points.map(copyPoint)
      overlay.reset()
      this.notifyPointsChange(overlay, 'api', previous)
    })
  }

  removeInstance(filter?: OverlayFilter): boolean {
    return this._mutate(() => this._removeInstance(filter))
  }

  private _removeInstance(filter?: OverlayFilter): boolean {
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
        this._notifyRemoved(this._progressOverlay)
        this._progressOverlay = undefined
        this._progressPaneId = ''
      }

      this._instances.forEach((paneInstances, paneId) => {
        updatePaneIds.push(paneId)
        paneInstances.forEach(instance => {
          this._notifyRemoved(instance)
        })
      })
      this._instances.clear()
      this._byId.clear()
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

        this._notifyRemoved(instance)
        this._byId.delete(instance.id)

        if (instance === this._progressOverlay) {
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
