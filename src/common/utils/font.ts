interface FontConfig {
  fontFamily: string
  size: number
  bold?: boolean
  italic?: boolean
}

// Font parsing regex - matches "italic bold 12px Arial" or similar
const FONT_REGEX = /(italic )?(bold )?(\d+)(px|pt) (.*)$/

/**
 * Creates a CSS font string from components
 * makeFont(12, g.CHART_FONT_FAMILY, "bold")
 */
export function makeFont(size: number, family: string, bold?: string, italic?: string): string {
  return `${italic ? `${italic} ` : ''}${bold ? `${bold} ` : ''}${size}px ${family}`
}

/**
 * Parses a CSS font string into components
 * @param fontString - CSS font string (e.g. "italic bold 12px Arial")
 * @returns FontConfig object or null if invalid
 */
export function parseFont(fontString: string): FontConfig | null {
  const match = FONT_REGEX.exec(fontString)

  if (!match) {
    return null
  }

  return {
    fontFamily: match[5],
    size: parseInt(match[3]) * (match[4] === 'pt' ? 0.75 : 1), // Convert pt to px
    bold: Boolean(match[2]),
    italic: Boolean(match[1]),
  }
}
