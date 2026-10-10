import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import btcSnapshot from '../data/btcusdt-periods.json'
import shSnapshot from '../data/sh600519-periods.json'

describe('Business cross-period drawing in a real chart', () => {
  const storageKey = 'klinechart:demo:period-points:BTCUSDT:v1'
  const selectionKey = 'klinechart:demo:period-points:asset'
  const storageKeys = [storageKey, selectionKey, 'klinechart:demo:period-points:sh600519:v1', 'klinechart:demo:period-points:hk09992:v1']
  let previousSaved: Map<string, string | null>
  beforeEach(() => {
    previousSaved = new Map(storageKeys.map(key => [key, localStorage.getItem(key)]))
    storageKeys.forEach(key => localStorage.removeItem(key))
  })
  afterEach(() => {
    previousSaved.forEach((value, key) => {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    })
  })

  it('persists complete anchors and the viewing period across page loads, and clears only the saved copy', async () => {
    let frame = document.createElement('iframe')
    const mount = async () => {
      frame.src = '/tests/html/overlay/period-points.html'
      document.body.appendChild(frame)
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#period')?.disabled).toBe(false))
      return frame.contentDocument!
    }
    try {
      let doc = await mount()
      const selector = doc.querySelector<HTMLSelectElement>('#period')!
      selector.value = '15m'
      selector.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      const record = doc.querySelector<HTMLTextAreaElement>('#record')!
      const edited = JSON.parse(record.value)
      edited.points[0].value += 100
      record.value = JSON.stringify(edited)
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      expect(doc.querySelector('#save')).toBeNull()
      expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({ version: 2, currentPeriod: '15m', drawing: edited })
      frame.remove()
      frame = document.createElement('iframe')
      doc = await mount()
      expect(doc.querySelector<HTMLSelectElement>('#period')!.value).toBe('15m')
      expect(JSON.parse(doc.querySelector<HTMLTextAreaElement>('#record')!.value)).toEqual(edited)
      expect(doc.querySelector('#storage-status')!.textContent).toContain('已恢复')
      doc.querySelector<HTMLButtonElement>('#clear-saved')!.click()
      expect(localStorage.getItem(storageKey)).toBeNull()
      expect(JSON.parse(doc.querySelector<HTMLTextAreaElement>('#record')!.value)).toEqual(edited)

      // Saving an empty chart must not start an unfinished drawing on reload.
      doc.querySelector<HTMLButtonElement>('#new')!.click()
      doc.querySelector<HTMLButtonElement>('#cancel')!.click()
      expect(JSON.parse(localStorage.getItem(storageKey)!).drawing).toBeNull()
      frame.remove()
      frame = document.createElement('iframe')
      doc = await mount()
      expect(JSON.parse(doc.querySelector<HTMLTextAreaElement>('#record')!.value).points).toEqual([])
      expect(doc.querySelector<HTMLButtonElement>('#cancel')!.disabled).toBe(true)
    } finally { frame.remove() }
  })

  it.each([['segment', 2], ['rayLine', 2], ['straightLine', 2], ['horizontalStraightLine', 1], ['verticalStraightLine', 1], ['rect', 2], ['fibonacciLine', 2]] as const)('automatically saves and restores the %s drawing type', async (name, count) => {
    let frame = document.createElement('iframe')
    const mount = async () => {
      frame.src = '/tests/html/overlay/period-points.html'
      document.body.appendChild(frame)
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#period')?.disabled).toBe(false))
      return frame.contentDocument!
    }
    try {
      let doc = await mount()
      const input = doc.querySelector<HTMLTextAreaElement>('#record')!
      const saved = JSON.parse(input.value)
      saved.name = name
      saved.points = saved.points.slice(0, count)
      input.value = JSON.stringify(saved)
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      expect(doc.querySelector<HTMLSelectElement>('#drawing-type')!.value).toBe(name)
      const persisted = JSON.parse(localStorage.getItem(storageKey)!)
      expect(persisted.drawing.name).toBe(name)
      expect(persisted.drawing.points).toHaveLength(count)
      // Do not overwrite a completed drawing with a new unfinished preview.
      doc.querySelector<HTMLButtonElement>('#new')!.click()
      expect(doc.querySelector<HTMLSelectElement>('#drawing-type')!.disabled).toBe(true)
      expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(persisted)
      frame.remove()
      frame = document.createElement('iframe')
      doc = await mount()
      expect(JSON.parse(doc.querySelector<HTMLTextAreaElement>('#record')!.value)).toEqual(persisted.drawing)
      expect(doc.querySelector<HTMLSelectElement>('#drawing-type')!.value).toBe(name)
    } finally { frame.remove() }
  })

  it('automatically persists a one-point drawing when mouse interaction completes it', async () => {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'width:1000px;height:1000px'
    frame.src = '/tests/html/overlay/period-points.html'
    document.body.appendChild(frame)
    try {
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#period')?.disabled).toBe(false))
      const doc = frame.contentDocument!
      doc.querySelector<HTMLSelectElement>('#drawing-type')!.value = 'horizontalStraightLine'
      doc.querySelector<HTMLButtonElement>('#new')!.click()
      const box = doc.querySelector('#chart')!.getBoundingClientRect()
      const x = box.left + 300
      const y = box.top + 180
      const target = doc.elementFromPoint(x, y)!
      for (const type of ['mouseenter', 'mousemove', 'mousedown', 'mouseup']) {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, view: frame.contentWindow }))
      }
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(storageKey) ?? '{}').drawing?.name).toBe('horizontalStraightLine'))
      expect(JSON.parse(localStorage.getItem(storageKey)!).drawing.points).toHaveLength(1)
    } finally { frame.remove() }
  })

  it('switches real assets, limits unavailable periods, and restores asset-specific drawings', async () => {
    let frame = document.createElement('iframe')
    const mount = async () => {
      frame.src = '/tests/html/overlay/period-points.html'
      document.body.appendChild(frame)
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#asset')?.disabled).toBe(false))
      return frame.contentDocument!
    }
    try {
      let doc = await mount()
      const asset = doc.querySelector<HTMLSelectElement>('#asset')!
      const changeAsset = async (value: string) => {
        asset.value = value
        asset.dispatchEvent(new Event('change'))
        expect(asset.disabled).toBe(true)
        await vi.waitFor(() => expect(asset.disabled).toBe(false))
      }
      const btc = JSON.parse(doc.querySelector<HTMLTextAreaElement>('#record')!.value)
      await changeAsset('sh600519')
      expect(doc.querySelector('#market')?.textContent).toContain('贵州茅台')
      expect(doc.querySelector('#market')?.textContent).toContain('CNY')
      expect(doc.querySelector('#market')?.textContent).toContain('40 根真实 K 线')
      const record = doc.querySelector<HTMLTextAreaElement>('#record')!
      const maotai = JSON.parse(record.value)
      maotai.points[0].value = 1234
      record.value = JSON.stringify(maotai)
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      await changeAsset('hk09992')
      expect(doc.querySelector('#market')?.textContent).toContain('泡泡玛特')
      expect(doc.querySelector('#market')?.textContent).toContain('HKD')
      expect(doc.querySelector('#market')?.textContent).toContain('640 根真实 K 线')
      const periods = doc.querySelector<HTMLSelectElement>('#period')!
      expect(periods.value).toBe('1d')
      expect(Array.from(periods.options).filter(option => option.disabled).map(option => option.value)).toEqual(['5m', '15m', '30m', '1h'])
      const popmart = JSON.parse(record.value)
      expect(popmart.points[0].value).not.toBe(1234)
      periods.value = '1w'
      periods.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(periods.disabled).toBe(false))
      expect(doc.querySelector('#status')?.textContent).not.toContain('暂不可定位')
      await changeAsset('sh600519')
      expect(JSON.parse(record.value)).toEqual(maotai)
      await changeAsset('BTCUSDT')
      expect(JSON.parse(record.value)).toEqual(btc)
      await changeAsset('hk09992')
      expect(periods.value).toBe('1w')
      frame.remove()
      frame = document.createElement('iframe')
      doc = await mount()
      expect(doc.querySelector<HTMLSelectElement>('#asset')!.value).toBe('hk09992')
      expect(doc.querySelector<HTMLSelectElement>('#period')!.value).toBe('1w')
      expect(JSON.parse(doc.querySelector<HTMLTextAreaElement>('#record')!.value)).toEqual(popmart)
    } finally { frame.remove() }
  })

  it.each(['{broken', JSON.stringify({ version: 1, currentPeriod: '30m', drawing: { period: '30m', points: [null, null, null] } })])('falls back from invalid local records without overwriting them (%s)', async (raw) => {
    localStorage.setItem(storageKey, raw)
    const frame = document.createElement('iframe')
    frame.src = '/tests/html/overlay/period-points.html'
    document.body.appendChild(frame)
    try {
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#period')?.disabled).toBe(false))
      expect(frame.contentDocument?.querySelector('#status')?.textContent).toContain('343, 349, 373')
      expect(frame.contentDocument?.querySelector('#storage-status')?.textContent).toContain('未能恢复')
      expect(localStorage.getItem(storageKey)).toBe(raw)
    } finally { frame.remove() }
  })

  it('uses real BTC snapshots and round-trips points while enforcing the drawing/switching exclusion', async () => {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'width:1000px;height:900px'
    frame.src = '/tests/html/overlay/period-points.html'
    document.body.appendChild(frame)
    try {
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector('#status')?.textContent).toContain('343, 349, 373'))
      const doc = frame.contentDocument!
      const record = doc.querySelector<HTMLTextAreaElement>('#record')!
      const selector = doc.querySelector<HTMLSelectElement>('#period')!
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      const saved = JSON.parse(record.value)
      expect(doc.querySelector('#snapshot-time')?.textContent).toContain('2026-09-20')
      expect(doc.querySelector('#snapshot-time')?.textContent).toContain('未收盘')
      expect(saved.points.map((point: { period: string }) => point.period)).toEqual(['5m', '15m', '30m'])
      expect(saved.points.every((point: { value: number }) => point.value >= Math.min(...btcSnapshot.periods['30m'].map(bar => bar.low)) && point.value <= Math.max(...btcSnapshot.periods['30m'].map(bar => bar.high)))).toBe(true)
      expect(saved.points[0].timestamp).toBe(Date.UTC(2026, 8, 20, 3))
      expect(doc.querySelector('#market')?.textContent).toContain('343 根真实 K 线')
      expect(doc.querySelector('#market')?.textContent).toContain(`${btcSnapshot.periods['30m'][btcSnapshot.periods['30m'].length - 1].close.toFixed(2)} USDT`)
      expect(doc.querySelector<HTMLAnchorElement>('#source')?.href).toContain('interval=30m')

      selector.value = '5m'
      selector.dispatchEvent(new Event('change'))
      expect(selector.disabled).toBe(true)
      expect(doc.querySelector<HTMLElement>('#chart')?.inert).toBe(true)
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      expect(doc.querySelector('#status')?.textContent).toContain('2058, 2094, 2238')
      expect(doc.querySelector('#market')?.textContent).toContain('2054 根真实 K 线')
      expect(JSON.parse(record.value)).toEqual(saved)

      for (const [period, count, indices] of [
        ['1h', 172, '171, 174, 186'],
        ['1d', 1359, '1358, 1358, 1358'],
        ['1w', 246, '245, 245, 245'],
        ['1M', 81, '80, 80, 80']
      ] as const) {
        selector.value = period
        selector.dispatchEvent(new Event('change'))
        await vi.waitFor(() => expect(selector.disabled).toBe(false))
        expect(doc.querySelector('#market')?.textContent).toContain(`${count} 根真实 K 线`)
        expect(doc.querySelector('#status')?.textContent).toContain(indices)
        expect(JSON.parse(record.value)).toEqual(saved)
      }

      // January + 2 calendar months is March 1, including leap-year February.
      record.value = JSON.stringify({ period: '1M', points: [1, 2, -1].map(offset => ({
        timestamp: Date.UTC(2024, 0, 1), offset, value: 43000, period: '1M'
      })) })
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      selector.value = '1d'
      selector.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      expect(doc.querySelector('#status')?.textContent).toContain('396, 425, 334')
      record.value = JSON.stringify(saved)
      doc.querySelector<HTMLButtonElement>('#restore')!.click()

      selector.value = '15m'
      selector.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      expect(doc.querySelector('#status')?.textContent).toContain('686, 698, 746')
      expect(doc.querySelector('#market')?.textContent).toContain('685 根真实 K 线')
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      expect(JSON.parse(record.value)).toEqual(saved)

      doc.querySelector<HTMLButtonElement>('#new')!.click()
      expect(selector.disabled).toBe(true)
      selector.value = '30m'
      selector.dispatchEvent(new Event('change'))
      expect(selector.value).toBe('15m')
      expect(doc.querySelector('#market')?.textContent).toContain('685 根真实 K 线')
      doc.querySelector<HTMLButtonElement>('#cancel')!.click()
      expect(selector.disabled).toBe(false)
      record.value = JSON.stringify(saved)
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      expect(JSON.parse(record.value)).toEqual(saved)

      const enabled = doc.querySelector<HTMLInputElement>('#enabled')!
      enabled.checked = false
      enabled.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      expect(doc.querySelector('#status')?.textContent).toContain('690, 698, 715')
      expect(JSON.parse(record.value)).toEqual(saved)
    } finally {
      frame.remove()
    }
  })

  it('projects the June 15 anchor into its containing week and month without changing the record', async () => {
    const frame = document.createElement('iframe')
    frame.src = '/tests/html/overlay/period-points.html'
    document.body.appendChild(frame)
    try {
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#period')?.disabled).toBe(false))
      const doc = frame.contentDocument!
      const selector = doc.querySelector<HTMLSelectElement>('#period')!
      const record = doc.querySelector<HTMLTextAreaElement>('#record')!
      const saved = { name: 'triangle', period: '1M', points: [
        { timestamp: 1686787200000, offset: 0, value: 24639.46063701923, period: '1d' },
        { timestamp: 1701388800000, offset: 0, value: 32645.92097355769, period: '1M' },
        { timestamp: 1701388800000, offset: 0, value: 24064.19020432692, period: '1M' }
      ] }
      record.value = JSON.stringify(saved)
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      for (const [period, indices] of [
        ['1M', '41, 47, 47'], // June 1 / December 1
        ['1w', '75, 99, 99'], // June 12 / November 27
        ['1d', '165, 334, 334'], // June 15 / December 1
        ['1M', '41, 47, 47']
      ]) {
        selector.value = period
        selector.dispatchEvent(new Event('change'))
        await vi.waitFor(() => expect(selector.disabled).toBe(false))
        expect(doc.querySelector('#status')?.textContent).toContain(indices)
        expect(JSON.parse(record.value)).toEqual(saved)
      }
    } finally {
      frame.remove()
    }
  })

  it('persists style changes without replacing source anchors with the coarse projection', async () => {
    const frame = document.createElement('iframe')
    frame.src = '/tests/html/overlay/period-points.html'
    document.body.appendChild(frame)
    try {
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#period')?.disabled).toBe(false))
      const doc = frame.contentDocument!
      const selector = doc.querySelector<HTMLSelectElement>('#period')!
      const record = doc.querySelector<HTMLTextAreaElement>('#record')!
      const original = JSON.parse(record.value)
      selector.value = '1M'
      selector.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      doc.querySelector<HTMLButtonElement>('#style')!.click()
      const saved = JSON.parse(localStorage.getItem(storageKey)!).drawing
      expect(saved.points).toEqual(original.points)
      expect(saved.color).toBe('#7c3aed')
      expect(JSON.parse(doc.querySelector('#projection')!.textContent!).every((point: object) => !('period' in point))).toBe(true)
      record.value = JSON.stringify({ ...saved, points: [null, null, null] })
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      expect(JSON.parse(localStorage.getItem(storageKey)!).drawing).toEqual(saved)
      selector.value = '30m'
      selector.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(selector.disabled).toBe(false))
      expect(JSON.parse(record.value)).toEqual(saved)
      expect(doc.querySelector('#status')!.textContent).toContain('343, 349, 373')
    } finally { frame.remove() }
  })

  it('ignores a superseded asset response and responses after page disposal', async () => {
    const frame = document.createElement('iframe')
    frame.src = '/tests/html/overlay/period-points.html'
    document.body.appendChild(frame)
    try {
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#asset')?.disabled).toBe(false))
      const doc = frame.contentDocument!
      const win = frame.contentWindow! as Window & typeof globalThis
      const fetch = win.fetch.bind(win)
      const snapshot = await (await fetch('/tests/data/sh600519-periods.json')).json()
      const requests: Array<(response: Response) => void> = []
      win.fetch = () => new Promise(resolve => requests.push(resolve))
      const select = doc.querySelector<HTMLSelectElement>('#asset')!
      select.value = 'sh600519'
      select.dispatchEvent(new Event('change'))
      // Simulate an explicit retry before the earlier response completes.
      doc.querySelector<HTMLButtonElement>('#retry')!.click()
      expect(requests).toHaveLength(2)
      requests[1](new Response(JSON.stringify(snapshot)))
      await vi.waitFor(() => expect(select.disabled).toBe(false))
      const record = doc.querySelector<HTMLTextAreaElement>('#record')!.value
      requests[0](new Response('late failure', { status: 500 }))
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(doc.querySelector<HTMLTextAreaElement>('#record')!.value).toBe(record)
      expect(doc.querySelector('#market')!.textContent).toContain('贵州茅台')
      expect(doc.querySelector<HTMLButtonElement>('#retry')!.hidden).toBe(true)
      select.value = 'BTCUSDT'
      select.dispatchEvent(new Event('change'))
      win.dispatchEvent(new Event('pagehide'))
      requests[2](new Response(JSON.stringify(btcSnapshot)))
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(doc.querySelector<HTMLTextAreaElement>('#record')!.value).toBe(record)
      expect(localStorage.getItem(selectionKey)).toBe('sh600519')
    } finally { frame.remove() }
  })

  it('uses the asset holiday calendar when a future daily point crosses into another week', async () => {
    localStorage.setItem(selectionKey, 'sh600519')
    const frame = document.createElement('iframe')
    frame.src = '/tests/html/overlay/period-points.html'
    document.body.appendChild(frame)
    try {
      await vi.waitFor(() => expect(frame.contentDocument?.querySelector<HTMLSelectElement>('#period')?.disabled).toBe(false))
      const doc = frame.contentDocument!
      const record = doc.querySelector<HTMLTextAreaElement>('#record')!
      const daily = shSnapshot.periods['1d']
      const source = { name: 'horizontalStraightLine', period: '1d', points: [{
        timestamp: daily[daily.length - 1].timestamp, value: daily[daily.length - 1].close, offset: 5, period: '1d'
      }] }
      record.value = JSON.stringify(source)
      doc.querySelector<HTMLButtonElement>('#restore')!.click()
      const period = doc.querySelector<HTMLSelectElement>('#period')!
      period.value = '1w'
      period.dispatchEvent(new Event('change'))
      await vi.waitFor(() => expect(period.disabled).toBe(false))
      // Sep 18 + 5 trading days is Sep 28 (Sep 25 is a holiday), two weeks ahead.
      expect(doc.querySelector('#status')!.textContent).toContain(`临时 index：${shSnapshot.periods['1w'].length + 1}`)
      expect(JSON.parse(record.value)).toEqual(source)
    } finally { frame.remove() }
  })

})
