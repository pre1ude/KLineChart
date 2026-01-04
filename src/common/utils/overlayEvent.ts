import type { MouseTouchEvent, OverlayEventData } from '../SyntheticEvent'
import type { Overlay, OverlayMouseTouchEvent, EventOverlayInfo } from '../../component/Overlay'

/** 创建带 overlayData 的事件对象 */
export function createOverlayEvent<E>(
  event: MouseTouchEvent,
  overlay: Overlay<E>,
  paneId: string,
  extra?: Partial<Pick<OverlayEventData, 'interactType' | 'figureKey' | 'figureIndex' | 'attrsIndex' | 'pointIndex'>>
): OverlayMouseTouchEvent<E> {
  const overlayEvent = event as OverlayMouseTouchEvent<E>
  overlayEvent.overlayData = {
    overlay,
    paneId,
    interactType: extra?.interactType ?? 'body',
    figureKey: extra?.figureKey ?? '',
    figureIndex: extra?.figureIndex ?? 0,
    attrsIndex: extra?.attrsIndex ?? 0,
    pointIndex: extra?.pointIndex
  }
  return overlayEvent
}

/** 从 EventOverlayInfo 创建带 overlayData 的事件对象 */
export function createOverlayEventFromInfo<E = unknown>(event: MouseTouchEvent, info: EventOverlayInfo): OverlayMouseTouchEvent<E> {
  return createOverlayEvent(event, info.overlay as Overlay<E>, info.paneId, {
    interactType: info.interactType,
    figureKey: info.figureKey,
    figureIndex: info.figureIndex,
    attrsIndex: info.attrsIndex
  })
}
