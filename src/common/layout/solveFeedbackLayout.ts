export function solveFeedbackLayout<T>(params: {
  initial: T
  maxCycles?: number
  iterate: (current: T, cycle: number) => T
  isSame: (left: T, right: T) => boolean
  getSignature?: (value: T) => string
}): {
  value: T
  cycleCount: number
  converged: boolean
} {
  const maxCycles = Math.max(1, params.maxCycles ?? 4)
  let current = params.initial
  const seen = new Set<string>()
  const initialSignature = params.getSignature?.(current)
  if (initialSignature !== undefined) {
    seen.add(initialSignature)
  }
  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const next = params.iterate(current, cycle)
    if (params.isSame(current, next)) {
      return {
        value: next,
        cycleCount: cycle + 1,
        converged: true
      }
    }
    const signature = params.getSignature?.(next)
    if (signature !== undefined) {
      if (seen.has(signature)) {
        return {
          value: next,
          cycleCount: cycle + 1,
          converged: false
        }
      }
      seen.add(signature)
    }
    current = next
  }
  return {
    value: current,
    cycleCount: maxCycles,
    converged: false
  }
}
