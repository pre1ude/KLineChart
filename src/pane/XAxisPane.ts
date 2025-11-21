
import type DrawWidget from '../widget/DrawWidget'
import XAxisWidget from '../widget/XAxisWidget'
import SingleWidgetPane from './SingleWidgetPane'
import type { PaneOptions } from './types'

export default class XAxisPane extends SingleWidgetPane {
  override createMainWidget(container: HTMLElement, options: PaneOptions): DrawWidget<SingleWidgetPane> {
    return new XAxisWidget(container, this, options)
  }
}
