## Independent CP-1 three-dimensional reconciliation

REVIEW_TARGET=STEP_RECONCILIATION
SCOPE=CP-1
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER_AGENT_ID=01a0a928-9614-7ca2-905a-c055c25b5054
VERDICT=OPEN

### Evidence

- `apps/terminal/ui/base/render/src/types/props.ts:71-108` defines four content reasons, three system reasons, one transition reason, and nullable `readyPartKey`/`contentFailure`.
- `apps/terminal/ui/base/render/src/components/resolvePart.ts:36-50` renders visible content fallback text and `:120-196` separates the missing-catalog, incompatible-catalog, missing-renderer, and invalid-props cases.
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:62-97` separates host-unavailable, runtime-start-failed, and runtime-not-started; `:153-162` limits system pages to target PRIMARY.
- `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:224-258` reports readiness and hides only for the target surface after a positive-size layout.
- `apps/terminal/ui/base/render/test/renderSurface.test.tsx:1104-1179` covers incompatible content failure plus PRIMARY ready; `:1304-1410` covers content failure followed by runtime failure; `:1462-1517` covers SECONDARY system failure without startup/runtime page or hide.

### OPEN findings

1. `container-empty` has no diagnostic with the required location fields. `ScreenContainer.tsx:102-118` only constructs a `RenderFailure`; `diagnostics.ts:6-50` has no container-empty diagnostic variant. The smallest repair is a content diagnostic carrying `category/reason/partKey:null/displayMode/containerKey/surfaceForm`, with a focused log-payload assertion.
2. There is no focused SECONDARY content-failure counterexample asserting that `onPrimarySurfaceReady` and `hideOnce` are not called. The existing SECONDARY test covers system failure only; no Web/preview focused harness evidence was found.
3. CP-1 red mutations have not been run. The design requires real mutations for missing-catalog-as-system, runtime-not-started-as-system, and the R-16 sequence, but current evidence records only typecheck/test PASS and no mutation failure output.

### Required disposition

Fix the three gaps at their owning sources, run a real mutation that changes production behavior and record its failure before restoring the source, then obtain a fresh independent CP-1 reconciliation. Do not start A-2 while this verdict remains OPEN.
