import type { MouseTouchEvent, OverlayEventData } from '../SyntheticEvent'
import type { IPoint, Point } from '../Point'
import type { Overlay, OverlayMouseTouchEvent, EventOverlayInfo, DefaultExtendData } from '../../component/Overlay'
import type ChartStore from '../../store/ChartStore'

/** 创建带 overlayData 的事件对象 */
export function createOverlayEvent<E>(
  event: MouseTouchEvent,
  overlay: Overlay<E>,
  paneId: string,
  chartStore: ChartStore,
  extra?: Partial<Pick<OverlayEventData<Overlay<E>>, 'interactType' | 'figureKey' | 'figureIndex' | 'attrsIndex' | 'pointIndex'>>
): OverlayMouseTouchEvent<E> {
  const overlayEvent = event as OverlayMouseTouchEvent<E>
  overlayEvent.overlayData = {
    overlay,
    paneId,
    interactType: extra?.interactType ?? 'body',
    figureKey: extra?.figureKey ?? '',
    figureIndex: extra?.figureIndex ?? 0,
    attrsIndex: extra?.attrsIndex ?? 0,
    pointIndex: extra?.pointIndex,
    internalToExternal: (point: IPoint): Partial<Point> => chartStore.internalToExternal(point)
  }
  return overlayEvent
}

/** 从 EventOverlayInfo 创建带 overlayData 的事件对象 */
export function createOverlayEventFromInfo<E = DefaultExtendData>(
  event: MouseTouchEvent,
  info: EventOverlayInfo,
  chartStore: ChartStore
): OverlayMouseTouchEvent<E> {
  return createOverlayEvent(event, info.overlay as Overlay<E>, info.paneId, chartStore, {
    interactType: info.interactType,
    figureKey: info.figureKey,
    figureIndex: info.figureIndex,
    attrsIndex: info.attrsIndex
  })
}
