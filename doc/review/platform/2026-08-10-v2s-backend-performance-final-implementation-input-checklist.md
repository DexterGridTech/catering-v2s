# Backend-performance final static implementation review input checklist

`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CLOSURE_IMPLEMENTATION_20260810`  
`REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`

## Bound inputs

1. Final design manifest `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-granularity-manifest.json` — `78dcf08eea3e82a871d411779edcbdc3da1ff0f932afba560a77dd11f7adb280`.
2. Final design Round 2 `doc/review/platform/2026-08-10-v2s-backend-performance-final-design-review-round2.md` — `7e10a062b2d41129afc574bbabfc19709685f78d0631d4a00f8754a6552de7e6`.
3. Static package input `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-implementation-package-input.json` — `bf139099ac4c49dca5bc71fddf8a41c0491d0d21a6d661786e04b41913d6ac64`.
4. Workload policy `contracts/policy/backend-performance-final-workload.json` — `b248b094fb7c41b5aff61711c764d9c931d0ccb402b3570c51eee5dc7e279b16`.
5. Task-read policy `contracts/registry/task-read-surface-policy.json` — `992e686d35c3579542b5a6e17374418c91e0c00a08651f8d54f93d10505684d9`.
6. SQL applicability `contracts/registry/backend-performance-sql-merge-applicability.json` — `bd2ebee1d4569b72f6f67c4b8f2c0eba8f90e7845978ffbddfedbceb8c8ccd0a`.
7. Binding registry `contracts/registry/operation-handler-bindings.json` — `13f08da276c5ca943836651a83c181fd9ccd76bae0f87b7c29cd1fd1b1c4ae81`.

## Required independent falsification

1. Verify no old `app/application` source, root result artifact, String operation dispatcher or runtime URI/token bridge survives; recompute the 42 catalog route map and 9/7 audit discriminators.
2. Prove audit-read has no `app` import and platform audit receives only public `PlatformSessionReadback`; confirm owner-local selected-workspace behavior and PLATFORM_ADMIN counterexample.
3. Attempt historic-R5, cross-run, missing/duplicate fixture, unclassified and cap-overflow final-snapshot admissions; each must reject before a measured success claim.
4. Verify final-only metrics attribution cannot be enabled by a non-final mode/namespace or raw JSONL post-processing.
5. Re-run the listed static gates and affected compile targets; distinguish the repository's remote-Testcontainers refusal from a test assertion failure.
6. Verify every actual changed path is in the active implementation package and that runtime remains absent/unauthorized.

## Required verdict

Fresh independent subagent must review source before author handoff, return `GO` or `NO-GO` with `M/S/N`, and record exact file/line, impact and minimal remedy. No dynamic run may start from Round 1 alone.
