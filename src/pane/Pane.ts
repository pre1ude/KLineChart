import { UpdateLevel } from '../common/Updater'
import { createDefaultBounding } from '../common/Bounding'
import { createDom } from '../common/utils/dom'
import type Updater from '../common/Updater'
import type Bounding from '../common/Bounding'
import type Chart from '../Chart'
export default abstract class Pane implements Updater {
  private _rootContainer: HTMLElement
  private _container: HTMLElement
  private readonly _id: string
  private readonly _chart: Chart
  private readonly _bounding: Bounding = createDefaultBounding()

  constructor(rootContainer: HTMLElement, afterElement: HTMLElement | null, chart: Chart, id: string) {
    this._chart = chart
    this._id = id
    this._rootContainer = rootContainer
    this._container = createDom('div', {
      width: '100%',
      margin: '0',
      padding: '0',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    })
    if (afterElement !== null) {
      rootContainer.insertBefore(this._container, afterElement)
    } else {
      rootContainer.appendChild(this._container)
    }
  }

  getContainer(): HTMLElement {
    return this._container
  }

  getId(): string {
    return this._id
  }

  getChart(): Chart {
    return this._chart
  }

  getBounding(): Bounding {
    return this._bounding
  }

  update(level?: UpdateLevel): void {
    if (this._bounding.height !== this._container.clientHeight) {
      this._container.style.height = `${this._bounding.height}px`
    }
    this.updateImp(level ?? UpdateLevel.Drawer, this._container, this._bounding)
  }

  destroy(): void {
    this._rootContainer.removeChild(this._container)
  }

  abstract setBounding(...bounding: Array<Partial<Bounding>>): Pane

  abstract getImage(includeOverlay: boolean): HTMLCanvasElement

  abstract updateImp(level: UpdateLevel, container: HTMLElement, bounding: Bounding): void
}
