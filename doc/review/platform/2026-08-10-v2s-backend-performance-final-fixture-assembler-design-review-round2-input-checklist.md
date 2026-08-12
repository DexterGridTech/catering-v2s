# Final fixture assembler design — Round 2 directed input

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_FIXTURE_ASSEMBLER_DESIGN_20260810`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`

Read the complete Round-1 checklist first, then independently reopen the current bytes below before
reading any author disposition. Form the directed verdict before author material.

- `doc/review/platform/2026-08-10-v2s-backend-performance-final-fixture-assembler-design-review-input-checklist.md` (all mandatory repository, memory and governance inputs);
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-design-amendment.md@a72367dcdfde59de9c296157848794f2e95b08f03e21aefdc59e87cd73e4b6db`;
- `contracts/policy/backend-performance-final-fixture-catalog.json@5e63aadba8fe363d2f117c5cc59404e6080f55385b11ce14a2c9723f57c72682`;
- `scripts/check/backend-performance-final-fixture-catalog` with `--check` and `--self-test`;
- `scripts/dev/backend-performance-runtime-runner.mjs` and `scripts/dev/backend-performance-final-managed-adapter.mjs` plus their focused tests;
- `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-granularity-manifest.json@f31f9fafabc416cd12fee913282cfe7e2c7bcb1864e53cc8a6f8d60a138fcebe` and current package input.

Directed falsification: (1) mutate an undeclared predecessor sequence, nonexistent source selector
and wrong OpenAPI status to prove the catalog checker rejects all; (2) attempt an exported direct
import with forged runtime authority and prove rejection precedes adapter import; (3) confirm no
dynamic resource/run is possible from static authority. The round must end with
`ROUND_FINAL_DECISION=SELF_DECIDED`; no third Codex round is allowed.
