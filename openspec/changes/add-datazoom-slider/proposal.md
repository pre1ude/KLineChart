# Proposal

## Summary

Add a first-version DataZoom slider controller that manipulates the existing percent `start/end` DataZoom range.

## Motivation

The current DataZoom mode already supports inside-style interactions by treating `start/end` percent as the source of truth. Customers also expect the ECharts slider-style control where the selected data window can be adjusted with visible handles outside the main plot.

## Scope

- Extend `dataZoom` options with a minimal `slider` option.
- Add a DataZoom range API on the time scale store.
- Add a DOM-based slider controller aligned with the plot area.
- Support:
  - left handle drag
  - right handle drag
  - selected-area drag
  - background click to move the current window
- Reuse the existing DataZoom range derivation and minimum visible data count rules.
- Keep K-line and time-share behavior unchanged.

## Out Of Scope

- Slider `dataShadow`.
- Slider brush selection.
- Slider detail labels.
- Public `zoomLock`, `minSpan`, or `maxSpan`.
- Multiple dataZoom components.
- Axis targeting beyond the current time scale.
