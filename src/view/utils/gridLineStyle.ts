import { type GridLineStyle } from '../../common/Styles'

export function getPrimaryGridLineStyle(styles: GridLineStyle): GridLineStyle {
  return {
    ...styles,
    ...styles.primary
  }
}
