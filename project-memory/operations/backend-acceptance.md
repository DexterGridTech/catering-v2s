---
id: operations.backend-acceptance
status: active
layer: routed
taskKinds: ["backend-acceptance","design","implementation","testing","review"]
domains: ["backend","contract","platform"]
consumerFaces: ["all"]
owners: ["backend","contract","platform","product"]
impacts: ["database","contract","evidence","runtime","cleanup","governance"]
triggers: ["task-start","implementation","review","failure","runtime"]
assertions: ["BACKEND_ACCEPTANCE_REAL_SCENARIOS","BACKEND_ACCEPTANCE_LEGACY_PROVIDER_ASSETS_RETIRED","BACKEND_ACCEPTANCE_OLD_CONTROLS_RETIRED","BACKEND_ACCEPTANCE_SCENARIO_EXTENSION_STANDARD"]
sourceRefs: ["doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md","scripts/README.md"]
---
# Backend acceptance

- `BACKEND_ACCEPTANCE_REAL_SCENARIOS`: 当前自动发现并运行 28 条 IAM、ORG、商业合同、asset 与 catalog 真实场景；每条必须以真实容器和 HTTP、手写 fixture/request/业务真值断言输出分离的 `CONTRACT` 与 `BUSINESS`，并打印不设门的 DB 调用数。
- `BACKEND_ACCEPTANCE_LEGACY_PROVIDER_ASSETS_RETIRED`: 原 196 个 provider 壳、共享 SPI 与 scenario registry 已下线删除；它们从未被当前真实 runner 执行，也不再作为 coverage 依据。
- `BACKEND_ACCEPTANCE_OLD_CONTROLS_RETIRED`: PERFORMANCE/CLEANUP verdict、accepted-baseline、known-uncovered、自动精确分母、lane/并行/心跳/work-stealing、calibration 和 correctnessCases 均不再运行或作为准入。
- `BACKEND_ACCEPTANCE_SCENARIO_EXTENSION_STANDARD`: 后续场景必须遵循当前主动设计规范 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`：按 IAM、ORG、商业合同、asset、catalog 分域写入五个 `*AcceptanceScenarios.java`，由显式 catalog 自动发现；fixture、真实 HTTP request 和真实业务 oracle 缺一不可，`CONTRACT`/`BUSINESS` 分开，`DB_OPERATIONS` 只报告不设门，场景总数不超过 80。受管资源 cleanup 仍是运行安全条件，但不是 scenario-level 业务维度。
