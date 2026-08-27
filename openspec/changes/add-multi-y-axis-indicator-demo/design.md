## Context

Drawable panes currently extend `DualYPane`, which eagerly creates one left and one right `YAxisWidget`. Chart layout measures one width per side, `YAxis` selects indicator data by side, and several views/events directly address the fixed left/right widgets. Indicators expose `yAxisPosition`, but there is no stable axis identity, no third axis, and no axis lifecycle API.

The agreed demo uses one shared, already-aligned timestamp/index domain. AAPL remains the chart's canonical `KLineData[]`; NVDA and MSFT arrays are owned by demo code and supplied to two custom indicators through `extendData`. The core library must support several independently scaled indicators in the candle pane, but it must not load or synchronize additional symbols.

## Goals / Non-Goals

**Goals:**

- Allow a drawable pane to own an ordered collection of Y-axis widgets addressed by stable IDs.
- Bind each indicator to exactly one Y axis with `yAxisId` and isolate its rendering/range/labels to that axis.
- Preserve existing left/right styles and `yAxisPosition` behavior for callers that do not use axis IDs.
- Support multiple outside axes on either side, axis-specific interaction, visibility, coordinate conversion, and orphan cleanup.
- Prove the capability with an AAPL/NVDA/MSFT manual demo using runtime add, timed `extendData` updates, hide/show, and remove.

**Non-Goals:**

- Multiple canonical data lists, independent time scales, timestamp union/alignment, loaders, subscriptions, or a general `DataSeries` model.
- A built-in comparison indicator or new compare-asset/indicator-data public API.
- Per-axis visual themes, fixed axis ordering independent of creation order, secondary OHLC rendering, or automated demo tests.

## Decisions

### Keep `DualYPane` as the internal base class but replace fixed members with an axis registry

`DualYPane` will retain its name to avoid a broad internal rename. Its implementation will own `Map<string, YAxisWidget>`, deterministic compatibility IDs for the built-in left/right axes, a default/main axis resolver, and a set recording explicitly created axes. Existing helpers such as `getYLeftAxisWidget`, `getYRightAxisWidget`, and `getMainAxisWidget` remain as compatibility projections over the registry.

Axis ownership is fixed at creation time. An axis created through `createYAxis` is persistent and remains caller-owned even while indicators bind to it. An axis created implicitly because an indicator references a missing `yAxisId` is chart-owned and is removed after its last binding disappears. Binding or rebinding an indicator never transfers ownership.

Renaming the class to `DrawPane` was considered, but it would touch almost every widget/layer without improving the requested behavior.

### Model axis visibility without discarding its component

Axis options will include `id`, `paneId`, `position`, and `needWidget`. Setting `needWidget: false` removes the axis from layout, hit testing, rendering, and image export while retaining its widget/component and manual range. Showing it again reuses the same ID and insertion position. Removing an axis destroys it.

Destroying and recreating widgets on every hide/show was rejected because it loses interaction state and complicates ordering.

### Add axis IDs while retaining side-based compatibility

Indicators gain optional `yAxisId`; `yAxisPosition` remains supported. Resolution order is explicit `yAxisId`, then the compatibility axis for `yAxisPosition`, then the pane's main/default axis. Existing integrations therefore continue to render without changes.

Coordinate conversion gains optional `yAxisId` while retaining `yAxisPosition`. New axis APIs are additive: `createYAxis`, `getYAxes`, `overrideYAxis`, and `removeYAxis`.

### Keep indicator removal pane-scoped

The object form of `removeIndicator` requires `paneId`. `{ paneId, id }` removes the exact instance, while `{ paneId, name }` removes every same-name instance in that pane. The legacy string form retains pane-scoped removal, including removing every indicator when no name is supplied. Cross-pane removal is intentionally excluded because indicator IDs are only unique within a pane and destructive global matching would have wider lifecycle effects.

### Scope data range to the resolved axis

Each Y axis gathers only visible indicator figures whose resolved axis ID equals its own. Candle/area data contributes only to the pane's built-in/default candle axes, never to additional indicator axes. The main/default axis continues to drive horizontal grid lines.

This isolates AAPL, NVDA, and MSFT autoscaling while keeping the shared X-axis index.

### Lay out axis columns by side and creation order

Visible axes are grouped into left and right arrays in map insertion order. For outside axes, the chart reserves the sum of per-column maximum widths across panes; for inside axes, the columns overlay the main area. A pane receives an ID-to-bounds mapping and positions each widget independently.

Deletion followed by recreation intentionally appends the new axis at the outer edge. No axis `order` field is introduced.

### Route views and interaction through the owning widget ID

Indicator drawing, custom tooltip callbacks, last-value labels, crosshair formatting, and range calculation resolve the indicator's axis ID. Candle price labels and overlay-axis figures remain on the pane's main/default axis. Event hit testing iterates visible axis widgets; dragging/zooming an axis changes only that axis, main-area vertical panning updates all visible axes, and double-click resets the targeted axis.

### Keep external arrays behind lightweight `extendData`

The demo registers one custom `EXTERNAL_PRICE_LINE` indicator. Its `extendData` contains `{ symbol, revision, getDataList }`; `getDataList` closes over a business-owned array so the chart's recursive clone/merge does not copy historical bars. Changing `revision` makes the current indicator change detector run `calc`, which maps external closes into the normal indicator result array used by rendering and autoscale.

The demo synchronously validates length and every timestamp before create/update. Validation occurs outside `calc` because indicator calculation catches failures internally.

### Keep demo lifecycle outside the public chart API

Demo-local helpers own symbol caches, revisions, timers, and calls to generic chart APIs. Comparison indicators reference missing axis IDs so the chart implicitly creates chart-owned axes. Hidden assets keep updating their business cache but do not call `overrideIndicator`; showing an asset submits the latest revision and restores its axis. Removing an asset clears its timer/cache and removes its indicator, allowing the now-orphaned chart-owned axis to be removed.

## Risks / Trade-offs

- **[Risk] Broad fixed-axis coupling across views and events** → Replace direct left/right access incrementally with registry iteration/resolution while keeping compatibility helpers until all call sites are migrated.
- **[Risk] Existing two-axis behavior regresses** → Seed deterministic left/right compatibility axes and retain side-based indicator and conversion fallbacks.
- **[Risk] Several outside axes consume chart width** → Use summed column widths and a wide manual-demo container; no overlay/compact mode is added.
- **[Risk] Hidden indicators can still influence an in-memory axis range** → Hidden axes are excluded from layout/rendering, and the demo pauses chart updates while hidden; this does not affect visible output.
- **[Risk] Showing an asynchronously recalculated indicator can briefly expose its previous result** → The demo uses synchronous `calc` data mapping and submits the current snapshot before restoring visibility; a calculation-completion API remains out of scope.
- **[Risk] Manual-only acceptance permits future regression** → Run repository type-check/build and document a deterministic manual checklist, while honoring the agreed no-new-automated-test scope.

## Migration Plan

1. Introduce axis IDs/options and the pane registry while preserving fixed-axis compatibility methods.
2. Migrate layout, range selection, views, coordinate conversion, and event routing to registry-based lookup.
3. Add public lifecycle APIs and indicator `yAxisId` binding with compatibility fallback.
4. Add the manual external-asset demo and validate the complete lifecycle.

Rollback consists of reverting the registry/API/view changes and removing the standalone demo; no persisted data or external migration is involved.

## Open Questions

None. Timestamp alignment, external ownership, update semantics, axis positions, visibility lifecycle, ordering, and manual verification were explicitly agreed before implementation.
