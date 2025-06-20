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
import { Figure, type FigureTemplate } from '../../component/Figure'
import { TemplateManager } from '../../common/TemplateManager'
import circle from './circle'
import line from './line'
import polygon from './polygon'
import rect from './rect'
import text from './text'
import rectText from './rectText'
import arc from './arc'

const extensions = [circle, line, polygon, rect, text, rectText, arc]

const figureTemplateManager = new TemplateManager<FigureTemplate<any, any>>(extensions)

function registerFigure<A = any, S = any> (template: FigureTemplate<A, S>): void {
  figureTemplateManager.add(template)
}

function getFigureTemplate<A = any, S = any> (name: string): Nullable<FigureTemplate<A, S>> {
  return figureTemplateManager.get(name)
}

function getSupportedFigures (): string[] {
  return figureTemplateManager.keys()
}

function createFigure<A = any, S = any> (name: string): Figure<A, S> {
  const template = getFigureTemplate(name)
  if (!template) throw new Error(`createFigure failed, Figure ${name} is not supported!`)
  return new Figure(template)
}

function drawStaticFigure<A = any, S = any> (ctx: CanvasRenderingContext2D, name: string, { attrs, styles }: { attrs: A, styles: S }): void {
  const template = getFigureTemplate(name)
  if (!template) throw new Error(`drawStaticFigure failed, Figure ${name} is not supported!`)
  template.draw(ctx, attrs, styles)
}

export { registerFigure, getFigureTemplate as getFigureClass, getSupportedFigures, createFigure, drawStaticFigure }
