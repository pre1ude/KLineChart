import { UpdateLevel } from '../common/Updater'
import { isValid, isString } from '../common/utils/typeChecks'
import { createId } from '../common/utils/id'
import { LoadDataType } from '../common/LoadDataCallback'
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

  /**
   * 全局选中的 overlay（用于跨 pane 共享选中状态）
   */
  private _selectedInfo?: EventOverlayInfo

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  setSelectedInfo(info?: EventOverlayInfo): void {
    this._selectedInfo = info
  }

  getSelectedInfo(): EventOverlayInfo | undefined {
    return this._selectedInfo
  }

  getInstanceById(id: string): Overlay | undefined {
    for (const entry of this._instances) {
      const paneShapes = entry[1]
      const overlay = paneShapes.find(s => s.id === id)
      if (isValid(overlay)) {
        return overlay
      }
    }
    if (this._progressOverlay && this._progressOverlay.id === id) {
      return this._progressOverlay
    }
    return undefined
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
      overlays.push(this._progressOverlay)
    }

    return overlays
  }

  private _sort(paneId?: string): void {
    if (isString(paneId)) {
      this._instances.get(paneId)?.sort((o1, o2) => o1.zLevel - o2.zLevel)
    } else {
      this._instances.forEach(paneInstances => {
        paneInstances.sort((o1, o2) => o1.zLevel - o2.zLevel)
      })
    }
  }

  addInstances(overlays: OverlayCreate[], paneId?: string): Array<string | undefined> {
    const updatePaneIds: string[] = []

    const ids = overlays.map((overlay) => {
      // 优先使用 overlay 自己的 paneId，否则使用参数 paneId，最后回退到 CANDLE
      const targetPaneId = overlay.paneId ?? paneId ?? PaneIdConstants.CANDLE

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
      const zLevel = overlay.zLevel ?? this.getInstances(targetPaneId).length

      const overlayInstance = new Overlay(overlayTemplate, {
        ...overlay,
        id,
        groupId,
        paneId: targetPaneId,
        zLevel
      })

      if (!updatePaneIds.includes(targetPaneId)) {
        updatePaneIds.push(targetPaneId)
      }

      if (!overlayInstance.isCompleted()) {
        this._progressOverlay = overlayInstance
      } else {
        if (!this._instances.has(targetPaneId)) {
          this._instances.set(targetPaneId, [])
        }
        this._instances.get(targetPaneId)?.push(overlayInstance)
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

  progressOverlayComplete(): void {
    if (this._progressOverlay?.isCompleted()) {
      const paneId = this._progressOverlay.paneId
      if (!this._instances.has(paneId)) {
        this._instances.set(paneId, [])
      }
      this._instances.get(paneId)?.push(this._progressOverlay)
      this._sort(paneId)
      this._progressOverlay = undefined
    }
  }

  updateProgressOverlayPane(paneId: string): void {
    if (this._progressOverlay) {
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
      // 检测变化
      const changes = instance.shouldUpdate(props)

      if (changes.sort) shouldSort = true
      // 如果有变化，更新
      if (changes.draw) {
        instance.update(props)
        if (!updatePaneIds.includes(instance.paneId)) {
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
      chart.updatePane(UpdateLevel.Overlay, paneId)
    })
    chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
  }

  removeInstance(filter?: OverlayFilter): boolean {
    const updatePaneIds: string[] = []

    if (!isValid(filter)) {
      // Remove all overlays
      if (this._progressOverlay) {
        if (!updatePaneIds.includes(this._progressOverlay.paneId)) {
          updatePaneIds.push(this._progressOverlay.paneId)
        }
        this._progressOverlay.onRemoved?.()
        this._progressOverlay = undefined
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

        if (!updatePaneIds.includes(targetPaneId)) {
          updatePaneIds.push(targetPaneId)
        }

        if (!instance.isCompleted()) {
          this._progressOverlay = undefined
        } else {
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

    if (updatePaneIds.length > 0) {
      this._redraw(updatePaneIds)
      return true
    }

    return false
  }

  updatePointPosition(dataChangeLength: number, type?: LoadDataType): void {
    if (dataChangeLength > 0) {
      const dataList = this._chartStore.getDataList()
      this._instances.forEach(overlays => {
        overlays.forEach(o => {
          const points = o.points
          points.forEach(point => {
            if (!isValid(point.timestamp) && isValid(point.dataIndex)) {
              if (type === LoadDataType.Backward) {
                point.dataIndex = point.dataIndex + dataChangeLength
              }
              const data = dataList[point.dataIndex]
              point.timestamp = data?.timestamp
            }
          })
        })
      })
    }
  }

  isEmpty(): boolean {
    return this._instances.size === 0 && !this._progressOverlay
  }
}
