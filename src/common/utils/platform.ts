export function isFF(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (window.navigator.userAgent.toLowerCase().indexOf('firefox') ?? -1) > -1
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return /iPhone|iPad|iPod/.test(window.navigator.platform)
}

export function getPlatform(): string {
  if (typeof navigator !== 'undefined') {
    return navigator.platform
  }
  if (typeof window !== 'undefined') {
    return window.navigator.platform
  }
  return ''
}
