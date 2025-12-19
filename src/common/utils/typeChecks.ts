
export function merge(target: any, source: any): void {
  if ((!isObject(target) && !isObject(source))) {
    return
  }
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetProp = target[key]
      const sourceProp = source[key]
      if (
        isObject(sourceProp) &&
        isObject(targetProp)
      ) {
        merge(targetProp, sourceProp)
      } else if (isValid(source[key])) {
        target[key] = clone(source[key])
      }
    }
  }
}

export function clone<T>(target: T): T {
  if (!isObject(target)) {
    return target
  }

  let copy: any
  if (isArray(target)) {
    copy = []
  } else {
    copy = {}
  }
  for (const key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      const v = target[key]
      if (isObject(v)) {
        copy[key] = clone(v)
      } else {
        copy[key] = v
      }
    }
  }
  return copy as T
}

export function isArray<T = any>(value: any): value is T[] {
  return Object.prototype.toString.call(value) === '[object Array]'
}

export function isFunction<T = (...args: any) => any>(value: any): value is T {
  return typeof value === 'function'
}

export function isObject(value: any): value is object {
  return (typeof value === 'object') && isValid(value)
}

export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value)
}

export function isValid<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean'
}

export function isString(value: any): value is string {
  return typeof value === 'string'
}
