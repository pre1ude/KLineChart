import { describe, expect, it } from 'vitest'

import DualYPane from './DualYPane'
import YAxisWidget, { YAxisLabelDisplay } from '../widget/YAxisWidget'

function createPane(): DualYPane {
  const pane = Object.create(DualYPane.prototype) as DualYPane
  const defaultLeft = {
    getOptions: () => ({ id: 'price-left', yScaleId: 'default', position: 'left', order: 1, needWidget: true, labelDisplay: YAxisLabelDisplay.Value })
  }
  const defaultRight = {
    getOptions: () => ({ id: 'price-right', yScaleId: 'default', position: 'right', order: 0, needWidget: true, labelDisplay: YAxisLabelDisplay.Percentage })
  }
  const volumeLeft = {
    getOptions: () => ({ id: 'volume-left', yScaleId: 'volume', position: 'left', order: 0, needWidget: true, labelDisplay: YAxisLabelDisplay.Value })
  }

  Reflect.set(pane, '_defaultYScaleId', 'default')
  Reflect.set(pane, '_yAxisWidgets', new Map([
    ['price-left', defaultLeft],
    ['price-right', defaultRight],
    ['volume-left', volumeLeft]
  ]))
  return pane
}

describe('DualYPane scale and axis lookup', () => {
  it('uses axis identity independently from visual position', () => {
    const pane = createPane()

    expect(pane.getYAxisWidgets().filter(widget => widget.getOptions().yScaleId === 'default').map(widget => widget.getOptions().id))
      .toEqual(['price-left', 'price-right'])
    expect(pane.getYAxisWidgetsByPosition('left').map(widget => widget.getOptions().id))
      .toEqual(['volume-left', 'price-left'])
  })

  it('reads the stable scale binding stored on each indicator', () => {
    const pane = createPane()

    expect(pane.resolveIndicatorYScaleId({ yScaleId: 'default' })).toBe('default')
    expect(pane.resolveIndicatorYScaleId({ yScaleId: 'volume' })).toBe('volume')
  })

  it('lets multiple visual axes resolve the exact same scale component', () => {
    const sharedScale = {}
    const leftAxis = { getScale: () => ({ getComponent: () => sharedScale }) }
    const rightAxis = { getScale: () => ({ getComponent: () => sharedScale }) }

    expect(YAxisWidget.prototype.getScaleComponent.call(leftAxis as never)).toBe(sharedScale)
    expect(YAxisWidget.prototype.getScaleComponent.call(rightAxis as never)).toBe(sharedScale)
  })

  it('keeps label display independent from the shared scale binding', () => {
    const pane = createPane()
    const [left, right] = pane.getYAxisWidgets().filter(widget => widget.getOptions().yScaleId === 'default')

    expect(left.getOptions().labelDisplay).toBe(YAxisLabelDisplay.Value)
    expect(right.getOptions().labelDisplay).toBe(YAxisLabelDisplay.Percentage)
  })

  it('enforces scale removal dependencies at the pane ownership boundary', () => {
    const pane = createPane()
    const indicators: Array<{ yScaleId: string }> = []
    const scales = new Map<string, object>([['default', {}], ['volume', {}]])
    Reflect.set(pane, '_id', 'candle_pane')
    Reflect.set(pane, '_chart', {
      getChartStore: () => ({
        getIndicatorStore: () => ({ getInstances: () => indicators })
      })
    })
    Reflect.set(pane, '_yScales', scales)

    expect(pane.removeYScale('default')).toBe(false)
    expect(pane.removeYScale('volume')).toBe(false)

    Reflect.set(pane, '_yAxisWidgets', new Map())
    indicators.push({ yScaleId: 'volume' })
    expect(pane.removeYScale('volume')).toBe(false)

    indicators.length = 0
    expect(pane.removeYScale('volume')).toBe(true)
    expect(scales.has('volume')).toBe(false)
  })
})
