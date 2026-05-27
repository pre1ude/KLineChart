
import type DeepPartial from '../../common/DeepPartial'
import { type Styles } from '../../common/Styles'

const dark: DeepPartial<Styles> = {
  grid: {
    horizontal: {
      color: '#1F2733'
    },
    vertical: {
      color: '#1F2733',
      primary: {
        color: '#40516B'
      }
    }
  },
  xAxis: {
    axisLine: {
      color: '#40516B'
    },
    tickText: {
      color: '#B8CAE6'
    },
    tickLine: {
      color: '#37465C'
    }
  },
  yAxis: {
    axisLine: {
      color: '#40516B'
    },
    tickText: {
      color: '#B8CAE6'
    },
    tickLine: {
      color: '#37465C'
    }
  },
  separator: {
    color: '#37465C',
    activeBackgroundColor: 'rgba(255,255,255,0.14)'
  },
  crosshair: {
    horizontal: {
      line: {
        color: '#76808F'
      },
      text: {
        borderColor: '#76808F',
        backgroundColor: '#3F516B'
      }
    },
    vertical: {
      line: {
        color: '#76808F'
      },
      text: {
        borderColor: '#76808F',
        backgroundColor: '#3F516B'
      }
    }
  }
}

export default dark
