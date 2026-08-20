## Context

KLineChart currently renders tooltip content in the overlay Canvas. `CandleTooltipView` combines candle and indicator content, while `IndicatorTooltipView` formats indicator content and registers Canvas figures for icon hit testing. `DrawWidget` captures only its Canvas elements for image export, and `TooltipLayer` owns the current tooltip view and Canvas event bridge.

The change must add a DOM route without changing the default Canvas route. It also needs to preserve the current synchronous image export API, pane-local coordinates/clipping, custom formatters, and tooltip icon actions.

## Goals / Non-Goals

**Goals:**

- Add initialization-only `tooltip.renderType: 'canvas' | 'dom'`, defaulting to `canvas`.
- Share tooltip data and semantic layout input between screen Canvas, screen DOM, and export Canvas renderers.
- Mount one DOM tooltip root per main widget/pane and update it without replacing the full subtree.
- Publish the DOM renderer's structural styles as an explicit global CSS import.
- Preserve current tooltip content, show rules, main-pane standard/rect combinations, indicator data sources, and icon actions.
- Initialize only the selected renderer and clean up its hit targets, listeners, and pane-local hovered icon state.
- Keep DOM tooltips out of normal Canvas composition while including the last rendered tooltip in `getConvertPictureUrl(true)`.
- Provide browser behavior/visual coverage and a repeatable non-gating performance benchmark.

**Non-Goals:**

- No custom tooltip renderer callback or user-provided HTML API.
- No new runtime dependency or runtime stylesheet injection.
- No automatic CSS side effect for Canvas consumers; DOM consumers explicitly import the public stylesheet.
- No pixel-perfect Canvas/DOM layout parity.
- No expansion of rect tooltip behavior to indicator panes; preserve their current standard rendering behavior.
- No redesign of the existing tooltip style schema.
- No runtime switching between Canvas and DOM; selecting another backend requires chart recreation.

## Decisions

### 1. Public option and ownership

Add `TooltipRenderType`, `TooltipOptions`, and `Options.tooltip` in `src/Options.ts`, and export the types from `src/index.ts`. `ChartStore` passes the initialization option into `TooltipStore`, which owns the immutable effective render type and exposes a getter.

The default is Canvas. Invalid initialization values fall back to Canvas using the repository's existing permissive option behavior. Later `Chart.setOptions` calls do not change the effective render type.

Alternatives considered: a top-level `tooltipRenderType` is less composable with future tooltip-wide options; per-style options would contradict the requirement for one global backend.

### 2. Renderer-neutral model

Extract the formatting and content assembly currently embedded in the tooltip Views into a `TooltipModelBuilder`. The builder receives chart/pane state and emits an immutable `TooltipRenderModel` composed of ordered standard or rect blocks, sections, legend rows, icon models, visibility, and placement intent.

The builder is the only place that invokes candle custom tooltip callbacks and indicator tooltip data sources during a screen update. Renderer code must not call user formatters independently.

Alternatives considered: letting the DOM renderer call protected Canvas View helpers would duplicate layout assumptions and make export/event behavior stateful.

### 3. Layer and renderer lifecycle

`TooltipLayer` becomes a coordinator with the screen renderer selected at construction and the last committed model. Its Canvas renderer has an interactive mode for screen rendering and a non-interactive mode for export.

Extend the internal `Layer` contract with optional export and destroy hooks. `MainWidget` invokes layer destroy hooks and adds export overlay hooks when composing an image. A DOM root is created only for DOM-configured widgets, then reused until pane/chart destruction.

The fixed renderer selection avoids maintaining inactive renderer state. Hiding or destroying a DOM renderer clears only the owning pane's hovered icon state and must not mutate interaction state owned by another pane.

### 4. DOM structure and styling

Each main widget owns one root with a stable `.klinechart-tooltip` class and namespaced `data-klinechart-tooltip-*` attributes for kind, pane, block, and semantic roles. Only the root and semantic roles are public hooks; generated row class names are not API.

Required structural styling lives in the published `@dm/kchart/klinechart-tooltip.css` stylesheet, imported once by applications that select DOM mode. The renderer never injects a stylesheet. It uses `textContent`, never `innerHTML`, and writes inline styles only for values derived from runtime tooltip options or placement state. Static layout declarations are owned by CSS rather than renderer construction/update code. The root uses absolute positioning, `pointer-events: none`, and layout containment; icon controls opt back into pointer events.

