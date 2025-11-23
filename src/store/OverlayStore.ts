
import type Nullable from '../common/Nullable'
import { UpdateLevel } from '../common/Updater'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { isFunction, isValid, isString, isBoolean, isArray } from '../common/utils/typeChecks'
import { createId } from '../common/utils/id'
import { LoadDataType } from '../common/LoadDataCallback'
import type { OverlayCreate, OverlayFilter } from '../component/Overlay'
import { OVERLAY_ID_PREFIX, Overlay } from '../component/Overlay'
import { getOverlayClass } from '../extension/overlay'
import type ChartStore from './ChartStore'
import { PaneIdConstants } from '../pane/types'

export interface ProgressOverlayInfo {
  paneId: string
  instance: Overlay
  appointPaneFlag: boolean
}

export const enum EventOverlayInfoFigureType {
  None, Point, Other
}

export interface EventOverlayInfo {
  paneId: string
  instance: Nullable<Overlay>
  figureType: EventOverlayInfoFigureType
  figureKey: string
  figureIndex: number
  attrsIndex: number
}

export default class OverlayStore {
  private readonly _chartStore: ChartStore

  private _instances = new Map<string, Overlay[]>()

  /**
   * Overlay information in painting
   */
  private _progressInstanceInfo: Nullable<ProgressOverlayInfo> = null

  /**
   * Overlay information by the mouse pressed
   */
  private _pressedInstanceInfo: EventOverlayInfo = {
    paneId: '',
    instance: null,
    figureType: EventOverlayInfoFigureType.None,
    figureKey: '',
    figureIndex: -1,
    attrsIndex: -1
  }

  /**
   * Overlay information by hover
   */
  private _hoverInstanceInfo: EventOverlayInfo = {
    paneId: '',
    instance: null,
    figureType: EventOverlayInfoFigureType.None,
    figureKey: '',
    figureIndex: -1,
    attrsIndex: -1
  }

  /**
   * Overlay information by the mouse click
   */
  private _clickInstanceInfo: EventOverlayInfo = {
    paneId: '',
    instance: null,
    figureType: EventOverlayInfoFigureType.None,
    figureKey: '',
    figureIndex: -1,
    attrsIndex: -1
  }

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  getInstanceById(id: string): Nullable<Overlay> {
    for (const entry of this._instances) {
      const paneShapes = entry[1]
      const overlay = paneShapes.find(s => s.id === id)
      if (isValid(overlay)) {
        return overlay
      }
    }
    if (this._progressInstanceInfo !== null) {
      if (this._progressInstanceInfo.instance.id === id) {
        return this._progressInstanceInfo.instance
      }
    }
    return null
  }

