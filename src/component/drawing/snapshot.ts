import { clone } from '../../common/utils/typeChecks'
import type { OverlayCreate } from '../Overlay'

const propertyFields = [
  'groupId', 'paneId', 'lock', 'visible', 'zLevel', 'mode', 'modeSensitivity',
  'controlPointVisibility', 'needDefaultPointFigure', 'needDefaultXAxisFigure', 'needDefaultYAxisFigure',
  'extendData', 'styles'
] as const satisfies ReadonlyArray<keyof OverlayCreate>

export type DrawingProperties = Pick<OverlayCreate, typeof propertyFields[number]>

/** Shared persisted configuration. Points and source metadata belong to their respective owners. */
export function snapshotDrawingProperties(input: DrawingProperties): DrawingProperties {
  const properties: DrawingProperties = {}
  for (const key of propertyFields) {
    if (input[key] !== undefined) Object.assign(properties, { [key]: clone(input[key]) })
  }
  return properties
}
