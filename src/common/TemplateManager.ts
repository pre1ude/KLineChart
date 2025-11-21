import type Nullable from './Nullable'

interface BaseTemplate {
  name: string
}

export class TemplateManager<T extends BaseTemplate> {
  private readonly store = new Map<string, T>()

  constructor(templates: T[]) {
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i]
      this.store.set(template.name, template)
    }
  }

  add(template: T): void {
    this.store.set(template.name, template)
  }

  get(name: string): Nullable<T> {
    return this.store.get(name) ?? null
  }

  keys(): string[] {
    return Array.from(this.store.keys())
  }
}
