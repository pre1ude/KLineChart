
import { requestIdleCallback, cancelIdleCallback, DEFAULT_REQUEST_ID } from './utils/compatible'

interface Task {
  id: string
  handler: () => void
}

export default class TaskScheduler {
  private readonly _tasks: Task[]

  private _requestIdleCallbackId = DEFAULT_REQUEST_ID

  constructor(tasks?: Task[]) {
    this._tasks = tasks ?? []
    this._operateTasks()
  }

  private _operateTasks(fn?: () => void): void {
    if (this._requestIdleCallbackId !== DEFAULT_REQUEST_ID) {
      cancelIdleCallback(this._requestIdleCallbackId)
      this._requestIdleCallbackId = DEFAULT_REQUEST_ID
    }
    fn?.()
    this._requestIdleCallbackId = requestIdleCallback(deadline => { this._runTasks(deadline) })
  }

  private _runTasks(deadline: IdleDeadline): void {
    while (deadline.timeRemaining() > 0 && this._tasks.length > 0) {
      const task = this._tasks.shift()
      task?.handler()
    }
    if (this._tasks.length > 0) {
      this._requestIdleCallbackId = requestIdleCallback(deadline => { this._runTasks(deadline) })
    }
  }

  addTask(task: Task): this {
    this._operateTasks(() => {
      const index = this._tasks.findIndex(t => t.id === task.id)
      if (index > -1) {
        this._tasks[index] = task
      } else {
        this._tasks.push(task)
      }
    })
    return this
  }

  removeTask(id: string): this {
    this._operateTasks(() => {
      const index = this._tasks.findIndex(t => t.id === id)
      if (index > -1) {
        this._tasks.splice(index, 1)
      }
    })
    return this
  }
}
