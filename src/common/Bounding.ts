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

import { isValid, merge } from './utils/typeChecks'

export default interface Bounding {
  width: number
  height: number
  left: number
  top: number
}

export function createDefaultBounding (bounding?: Partial<Bounding>): Bounding {
  const defaultBounding: Bounding = {
    width: 0,
    height: 0,
    left: 0,
    top: 0
  }
  if (isValid(bounding)) {
    merge(defaultBounding, bounding)
  }
  return defaultBounding
}

export function isPointInBounding (bounding: Bounding, { x, y }: { x: number, y: number }): boolean {
  return x >= bounding.left &&
           x <= bounding.left + bounding.width &&
           y >= bounding.top &&
           y <= bounding.top + bounding.height
}
