# Design

## Overview

`TimeScaleStore` remains the public owner of time scale state for the chart. It keeps shared responsibilities:

- Refreshing visible range.
- Recalculating crosshair.
- Updating panes.
- Emitting time scale actions.
- Exposing public API methods already used by `Chart` and `Event`.

Mode-specific behavior is moved into strategy classes:

- `KLineTimeScaleMode`
- `TimeShareTimeScaleMode`

Both strategies operate on a shared mutable time scale state owned by `TimeScaleStore`. This avoids duplicating accessors and keeps the existing rendering path stable.

## Shared State

The extracted state includes:

- `barWidth`
- `kWidth`
- `offsetRight`
- `barSpaceLimit`
- min visible/offset constraints
- `autoInitialAlignment`

The store exposes a small internal context to strategies for:

- current chart dimensions
- data list
- time-share settings
- bar width and offset updates
- bar-space limits

## Strategy Responsibilities

K-line mode owns:

- visible range calculation using `barWidth + offsetRight`
- scroll behavior
- zoom behavior
- fit-to-width
- resize anchoring
- initial alignment
- append-data offset adjustment

Time-share mode owns:

- fixed tick-based bar width
- last-data tick alignment
- visible range calculation after fixed-grid adjustment
- no-op free scroll/zoom/fitting where existing behavior effectively overwrote those changes

## Future ECharts DataZoom Mode

The future mode can define `start/end/startValue/endValue/rangeMode` as its primary state and derive `barWidth + offsetRight` from that range. The public `TimeScaleStore` API should not need broad changes for that addition.

## Compatibility

This change should be behavior-preserving for existing K-line and time-share use cases. The only semantic cleanup is making time-share free scroll/zoom explicit no-ops instead of allowing transient state changes that are immediately overwritten by time-share adjustment.
