import type Bounding from '../common/Bounding'
import { UpdateLevel } from '../common/Updater'
import { type MouseTouchEvent } from '../common/SyntheticEvent'
import { ActionType } from '../common/Action'
import { createDom } from '../common/utils/dom'
import { throttle } from '../common/utils/performance'
import Widget from './Widget'
import { WidgetNameConstants, REAL_SEPARATOR_HEIGHT } from './types'
import type SeparatorPane from '../pane/SeparatorPane'
import type DualYPane from '../pane/DualYPane'
import { PaneIdConstants } from '../pane/types'

interface MainFlexPaneResizeParams {
  dragDistance: number
  targetPaneStartHeight: number
  targetPaneMinHeight: number
  mainPaneStartHeight: number
  mainPaneMinHeight: number
}

export function calculateMainFlexPaneResize({
  dragDistance,
  targetPaneStartHeight,
  targetPaneMinHeight,
  mainPaneStartHeight,
  mainPaneMinHeight
}: MainFlexPaneResizeParams): { targetPaneHeight: number, mainPaneHeight: number } {
  const wantedTargetPaneHeight = targetPaneStartHeight - dragDistance
  const minTargetPaneHeight = Math.max(targetPaneMinHeight, 0)
  const minMainPaneHeight = Math.max(mainPaneMinHeight, 0)
  const maxTargetPaneHeight = targetPaneStartHeight + Math.max(mainPaneStartHeight - minMainPaneHeight, 0)
  const targetPaneHeight = Math.min(Math.max(wantedTargetPaneHeight, minTargetPaneHeight), maxTargetPaneHeight)
  return {
    targetPaneHeight,
    mainPaneHeight: mainPaneStartHeight - (targetPaneHeight - targetPaneStartHeight)
  }
}

export default class SeparatorWidget extends Widget<SeparatorPane> {
  private _dragFlag = false
  private _dragStartY = 0
  private _mainPaneHeight = 0
  private _topPaneHeight = 0
  private _bottomPaneHeight = 0

  constructor(rootContainer: HTMLElement, pane: SeparatorPane) {
    super(rootContainer, pane)
    this._initEventListeners()
  }

  private _initEventListeners(): void {
    this
      .addEventListener('touchStartEvent', this._mouseDownEvent)
      .addEventListener('touchMoveEvent', this._pressedMouseMoveEvent)
      .addEventListener('touchEndEvent', this._mouseUpEvent)
      .addEventListener('mouseDownEvent', this._mouseDownEvent)
      .addEventListener('mouseUpEvent', this._mouseUpEvent)
      .addEventListener('pressedMouseMoveEvent', this._pressedMouseMoveEvent)
      .addEventListener('mouseEnterEvent', this._mouseEnterEvent)
      .addEventListener('mouseLeaveEvent', this._mouseLeaveEvent)
  }

  override getName(): string {
    return WidgetNameConstants.SEPARATOR
  }

  override checkEventOn(): boolean {
    return true
  }

  private readonly _mouseDownEvent = (event: MouseTouchEvent): void => {
    this._dragFlag = true
    this._dragStartY = event.pageY
    const pane = this.getPane()
    const mainPane = pane.getChart().getDrawPaneById(PaneIdConstants.CANDLE)
    this._mainPaneHeight = mainPane?.getBounding().height ?? 0
    this._topPaneHeight = pane.getTopPane().getBounding().height
    this._bottomPaneHeight = pane.getBottomPane().getBounding().height
  }

  private readonly _mouseUpEvent = (): void => {
    this._dragFlag = false
    this._mouseLeaveEvent()
  }

