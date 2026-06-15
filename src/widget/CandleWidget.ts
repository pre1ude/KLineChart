import type DualYPane from '../pane/DualYPane'
import { createDom } from '../common/utils/dom'
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
  const widget = new MainWidget(rootContainer, pane, [
    GridLayer,
    CandleLayer,
    IndicatorLayer,
    OverlayLayer,
    CrosshairLayer,
    CandleTooltipLayer
  ])
  widget.getContainer().appendChild(createDom('div', {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    height: '1px',
    backgroundColor: '#37465c',
    zIndex: '3',
    pointerEvents: 'none'
  }))
  return widget
}
