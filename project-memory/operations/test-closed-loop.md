---
id: operations.test-closed-loop
status: active
layer: routed
taskKinds: ["backend-acceptance","implementation","testing","review"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","frontend-platform"]
impacts: ["evidence","governance","runtime","cleanup"]
triggers: ["implementation","review","failure"]
assertions: ["STATIC_PASS_NOT_DYNAMIC_PASS","FAILURE_TAXONOMY_IS_TYPED","ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION","BACKEND_ACCEPTANCE_REAL_SCENARIOS"]
sourceRefs: ["doc/decisions/2026-08-11-v2s-routine-runtime-command-classification.md","doc/plans/platform/2026-08-11-v2s-test-delivery-and-process-remediation-implementation-design-codex.md","doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-requirements-claude.md","scripts/README.md"]
---
# Test closed loop

- `STATIC_PASS_NOT_DYNAMIC_PASS`: static/unit proof cannot be described as Testcontainers, DEV, seed, L2, browser, business, cleanup, UAT, or performance success. Dynamic status remains `NOT_RUN_AWAITING_SEPARATE_AUTHORIZATION` until its managed runner, business result, and cleanup evidence exist.
- `FAILURE_TAXONOMY_IS_TYPED`: environment absence, test failure, and harness failure remain distinguishable as `ENV_*`, `TEST_*`, and `HARNESS_*`; wrappers preserve the deepest first failure and expose last-known-good and broken-boundary evidence.
- `ROUTINE_RUNTIME_COMMANDS_NOT_IMPLEMENTATION`: an authorized `backend-acceptance` invocation is a standalone managed test and does not require an implementation package. Its real HTTP contract/business output must be read directly.
- `BACKEND_ACCEPTANCE_REAL_SCENARIOS`: 当前 backend-acceptance 自动发现并运行 18 条真实 IAM、ORG、商业合同和 asset 场景；原 provider 壳、共享 SPI 与 scenario registry 已下线，PERFORMANCE/CLEANUP verdict、baseline、exact-set 与 lane 控制均已退役。
