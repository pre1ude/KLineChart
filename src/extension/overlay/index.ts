/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
import a from './advanced'

const extensions = [
  fibonacciLine, horizontalRayLine, horizontalSegment, horizontalStraightLine,
  parallelStraightLine, priceChannelLine, priceLine, rayLine, segment,
  straightLine, verticalRayLine, verticalSegment, verticalStraightLine,
  simpleAnnotation, simpleTag, ...a
]

const overlayTemplateManager = new TemplateManager<OverlayTemplate>(extensions)

function registerOverlay (template: OverlayTemplate): void {
  overlayTemplateManager.add(template)
}

function getOverlayTemplate (name: string): Nullable<OverlayTemplate> {
  return overlayTemplateManager.get(name)
}

function getSupportedOverlays (): string[] {
  return overlayTemplateManager.keys()
}

export { registerOverlay, getOverlayTemplate as getOverlayClass, getSupportedOverlays }
