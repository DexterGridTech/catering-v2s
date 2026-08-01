---
id: decisions.runtime-source-organization-must-not-follow-journey-ids
title: Runtime 源码组织不得跟随 Journey ID
type: decision
status: active
layer: routed
scope: frontend and backend runtime design and implementation
createdAt: 2026-07-17
lastUpdatedAt: 2026-07-17
taskKinds: [backend-implementation, frontend-implementation, implementation-review, spec-design, testing]
domains: [admin-ui, backend, platform]
consumerFaces: [backend, operations-admin, platform-admin]
owners: [frontend-platform, platform, product]
impacts: [architecture, evidence, journey, ownership, package-layout, runtime-binding, test]
triggers: [feature, frontend, implementation, new-page, package, phase-start, review, runtime, service]
sourceRefs:
  - doc/decisions/2026-07-17-runtime-source-organization-must-not-follow-journey-ids.md
  - doc/review/platform/2026-07-16-admin-ui-page-surface-traceability-remediation-plan.md
  - doc/review/platform/2026-07-16-four-domain-admin-frontend-page-module-state-test-map.md
---

# Runtime 源码组织不得跟随 Journey ID

Scenario/Step 只承担产品、设计、测试与 evidence 追踪，不产生 runtime 源码所有权。前端按 app、批准页面/稳定能力与 state owner 组织；后端按 deployable、bounded context、owner、稳定业务能力与 application use case 组织。

禁止以 Scenario/Step ID 命名或划分 runtime directory、package、file、class、Page、component、hook、store、slice、selector、controller、use case、adapter、Spring bean 或 test file。ID 只允许进入 docs、`tests/traceability`、test metadata、runner manifest 与 evidence metadata。

当前前端细则继续由 `decisions.admin-frontend-runtime-architecture-must-not-follow-journey-ids` 承担。恢复任何后端业务实现前，必须全量重绑 30 Packet §16 backend paths 与四包 Plan targets，并通过可失败的 layout/ArchUnit fixture、Claude 复审和 Dexter 批准；R4 不授权后端代码变更。
