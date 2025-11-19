export const setCursor = (dom: HTMLElement, cursor: string) => {
  const oldCursor = dom.style.cursor
  dom.style.cursor = cursor
  return () => {
    dom.style.cursor = oldCursor
  }
}
