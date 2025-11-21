interface FontConfig {
  family: string
  size: number
  bold?: boolean
  italic?: boolean
}

// Font parsing regex - matches "bold italic 12px Arial" or similar
const FONT_REGEX = /(bold )?(italic )?(\d+)(px|pt) (.*)$/

/**
 * Creates a CSS font string from components
 * makeFont(12, g.CHART_FONT_FAMILY, "bold")
 */
export function makeFont(
  size: number,
  family: string,
  italic?: string,
  bold?: string
): string {
  return `${bold ? `${bold  } ` : ''}${
    italic ? `${italic  } ` : ''
  }${size}px ${family}`
}

/**
 * Parses a CSS font string into components
 * @param fontString - CSS font string (e.g. "bold italic 12px Arial")
 * @returns FontConfig object or null if invalid
 */
export function parseFont(fontString: string): FontConfig | null {
  const match = FONT_REGEX.exec(fontString)

  if (!match) {
    return null
  }

  return {
    family: match[5],
    size: parseInt(match[3]) * (match[4] === 'pt' ? 0.75 : 1), // Convert pt to px
    bold: Boolean(match[1]),
    italic: Boolean(match[2])
  }
}
