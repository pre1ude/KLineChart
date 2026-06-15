
import type DeepPartial from '../../common/DeepPartial'
import { type Styles } from '../../common/Styles'

const dark: DeepPartial<Styles> = {
  grid: {
    horizontal: {
      color: '#1F2733',
      primary: {
        color: '#40516B'
      }
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
      color: '#C3CCD9'
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
      color: '#C3CCD9'
    },
    tickLine: {
      color: '#37465C'
    }
  },
  separator: {
    color: '#37465C',
    activeBackgroundColor: 'rgba(255,255,255,0.14)'
  },
  candle: {
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
    }
  },
  indicator: {
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
    }
  },
  crosshair: {
    horizontal: {
      line: {
        color: '#76808F'
      },
      text: {
        borderColor: '#76808F',
        backgroundColor: '#76808F'
      }
    },
    vertical: {
      line: {
        color: '#76808F'
      },
      text: {
        borderColor: '#76808F',
        backgroundColor: '#76808F'
      }
    }
  }
}

export default dark
