## Context

`CandleBarView` currently builds an OHLC bar from three filled rectangles. One `ohlcSize` value, derived from `gapBar * 0.2` and capped at 8, controls both the center-line width and the open/close tick thickness. This makes all strokes grow as the chart is zoomed in. The same rendering branch serves main-chart OHLC mode and indicator panes whose indicators request OHLC data.

Lightweight Charts 5.2.1 provides a suitable reference geometry: thin bars use a one-CSS-pixel stroke, ticks start outside the center stroke, and their length is a stepped function of center-to-center bar spacing. KLineChart draws in CSS coordinates on a canvas whose context is already scaled for DPR, unlike Lightweight Charts' bitmap-coordinate renderer.

## Goals / Non-Goals

**Goals:**

- Match the thin American-bar appearance and stepped tick sizing of Lightweight Charts.
- Keep all OHLC strokes sharp and one CSS pixel thick regardless of zoom.
- Define deterministic behavior for narrow and flat bars.
- Preserve shared behavior between main and indicator panes.

**Non-Goals:**

- Add `thinBars`, `openVisible`, or line-width options to the public API.
- Change OHLC coloring, hit testing, axis selection, or data validation.
- Copy bitmap-coordinate or DPR scaling logic into the view.
- Change candlestick rendering.

## Decisions

### Use a CSS-coordinate adaptation of Lightweight Charts geometry

The renderer will calculate a reference width from center-to-center spacing:

1. `barWidth = max(1, floor(barSpace.bar * 0.3))`.
2. Because the fixed center line is one CSS pixel wide, decrement an even `barWidth >= 2` so its parity matches the center line.
3. `tickLength = ceil(barWidth * 1.5)`.

This preserves Lightweight Charts' stepped visual proportions without multiplying by DPR a second time. The canvas transform already maps one CSS pixel to the appropriate number of physical pixels.

Alternative considered: retain `halfGapBar` as tick length. That produces continuously growing ticks and does not match the selected reference implementation.

### Draw three adjacent filled rectangles

The center line will occupy the snapped center pixel. The open tick ends immediately before that pixel, and the close tick starts immediately after it. Each tick has `tickLength` visible pixels, so none of the three rectangles overlap.

Alternative considered: use stroked paths. Filled rectangles match the existing renderer, avoid half-pixel stroke corrections, and keep the change local.

### Preserve the explicit one-pixel entity exception

When `barSpace.gapBar === 1`, only the center line will be rendered. For any wider entity, both ticks will be rendered even when their minimum two-pixel length extends outside the entity width. This deliberately differs from Lightweight Charts at the narrowest entity and follows the agreed KLineChart degradation rule.

### Clamp price ticks to the visible center-line pixels

The center rectangle height will be `max(1, lowY - highY)`. Open and close tick rows will be clamped to the inclusive pixel span occupied by that rectangle. This keeps ticks attached when open or close equals an extreme and leaves a visible 1×1 center mark when high equals low.

## Risks / Trade-offs

- [Ticks can exceed narrow entity bounds] → This is intentional for entities wider than one pixel and keeps each tick visibly at least two pixels long.
- [Rendered snapshots change at several zoom levels] → Add focused geometry tests at spacing thresholds 8, 10, and 17 plus narrow and flat cases.
- [DPR behavior could be double-scaled] → Keep every new dimension in CSS coordinates and rely on the existing canvas transform.
- [Main and indicator panes could diverge later] → Keep geometry in the shared `CandleType.Ohlc` branch and exercise indicator-pane rendering in a focused test.
