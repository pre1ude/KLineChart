# Extract Time Scale Modes

## What

Refactor time scale interaction behavior out of `TimeScaleStore` into explicit mode strategies for K-line and time-share charts.

## Why

`TimeScaleStore` currently mixes shared refresh/event orchestration with mode-specific rules. K-line charts use `barWidth + offsetRight` as the primary time scale state, while time-share charts derive `barWidth` and `offsetRight` from fixed trading ticks. This makes it hard to add an ECharts `dataZoom` compatibility mode without increasing conditional logic in `TimeScaleStore`.

## Scope

- Add a small mode-strategy layer for time scale behavior.
- Preserve existing public chart APIs and current K-line/time-share behavior.
- Move real-time append behavior behind a `TimeScaleStore` API so future modes can define their own append semantics.
- Do not implement ECharts `dataZoom` compatibility in this change.

