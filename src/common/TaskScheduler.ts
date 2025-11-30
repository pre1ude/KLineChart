type TaskFinishedCallback = () => void
type TaskErrorCallback = (error: Error) => void

export default class TaskScheduler {
  private _holdingTasks: Record<string, Promise<unknown>> | null = null
  private _running = false
  private readonly _onFinish?: TaskFinishedCallback
  private readonly _onError?: TaskErrorCallback

  constructor(onFinish?: TaskFinishedCallback, onError?: TaskErrorCallback) {
    this._onFinish = onFinish
    this._onError = onError
  }

  add(tasks: Record<string, Promise<unknown>>): void {
    if (!this._running) {
      void this._runTask(tasks)
    } else if (this._holdingTasks) {
      this._holdingTasks = {
        ...this._holdingTasks,
        ...tasks
      }
    } else {
      this._holdingTasks = tasks
    }
  }

  private async _runTask(tasks: Record<string, Promise<unknown>>): Promise<void> {
    this._running = true
    try {
      const results = await Promise.allSettled(Object.values(tasks))
      // 收集错误
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason)

      if (errors.length > 0 && this._onError) {
        errors.forEach(error => this._onError?.(error))
      }
    } finally {
      this._running = false
      this._onFinish?.()
      if (this._holdingTasks) {
        const next = this._holdingTasks
        this._holdingTasks = null
        void this._runTask(next)
      }
    }
  }

  clear(): void {
    this._holdingTasks = null
  }
}
