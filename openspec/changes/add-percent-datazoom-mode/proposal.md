# Proposal

## Summary

Add a percent-only DataZoom time scale mode that derives the visible range from `start/end` percent values and reuses the existing inside-style interactions for wheel zoom, drag scroll, and pinch zoom.

## Motivation

Customers expect ECharts dataZoom-like behavior where the data window is the primary state. In particular, when more data is appended while the same percent window is selected, the number of visible data points can increase and the visual bar spacing should shrink automatically.

The existing K-line mode uses `barWidth + offsetRight` as the primary state, which preserves spacing during append. That behavior should remain for K-line mode, while DataZoom mode should use `start/end` as the source of truth.

## Scope

- Add an optional `dataZoom` chart option.
- Add a new DataZoom time scale mode.
- Support percent `start/end` only.
- Reuse current inside interactions:
  - wheel zoom
  - drag scroll
  - touch drag scroll
  - pinch zoom
- Keep `start/end` unchanged on append and replace.
- Treat `barWidth` and `offsetRight` as derived compatibility cache in DataZoom mode.
- Make `setBarSpace()` a no-op in DataZoom mode.
- In DataZoom mode, use `barSpaceLimit.max` as the maximum candlestick entity width; do not let `barSpaceLimit.min` constrain the DataZoom window.

## Out Of Scope

- Slider UI.
- `startValue/endValue`.
- `rangeMode`.
- `filterMode`.
- Multiple dataZoom components or multi-axis targeting.
- Full ECharts option compatibility.
- Public `minSpan/maxSpan/zoomLock` configuration.