  getInstancesByFilter(filter: OverlayFilter): Overlay[] {
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

    const progressInstance = this._progressInstanceInfo?.instance
    if (isValid(progressInstance) && match(progressInstance)) {
      overlays.push(progressInstance)
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

  addInstances(overlays: OverlayCreate[], paneId: string | string[], appointPaneFlag: boolean | boolean[]): Array<Nullable<string>> {
    const updatePaneIds: string[] = []
    const paneIds = isArray(paneId) ? paneId : overlays.map(() => paneId)
    const appointPaneFlags = isArray(appointPaneFlag) ? appointPaneFlag : overlays.map(() => appointPaneFlag)

    const ids = overlays.map((overlay, index) => {
      const targetPaneId = paneIds[index] ?? PaneIdConstants.CANDLE

      // Check if ID already exists
      if (isValid(overlay.id)) {
        const existingOverlay = this.getInstanceById(overlay.id)
        if (existingOverlay !== null) {
          return overlay.id
        }
      }

      const overlayTemplate = getOverlayClass(overlay.name)
      if (overlayTemplate !== null) {
        const id = overlay.id ?? createId(OVERLAY_ID_PREFIX)
        const overlayInstance = new Overlay(overlayTemplate)

        overlay.id = id
        overlay.groupId ??= id
        overlay.paneId = targetPaneId

        // Auto-assign zLevel if not provided
        if (!isValid(overlay.zLevel)) {
          overlay.zLevel = this.getInstances(targetPaneId).length
        }

        overlayInstance.override(overlay)

        if (!updatePaneIds.includes(targetPaneId)) {
          updatePaneIds.push(targetPaneId)
        }

        if (overlayInstance.isDrawing()) {
          this._progressInstanceInfo = {
            paneId: targetPaneId,
            instance: overlayInstance,
            appointPaneFlag: appointPaneFlags[index]
          }
        } else {
          if (!this._instances.has(targetPaneId)) {
            this._instances.set(targetPaneId, [])
          }
          this._instances.get(targetPaneId)?.push(overlayInstance)
        }

        if (overlayInstance.isStart()) {
          overlayInstance.onDrawStart?.({ overlay: overlayInstance })
        }

        return id
      }
      return null
    })

    if (updatePaneIds.length > 0) {
      this._sort()
      const chart = this._chartStore.getChart()
      updatePaneIds.forEach(pid => {
        chart.updatePane(UpdateLevel.Overlay, pid)
      })
      chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
    }

    return ids
  }

  getProgressInstanceInfo(): Nullable<ProgressOverlayInfo> {
    return this._progressInstanceInfo
  }

  progressInstanceComplete(): void {
    if (this._progressInstanceInfo !== null) {
      const { instance, paneId } = this._progressInstanceInfo
      if (!instance.isDrawing) {
        if (!this._instances.has(paneId)) {
          this._instances.set(paneId, [])
        }
        this._instances.get(paneId)?.push(instance)
        this._sort(paneId)
        this._progressInstanceInfo = null
      }
    }
  }

  updateProgressInstanceInfo(paneId: string, appointPaneFlag?: boolean): void {
    if (this._progressInstanceInfo !== null) {
      if (isBoolean(appointPaneFlag) && appointPaneFlag) {
        this._progressInstanceInfo.appointPaneFlag = appointPaneFlag
      }
      this._progressInstanceInfo.paneId = paneId
      this._progressInstanceInfo.instance.paneId = paneId
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

  override(overlay: Partial<OverlayCreate>): boolean {
    let sortFlag = false
    const updatePaneIds: string[] = []

    const filterInstances = this.getInstancesByFilter(overlay)

    filterInstances.forEach(instance => {
      instance.override(overlay)
      const { sort, draw } = instance.shouldUpdate()

      if (sort) {
        sortFlag = true
      }
      if (sort || draw) {
        if (!updatePaneIds.includes(instance.paneId)) {
          updatePaneIds.push(instance.paneId)
        }
      }
    })

    if (sortFlag) {
      this._sort()
    }

    if (updatePaneIds.length > 0) {
      const chart = this._chartStore.getChart()
      updatePaneIds.forEach(paneId => {
        chart.updatePane(UpdateLevel.Overlay, paneId)
      })
      chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
      return true
    }

    return false
  }

  removeInstance(filter?: OverlayFilter): boolean {
    const updatePaneIds: string[] = []

    if (!isValid(filter)) {
      // Remove all overlays
      if (this._progressInstanceInfo !== null) {
        updatePaneIds.push(this._progressInstanceInfo.paneId)
        this._progressInstanceInfo.instance.onRemoved?.({ overlay: this._progressInstanceInfo.instance })
        this._progressInstanceInfo = null
      }

      this._instances.forEach((paneInstances, paneId) => {
        updatePaneIds.push(paneId)
        paneInstances.forEach(instance => {
          instance.onRemoved?.({ overlay: instance })
        })
      })
      this._instances.clear()
    } else {
      // Remove filtered overlays
      const filterInstances = this.getInstancesByFilter(filter)

      filterInstances.forEach(instance => {
        const targetPaneId = instance.paneId
        const paneInstances = this.getInstances(targetPaneId)

        instance.onRemoved?.({ overlay: instance })

        if (!updatePaneIds.includes(targetPaneId)) {
          updatePaneIds.push(targetPaneId)
        }

        if (instance.isDrawing()) {
          this._progressInstanceInfo = null
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
      const chart = this._chartStore.getChart()
      updatePaneIds.forEach(paneId => {
        chart.updatePane(UpdateLevel.Overlay, paneId)
      })
      chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
      return true
    }

    return false
  }

  setPressedInstanceInfo(info: EventOverlayInfo): void {
    this._pressedInstanceInfo = info
  }

  getPressedInstanceInfo(): EventOverlayInfo {
    return this._pressedInstanceInfo
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

  setHoverInstanceInfo(info: EventOverlayInfo, event: MouseTouchEvent): void {
    const { instance, figureType, figureKey, figureIndex } = this._hoverInstanceInfo
    if (
      instance?.id !== info.instance?.id ||
      figureType !== info.figureType ||
      figureIndex !== info.figureIndex
    ) {
      this._hoverInstanceInfo = info
      if (instance?.id !== info.instance?.id) {
        let ignoreUpdateFlag = false
        let sortFlag = false

        // Handle mouse leave
        if (instance !== null) {
          instance.setPrevZLevel(instance.zLevel)
          instance.override({ zLevel: instance.getPrevZLevel() })
          sortFlag = true
          if (isFunction(instance.onMouseLeave)) {
            instance.onMouseLeave({ overlay: instance, figureKey, figureIndex, ...event })
            ignoreUpdateFlag = true
          }
        }

        // Handle mouse enter
        if (info.instance !== null) {
          info.instance.setPrevZLevel(info.instance.zLevel)
          info.instance.override({ zLevel: Number.MAX_SAFE_INTEGER })
          sortFlag = true
          if (isFunction(info.instance.onMouseEnter)) {
            info.instance.onMouseEnter({ overlay: info.instance, figureKey: info.figureKey, figureIndex: info.figureIndex, ...event })
            ignoreUpdateFlag = true
          }
        }

        if (sortFlag) {
          this._sort()
        }
        if (!ignoreUpdateFlag) {
          this._chartStore.getChart().updatePane(UpdateLevel.Overlay)
        }
      }
    }
  }

  getHoverInstanceInfo(): EventOverlayInfo {
    return this._hoverInstanceInfo
  }

  setClickInstanceInfo(info: EventOverlayInfo, event: MouseTouchEvent): void {
    const { paneId, instance, figureType, figureKey, figureIndex } = this._clickInstanceInfo
    if (!(info.instance?.isDrawing ?? false)) {
      info.instance?.onClick?.({ overlay: info.instance, figureKey: info.figureKey, figureIndex: info.figureIndex, ...event })
    }
    if (instance?.id !== info.instance?.id || figureType !== info.figureType || figureIndex !== info.figureIndex) {
      this._clickInstanceInfo = info
      if (instance?.id !== info.instance?.id) {
        instance?.onDeselected?.({ overlay: instance, figureKey, figureIndex, ...event })
        info.instance?.onSelected?.({ overlay: info.instance, figureKey: info.figureKey, figureIndex: info.figureIndex, ...event })
        const chart = this._chartStore.getChart()
        chart.updatePane(UpdateLevel.Overlay, info.paneId)
        if (paneId !== info.paneId) {
          chart.updatePane(UpdateLevel.Overlay, paneId)
        }
        chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
      }
    }
  }

  getClickInstanceInfo(): EventOverlayInfo {
    return this._clickInstanceInfo
  }

  isEmpty(): boolean {
    return this._instances.size === 0 && this._progressInstanceInfo === null
  }

  isDrawing(): boolean {
    return this._progressInstanceInfo !== null && (this._progressInstanceInfo.instance.isDrawing() ?? false)
  }
}
