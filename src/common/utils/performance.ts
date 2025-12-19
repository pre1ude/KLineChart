/**
 * Creates a throttled function that only invokes `func` at most once per every `limit` milliseconds.
 * It ensures that the first call is immediate and that a call made during the cooldown
 * period will be executed at the end.
 *
 * @param func The function to throttle.
 * @param limit The number of milliseconds to throttle invocations to.
 * @returns A new throttled function.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastFn: ReturnType<typeof setTimeout>
  let lastTime: number

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this

    if (!lastTime) {
      // First call, execute immediately
      func.apply(context, args)
      lastTime = Date.now()
    } else {
      // A call was made during the cooldown
      clearTimeout(lastFn)

      // Check if the cooldown period has passed
      if (Date.now() - lastTime >= limit) {
        func.apply(context, args)
        lastTime = Date.now()
      } else {
        // Schedule the trailing call
        lastFn = setTimeout(() => {
          if (Date.now() - lastTime >= limit) {
            func.apply(context, args)
            lastTime = Date.now()
          }
        }, limit - (Date.now() - lastTime))
      }
    }
  }
}

/**
 * Creates a debounced function that delays invoking `func` until after `delay`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * @param func The function to debounce.
 * @param delay The number of milliseconds to delay.
 * @returns A new debounced function.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  // The returned function needs to be a standard `function` to capture `this`
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    // Capture the `this` context and arguments from the call site
    const context = this

    // Clear the previous timeout to reset the delay timer
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Set a new timeout
    timeoutId = setTimeout(() => {
      // When the timeout completes, call the original function with the saved context and arguments
      func.apply(context, args)
    }, delay)
  }
}
