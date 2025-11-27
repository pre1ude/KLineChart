import { Figure, type FigureTemplate } from '../../component/Figure'
import { TemplateManager } from '../../common/TemplateManager'
import arc from './arc'
import circle from './circle'
import line from './line'
import polygon from './polygon'
import rect from './rect'
import text from './text'
import textBox from './textBox'

const extensions = [arc, circle, line, polygon, rect, text, textBox]

const TM = new TemplateManager<FigureTemplate>(extensions as FigureTemplate[])

function registerFigure<A = unknown, S = unknown>(template: FigureTemplate<A, S>): void {
  TM.add(template as FigureTemplate)
}

function getFigureTemplate<A = unknown, S = unknown>(name: string): FigureTemplate<A, S> | undefined {
  return TM.get(name)
}

function getSupportedFigures(): string[] {
  return TM.keys()
}

function createFigure<A = unknown, S = unknown, T = unknown>(name: string, id?: string): Figure<A, S, T> {
  const template = getFigureTemplate(name)
  if (!template) throw new Error(`createFigure failed, Figure ${name} is not supported!`)
  return new Figure<A, S, T>(template, id)
}

function drawStaticFigure<A = unknown, S = unknown>(ctx: CanvasRenderingContext2D, name: string, { attrs, styles }: { attrs: A, styles: S }): void {
  const template = getFigureTemplate(name)
  if (!template) throw new Error(`drawStaticFigure failed, Figure ${name} is not supported!`)
  template.draw(ctx, attrs, styles)
}

export { registerFigure, getFigureTemplate, getSupportedFigures, createFigure, drawStaticFigure }
