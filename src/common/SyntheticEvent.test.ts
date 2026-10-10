import { expect, it } from 'vitest'
import { resolve } from 'node:path'
import ts from 'typescript'

it('exposes overlayData when only the original event type module is imported', () => {
  const file = resolve('src/common/event-type-consumer.ts')
  const source = "import type { MouseTouchEvent } from './SyntheticEvent'; declare const event: MouseTouchEvent; event.overlayData;"
  const options: ts.CompilerOptions = {
    noEmit: true, strict: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: process.cwd(), paths: { '@/*': ['src/*'] }
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (path, ...args) => path === file
    ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2020, true)
    : getSourceFile(path, ...args)
  const program = ts.createProgram([file], options, host)
  const errors = program.getSemanticDiagnostics(program.getSourceFile(file))
  expect(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([])
})
