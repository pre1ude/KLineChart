import { describe, expect, it, vi } from 'vitest'
import type { EventOverlayInfo, Overlay } from '../component/Overlay'
import type Chart from '../Chart'
import { PaneIdConstants } from '../pane/types'
import type ChartStore from './ChartStore'
import OverlayStore from './OverlayStore'

function createStore(): OverlayStore {
  const chart = {
    updatePane: vi.fn()
  } as unknown as Chart
  const chartStore = {
    batchEffects: (effect: () => unknown) => effect(),
    dispatchEffect: (effect: () => void) => effect(),
    dispatchLifecycleEffect: (effect: () => void) => effect(),
    getChart: () => chart,
    externalToInternal: (point: { timestamp?: number, value?: number }) => ({
      logicalIndex: point.timestamp,
      value: point.value
    })
  } as unknown as ChartStore
  return new OverlayStore(chartStore)
}

function addOverlay(store: OverlayStore): Overlay {
  const [id] = store.addInstances([{
    name: 'segment',
    paneId: PaneIdConstants.CANDLE,
    points: [
      { timestamp: 1, value: 1 },
      { timestamp: 2, value: 2 }
    ]
  }])
  return store.getInstanceById(id as string) as Overlay
}

function createInteractionInfo(overlay: Overlay): EventOverlayInfo {
  return {
    overlay,
    paneId: overlay.paneId,
    interactType: 'body',
    figureKey: '',
    figureIndex: 0,
    attrsIndex: 0
  }
}

describe('OverlayStore ID index', () => {
  it('tracks progress replacement, completion, reset and removal across panes', () => {
    const store = createStore()
    store.addInstances([{ id: 'old-progress', name: 'segment' }])
    store.addInstances([{ id: 'progress', name: 'segment' }])
    expect(store.getInstanceById('old-progress')).toBeUndefined()
    const progress = store.getInstanceById('progress')!
    progress.update({ points: [{ timestamp: 1, value: 1 }, { timestamp: 2, value: 2 }] })
    store.progressOverlayComplete()
    expect(store.getInstanceById('progress')).toBe(progress)
    expect(store.find({ id: 'progress', paneId: PaneIdConstants.CANDLE })).toEqual([progress])
    expect(store.find({ id: 'progress', paneId: 'other' })).toEqual([])
    store.resetInstance('progress')
    store.removeInstance({ id: 'progress' })
    expect(store.getInstanceById('progress')).toBeUndefined()
    expect(store.getInstances()).toEqual([])
    store.addInstances([{ id: 'progress', name: 'segment' }])
    store.removeInstance()
    expect(store.getInstanceById('progress')).toBeUndefined()
  })

  it('looks up and exports drawings without repeatedly searching pane arrays', () => {
    const store = createStore()
    const overlays = Array.from({ length: 100 }, () => addOverlay(store))
    const search = vi.spyOn(store.getInstances(PaneIdConstants.CANDLE), 'find')
    for (const overlay of overlays) expect(store.getInstanceById(overlay.id)).toBe(overlay)
    expect(store.exportAllOverlays()).toHaveLength(100)
    expect(search).not.toHaveBeenCalled()
  })
})

describe('OverlayStore.removeInstance', () => {
  it('clears interaction state that references a removed overlay', () => {
    const store = createStore()
    const overlay = addOverlay(store)
    const info = createInteractionInfo(overlay)
    store.setHoverInfo(info)
    store.setSelectedInfo(info)
    store.setPressed(true)
    store.setDragging(true)

    store.removeInstance({ id: overlay.id })

    expect(store.getHoverInfo()).toBeUndefined()
    expect(store.getSelectedInfo()).toBeUndefined()
    expect(store.isPressed()).toBe(false)
    expect(store.isDragging()).toBe(false)
  })

  it('preserves interaction state when removing a different overlay', () => {
    const store = createStore()
    const activeOverlay = addOverlay(store)
    const removedOverlay = addOverlay(store)
    const info = createInteractionInfo(activeOverlay)
    store.setHoverInfo(info)
    store.setSelectedInfo(info)
    store.setPressed(true)
    store.setDragging(true)

    store.removeInstance({ id: removedOverlay.id })

    expect(store.getHoverInfo()).toBe(info)
    expect(store.getSelectedInfo()).toBe(info)
    expect(store.isPressed()).toBe(true)
    expect(store.isDragging()).toBe(true)
  })

  it('resets stale interaction state when removing all overlays', () => {
    const store = createStore()
    const overlay = addOverlay(store)
    const info = createInteractionInfo(overlay)
    store.setHoverInfo(info)
    store.setSelectedInfo(info)
    store.setPressed(true)
    store.setDragging(true)

    store.removeInstance()

    expect(store.getHoverInfo()).toBeUndefined()
    expect(store.getSelectedInfo()).toBeUndefined()
    expect(store.isPressed()).toBe(false)
    expect(store.isDragging()).toBe(false)
  })
})
