## ADDED Requirements

### Requirement: AAPL-only initial state
The manual demo SHALL initialize with aligned historical AAPL, NVDA, and MSFT arrays owned by demo code while displaying only AAPL candles and the left-side AAPL Y axis.

#### Scenario: Open the demo
- **WHEN** the demo page finishes loading
- **THEN** AAPL candles and one left axis are visible and no comparison indicator or right axis is present

### Requirement: Runtime comparison-asset addition
The demo SHALL allow NVDA and MSFT to be added at runtime as instances of one demo-local external price-line indicator.

#### Scenario: Add both assets
- **WHEN** the user adds NVDA and then MSFT
- **THEN** their indicator bindings implicitly create two chart-owned, independently scaled right-side axes in creation order and render two differently colored close lines

### Requirement: Lightweight external data contract
Each comparison indicator SHALL receive demo-owned data through `extendData` containing a symbol, revision, and lightweight getter, and SHALL recalculate when the revision changes without cloning the source history into the indicator configuration.

#### Scenario: Timed last-price update
- **WHEN** an asset timer changes the last bar close and increments its revision
- **THEN** `overrideIndicator({ extendData })` recalculates the line, latest-value label, tooltip value, and automatic axis range without adding a timestamp

### Requirement: Fail-fast alignment validation
The demo adapter SHALL synchronously reject any comparison array whose length or timestamp at any index differs from the AAPL main array.

#### Scenario: Reject a timestamp mismatch
- **WHEN** a comparison update contains a mismatched timestamp
- **THEN** the update helper throws before mutating the demo cache or calling the chart

### Requirement: Runtime visibility lifecycle
The demo SHALL hide and show a comparison line together with its bound axis while keeping the business cache current.

#### Scenario: Hide a comparison asset
- **WHEN** the user hides NVDA
- **THEN** the NVDA line, latest-value label, tooltip entry, and right-axis column disappear while its demo cache timer continues

#### Scenario: Show a comparison asset
- **WHEN** the user shows NVDA after hidden updates
- **THEN** the latest aligned snapshot is submitted through a new revision and the line and axis return at their original insertion position

### Requirement: Runtime removal lifecycle
The demo SHALL remove a comparison indicator and its orphaned Y axis and SHALL stop and clear that asset's timer/cache.

#### Scenario: Remove and re-add an asset
- **WHEN** the user removes NVDA and later adds it again
- **THEN** its previous resources are gone and the newly created axis appears at the current outermost creation position

### Requirement: Preserve manual axis range during live updates
Timed comparison updates SHALL not reset a user-manipulated Y-axis range.

#### Scenario: Update after manual scaling
- **WHEN** the user manually scales the NVDA axis and the NVDA timer updates its last price
- **THEN** the line/result updates while the manual range remains until the user double-clicks the axis

### Requirement: Demo cleanup
The demo SHALL release every running timer when an asset is removed and when the page is unloaded.

#### Scenario: Dispose the demo
- **WHEN** the demo page is unloaded or its chart is disposed
- **THEN** no comparison timer continues invoking chart methods
