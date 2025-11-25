import { type OverlayTemplate } from '../../../component/Overlay'

const textLog: OverlayTemplate = {
  name: 'textLog',
  totalStep: 2,
  needDefaultPointFigure: true,
  onBodyDrag({ point, prevPoint, prevPoints, chartStore }) {
    // 只移动 point[1]（文本框），point[0]（锚点）保持不动
    const difDataIndex = point.dataIndex - prevPoint.dataIndex
    const difValue = point.value - prevPoint.value

    // 只更新 point[1]
    this.points[1] = {
      dataIndex: prevPoints[1].dataIndex + difDataIndex,
      value: prevPoints[1].value + difValue,
      timestamp: chartStore.dataIndexToTimestamp(prevPoints[1].dataIndex + difDataIndex)
    }
  },
  createFigures: ({ overlay, coordinates }) => {
    const text = String(overlay.extendData?.text ?? '')

    const startX = coordinates[0]?.x ?? 0
    const startY = coordinates[0]?.y ?? 0
    const endX = coordinates[1]?.x ?? 0
    const endY = coordinates[1]?.y ?? 0

    if (coordinates.length < 2) {
      return []
    }

    return [
      {
        type: 'line',
        attrs: { coordinates: [{ x: startX, y: startY }, { x: endX, y: endY }] },
        ignoreEvent: true
      },
      {
        type: 'textBox',
        attrs: { x: endX, y: endY, text: text ?? '' },
      }
    ]
  }
}

export default textLog
