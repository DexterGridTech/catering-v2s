# Final-closure design Round 1 author intake

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CLOSURE_DESIGN_20260810`  
`REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`

## Verified dispositions

| Finding | Disposition | Source-backed repair |
|---|---|---|
| BPF-D-M-001 audit-read imports edge session facts | CONFIRMED | The nested `PlatformSessionResolver.PlatformReadSessionFacts` would form app→audit-read→app. The final design now keeps this fact edge-private; controller passes its public `PlatformSessionReadback` to audit-read, which owns the selected-workspace owner call and measurement. The module must not import any `app` package. |
| BPF-D-M-002 catalog only had a count | CONFIRMED | `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-catalog-route-binding-map.json` freezes 42 unique operation→edge method→coordinator method rows, including all 26 generated token constants. Source gate will verify this exact map, response/failure parity and no dispatcher. |
| BPF-D-M-003 historic snapshot accepted | CONFIRMED | Final snapshot admission now requires runner kind `backend-performance-final-acceptance`, final implementation manifest digest, workload-policy digest and exact same-run tuple evidence; `.runtime/r5`/historic runner kinds are rejected even with valid shape. |
| BPF-D-M-004 design authority missing from manifest | CONFIRMED | Manifest now declares `implementationAuthority=false`; static implementation/runtime remain excluded from this package. |

## Reopened alternatives

- Moving audit coordinators under `app/edge` was rejected: it gives edge cross-owner coordination.
- Moving them under `audit-model` was rejected: audit-model is already a dependency of the relevant owner
  modules, so it reverses the module graph.
- Retaining a generic dispatcher during route-by-route cutover was rejected because BP-U06 completion is
  source absence, not caller reachability.
- Reusing a historical snapshot was rejected because it cannot prove final source bytes, exact fixtures or
  final-run cleanup.

## Round 2 scope

Only verify the four repairs above and their counterexamples. This is the second and final independent
round; it must not expand scope or author a third round.
