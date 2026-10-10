import type KLineData from '../common/KLineData'
import type Crosshair from '../common/Crosshair'
import { UpdateLevel } from '../common/Updater'
import { isBoolean, isNumber } from '../common/utils/typeChecks'
import type ChartStore from './ChartStore'
import { clamp } from '@/common/utils/number'
import type { TooltipOptions, TooltipRenderType } from '../Options'

export default class TooltipStore {
  private readonly _chartStore: ChartStore
  private _crosshair: Crosshair = {}
  private readonly _renderType: TooltipRenderType
  private _showValueDirection = true

  constructor(chartStore: ChartStore, options?: TooltipOptions) {
    this._chartStore = chartStore
    this._renderType = options?.renderType === 'dom' ? 'dom' : 'canvas'
    this.setOptions(options)
  }

  getRenderType(): TooltipRenderType {
    return this._renderType
  }

  setOptions(options?: TooltipOptions): void {
    if (isBoolean(options?.showValueDirection)) {
      this._showValueDirection = options.showValueDirection
    }
  }

  getShowValueDirection(): boolean {
    return this._showValueDirection
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
        const current = this._crosshair
        this._chartStore.dispatchDataEffect(() => this._chartStore.getChart().onCrosshairChange(current), 'crosshair')
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

  clear(): void {
    this.setCrosshair({}, { notInvalidate: true })
  }
}
