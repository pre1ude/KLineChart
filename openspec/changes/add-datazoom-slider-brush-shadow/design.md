# Design

## Overview

This change keeps the slider as a DOM controller over `DataZoomTimeScaleMode`.

```text
slider brush / handle interaction
  -> start/end percent
  -> TimeScaleStore.setDataZoomRange()
  -> DataZoomTimeScaleMode.calcVisibleRange()
```

The mode remains the source of truth for percent normalization, minimum visible count, bar width, and right offset derivation.

## Options

The slider options become:

```ts
dataZoom?: boolean | {
  start?: number
  end?: number
  slider?: boolean | {
    show?: boolean
    height?: number
    brushSelect?: boolean
    showDataShadow?: boolean
    theme?: 'auto' | 'dark' | 'light'
  }
}
```

`showDataShadow` defaults to `true`. `brushSelect` defaults to `false` so the existing slider behavior remains compatible unless explicitly enabled.
`theme` defaults to `auto`, which follows the chart theme. `dark` and `light` override the chart theme.

## Data Shadow

The data shadow is a single SVG path derived from `KLineData.close`.

- Empty data renders no path.
- One data point renders one point in the middle of the slider track.
- Equal close values render a horizontal center line.
- `showDataShadow: false` skips rendering the SVG shadow.

No volume path or selected-range shadow is added in this change.

## Interaction

The selected range has three interactive controls:

- Left handle: adjust `start`.
- Right handle: adjust `end`.
- Top move handle: preserve span and move both ends.

When `brushSelect` is enabled, dragging the slider background displays a temporary rectangle. On release, the rectangle becomes the new percent range. A short click still moves the current span so its center matches the click position.

When `brushSelect` is disabled, the selected range preserves the current v1 drag behavior.
