import type { KLineData, OverlayPointsChangeEvent, Point } from '../../../../src/index'
import type { ResolveOverlayPoint } from './types'

// Business source data. The chart only receives ordinary Point objects.
export interface DrawingRecord {
  name: string
  period: string
  points: Array<Point & { period: string }>
  color?: string
}
export interface EditBaseline {
  source: DrawingRecord
  displayed: Point[]
}
export const steps: Record<string, number> = {
  triangle: 3, segment: 2, rayLine: 2, straightLine: 2,
  horizontalStraightLine: 1, verticalStraightLine: 1, rect: 2, fibonacciLine: 2
}
export const periods = ['5m', '15m', '30m', '1h', '1d', '1w', '1M']

export function copyRecord(record: DrawingRecord): DrawingRecord {
  return { ...record, points: record.points.map(point => ({ ...point })) }
}

export function readRecord(value: unknown): DrawingRecord {
  const record = value as DrawingRecord | null
  if (!record || !periods.includes(record.period) || !Object.prototype.hasOwnProperty.call(steps, record.name ?? 'triangle') ||
    !Array.isArray(record.points) || ![0, steps[record.name ?? 'triangle']].includes(record.points.length) ||
    record.points.some(point => !point || !Number.isFinite(point.timestamp) || !Number.isFinite(point.value) ||
      !Number.isSafeInteger(point.offset ?? 0) || !periods.includes(point.period)) ||
    (record.color !== undefined && !/^#[\da-f]{6}$/i.test(record.color))) {
    throw new Error('记录需要有效的画线类型、period，以及该类型所需数量的整数偏移点。')
  }
  // Explicitly select persisted fields; never restore callbacks or runtime state.
  return { name: record.name ?? 'triangle', period: record.period,
    points: record.points.map(point => ({ timestamp: point.timestamp, value: point.value,
      ...(point.offset === undefined ? {} : { offset: point.offset }), period: point.period })),
    ...(record.color === undefined ? {} : { color: record.color }) }
}

export function projectPoints(record: DrawingRecord, currentPeriod: string, dataList: readonly KLineData[], resolve?: ResolveOverlayPoint): Point[] | undefined {
  const points: Point[] = []
  for (const point of record.points) {
    const anchor = resolve ? resolve({ point, currentPeriod, dataList }) : point
    if (!anchor || !Number.isFinite(anchor.timestamp) || !Number.isSafeInteger(anchor.offset ?? 0)) return undefined
    points.push({ timestamp: anchor.timestamp, ...(anchor.offset === undefined ? {} : { offset: anchor.offset }), value: point.value })
  }
  return points
}

const sameAnchor = (a: Point | undefined, b: Point): boolean =>
  a?.timestamp === b.timestamp && (a.offset ?? 0) === (b.offset ?? 0)

/** Only user point edits change source anchors. Projection/style updates are ignored. */
export function editRecord(record: DrawingRecord, event: Pick<OverlayPointsChangeEvent, 'source' | 'previousPoints' | 'points'>, period: string, baseline?: EditBaseline): DrawingRecord {
  if (event.source === 'api') return record
  return { ...record, points: event.points.map((point, index) => {
    const original = baseline?.source.points[index]
    if (original && sameAnchor(baseline?.displayed[index], point)) return { ...original, value: point.value }
    const previous = record.points[index]
    if (previous && sameAnchor(event.previousPoints[index], point)) return { ...previous, value: point.value }
    return { timestamp: point.timestamp, offset: point.offset ?? 0, value: point.value, period }
  }) }
}
