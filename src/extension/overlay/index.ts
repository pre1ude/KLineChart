
import type Nullable from '../../common/Nullable'
import { TemplateManager } from '../../common/TemplateManager'
import { type OverlayTemplate } from '../../component/Overlay'
import fibonacciLine from './fibonacciLine'
import horizontalRayLine from './horizontalRayLine'
import horizontalSegment from './horizontalSegment'
import horizontalStraightLine from './horizontalStraightLine'
import parallelStraightLine from './parallelStraightLine'
import priceChannelLine from './priceChannelLine'
import priceLine from './priceLine'
import rayLine from './rayLine'
import segment from './segment'
import straightLine from './straightLine'
import verticalRayLine from './verticalRayLine'
import verticalSegment from './verticalSegment'
import verticalStraightLine from './verticalStraightLine'
import simpleAnnotation from './simpleAnnotation'
import simpleTag from './simpleTag'
import advancedOverlays from './advanced'
import customOverlays from './custom'

const extensions = [
  fibonacciLine, horizontalRayLine, horizontalSegment, horizontalStraightLine,
  parallelStraightLine, priceChannelLine, priceLine, rayLine, segment,
  straightLine, verticalRayLine, verticalSegment, verticalStraightLine,
  simpleAnnotation, simpleTag, ...advancedOverlays, ...customOverlays
]

const overlayTemplateManager = new TemplateManager<OverlayTemplate>(extensions)

function registerOverlay(template: OverlayTemplate): void {
  overlayTemplateManager.add(template)
}

function getOverlayTemplate(name: string): Nullable<OverlayTemplate> {
  return overlayTemplateManager.get(name)
}

function getSupportedOverlays(): string[] {
  return overlayTemplateManager.keys()
}

export { registerOverlay, getOverlayTemplate as getOverlayClass, getSupportedOverlays }
