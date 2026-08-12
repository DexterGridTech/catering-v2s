---
id: operations.test-closed-loop
status: active
layer: routed
taskKinds: ["implementation","testing","review"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","frontend-platform"]
impacts: ["evidence","governance","runtime","cleanup"]
triggers: ["implementation","review","failure"]
assertions: ["TESTS_MUST_HAVE_EXECUTION_RECEIPT","STATIC_PASS_NOT_DYNAMIC_PASS","FAILURE_TAXONOMY_IS_TYPED","LEGACY_TEST_RETIREMENT_REQUIRES_RETAINED_PROOF","ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION"]
sourceRefs: ["doc/decisions/2026-08-11-v2s-routine-runtime-command-classification.md","doc/plans/platform/2026-08-11-v2s-test-delivery-and-process-remediation-implementation-design-codex.md","doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-requirements-claude.md","project-memory/operations/verification-governance.md","scripts/check/backend-performance-sql-merge-coverage","scripts/test/test-health-entry-runner.mjs"]
---
# Test closed loop

- `TESTS_MUST_HAVE_EXECUTION_RECEIPT`: every finite test or gate denominator must have an explicit discovery set and a matching successful execution receipt; a file existing, a marker existing, or an unmatched glob is not execution evidence.
- `STATIC_PASS_NOT_DYNAMIC_PASS`: static/unit proof cannot be described as Testcontainers, DEV, seed, L2, browser, business, cleanup, UAT, or performance success. Dynamic status remains `NOT_RUN_AWAITING_SEPARATE_AUTHORIZATION` until its managed runner, business result, and cleanup evidence exist.
- `FAILURE_TAXONOMY_IS_TYPED`: environment absence, test failure, and harness failure remain distinguishable as `ENV_*`, `TEST_*`, and `HARNESS_*`; wrappers preserve the deepest first failure and expose last-known-good and broken-boundary evidence.
- `LEGACY_TEST_RETIREMENT_REQUIRES_RETAINED_PROOF`: a retired test or fixture is removed only after its capability assertions are migrated or explicitly dispositioned, the predecessor denominator has exact-set and red-mutation proof, and historical hash-bound evidence remains unchanged.
- `ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION`: an authorized Testcontainers invocation is a standalone routine test. Its runner validates the current authoritative contract and its own managed evidence, rather than a BPF package-input/admission, implementation review, or historical static exit. This does not claim performance, L2, UAT, reset, DEV, seed, business, or cleanup success before the corresponding managed evidence exists.
