export const measureTextByDom = (options: {
  text: string
  maxWidth: number
  fontSize: string
  fontFamily: string
  fontWeight: string
  fontStyle: string // italic
  lineHeight: number
}) => {
  const fontSize = options.fontSize || '12px'
  const fontFamily = options.fontFamily || 'Arial'
  const fontWeight = options.fontWeight || 'normal'
  const fontStyle = options.fontStyle || 'normal'
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.visibility = 'hidden'
  container.style.top = '0px'
  container.style.left = '0px'
  container.style.wordBreak = 'break-word' // 强制换行
  container.style.overflowWrap = 'break-word' // 允许在单词内换行
  container.style.whiteSpace = 'pre-wrap' // 允许换行
  container.style.maxWidth = `${options.maxWidth  }px`
  container.style.fontSize = fontSize
  container.style.fontFamily = fontFamily
  container.style.fontWeight = fontWeight
  container.style.fontStyle = fontStyle
  container.style.lineHeight = `${options.lineHeight  }px`
  container.innerHTML = options.text
    .replace(/\n/g, '<br>') // 保留换行
    .replace(/\s/g, '&nbsp;') // 保留空格
  document.body.appendChild(container)
  const bBox = container.getBoundingClientRect()
  document.body.removeChild(container)
  return bBox
}
