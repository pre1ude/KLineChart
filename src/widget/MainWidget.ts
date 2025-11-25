import type DualYPane from '../pane/DualYPane'
import { WidgetNameConstants } from './types'
import DrawWidget from './DrawWidget'
import type { Layer, LayerClass } from './layer/Layer'
import { setCursor } from '../common/utils/cursor'

/**
 * 主 Widget - 使用 Layer 组合模式
 *
 * 通过组合不同的 Layer 来构建功能完整的 Widget
 * 替代了之前的 IndicatorWidget 和 CandleWidget 的继承关系
 */
export default class MainWidget extends DrawWidget<DualYPane> {
  private readonly _layers: Layer[] = []

  constructor(
    rootContainer: HTMLElement,
    pane: DualYPane,
    layers: LayerClass[]
  ) {
    super(rootContainer, pane)

    // 初始化所有 layers
    this._layers = layers.map(layerClass => new layerClass(this))

    // 设置通用样式和事件
    setCursor(this.getContainer(), 'crosshair')
    this.addEventListener('mouseMoveEvent', () => {
      pane.getChart().getChartStore().getTooltipStore().setActiveIcon()
      return false
    })
  }

  getName(): string {
    return WidgetNameConstants.MAIN
  }

  protected updateMain(ctx: CanvasRenderingContext2D): void {
    // 按顺序绘制所有 main layers
    this._layers.forEach((layer) => {
      layer.drawMain?.(ctx)
    })
  }

  protected updateOverlay(ctx: CanvasRenderingContext2D): void {
    // 按顺序绘制所有 overlay layers
    this._layers.forEach((layer) => {
      layer.drawOverlay?.(ctx)
    })
  }
}
