## 1. Establish contracts and Canvas baseline

- [x] 1.1 Add `TooltipRenderType`, `TooltipOptions`, and `Options.tooltip` with Canvas as the default; export the new public types from `src/index.ts`.
- [x] 1.2 Initialize immutable render-type state in `TooltipStore` from the chart creation options without changing existing style options.
- [x] 1.3 Add unit coverage for default Canvas mode, initial DOM mode, invalid values, and ignored runtime `Chart.setOptions` changes.
- [x] 1.4 Capture current Canvas tooltip behavior in regression tests for candle/indicator content, show rules, main-pane standard/rect combinations, custom formatters, and icon actions.

## 2. Extract the shared tooltip model

- [x] 2.1 Define renderer-neutral tooltip model types for visibility, ordered standard/rect blocks, sections, legend rows, icons, styles, and placement intent.
- [x] 2.2 Extract candle legend and indicator tooltip data assembly from the existing Views into a `TooltipModelBuilder` without invoking formatters from renderer code.
- [x] 2.3 Preserve the current indicator-pane standard path and main-pane mixed showType behavior while adapting the Canvas screen route to consume the shared model.
- [x] 2.4 Add model-level tests that compare normalized candle/indicator content and verify custom tooltip callbacks are called once per screen update.

## 3. Add renderer and layer lifecycle hooks

- [x] 3.1 Extend the internal layer contract with optional export and destroy hooks, and make `MainWidget` invoke them during image composition and destruction.
- [x] 3.2 Initialize only the configured screen renderer and clear its Canvas Figure hit targets or DOM resources on destruction.
- [x] 3.3 Update `TooltipLayer` to coordinate the shared model, fixed screen renderer, and last committed model.
- [x] 3.4 Add initialization tests that prove DOM mode reuses one root and Canvas mode retains its event behavior.

## 4. Implement the pane-local DOM renderer

- [x] 4.1 Create a lazily initialized tooltip root per main widget with the documented class and namespaced data attributes, using `textContent` rather than HTML parsing.
- [x] 4.2 Implement standard block DOM layout with non-breaking legend items, grouped icons, max-width handling, and semantic role nodes.
- [x] 4.3 Implement rect block grid layout, fixed/pointer horizontal anchoring, vertical clamping through cached or observed height, and pane-local clipping.
- [x] 4.4 Add keyed section/icon reuse and positional legend node pooling; patch only changed text, attributes, and styles.
- [x] 4.5 Add DOM icon hover/click handlers, native control semantics, and mouse/touch down propagation guards while preserving chart crosshair movement.
- [x] 4.6 Add browser tests for DOM structure, styles, wrapped content, main-pane mixed blocks, pane isolation, icon events, and drag/touch interaction.

## 5. Preserve export behavior

- [x] 5.1 Implement a non-interactive Canvas export renderer that consumes the cached model and never mutates Eventful hit targets or invokes formatter callbacks again.
- [x] 5.2 Add `drawOverlayForExport` composition for DOM mode while keeping Canvas-mode export unchanged.
- [x] 5.3 Add export tests for overlay inclusion/exclusion, DOM tooltip presence, and callback invocation counts.

## 6. Verify performance, visuals, and public documentation

- [x] 6.1 Add browser visual coverage for default/DOM modes across standard, rect, mixed, first/last bar, long legends, custom fonts, and high-DPR rendering.
- [x] 6.2 Add the fixed 1200x700 multi-pane benchmark fixture with 1,000 data points, MA/BOLL/VOL/MACD/KDJ, font warm-up, 120 warm-up frames, and 600 measured frames.
- [x] 6.3 Report model build, renderer commit, complete frame script/layout/paint, and post-warm-up node creation for Canvas versus DOM without adding a flaky timing gate.
- [x] 6.4 Document `tooltip.renderType`, default Canvas behavior, DOM root/data hooks, stylesheet customization, and the accepted non-pixel-perfect DOM layout differences.
- [x] 6.5 Run focused tests, type-check, lint, and the production build; confirm the default Canvas bundle has no new runtime dependency or automatic CSS side effect.

## 7. Localize tooltip interaction state

- [x] 7.1 Document `TooltipStore` chart-level ownership, `TooltipLayer` pane-local hover ownership, and renderer-neutral click dispatch.
- [x] 7.2 Move tooltip click payload typing out of `TooltipStore` and remove chart-wide active-icon state.
- [x] 7.3 Make `TooltipLayer` the single hover owner and adapt Canvas/DOM interactions to report enter, leave, and click through the layer.
- [x] 7.4 Resolve the Canvas tooltip cursor from the current main widget's pane-local tooltip layer instead of `TooltipStore`.
- [x] 7.5 Add regression coverage for fixed renderer selection, pane isolation, hover styling, cursor behavior, and unchanged click payloads.
- [x] 7.6 Run focused tests, browser tests, type-check, lint, and the production build.

## 8. Fix DOM renderer review findings

- [x] 8.1 Treat standard block `maxWidth` as a right boundary and preserve the configured right inset in DOM layout.
- [x] 8.2 Apply all four tooltip text margins to rect rows and cover the default horizontal spacing.
- [x] 8.3 Position mixed pointer rect blocks from cached/observed DOM block heights without synchronous layout reads.
- [x] 8.4 Release native icon listeners when pooled content nodes are discarded and cover detached-node behavior.

## 9. Publish DOM structural styles as CSS

- [x] 9.1 Add a public `@dm/kchart/klinechart-tooltip.css` package subpath and verify the production build contains it.
- [x] 9.2 Move static root, block, content, legend, rect-row, and icon layout declarations out of `TooltipDomRenderer` into the stylesheet while keeping runtime-derived values dynamic.
- [x] 9.3 Import the stylesheet in DOM browser fixtures and add regression coverage proving structural layout comes from CSS rather than inline declarations.
- [x] 9.4 Update the README and DOM examples with the required global import, then run focused and full verification.

## 10. Refine the DOM tooltip fixture

- [x] 10.1 Make the `dom-tooltip.html` candle tooltip standard-only with one `-` icon, keep indicator tooltips icon-free, toggle the candle icon to `+` and back through the existing click action, and verify the fixture behavior.
- [x] 10.2 Hide every indicator tooltip when the candle icon changes to `+`, restore them when it changes back to `-`, and verify both main-pane and indicator-pane tooltip visibility.
- [x] 10.3 Replace the candle toggle's plain `-` and `+` characters with `➖` and `➕` emoji, then verify the icon text and indicator tooltip visibility cycle.
- [x] 10.4 Use `▾` for expanded indicator tooltips and `▸` for collapsed indicator tooltips, restore a regular sans-serif font, and verify the visibility cycle.

## 11. Preserve style invalidation compatibility

- [x] 11.1 Add regression coverage for same-reference tooltip callbacks, manual Y-axis ranges across `setOptions`, and the existing `ChartStore.setOptions` return contract.
- [x] 11.2 Separate style invalidation reporting from `ChartStore.setOptions`, preserve explicit style refreshes, and avoid resetting Y-axis auto calculation from general option updates.
- [x] 11.3 Run focused tests, full tests, type-check, lint, and the production build.
