## Why

The chart currently renders all tooltips on the overlay canvas. Canvas text measurement and rasterization limit typography and CSS customization, and tooltip drawing is repeated as part of every overlay repaint. Add a DOM rendering route so users can opt into browser text/layout while preserving the existing Canvas default, tooltip behavior, and image export behavior.

## What Changes

- Add an initialization-only `tooltip.renderType` option with `canvas` (default) and `dom` values.
- Add a renderer-neutral tooltip model shared by Canvas screen rendering, DOM rendering, and Canvas image export.
- Add a pane-local DOM tooltip renderer with stable root class/data hooks and a public stylesheet imported once by DOM-mode consumers.
- Preserve existing tooltip content, show rules, standard/rect combinations, custom formatters, icon hover, and icon click actions.
- Select the tooltip renderer when the chart is created and keep that renderer fixed for the chart lifetime.
- Keep DOM tooltips out of normal Canvas composition while rendering them through a side-effect-free Canvas export path when `getConvertPictureUrl(true)` is called.
- Add browser behavior, visual, event, export, and non-gating performance coverage for the new route.

## Capabilities

### New Capabilities

- `dom-tooltip-rendering`: Select and operate a DOM-backed tooltip renderer while retaining the existing Canvas route and public tooltip behavior.

### Modified Capabilities

None.

## Impact

- Public TypeScript options and exports in `src/Options.ts` and `src/index.ts`.
- Tooltip state, model construction, renderers, layer lifecycle, and pane-local DOM ownership under `src/store`, `src/view`, and `src/widget/layer`.
- Canvas/image composition hooks in `src/widget` and `src/Chart.ts`.
- Browser test configuration and tooltip regression/performance fixtures.
- No new runtime dependency; Canvas mode requires no stylesheet, while DOM mode requires the public tooltip CSS import.
