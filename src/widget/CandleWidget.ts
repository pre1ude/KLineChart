import type DualYPane from '../pane/DualYPane'
import MainWidget from './MainWidget'
import {
  GridLayer,
  CandleLayer,
  IndicatorLayer,
  OverlayLayer,
  CrosshairLayer,
  CandleTooltipLayer,
} from './layer'

export function CandleWidget(
  rootContainer: HTMLElement,
  pane: DualYPane
): MainWidget {
  return new MainWidget(rootContainer, pane, [
    GridLayer,
    CandleLayer,
    IndicatorLayer,
    OverlayLayer,
    CrosshairLayer,
    CandleTooltipLayer
  ])
}
