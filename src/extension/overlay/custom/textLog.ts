import { LineType, PolygonType } from '@/common/Styles'
import { type OverlayTemplate } from '../../../component/Overlay'

export interface ExtendDataType {
  /** 文本内容 */
  text: string;
  /**
   * 与 visible 的区别是: false 时是完全看不见, 而 show 还能看到一个点
  */
  show: boolean;
  /**
   * 用于交互时取到 id
   */
  id: string | number;
}

export const textLog: OverlayTemplate<ExtendDataType> = {
  name: 'textLog',
  totalStep: 2,
  zLevel: 100, // 默认设为100, 确保比普通画线层级高
  needDefaultPointFigure: true,
  onBodyDrag({ point, prevPoint, prevPoints }) {
    // 只移动 point[1]（文本框），point[0]（锚点）保持不动
    // 内部使用 dataIndex，计算简单直接
    const difDataIndex = point.dataIndex - prevPoint.dataIndex
    const difValue = point.value - prevPoint.value

    this.points[1] = {
      dataIndex: prevPoints[1].dataIndex + difDataIndex,
      value: prevPoints[1].value + difValue
    }
  },
  createFigures: ({ overlay, coordinates }) => {
    const text = String(overlay.extendData?.text ?? '')
    const show = overlay.extendData?.show ?? true

    if (coordinates.length < 2) {
      return []
    }

    const startX = coordinates[0].x ?? 0
    const startY = coordinates[0].y ?? 0
    const endX = coordinates[1].x ?? 0
    const endY = coordinates[1].y ?? 0

    if (!show) {
      return [
        {
          type: 'circle',
          attrs: { x: startX, y: startY, r: 6 },
          ignoreEvent: true
        },
      ]
    }

    return [
      {
        type: 'circle',
        attrs: { x: startX, y: startY, r: 6 },
        ignoreEvent: true
      },
      {
        type: 'line',
        attrs: { coordinates: [{ x: startX, y: startY }, { x: endX, y: endY }] },
        styles: {
          style: LineType.Dashed,
          color: 'rgba(138, 174, 230, 0.5)',
          dashedValue: [4, 2]
        },
        ignoreEvent: true
      },
      {
        type: 'textBox',
        attrs: { x: endX, y: endY, text },
        styles: {
          maxWidth: 150,
          color: '#FFF',
          backgroundColor: '#4D6180',
          borderColor: '#8AAEE6',
          style: PolygonType.StrokeFill
        }
      }
    ]
  }
}