  private readonly _pressedTouchMouseMoveEvent = (event: MouseTouchEvent): void => {
    const dragDistance = event.pageY - this._dragStartY
    const currentPane = this.getPane()
    const topPane = currentPane.getTopPane() as DualYPane
    const bottomPane = currentPane.getBottomPane() as DualYPane

    // 检查是否允许拖动
    if (!topPane || !bottomPane?.getOptions().dragEnabled) {
      return
    }

    const chart = currentPane.getChart()
    const drawablePaneHeight = chart.getAllDrawPanes().reduce((height, pane) => {
      return pane.getId() === PaneIdConstants.X_AXIS ? height : height + pane.getBounding().height
    }, 0)

    if (chart.getChartStore().getPaneResizeMode() === 'main-flex') {
      const mainPane = chart.getDrawPaneById(PaneIdConstants.CANDLE) as DualYPane | undefined
      if (!mainPane) {
        return
      }
      const { targetPaneHeight, mainPaneHeight } = calculateMainFlexPaneResize({
        dragDistance,
        targetPaneStartHeight: this._bottomPaneHeight,
        targetPaneMinHeight: bottomPane.getOptions().minHeight,
        mainPaneStartHeight: this._mainPaneHeight,
        mainPaneMinHeight: mainPane.getOptions().minHeight
      })

      bottomPane.setBounding({ height: targetPaneHeight })
      mainPane.setBounding({ height: mainPaneHeight })
      bottomPane.updateHeightSpecFromDrag(targetPaneHeight, drawablePaneHeight)

      chart.getChartStore().getActionStore().execute(ActionType.OnPaneDrag, { paneId: currentPane.getId() })
      chart.refreshPaneLayout()
      return
    }

    const isUpDrag = dragDistance < 0

    // 确定哪个 pane 缩小，哪个 pane 放大
    const { reducedPane, increasedPane, reducedPaneStartHeight, increasedPaneStartHeight } = isUpDrag
      ? {
        reducedPane: topPane,
        increasedPane: bottomPane,
        reducedPaneStartHeight: this._topPaneHeight,
        increasedPaneStartHeight: this._bottomPaneHeight
      }
      : {
        reducedPane: bottomPane,
        increasedPane: topPane,
        reducedPaneStartHeight: this._bottomPaneHeight,
        increasedPaneStartHeight: this._topPaneHeight
      }

    const reducedPaneMinHeight = reducedPane.getOptions().minHeight

    // 检查是否超过最小高度限制
    if (reducedPaneStartHeight <= reducedPaneMinHeight) {
      return
    }

    // 计算新的高度
    const reducedPaneHeight = Math.max(
      reducedPaneStartHeight - Math.abs(dragDistance),
      reducedPaneMinHeight
    )
    const diffHeight = reducedPaneStartHeight - reducedPaneHeight

    // 更新 pane 高度
    reducedPane.setBounding({ height: reducedPaneHeight })
    increasedPane.setBounding({ height: increasedPaneStartHeight + diffHeight })
    reducedPane.updateHeightSpecFromDrag(reducedPaneHeight, drawablePaneHeight)
    increasedPane.updateHeightSpecFromDrag(increasedPaneStartHeight + diffHeight, drawablePaneHeight)

    // 触发事件和更新
    chart.getChartStore().getActionStore().execute(ActionType.OnPaneDrag, { paneId: currentPane.getId() })
    chart.refreshPaneLayout()
  }

  private readonly _throttledPressedMouseMove = throttle(this._pressedTouchMouseMoveEvent, 20)

  private readonly _pressedMouseMoveEvent = (event: MouseTouchEvent): void => {
    this._throttledPressedMouseMove(event)
  }

  private readonly _mouseEnterEvent = (): void => {
    const pane = this.getPane()
    const bottomPane = pane.getBottomPane() as DualYPane

    if (bottomPane?.getOptions().dragEnabled) {
      const chart = pane.getChart()
      const styles = chart.getStyles().separator
      this.getContainer().style.background = styles.activeBackgroundColor
    }
  }

  private readonly _mouseLeaveEvent = (): void => {
    if (!this._dragFlag) {
      this.getContainer().style.background = ''
    }
  }

  override createContainer(): HTMLElement {
    return createDom('div', {
      width: '100%',
      height: `${REAL_SEPARATOR_HEIGHT}px`,
      margin: '0',
      padding: '0',
      position: 'absolute',
      top: '-3px',
      zIndex: '20',
      boxSizing: 'border-box',
      cursor: 'ns-resize'
    })
  }

  override updateImp(container: HTMLElement, _bounding: Bounding, level: UpdateLevel): void {
    if (level === UpdateLevel.All || level === UpdateLevel.Separator) {
      const styles = this.getPane().getChart().getStyles().separator
      container.style.top = `${-Math.floor((REAL_SEPARATOR_HEIGHT - styles.size) / 2)}px`
      container.style.height = `${REAL_SEPARATOR_HEIGHT}px`
    }
  }
}
