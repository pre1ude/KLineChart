## 1. Logical viewport

- [x] 1.1 Make viewport state and mode geometry logical, with compatible public range and offset adapters.
- [x] 1.2 Preserve loading, append, replacement, zoom, resize, percentage, and time-share behavior through focused tests.

## 2. Drawing interaction

- [x] 2.1 Add logical drawing projection and migrate drawing geometry and drag snapshots while retaining public point adapters.
- [x] 2.2 Re-anchor on timeline corrections and invalidate on dataset resets; test loading and replacement during drags.

## 3. Verification

- [x] 3.1 Run unit tests, type checks, changed-source lint, and relevant browser tests; document verified boundaries.

## 4. Simplification

- [x] 4.1 Unify IPoint as logicalIndex/value, remove duplicate point adapters and snapshot fields, and migrate consumers.
- [x] 4.2 Verify logical point round trips, loading/drag behavior, and the complete regression suites.

## 5. Interaction simplification

- [x] 5.1 Remove the redundant data-update flag and use the existing change context as the update condition.
- [x] 5.2 Pass complete IPoint values from pointer picking to drag computation, converting to timestamps at commit/callback boundaries.
- [x] 5.3 Establish only complete drag snapshots and atomically reproject them after timeline changes; verify recovery and regression suites.

## 6. Review fixes

- [x] 6.1 Centralize discrete bar picking, preserve right-side midpoint ties, and verify pointer/public/crosshair consistency.
- [x] 6.2 Detect initial alignment in logical coordinates and verify fractional spacing through history loading and view reset.
- [x] 6.3 Reset directly in logical coordinates without redundant refreshes from pixel rounding, and name batch append handling explicitly.
- [x] 6.4 Tolerate floating-point round-off when deriving integer visible bounds; verify offscreen highs stay excluded and genuine fractional boundaries remain effective.
- [x] 6.5 Provide a dedicated migration guide for public and deep-import consumers, with checked examples and logical-coordinate lifetime rules.
- [x] 6.6 Reuse the exact timestamp comparison during full snapshots, preserving projection caches and verifying the CPU cost against the pre-optimization implementation.
- [x] 6.7 Complete the final commit-readiness review; preserve the current origin in a zero-width DataZoom viewport and verify the built public declarations.

## Verification

- `npm run test:unit`: 78 files, 817 tests passed.
- `npm run type-check`: production and browser TypeScript checks passed.
- ESLint on changed production TypeScript files and `git diff --check`: passed.
- `npm run test:browser -- --browser.headless --no-file-parallelism`: 8 files, 71 tests passed.
- Covered logical point round trips with a nonzero origin, virtual boundary points, real mouse drags during prepend/snapshot/correction, and business-demo public API boundaries.
- Additional interaction checks cover direct logical pointer picking and magnet snapping, rejecting incomplete drag starts, retaining timestamp callbacks, and recovering after failed timeline reprojection.
- Review regressions were reproduced before the fix: midpoint picking disagreed between drawing and crosshair, and fractional bar spacing misclassified initial left alignment. Tests now cover midpoint ties and their immediate neighbors across all three modes, actual browser drawing/public conversion/crosshair agreement, and fractional-spacing reset after prepend with a non-left-aligned control case.
- Reset follow-up: five failing cases reproduced redundant layout refreshes and round-off drift before the fix. Tests now verify repeated reset leaves an unchanged fractional viewport untouched, a real 0.01-pixel scroll still resets, and reset after prepend refreshes only once.
- Visible-range follow-up: three cases failed before the fix, covering centered left boundaries before/after prepend and right-boundary rounding. Six regression cases now cover visible data and callback bounds, exclusion of an offscreen high, and real fractional displacement of 1e-7 bars. Full unit/browser suites, type checks, and changed-file ESLint passed after the fix.
- `docs/logical-index-migration.md` documents affected interfaces, array/logical/pixel conversions, partial results, persisted points, cache lifetime, and deep-import changes. All five migrated TypeScript examples passed an in-memory type check; two explicitly old examples were excluded.
- Snapshot optimization: exact timestamp equality now serves both indicator invalidation and logical-origin retention, skipping the second scan on price-only snapshots. Existing cache tests also verify that new prices commit without invalidating logical anchors or repeating time lookups. Full unit/browser suites, type checks, and changed-file ESLint passed again.
- Paired Node 22 / Apple M4 benchmarks used nine alternating samples of pre-optimization and optimized code, excluding DOM/Canvas, indicators, network, and parsing. Median price-only snapshot cost fell from 0.184 to 0.138 ms for 10k bars and from 2.222 to 1.525 ms for 100k bars without drawings; with projection of 1,000 two-point drawings, costs fell from 0.396 to 0.291 ms and from 2.150 to 1.527 ms respectively. These are computation-path measurements, not browser frame-rate claims.
- Point unification removed 68 net lines of production TypeScript relative to the preceding refactor, including redundant point adapters and viewport snapshot fields.
- Subsequent interaction simplification removed another 9 net production lines, the duplicate update flag, optional drag geometry, and the pointer timestamp lookup from ordinary drag movement.
- `openspec validate refactor-logical-coordinate-state --strict`: passed.
- Final review: full repository lint passed with 0 errors and 49 existing warnings, all in unchanged files; production build passed. Five migration examples and the intentional IPoint breaking-change contract type-check against the generated `dist` declarations. A DataZoom zero-width/prepend regression failed before the final fix and now verifies empty public bounds, picking, and restoration of the retained percentages. Browser verification had one initial page-readiness timeout while other checks ran concurrently; the affected file passed all 17 tests in isolation, then the full serial suite passed all 71 tests. No assertions or timeouts were relaxed.
