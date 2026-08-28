# Manual Acceptance Checklist

Open `tests/html/indicator/multi-y-axis-external-assets.html` through the local demo server and verify the following scenarios.

- [x] The initial chart contains only AAPL candles and one left-side AAPL price axis.
- [x] Adding NVDA creates its line indicator and one blue right-side price axis.
- [x] Adding MSFT creates its line indicator and one purple right-side price axis, outside the NVDA axis.
- [x] Timed updates change only the last close value; timestamps and aligned array lengths remain unchanged.
- [x] Hiding NVDA hides both its line and axis while its cache revision continues to advance; showing it restores the latest revision.
- [x] Removing MSFT removes its indicator and orphaned axis; adding it again restores it as the outermost right axis.
- [x] Dragging an asset axis creates a manual range that survives timed updates; double-clicking that same axis restores automatic ranging.
- [x] Resizing the chart preserves every manually selected Y-axis range while automatic axes continue to recalculate normally.
- [x] The demo runs without browser console errors during the add, hide/show, remove/re-add, and axis interaction flows.
- [x] Passing a misaligned array to `multiYAxisDemo.updateAssetData(symbol, dataList)` throws before cache mutation or a chart API call. The validation checks both array length and every timestamp.

The demo intentionally keeps alignment, cache ownership, revisions, and update scheduling in the business layer. The chart receives AAPL as canonical K-line data and receives NVDA/MSFT through indicator `extendData` accessors.
