# Design

## Overview

DataZoom mode introduces a separate time scale strategy:

- `TimeScaleModeKind.DataZoom`
- `DataZoomTimeScaleMode`

The mode owns `start/end` percent state. The existing `TimeScaleStore` continues to own refresh, visible-data adjustment, action execution, and rendering integration.

## State Model

DataZoom mode uses:

- `start`: percent in `[0, 100]`
- `end`: percent in `[0, 100]`

The mode treats these values as the only source of truth. It derives:

- `visibleRange`
- `_barWidth`
- `_offsetRight`

on every `calcVisibleRange()` call.

## Derived Cache

For compatibility with existing rendering and API code, DataZoom mode writes derived values back through the mode context:

```text
domainFrom = dataCount * start / 100
domainTo = dataCount * end / 100
domainSpan = domainTo - domainFrom

barWidth = mainWidth / domainSpan
offsetRight = (domainTo - dataCount) * barWidth
```

This keeps existing coordinate conversion and drawing paths working while preventing `_barWidth` and `_offsetRight` from becoming primary DataZoom state.

## Small Data Behavior

DataZoom mode uses an internal minimum visible data count:

```text
MIN_VISIBLE_DATA_COUNT = 3
```

Rules:

- `dataCount = 0`: return an empty range.
- `dataCount <= 3`: force full range, disable zoom/scroll effect.
- `dataCount > 3`: clamp interactive zoom so at least three data points remain visible.

## Bar Space Semantics

K-line mode keeps the existing behavior:

```text
barSpaceLimit limits bar width
```

DataZoom mode uses ECharts-like layering:

```text
barSpace.bar = band width derived from start/end
barSpace.gapBar = candlestick entity width capped by barSpaceLimit.max
```

`barSpaceLimit.min` does not constrain the DataZoom window.

## Public API Boundaries

`setBarSpace()` is a no-op in DataZoom mode, because directly setting `_barWidth` would bypass `start/end`.

`setBarSpaceLimit()` does not clamp DataZoom `_barWidth`. The next visible-range calculation derives band width from `start/end` and uses `barSpaceLimit.max` only for entity width.

`replaceData()` preserves `start/end`. Init data load resets to the configured DataZoom range.

## Interaction

Existing event handling remains the input source.

`scroll(distance)` moves the percent window while preserving span:

```text
deltaPercent = distance / mainWidth * span
nextStart = start - deltaPercent
nextEnd = end - deltaPercent
```

`zoom(scaleDelta, xCoord)` changes span around the pointer anchor:

```text
scaleRatio = 1 + scaleDelta
anchorRatio = x / mainWidth
anchorPercent = start + span * anchorRatio
nextSpan = span / scaleRatio
nextStart = anchorPercent - nextSpan * anchorRatio
nextEnd = nextStart + nextSpan
```

All interactive updates clamp into `[0, 100]`.

## Compatibility

Existing K-line and time-share behavior should remain unchanged unless `dataZoom` is enabled.
