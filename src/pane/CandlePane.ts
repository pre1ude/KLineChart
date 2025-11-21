

import { CandleWidget } from '../widget/CandleWidget'
import type DrawWidget from '../widget/DrawWidget'
import DualYPane from './DualYPane'

export default class CandlePane extends DualYPane {
  override createMainWidget (container: HTMLElement): DrawWidget<DualYPane> {
    return CandleWidget(container, this)
  }
}
