import type DeepPartial from '../../common/DeepPartial'
import { type Styles } from '../../common/Styles'

import light from './light'
import dark from './dark'
import black from './black'

const styles: Record<string, DeepPartial<Styles>> = {
  light,
  dark,
  black
}

function registerStyles(name: string, ss: DeepPartial<Styles>): void {
  styles[name] = ss
}

function getStyles(name: string): DeepPartial<Styles> | undefined {
  return styles[name]
}

export {
  registerStyles,
  getStyles
}
