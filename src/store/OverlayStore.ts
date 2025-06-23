/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type Nullable from '../common/Nullable'
import { UpdateLevel } from '../common/Updater'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { isFunction, isValid, isString, isBoolean, isNumber, isArray, merge } from '../common/utils/typeChecks'
import { createId } from '../common/utils/id'
import { LoadDataType } from '../common/LoadDataCallback'
import type { OverlayCreate, OverlayRemove } from '../component/Overlay'
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

  constructor (chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  private _overrideInstance (instance: Overlay, overlay: Partial<OverlayCreate>): [boolean, boolean] {
    const {
      id, groupId, points, styles, lock, visible,
      zLevel, mode, modeSensitivity, extendData,
      onDrawStart, onDrawing,
      onDrawEnd, onClick, onDoubleClick, onRightClick,
      onPressedMoveStart, onPressedMoving, onPressedMoveEnd,
      onMouseEnter, onMouseLeave,
      onRemoved, onSelected, onDeselected
    } = overlay
    let updateFlag = false
    let sortFlag = false
    if (isString(id)) {
      instance.id = id
    }
    if (isString(groupId)) {
      instance.groupId = groupId
    }
    if (isBoolean(lock)) {
      instance.lock = lock
    }
    if (isArray(points) && instance.setPoints(points)) {
      updateFlag = true
    }
    if (isValid(styles) && instance.styles !== styles) {
      merge(instance.styles, styles)
      updateFlag = true
    }
    if (isBoolean(visible) && instance.visible !== visible) {
      instance.visible = visible
      updateFlag = true
    }
    if (isNumber(zLevel) && instance.zLevel !== zLevel) {
      instance.zLevel = zLevel
      updateFlag = true
      sortFlag = true
    }
    if (extendData !== undefined && instance.extendData !== extendData) {
      instance.extendData = extendData
      updateFlag = true
    }
    if (isValid(mode)) {
      instance.mode = mode
    }
    if (isNumber(modeSensitivity)) {
      instance.modeSensitivity = modeSensitivity
    }
    if (onDrawStart !== undefined) {
      instance.onDrawStart = onDrawStart
    }
    if (onDrawing !== undefined) {
      instance.onDrawing = onDrawing
    }
    if (onDrawEnd !== undefined) {
      instance.onDrawEnd = onDrawEnd
    }
    if (onClick !== undefined) {
      instance.onClick = onClick
    }
    if (onDoubleClick !== undefined) {
      instance.onDoubleClick = onDoubleClick
    }
    if (onRightClick !== undefined) {
      instance.onRightClick = onRightClick
    }
    if (onPressedMoveStart !== undefined) {
      instance.onPressedMoveStart = onPressedMoveStart
    }
    if (onPressedMoving !== undefined) {
      instance.onPressedMoving = onPressedMoving
    }
    if (onPressedMoveEnd !== undefined) {
      instance.onPressedMoveEnd = onPressedMoveEnd
    }
    if (onMouseEnter !== undefined) {
      instance.onMouseEnter = onMouseEnter
    }
    if (onMouseLeave !== undefined) {
      instance.onMouseLeave = onMouseLeave
    }
    if (onRemoved !== undefined) {
      instance.onRemoved = onRemoved
    }
    if (onSelected !== undefined) {
      instance.onSelected = onSelected
    }
    if (onDeselected !== undefined) {
      instance.onDeselected = onDeselected
    }
    return [updateFlag, sortFlag]
  }

  getInstanceById (id: string): Nullable<Overlay> {
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

  private _sort (paneId?: string): void {
    if (isString(paneId)) {
      this._instances.get(paneId)?.sort((o1, o2) => o1.zLevel - o2.zLevel)
    } else {
      this._instances.forEach(paneInstances => {
        paneInstances.sort((o1, o2) => o1.zLevel - o2.zLevel)
      })
    }
  }

  addInstances (overlays: OverlayCreate[], paneId: string, appointPaneFlag: boolean): Array<Nullable<string>> {
    const ids = overlays.map(overlay => {
      const id = overlay.id ?? createId(OVERLAY_ID_PREFIX)
      if (this.getInstanceById(id) === null) {
        const overlayTemplate = getOverlayClass(overlay.name)
        if (overlayTemplate !== null) {
          const overlayInstance = new Overlay(overlayTemplate)
          overlayInstance.paneId = paneId
          const groupId = overlay.groupId ?? id
          overlay.id = id
          overlay.groupId = groupId
          this._overrideInstance(overlayInstance, overlay)
          if (overlayInstance.isDrawing) {
            this._progressInstanceInfo = { paneId, instance: overlayInstance, appointPaneFlag }
          } else {
            if (!this._instances.has(paneId)) {
              this._instances.set(paneId, [])
            }
            this._instances.get(paneId)?.push(overlayInstance)
          }
          if (overlayInstance.isStart) {
            overlayInstance.onDrawStart?.(({ overlay: overlayInstance }))
          }
          return id
        }
      }
      return null
    })
    if (ids.some(id => id !== null)) {
      this._sort()
      const chart = this._chartStore.getChart()
      chart.updatePane(UpdateLevel.Overlay, paneId)
      chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
    }
    return ids
  }

  getProgressInstanceInfo (): Nullable<ProgressOverlayInfo> {
    return this._progressInstanceInfo
  }

  progressInstanceComplete (): void {
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

  updateProgressInstanceInfo (paneId: string, appointPaneFlag?: boolean): void {
    if (this._progressInstanceInfo !== null) {
      if (isBoolean(appointPaneFlag) && appointPaneFlag) {
        this._progressInstanceInfo.appointPaneFlag = appointPaneFlag
      }
      this._progressInstanceInfo.paneId = paneId
      this._progressInstanceInfo.instance.paneId = paneId
    }
  }

  getInstances (paneId?: string): Overlay[] {
    if (!isString(paneId)) {
      let instances: Overlay[] = []
      this._instances.forEach(paneInstances => {
        instances = instances.concat(paneInstances)
      })
      return instances
    }
    return this._instances.get(paneId) ?? []
  }

  override (overlay: Partial<OverlayCreate>): void {
    const { id, groupId, name } = overlay
    let updateFlag = false
    let sortFlag = false

    const setFlag: (instance: Overlay) => void = (instance: Overlay) => {
      const flags = this._overrideInstance(instance, overlay)
      if (flags[0]) {
        updateFlag = true
      }
      if (flags[1]) {
        sortFlag = true
      }
    }

    if (isString(id)) {
      const instance = this.getInstanceById(id)
      if (instance !== null) {
        setFlag(instance)
      }
    } else {
      const nameValid = isString(name)
      const groupIdValid = isString(groupId)
      this._instances.forEach(paneInstances => {
        paneInstances.forEach(instance => {
          if (
            (nameValid && instance.name === name) ||
            (groupIdValid && instance.groupId === groupId) ||
            (!nameValid && !groupIdValid)
          ) {
            setFlag(instance)
          }
        })
      })
      if (this._progressInstanceInfo !== null) {
        const progressInstance = this._progressInstanceInfo.instance
        if (
          (nameValid && progressInstance.name === name) ||
          (groupIdValid && progressInstance.groupId === groupId) ||
          (!nameValid && !groupIdValid)
        ) {
          setFlag(progressInstance)
        }
      }
    }
    if (sortFlag) {
      this._sort()
    }
    if (updateFlag) {
      this._chartStore.getChart().updatePane(UpdateLevel.Overlay)
    }
  }

  removeInstance (overlayRemove?: OverlayRemove): void {
    const match: ((remove: OverlayRemove, overlay: Overlay) => boolean) = (remove: OverlayRemove, overlay: Overlay) => {
      if (isString(remove.id)) {
        if (overlay.id !== remove.id) {
          return false
        }
      } else {
        if (isString(remove.groupId)) {
          if (overlay.groupId !== remove.groupId) {
            return false
          }
        } else {
          if (isString(remove.name)) {
            if (overlay.name !== remove.name) {
              return false
            }
          }
        }
      }
      return true
    }

    const updatePaneIds: string[] = []
    const overlayRemoveValid = isValid(overlayRemove)
    if (this._progressInstanceInfo !== null) {
      const { instance } = this._progressInstanceInfo
      if (
        !overlayRemoveValid ||
        (overlayRemoveValid && match(overlayRemove, instance))
      ) {
        updatePaneIds.push(this._progressInstanceInfo.paneId)
        instance.onRemoved?.({ overlay: instance })
        this._progressInstanceInfo = null
      }
    }
    if (overlayRemoveValid) {
      const instances = new Map<string, Overlay[]>()
      for (const entry of this._instances) {
        const paneInstances = entry[1]
        const newPaneInstances = paneInstances.filter(instance => {
          if (match(overlayRemove, instance)) {
            if (!updatePaneIds.includes(entry[0])) {
              updatePaneIds.push(entry[0])
            }
            instance.onRemoved?.({ overlay: instance })
            return false
          }
          return true
        })
        if (newPaneInstances.length > 0) {
          instances.set(entry[0], newPaneInstances)
        }
      }
      this._instances = instances
    } else {
      this._instances.forEach((paneInstances, paneId) => {
        updatePaneIds.push(paneId)
        paneInstances.forEach(instance => {
          instance.onRemoved?.({ overlay: instance })
        })
      })
      this._instances.clear()
    }
    if (updatePaneIds.length > 0) {
      const chart = this._chartStore.getChart()
      updatePaneIds.forEach(paneId => {
        chart.updatePane(UpdateLevel.Overlay, paneId)
      })
      chart.updatePane(UpdateLevel.Overlay, PaneIdConstants.X_AXIS)
    }
  }

  setPressedInstanceInfo (info: EventOverlayInfo): void {
    this._pressedInstanceInfo = info
  }

  getPressedInstanceInfo (): EventOverlayInfo {
    return this._pressedInstanceInfo
  }

  updatePointPosition (dataChangeLength: number, type?: LoadDataType): void {
    if (dataChangeLength > 0) {
      const dataList = this._chartStore.getDataList()
      this._instances.forEach(overlays => {
        overlays.forEach(o => {
          const points = o.points
          points.forEach(point => {
            if (!isValid(point.timestamp) && isValid(point.dataIndex)) {
              if (type === LoadDataType.Forward) {
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

  setHoverInstanceInfo (info: EventOverlayInfo, event: MouseTouchEvent): void {
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
        if (instance !== null) {
          sortFlag = true
          if (isFunction(instance.onMouseLeave)) {
            instance.onMouseLeave({ overlay: instance, figureKey, figureIndex, ...event })
            ignoreUpdateFlag = true
          }
        }

        if (info.instance !== null) {
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

  getHoverInstanceInfo (): EventOverlayInfo {
    return this._hoverInstanceInfo
  }

  setClickInstanceInfo (info: EventOverlayInfo, event: MouseTouchEvent): void {
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

  getClickInstanceInfo (): EventOverlayInfo {
    return this._clickInstanceInfo
  }

  isEmpty (): boolean {
    return this._instances.size === 0 && this._progressInstanceInfo === null
  }

  isDrawing (): boolean {
    return this._progressInstanceInfo !== null && (this._progressInstanceInfo?.instance.isDrawing ?? false)
  }
}
