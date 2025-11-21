
import type DrawWidget from '../widget/DrawWidget'
import { IndicatorWidget } from '../widget/IndicatorWidget'
import DualYPane from './DualYPane'

export default class IndicatorPane extends DualYPane {
  override createMainWidget(container: HTMLElement): DrawWidget<DualYPane> {
    return IndicatorWidget(container, this)
  }
}
