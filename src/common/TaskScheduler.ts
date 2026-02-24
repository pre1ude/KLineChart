type TaskFinishedCallback = () => void
type TaskErrorCallback = (errorInfo: { key: string, error: unknown }) => void

export default class TaskScheduler {
  private _pending: Record<string, Promise<unknown>> = {}
  private _running = false
  private readonly _onFinish?: TaskFinishedCallback
  private readonly _onError?: TaskErrorCallback

  constructor(onFinish?: TaskFinishedCallback, onError?: TaskErrorCallback) {
    this._onFinish = onFinish
    this._onError = onError
  }

  add(tasks: Record<string, Promise<unknown>>): void {
    Object.assign(this._pending, tasks) // same key => latest wins
    void this._drain()
  }

  private async _drain(): Promise<void> {
    if (this._running) return
    this._running = true
    try {
      while (Object.keys(this._pending).length > 0) {
        const batch = this._pending
        this._pending = {}

        const results = await Promise.allSettled(Object.values(batch))
        const keys = Object.keys(batch)
        for (let i = 0; i < results.length; i++) {
          const r = results[i]
          if (r.status === 'rejected') {
            // 传递任务 key 以便调试
            this._onError?.({ key: keys[i], error: r.reason })
          }
        }
        this._onFinish?.()
      }
    } finally {
      this._running = false
    }
  }

  clear(): void {
    this._pending = {}
  }
}