Standard blocks use browser flex wrapping with non-breaking legend items. Rect blocks use a two-column grid. Pointer placement uses left/right anchors and a cached/observed height for vertical clamping, avoiding synchronous layout reads in the crosshair hot path. Browser typography and wrapping differences from Canvas are accepted.

Alternatives considered: runtime stylesheet injection hides the dependency but creates global side effects and complicates Content Security Policy. Keeping every declaration inline makes the renderer verbose and prevents normal stylesheet ownership. A full Canvas-like manual DOM layout would preserve line backgrounds but would retain text measurement complexity.

### 5. Interaction bridge

`TooltipStore` owns chart-wide tooltip data and configuration only: crosshair state and the effective render type. Each `TooltipLayer` exclusively owns its pane-local `hoveredIcon` interaction state and exposes whether its icon is hovered for cursor resolution. Canvas and DOM renderers report icon enter/leave/click interactions to the layer; they may cache a derived hovered key for efficient rendering, but they are not independent state owners.

The layer dispatches the existing `ActionType.OnTooltipIconClick` payload for both renderers. The public `TooltipIconClickEventData` remains semantic click data, while internal hover identity uses `paneId`, `indicatorId`, and `iconId`. DOM renderer hiding and pane destruction clear only the owning layer's hover state. Mouse/touch down events on controls stop propagation so chart drag/scroll does not start; normal mouse movement continues to bubble to the chart event system for crosshair updates.

No `aria-live` behavior is added because tooltip values can change every frame. Icon controls use native button semantics where possible and receive a deterministic label derived from existing icon/indicator identity.

### 6. Export isolation

The current Canvas image composition remains unchanged for Canvas mode. In DOM mode, `drawOverlayForExport` renders the cached last model to the export Canvas with hit testing disabled. It must not call `View.draw`, mutate Eventful children, or invoke formatters a second time. Export therefore represents the last committed visual frame, matching the existing Canvas capture semantics.

### 7. Performance and verification

DOM updates piggyback on the existing Canvas overlay scheduling; no second animation-frame scheduler is introduced. The first implementation always builds the model when an overlay render occurs, then diffs DOM output. It must not skip custom callbacks solely because `dataIndex` is unchanged.

The browser benchmark uses a 1200x700 chart, 1,000 data points, MA and BOLL on the main pane, VOL/MACD/KDJ panes, font loading completed, 120 warm-up frames, and 600 measured crosshair frames at distinct data indices. It records model build time, renderer commit time, complete frame script/layout/paint cost, and post-warm-up node creation. Timing is reported, not used as a flaky CI threshold; structural invariants are test assertions.

## Risks / Trade-offs

- [Risk] DOM text/layout may be slower than Canvas on some browsers. -> Keep Canvas as the default, avoid synchronous layout reads and full subtree replacement, and publish benchmark results instead of promising a fixed percentage improvement.
- [Risk] Standard background geometry will differ when flex wrapping creates multiple visual lines. -> Document semantic rather than pixel parity and add visual coverage for long/wrapped content.
- [Risk] Custom callbacks can depend on external mutable state. -> Build the model on every overlay render and optimize DOM commits before introducing revision-based model caching.
- [Risk] Native DOM controls can interfere with chart gestures. -> Stop down/touch-start propagation only on controls and test mouse drag, touch scroll, and icon click together.
- [Risk] A hidden renderer or another pane can clear the current icon hover. -> Keep hover state pane-local in `TooltipLayer`; renderer hide operations never mutate chart-wide interaction state.
- [Risk] DOM hooks become an accidental long-term API. -> Document only the root class and namespaced semantic data attributes; do not expose implementation-generated class names.

## Migration Plan

1. Add Canvas regression tests and extract the shared model without changing the default renderer.
2. Add the option/store plumbing and renderer coordinator with Canvas-only behavior still covered.
3. Add the DOM renderer, event bridge, node reuse, and fixed initialization-time selection.
4. Add export composition, lifecycle cleanup, browser visual tests, and the benchmark fixture.
5. Publish the new option, DOM hook contract, and stylesheet subpath; Canvas consumers require no migration, while DOM consumers import `@dm/kchart/klinechart-tooltip.css` once globally.

Rollback is the default option value: omit `tooltip.renderType` or set it to `canvas` to bypass DOM rendering. No persisted data or server migration is involved.

## Open Questions

None for the scoped first release. Extending rect rendering to indicator panes and adding custom DOM renderer callbacks are intentionally separate changes.
