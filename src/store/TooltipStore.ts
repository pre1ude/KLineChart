import type KLineData from '../common/KLineData'
import type Crosshair from '../common/Crosshair'
import { UpdateLevel } from '../common/Updater'
import { isNumber } from '../common/utils/typeChecks'
import type ChartStore from './ChartStore'
import { clamp } from '@/common/utils/number'

export interface TooltipIcon {
  paneId: string
  indicatorId: string
  indicatorName: string
  iconId: string
}

export default class TooltipStore {
  private readonly _chartStore: ChartStore
  private _crosshair: Crosshair = {}
  private _activeIcon: TooltipIcon | null = null

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  /**
    * 设置十字光标点信息
    * @param crosshair
    * @param options
    */
  setCrosshair(crosshair?: Crosshair, options?: { notInvalidate?: boolean, notExecuteAction?: boolean }): void {
    const { notInvalidate, notExecuteAction } = options ?? {}
    const dataList = this._chartStore.getDataList()
    const cr = crosshair ?? {}
    let realDataIndex: number
    let dataIndex: number
    let kLineData: KLineData | undefined
    let realX: number | undefined

    // 当有数据时，计算数据索引和 kLineData
    if (dataList.length > 0) {
      if (isNumber(cr.x)) {
        realDataIndex = this._chartStore.getTimeScaleStore()
          .coordinateToDataIndex(cr.x)
        dataIndex = clamp(realDataIndex, 0, dataList.length - 1)
      } else {
        realDataIndex = dataList.length - 1
        dataIndex = realDataIndex
      }
      kLineData = dataList[dataIndex]
      realX = this._chartStore.getTimeScaleStore()
        .dataIndexToCoordinate(realDataIndex)
    } else {
      // 没有数据时，仍然允许垂直线跟随鼠标移动
      kLineData = undefined
      realX = isNumber(cr.x) ? cr.x : undefined
      realDataIndex = -1
      dataIndex = -1
    }

    const prevCrosshair = { x: this._crosshair.x, y: this._crosshair.y, paneId: this._crosshair.paneId }
    this._crosshair = { ...cr, realX, kLineData, realDataIndex, dataIndex }
    if (
      prevCrosshair.x !== cr.x || prevCrosshair.y !== cr.y || prevCrosshair.paneId !== cr.paneId
    ) {
      if (kLineData !== undefined && !(notExecuteAction ?? false)) {
        this._chartStore.getChart().onCrosshairChange(this._crosshair)
      }
      if (!(notInvalidate ?? false)) {
        this._chartStore.getChart().updatePane(UpdateLevel.Overlay)
      }
    }
  }

  /**
   * 重新计算十字光标
   * @param notInvalidate
   */
  recalculateCrosshair(notInvalidate: boolean): void {
    this.setCrosshair(this._crosshair, { notInvalidate })
  }

  /**
   * 获取crosshair信息
   * @returns
   */
  getCrosshair(): Crosshair {
    return this._crosshair
  }

  setActiveIcon(icon: TooltipIcon | null): void {
    this._activeIcon = icon
  }

  getActiveIcon() {
    return this._activeIcon
  }

  clear(): void {
    this.setCrosshair({}, { notInvalidate: true })
    this.setActiveIcon(null)
  }
}
