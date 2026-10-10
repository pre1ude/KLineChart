import { expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

it('has a single built-in chart and no optional drawing installation entry', () => {
  const exports = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).exports
  expect(exports['./core']).toBeUndefined()
  expect(exports['./extension/drawing']).toBeUndefined()
  expect(exports['./extension/drawing/cross-period']).toBeUndefined()
  for (const file of ['src/core.ts', 'src/ChartCore.ts', 'src/store/CoreChartStore.ts', 'src/extension/drawing/install.ts', 'src/extension/drawing/module.ts', 'src/component/FeatureHost.ts']) {
    expect(existsSync(resolve(file)), file).toBe(false)
  }
})

function runtimeDependencies(entry: string): string[] {
  const seen = new Set<string>()
  const visit = (path: string) => {
    if (seen.has(path)) return
    seen.add(path)
    const text = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
    for (const match of text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
      const name = match[1]
      if (!name.startsWith('.') && !name.startsWith('@/')) continue
      const base = name.startsWith('@/') ? resolve('src', name.slice(2)) : resolve(dirname(path), name)
      const file = [base + '.ts', resolve(base, 'index.ts')].find(existsSync)
      if (file) visit(file)
    }
  }
  visit(resolve(entry))
  return [...seen]
}

it('exports ordinary drawing without business cross-period APIs', async () => {
  const files = runtimeDependencies('src/index.ts')
  expect(files).toContain(resolve('src/component/Overlay.ts'))
  expect(files).toContain(resolve('src/store/OverlayStore.ts'))
  expect(files).toContain(resolve('src/widget/layer/OverlayLayer.ts'))
  expect(files.some(file => file.includes('cross-period'))).toBe(false)
  expect(existsSync(resolve('src/extension/drawing'))).toBe(false)
  expect(existsSync(resolve('src/component/drawing/createControlledDrawingScope.ts'))).toBe(false)
  const api = await import('../index')
  for (const name of ['createCrossPeriodDrawingController', 'CrossPeriodDrawingController', 'createTradingRuleOverlayResolver', 'createTradingCalendarTimeMapping', 'CrossPeriodProjectionError'] as const) {
    expect(name in api).toBe(false)
  }
})

it('keeps template implementations in their original directory without forwarding wrappers', () => {
  expect(existsSync(resolve('src/extension/drawing/templates'))).toBe(false)
  const source = readFileSync(resolve('src/extension/overlay/custom/textLog.ts'), 'utf8')
  expect(source).toContain('export const textLog')
  expect(source).not.toMatch(/export \* from/)
  expect(runtimeDependencies('src/index.ts')).toContain(resolve('src/extension/overlay/custom/textLog.ts'))
})

it('keeps the business demo outside the library implementation', () => {
  expect(existsSync(resolve('src/component/cross-period'))).toBe(false)
  expect(existsSync(resolve('src/component/drawing/controlled.ts'))).toBe(false)
  expect(existsSync(resolve('src/component/drawing/binding.ts'))).toBe(false)
  const demo = readFileSync(resolve('tests/html/overlay/period-points.html'), 'utf8')
  expect(demo).not.toMatch(/getChartStore|createCrossPeriodDrawingController/)
})

it('keeps the transaction protocol out of the public chart entry', () => {
  const source = readFileSync(resolve('src/index.ts'), 'utf8')
  expect(source).not.toMatch(/controlled|binding|snapshot|DrawingStateCell|PreparedDrawingChange|ControlledDrawingCommit|initializeOverlayPoints|normalizeOverlayPoints/)
})
