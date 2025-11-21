

import type DualYPane from '../pane/DualYPane'
import MainWidget from './MainWidget'
import {
  IndicatorLayer,
  GridLayer,
  OverlayLayer,
  CrosshairLayer,
  TooltipLayer
} from './layer'

export function IndicatorWidget (
  rootContainer: HTMLElement,
  pane: DualYPane
): MainWidget {
  return new MainWidget(rootContainer, pane, [
    new GridLayer(),
    new IndicatorLayer(),
    new OverlayLayer(),
    new CrosshairLayer(),
    new TooltipLayer('indicator')
  ])
}
