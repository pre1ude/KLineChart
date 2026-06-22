import { describe, expect, it } from 'vitest'

import { textLog } from '../extension/overlay/custom/textLog'
import { Overlay } from './Overlay'

describe('Overlay styles', () => {
  it('merges instance styles without mutating textLog template defaults', () => {
    const first = new Overlay(textLog, {
      id: 'overlay_1',
      groupId: 'overlay_1',
      paneId: 'candle',
      styles: {
        textBox: {
          color: '#ff0000'
        }
      }
    })

    expect(first.styles?.textBox?.color).toBe('#ff0000')
    expect(first.styles?.textBox?.maxWidth).toBe(150)
    expect(first.styles?.textBox?.backgroundColor).toBe('#4D6180')

    const second = new Overlay(textLog, {
      id: 'overlay_2',
      groupId: 'overlay_2',
      paneId: 'candle'
    })

    expect(second.styles?.textBox?.color).toBe('#FFF')
  })
})
