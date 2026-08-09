# Backend-performance final-closure design review input checklist

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CLOSURE_DESIGN_20260810`  
`REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`

## Independence

The reviewer must be a fresh `INDEPENDENT_SUBAGENT`. Form a falsification-first verdict from current
bytes before reading author disposition. This is a new scope/authorization cycle; no earlier U05 or U07
review round may be reused.

## Required inputs

1. `doc/decisions/2026-08-10-v2s-backend-performance-final-closure-authorization.md` — `57abad75d4467f135d1dac614edeff0985f0f5013e8a4439fee82e808a8c1da6`
2. `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` — `feb3624275807cf37184d5f63786f05c655adac2160de3876a4523dc397ab67b`
3. `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-design-source-inventory.json` — `50351dd2bc05c0a29abfcfe8ca0488e64c57d883fc7721a92ae2bb9797ad866e`
4. `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-granularity-manifest.json` — review its current bytes and recompute its binding hashes.
5. Current source: `CatalogInventoryApplicationService`, both app/application audit readers, `OperationsCatalogInventoryController`, both audit controllers, handler bindings, task-read policy, SQL applicability generator, `http-diagnostic-runner`, snapshot checker and code-layout checker.

## Falsification targets

1. Recompute BP-U06 source/route denominator: 3 production sources, 4 tests, 2 registries plus 2 tests,
   one root artifact, 42 catalog routes and 9/7 audit target types.
2. Prove or disprove the proposed `audit-read` module avoids both an owner dependency cycle and edge-owned
   cross-owner coordination; reject invented source paths or missing build wiring.
3. Prove every legacy catalog dispatch reference has a declared direct typed replacement path, preserving
   owner transaction, scope recheck, CAS/replay and asset readback.
4. Try to obtain a measured status using the current generator and a foreign/partial snapshot. The design
   must specify a closed replacement that rejects both.
5. Recompute all dynamic denominators and reject any workload that reuses RM1 L2/historic evidence or
   starts remote application/browser processes.
6. Confirm the serial Roadmap pause is a pause, not a false RM1 closure, and that dynamic authority remains
   absent from this design package.

## Required verdict

State `GO` or `NO_GO`, list M/S/N with exact source/evidence, declare blind review, and preserve the fixed
cycle/round metadata. Round 2, if required, is final and must include
`ROUND_FINAL_DECISION=SELF_DECIDED`.
