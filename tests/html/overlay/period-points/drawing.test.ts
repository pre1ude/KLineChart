import { expect, it } from 'vitest'
import { copyRecord, editRecord, projectPoints, readRecord, type DrawingRecord } from './drawing'

const source: DrawingRecord = { name: 'segment', period: '5m', points: [
  { timestamp: 110, offset: 0, value: 10, period: '5m' },
  { timestamp: 120, offset: 0, value: 20, period: '15m' }
] }
const projected = source.points.map(point => ({ timestamp: 100, offset: 0, value: point.value }))
const baseline = { source: copyRecord(source), displayed: projected }

it('projects collapsed anchors without changing the source, then recovers the fine positions', () => {
  expect(projectPoints(source, '1d', [], () => ({ timestamp: 100 }))).toEqual(projected.map(({ offset, ...point }) => point))
  expect(projectPoints(source, '5m', [])).toEqual(source.points.map(({ period, ...point }) => point))
  expect(source).toEqual(baseline.source)
})
it('preserves distinct source times on vertical edits after collapse', () => {
  const moved = projected.map(point => ({ ...point, value: point.value + 5 }))
  expect(editRecord(source, { source: 'body', previousPoints: projected, points: moved }, '1d', baseline).points)
    .toEqual(source.points.map(point => ({ ...point, value: point.value + 5 })))
})
it.each(['body', 'control-point'] as const)('reanchors only changed points and restores their original anchors when %s moves back', kind => {
  const moved = projected.map((point, i) => ({ ...point, timestamp: i === 0 ? 200 : 100, value: point.value + 5 }))
  const changed = editRecord(source, { source: kind, previousPoints: projected, points: moved }, '1d', baseline)
  expect(changed.points).toEqual([{ timestamp: 200, offset: 0, value: 15, period: '1d' }, { ...source.points[1], value: 25 }])
  const returned = moved.map(point => ({ ...point, timestamp: 100 }))
  expect(editRecord(changed, { source: kind, previousPoints: moved, points: returned }, '1d', baseline).points)
    .toEqual(source.points.map(point => ({ ...point, value: point.value + 5 })))
})
it('does not rewrite horizontal anchors on subsequent vertical edits or API updates', () => {
  const moved = projected.map(point => ({ ...point, timestamp: 200 }))
  const changed = editRecord(source, { source: 'body', previousPoints: projected, points: moved }, '1d', baseline)
  const next = moved.map(point => ({ ...point, value: point.value + 1 }))
  expect(editRecord(changed, { source: 'body', previousPoints: moved, points: next }, '1d', baseline).points)
    .toEqual(changed.points.map(point => ({ ...point, value: point.value + 1 })))
  expect(editRecord(source, { source: 'api', previousPoints: projected, points: moved }, '1d')).toBe(source)
})
it('captures the current period for newly drawn points', () => {
  expect(editRecord({ ...source, points: [] }, { source: 'draw', previousPoints: [], points: projected }, '1d').points)
    .toEqual(projected.map(point => ({ ...point, period: '1d' })))
})
it('leaves source records recoverable when mapping is missing or throws', () => {
  expect(projectPoints(source, '1d', [], () => undefined)).toBeUndefined()
  expect(() => projectPoints(source, '1d', [], () => { throw Error('missing rules') })).toThrow('missing rules')
  expect(source).toEqual(baseline.source)
})
it('round-trips a styled business record and rejects invalid restores without mutating it', () => {
  const record = { ...source, color: '#7c3aed' }
  expect(readRecord(JSON.parse(JSON.stringify(record)))).toEqual(record)
  const copy = readRecord(record)
  copy.points[0].timestamp = 999
  expect(source).toEqual(baseline.source)
  expect(() => readRecord({ ...source, points: [null, null] })).toThrow()
  expect(() => readRecord({ ...source, color: 'invalid' })).toThrow()
})
