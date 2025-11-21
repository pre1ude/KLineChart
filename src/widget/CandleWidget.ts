
import type DualYPane from '../pane/DualYPane'
import MainWidget from './MainWidget'
import {
  CandleLayer,
  IndicatorLayer,
  GridLayer,
  OverlayLayer,
  CrosshairLayer,
  TooltipLayer
} from './layer'

export function CandleWidget(
  rootContainer: HTMLElement,
  pane: DualYPane
): MainWidget {
  return new MainWidget(rootContainer, pane, [
    new GridLayer(),
    new CandleLayer(),
    new IndicatorLayer(),
    new OverlayLayer(),
    new CrosshairLayer(),
    new TooltipLayer('candle')
  ])
}
