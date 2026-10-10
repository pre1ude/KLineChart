type TaskFinishedCallback = () => void
type TaskErrorCallback = (errorInfo: { key: string, error: unknown }) => void

export default class TaskScheduler {
  private readonly _pending = new Map<string, Promise<unknown>>()
  private _generation = 0
  private _finishNotification?: object
  private readonly _onFinish?: TaskFinishedCallback
  private readonly _onError?: TaskErrorCallback

  constructor(onFinish?: TaskFinishedCallback, onError?: TaskErrorCallback) {
    this._onFinish = onFinish
    this._onError = onError
  }

  add(tasks: Record<string, Promise<unknown>>): void {
    const generation = this._generation
    Object.entries(tasks).forEach(([key, task]) => {
      this._finishNotification = undefined
      this._pending.set(key, task)
      void task.then(
        () => this._settle(key, task, generation),
        error => this._settle(key, task, generation, error)
      )
    })
  }

  private _settle(key: string, task: Promise<unknown>, generation: number, error?: unknown): void {
    if (generation !== this._generation || this._pending.get(key) !== task) return
    this._pending.delete(key)
    if (error !== undefined) this._onError?.({ key, error })
    this._scheduleFinish()
  }

  remove(keys: readonly string[]): void {
    let removed = false
    keys.forEach(key => { removed = this._pending.delete(key) || removed })
    if (!removed || this._pending.size > 0) return
    this._scheduleFinish()
  }

  private _scheduleFinish(): void {
    if (this._pending.size > 0 || this._finishNotification) return
    // Settling and removal share one stable, post-call completion boundary.
    const finish = {}
    this._finishNotification = finish
    queueMicrotask(() => {
      if (this._finishNotification !== finish) return
      this._finishNotification = undefined
      this._onFinish?.()
    })
  }

  isCurrent(key: string, task: Promise<unknown>): boolean { return this._pending.get(key) === task }

  hasPending(): boolean { return this._pending.size > 0 }

  clear(): void {
    this._generation++
    this._finishNotification = undefined
    this._pending.clear()
  }
}
