# Design

## Overview

The slider is a controller over the existing `DataZoomTimeScaleMode`; it is not a new time scale mode.

```text
slider pointer interaction
  -> start/end percent
  -> TimeScaleStore.setDataZoomRange()
  -> DataZoomTimeScaleMode.calcVisibleRange()
  -> derived barWidth + offsetRight
```

This keeps the current DataZoom invariant: `start/end` remain the only primary time-window state.

## Option Model

`dataZoom` remains optional. The first slider API is:

```ts
dataZoom?: boolean | {
  start?: number
  end?: number
  slider?: boolean | {
    show?: boolean
    height?: number
  }
}
```

`slider: true` enables the default slider. `slider: false` or `show: false` hides it while keeping inside DataZoom behavior available.

## Layout

The slider is a chart-level DOM controller rather than a normal pane. The existing pane system assumes non-X-axis panes are Y-axis chart panes; putting the slider into `_drawPanes` would create unnecessary Y-axis and separator coupling.

When visible, the slider height is subtracted from the available pane height and the slider is positioned under the x-axis. The slider width and left offset match the main plot area, so handles line up with the visible data coordinate system.

## Interaction

The slider maps percent to pixel linearly:

```text
x = width * percent / 100
percent = x / width * 100
```

Supported interaction types:

- Drag left handle: update `start`.
- Drag right handle: update `end`.
- Drag selected area: preserve span and move both ends.
- Click background: move the current span so its center is at the click percent.

The store/mode applies the existing minimum visible data count rule, so the slider does not introduce a separate public `minSpan`.

## Rendering

The first version renders:

- background track
- selected range
- two handles

Rendering updates on layout changes, data changes, and range changes.

## Compatibility

Time-share mode still takes precedence over DataZoom. If `isTimeShare` is true, the slider is hidden even if `dataZoom.slider` is configured.
