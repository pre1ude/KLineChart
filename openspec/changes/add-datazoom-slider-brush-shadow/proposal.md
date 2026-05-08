# Proposal

## Summary

Extend the DataZoom slider with brush selection, a top move handle, and a close-line data shadow.

## Motivation

The current slider is a minimal range controller. Customers expect behavior closer to ECharts `dataZoom.slider`, where users can drag a selected window with a dedicated move handle and brush a new window from the slider background. A lightweight data shadow also helps users understand where the full close-price series sits before selecting a range.

## Scope

- Add `brushSelect` to the slider options.
- Add `showDataShadow` to the slider options, defaulting to `true`.
- Render data shadow as one SVG close-price line only.
- Add a top move handle for dragging the selected range.
- Add a temporary brush rectangle while brushing a new range.
- Keep the existing DataZoom percent range as the only time-window state.

## Out Of Scope

- `selectedDataShadow`.
- Volume-based shadow rendering.
- Public slider style customization.
- Multiple DataZoom sliders.
- Detail labels on slider handles.
