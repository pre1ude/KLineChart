import { UpdateLevel } from '../common/Updater'
import { isValid, isString, isNumber } from '../common/utils/typeChecks'
import { createId } from '../common/utils/id'
import type { IPoint, Point } from '../common/Point'
import type { EventOverlayInfo, OverlayCreate, OverlayFilter, OverlayProps } from '../component/Overlay'
import { OVERLAY_ID_PREFIX, Overlay } from '../component/Overlay'
import { getOverlayTemplate } from '../extension/overlay'
import type ChartStore from './ChartStore'
import { PaneIdConstants } from '../pane/types'
import { logWarn } from '@/common/utils/logger'

export type ProgressOverlay = Overlay

export default class OverlayStore {
  private readonly _chartStore: ChartStore

  private _instances = new Map<string, Overlay[]>()

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
  private _isDragging = false

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
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
   * 将内部 dataIndex 转换为外部 timestamp + offset
   */
  exportOverlay(id: string): { points: Array<Partial<Point>>, [key: string]: unknown } | undefined {
    const overlay = this.getInstanceById(id)
    if (!overlay) return undefined

    const externalPoints = overlay.points.map(p => this._chartStore.internalToExternal(p))

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
  exportAllOverlays(): Array<{ points: Array<Partial<Point>>, [key: string]: unknown }> {
    const result: Array<{ points: Array<Partial<Point>>, [key: string]: unknown }> = []
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

      // 尝试转换外部格式的点为内部格式
      let internalPoints: IPoint[] | undefined
      let skipDraw = false

      if (overlay.points && overlay.points.length > 0) {
        const converted = this._convertPoints(overlay.points)
        if (converted) {
          internalPoints = converted
        } else {
          // 转换失败，标记跳过绘制
          skipDraw = true
        }
      }

      const overlayInstance = new Overlay(overlayTemplate, {
        ...overlay,
        id,
        groupId,
        paneId: targetPaneId,
        zLevel,
        points: internalPoints,
        rawPoints: overlay.points,
      })
      overlayInstance.setSkipDraw(skipDraw)

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

  /**
   * 将外部格式的点转换为内部格式
   * @returns 转换成功返回内部格式点数组，失败返回 undefined
   */
  private _convertPoints(rawPoints: Point[]): IPoint[] | undefined {
    const internalPoints: IPoint[] = []

    for (const rawPoint of rawPoints) {
      const internal = this._chartStore.externalToInternal(rawPoint)
      // 检查转换是否有效（timestamp 不在数据范围内时 dataIndex 为 undefined）
      if (!isNumber(internal.dataIndex) || !isNumber(internal.value)) {
        return
      }
      internalPoints.push(internal as IPoint)
    }

    return internalPoints
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
    const updatePaneIds: string[] = []
    let shouldSort = false

    const instances = this.find(filter)

    instances.forEach(instance => {
      // 如果更新了 points，需要转换并更新
      let _props = props as Partial<Omit<OverlayProps, 'points'> & { points?: IPoint[] }>
      if (props.points) {
        instance.rawPoints = props.points
        const converted = this._convertPoints(props.points)
        instance.setSkipDraw(!converted)
        _props = { ...props, points: converted }
      }
      const changes = instance.shouldUpdate(_props)

      if (changes.sort) shouldSort = true
      if (changes.draw) {
        instance.update(_props)
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

  /**
   * 当向前加载数据时，更新 overlay 点的 dataIndex
   */
  updatePointPosition(offset: number): void {
    if (offset <= 0) return

    this._instances.forEach(overlays => {
      overlays.forEach(o => {
        if (!o.getSkipDraw()) {
          o.points.forEach(point => {
            point.dataIndex += offset
          })
        }
      })
    })

    if (this._progressOverlay) {
      this._progressOverlay.points.forEach(point => {
        point.dataIndex += offset
      })
    }
  }

  /**
   * 尝试恢复之前因为超出边界而 skipDraw 的 overlay
   * @param side 'left' 表示检查左侧超出的（向前加载后），'right' 表示检查右侧超出的（向后加载后）
   */
  tryRecoverSkippedOverlays(side: 'left' | 'right'): void {
    const dataList = this._chartStore.getDataList()
    if (dataList.length === 0) return

    const minTimestamp = dataList[0].timestamp
    const maxTimestamp = dataList[dataList.length - 1].timestamp

    const tryRecover = (overlay: Overlay): void => {
      if (!overlay.getSkipDraw() || !overlay.rawPoints) return

      // 检查是否是对应边界超出的情况
      const shouldTry = overlay.rawPoints.some(p => {
        if (!isNumber(p.timestamp)) return false
        if (side === 'left') {
          // 左侧超出：timestamp 小于数据源最小 timestamp
          return p.timestamp < minTimestamp
        }
        // 右侧超出：timestamp 大于数据源最大 timestamp
        return p.timestamp > maxTimestamp
      })

      if (shouldTry) {
        const converted = this._convertPoints(overlay.rawPoints)
        if (converted) {
          overlay.updateInternalPoints(converted)
        }
      }
    }

    this._instances.forEach(overlays => {
      overlays.forEach(tryRecover)
    })
  }

  /**
   * 数据替换前，将所有 overlay 的 points 转换为外部格式保存到 rawPoints
   */
  syncPointsToRaw(): void {
    const convert = (point: IPoint): Point => this._chartStore.internalToExternal(point) as Point

    this._instances.forEach(overlays => {
      overlays.forEach(o => {
        if (o.points.length > 0 && !o.getSkipDraw()) {
          o.rawPoints = o.points.map(convert)
        }
      })
    })

    if (this._progressOverlay) {
      this._progressOverlay.rawPoints = this._progressOverlay.points.map(convert)
    }
  }

  /**
   * 数据替换后，重新从 rawPoints 转换所有 overlay
   */
  reconvertAllFromRaw(): void {
    this._instances.forEach(overlays => {
      overlays.forEach(o => {
        if (o.rawPoints) {
          const converted = this._convertPoints(o.rawPoints)
          if (converted) {
            o.updateInternalPoints(converted)
          } else {
            o.setSkipDraw(true)
          }
        }
      })
    })

    if (this._progressOverlay?.rawPoints) {
      const converted = this._convertPoints(this._progressOverlay.rawPoints)
      if (converted) {
        this._progressOverlay.updateInternalPoints(converted)
      } else {
        this._progressOverlay.setSkipDraw(true)
      }
    }
  }
}
