# R5 U01 control baseline — 2026-07-26

## Scope and truth status

This is the implementation-start control record for the accepted R5 revised plan. It does not
claim that later P5/P6 work already exists. The frozen denominators remain 106 operations,
32 scenarios, 22 surfaces, 25 page design keys and seven owner schemas.

| Control | state | production result | scratchpad red mutation |
| --- | --- | --- | --- |
| Backend module / edge boundary | `ACTIVE_RED_VERIFIED` | `tools/verify-gates/cli.mjs backend` PASS | existing backend self-test PASS |
| Code layout | `ACTIVE_RED_VERIFIED` | `scripts/check/code-layout` PASS | `scripts/check/code-layout --self-test` PASS |
| Frontend architecture | `ACTIVE_RED_VERIFIED` | `scripts/check/frontend-architecture` PASS | `scripts/check/frontend-architecture --self-test` PASS |
| Route registry and OpenAPI closure | `ACTIVE_RED_VERIFIED` | `tools/verify-gates/cli.mjs openapi` PASS after the 106-row materialization | `scripts/generate/r5-edge-materialize.mjs --self-test` rejects unresolved capability; `scripts/generate/edge-codegen.mjs --self-test` rejects generated drift and a manual wire file; `tools/platform-boundary-gates/cli.mjs contract --post-gate-0 --self-test` rejects malformed root spec |
| Security edge boundary | `ACTIVE_RED_VERIFIED` | `scripts/check/security-boundaries` PASS | self-test mutates the generated route registry and the actual workspace-detail mapping; both red paths are required |
| Logging sensitive data | `ACTIVE_RED_VERIFIED` | `scripts/check/logging-boundaries` PASS | `scripts/check/logging-boundaries --self-test` PASS |
| Database/media boundary | `ACTIVE_RED_VERIFIED` | database boundary and operation-budget checks PASS | both checks' self-tests PASS |
| L2/L3 discovery | `ACTIVE_RED_VERIFIED` | deliberately RED until P5 supplies the registered real L2 targets | `tools/verify-gates/cli.mjs affected-l2` currently reports `R5_AFFECTED_L2_TARGET_MISSING:apps/frontend/operations-admin/src/tests/l2/authentication.spec.ts` |

The final row is an active guard, not a pending control and not a waiver: it correctly blocks
the future L2/L3 and evidence closure while pages are absent. No placeholder or skipped test was
created to make it green. It must be re-run after P5 and must pass before P6/P7 can close.

## P2 correction made before contract execution

The pre-existing contract-face control still referenced a retired, unused
`EdgeOperationRegistry.java` path while the accepted structure plan makes the generated
`edge-route-face-registry.json` the single registry. The control now validates the real
`app/edge/generated/EdgeProblemCode.java` plus route registry, and its post-Gate-0 scratchpad
test starts from a copy of the actual P2 source before applying the red mutation. This is a
control correction only; it does not change HTTP paths, operation IDs, error codes, owner APIs,
transaction semantics or migration bytes.
