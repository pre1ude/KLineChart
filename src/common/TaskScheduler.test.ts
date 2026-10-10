import { expect, it, vi } from 'vitest'
import TaskScheduler from './TaskScheduler'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

it.each([false, true])('only finishes the latest stable batch (latest first: %s)', async latestFirst => {
  const finish = vi.fn()
  const scheduler = new TaskScheduler(finish)
  const a = deferred()
  const b = deferred()
  scheduler.add({ indicator: a.promise })
  scheduler.add({ indicator: b.promise })
  if (latestFirst) {
    b.resolve()
    await flush()
    expect(finish).toHaveBeenCalledTimes(1)
    a.resolve()
  } else {
    a.resolve()
    await flush()
    expect(finish).not.toHaveBeenCalled()
    b.resolve()
  }
  await flush()
  expect(finish).toHaveBeenCalledTimes(1)
})

it('cancels running batches on clear without blocking the next dataset', async () => {
  const finish = vi.fn()
  const scheduler = new TaskScheduler(finish)
  const a = deferred()
  const b = deferred()
  scheduler.add({ indicator: a.promise })
  scheduler.clear()
  scheduler.add({ indicator: b.promise })
  b.resolve()
  await flush()
  expect(finish).toHaveBeenCalledTimes(1)
  a.resolve()
  await flush()
  expect(finish).toHaveBeenCalledTimes(1)
})

it('releases removed tasks without waiting for them or reporting late rejections', async () => {
  const finish = vi.fn()
  const error = vi.fn()
  const scheduler = new TaskScheduler(finish, error)
  let reject!: (error: Error) => void
  scheduler.add({ A: new Promise((_resolve, fail) => { reject = fail }) })
  scheduler.remove(['A'])
  scheduler.remove(['A', 'missing'])
  expect(scheduler.hasPending()).toBe(false)
  expect(finish).not.toHaveBeenCalled()
  await flush()
  expect(finish).toHaveBeenCalledOnce()
  reject(new Error('retired'))
  await flush()
  expect(error).not.toHaveBeenCalled()
  expect(finish).toHaveBeenCalledOnce()
})

it.each(['add', 'remove-again', 'clear'] as const)('invalidates deferred removal completion on %s', async change => {
  const finish = vi.fn()
  const scheduler = new TaskScheduler(finish)
  const a = deferred()
  const b = deferred()
  scheduler.add({ A: a.promise })
  scheduler.remove(['A'])
  if (change === 'clear') scheduler.clear()
  else {
    scheduler.add({ B: b.promise })
    if (change === 'remove-again') scheduler.remove(['B'])
  }
  await flush()
  expect(finish).toHaveBeenCalledTimes(change === 'remove-again' ? 1 : 0)
  a.resolve()
  b.resolve()
  await flush()
  expect(finish).toHaveBeenCalledTimes(change === 'clear' ? 0 : 1)
})
