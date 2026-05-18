# Tasks

- [x] Create OpenSpec change artifacts.
- [x] Add `src/component/x-axis/tickLayout.ts` and move boundary-label and overlap-layout helpers behind named exports.
- [x] Add `src/component/x-axis/timeShareTicks.ts` and move time-share tick selection helpers behind named exports.
- [x] Add `src/component/x-axis/regularTicks.ts` and move regular K-line tick creation out of `XAxisImp`.
- [x] Simplify `XAxisImp` to orchestrate range refresh, strategy selection, custom `createTicks`, and conversions.
- [x] Share first/last label X-position logic between layout filtering and `XAxisView`.
- [x] Update or relocate X axis unit tests without weakening existing behavior assertions.
- [x] Run type-check and targeted X axis tests.
