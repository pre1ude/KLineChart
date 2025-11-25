import type DualYPane from '../pane/DualYPane'
import MainWidget from './MainWidget'
import {
  GridLayer,
  IndicatorLayer,
  OverlayLayer,
  CrosshairLayer,
  IndicatorTooltipLayer
} from './layer'

export function IndicatorWidget(
  rootContainer: HTMLElement,
  pane: DualYPane
): MainWidget {
  return new MainWidget(rootContainer, pane, [
    GridLayer,
    IndicatorLayer,
    OverlayLayer,
    CrosshairLayer,
    IndicatorTooltipLayer
  ])
}
