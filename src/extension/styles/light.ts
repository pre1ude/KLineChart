

import type DeepPartial from '../../common/DeepPartial'
import { type Styles } from '../../common/Styles'

const light: DeepPartial<Styles> = {
  grid: {
    horizontal: {
      color: '#F5F9FF'
    },
    vertical: {
      color: '#F5F9FF'
    }
  },
  xAxis: {
    axisLine: {
      color: '#D8E0EB'
    },
    tickText: {
      color: '#40516B'
    },
    tickLine: {
      color: '#D8E0EB'
    }
  },
  yAxis: {
    axisLine: {
      color: '#D8E0EB'
    },
    tickText: {
      color: '#40516B'
    },
    tickLine: {
      color: '#D8E0EB'
    }
  },
  separator: {
    color: '#D8E0EB',
    activeBackgroundColor: 'rgba(255,255,255,0.14)'
  },
  crosshair: {
    horizontal: {
      line: {
        color: '#76808F'
      },
      text: {
        borderColor: '#686D76',
        backgroundColor: '#686D76'
      }
    },
    vertical: {
      line: {
        color: '#76808F'
      },
      text: {
        borderColor: '#686D76',
        backgroundColor: '#686D76'
      }
    }
  }
}

export default light
