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

export default interface VisibleRange {
  readonly from: number
  readonly to: number
  /** 值域起点: 图最左侧对应的索引值 */
  readonly domainFrom: number
  /** 值域终点: 图最右侧对应的索引值 */
  readonly domainTo: number
}

export function getDefaultVisibleRange (): VisibleRange {
  return { from: 0, to: 0, domainFrom: 0, domainTo: 0 }
}
