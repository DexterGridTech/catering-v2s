---
reviewCycleId: OVERALL_PHASE_4_U05_OWNER_PROJECTION_REBASELINE_DESIGN_20260809
reviewTarget: DESIGN
reviewRound: 1
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
authorMaterialExcludedUntilVerdict: true
---

# BP-U05 owner-projection 重基线独立盲审输入｜Round 1

## 盲审任务

先以证伪为目的审查第 9 至第 11 个 exception 是否有必要、11 条闭集是否真实、每条
owner-local projection 的 cap 与 branch 是否足以保持既有 HTTP 输出，并确认没有进入
BP-U06。不得在形成 verdict 前读取作者 intake、作者 self-review 或 finding disposition。

## 已重开输入

| 输入 | path | SHA-256 | 用途 |
| --- | --- | --- | --- |
| 仓库约束 | `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` | owner、独立审查、BP-U06 与动态运行边界 |
| 确定性上下文 | `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | review/gate 必须有真实落点 |
| BP-U05 详设 | `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` | `f84dfdc364d9e1576e345b80ea32f787043c1bda254d23ca0b58571dbfdce2e7` | 78 行 budget、11 行例外、owner/read 边界 |
| 既有五条裁定 | `doc/decisions/2026-08-09-v2s-backend-performance-phase4-read-budget-rebaseline.md` | `2cc48970b2ec0d9bf9e970da8b1e09ac51f5ccce6d433916cb2ccdfe473728c1` | 既有 5 条双 owner 基线 |
| 本次六条裁定 | `doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md` | `302dc6d373fc50cd124c0ef26e889179d1bc5cab90c40e95a22ae73b1f23f2d1` | 8→11 有限分母与反例 |
| 当前 policy | `contracts/registry/task-read-surface-policy.json` | `12640779468b338957b15cfd58716cf9046e9b8018fcf525e181f733a0c67395` | 83/78/5 与 5+6 exception 数据 |
| policy generator | `scripts/generate/task-read-surface-policy.mjs` | `4690081899e7e070465a6ab3c6983ea056debcac250b99ec3348d157aecf4f49` | exact-set、branch、red mutation 控制 |
| policy checker | `scripts/check/backend-performance-read-budget` | `36bbd1c56027d2c4b9a83654aaacb2f12d49157a45783be82d93ea9a8c5d656a` | 机械判定入口 |
| Phase 4 manifest | `doc/review/platform/2026-08-09-v2s-backend-performance-phase4-u05-rebaseline-design-granularity-manifest.json` | `6fe7caaa9b846a28f3d4dcc4255c8d6d475ab542a8c620c1a40b413d9ee43f0f` | approved sources、delivery 与 BP-U06 exclusion |
| 当前 package | `.runtime/compliance-control/active-package.json` | `e6dc1799022f6e4851c1ec7d2de99a597b5db5a15159a9dc588efb46175a89a4` | 仅 BP-U05 implementation surface、runtime=false |

## 独立重开源码链

| 新 exception | edge / source chain |
| --- | --- |
| `getPlatformContractOverviewDetail` | `PlatformContractOverviewController#detail` → `ContractTaskReadService#platformOverviewTaskDetail` + `ExtensionDefinitionService#platformContractManagementDefinition` |
| `getPlatformOrganizationOverviewDetail` | `PlatformOrganizationOverviewController#detail` → `OrganizationOverviewTaskReadService#detail`，其 current closure 继续读取 extension definition 与 organization extension values |
| `getPlatformEntityAuditHistory` | `PlatformAuditHistoryController#history` → `PlatformWorkspaceAuditHistoryService#readGroupWorkspace` → `OrganizationAuditHistoryService#readInitializationForGroupWorkspace`，并含 five workspace-host / one platform-admin branches |
| `getOperationsEntityAuditHistory` | `OperationsAuditHistoryController#history` → target-specific `WorkspaceAuditAuthorizationService` / `OrganizationOverviewTaskReadService` / `ContractTaskReadService` → owner audit page |
| `listPlatformGroupWorkspaces` | `PlatformWorkspaceAdministrationController#list` → `WorkspaceAdministrationService#list` + `PlatformAssetService#requireActivePublicReferences`; current workspace page embeds commercial-group `EXISTS` |
| `getPlatformGroupWorkspaceDetail` | `PlatformWorkspaceAdministrationController#detail` → `WorkspaceAdministrationService#require` + `GroupWorkspaceTaskQuery#detail` + `PlatformAssetService#requireActivePublicReference` + two separate `WorkspaceIamSummaryReadService` count calls |

## 已独立复算的反例

- policy 共有 78 条 `TASK_READ`：5 条既有双 owner cap=2 加本次 6 条，恰为 11；其余 67 条 cap=1。
- 当前 gate 输出 `TWO_OWNER_PRIMARY_PROJECTION_EXCEPTIONS=5`、`TWO_OWNER_REMAINING_EXCEPTIONS=6`，状态仍为 `SOURCE_NOT_IMPLEMENTED_BLOCKED`，没有伪称测量成功。
- `PlatformWorkspaceAdministrationController#list` 的 response 只需要 page、total、初始化标志与 logo URL；不能在 edge 逐行查 asset 或以删 logo/初始化标志来降低 cap。
- `PLATFORM_ADMIN` audit 不加载 selected-workspace；`GROUP_WORKSPACE` 的 selected-workspace key 来自 target 而非 host request param，二者不能被一般化为同一 unconditional gate。

## 输出限制

本轮仅可生成本 checklist 与相邻 Round 1 verdict；不得改 policy、生成器、生产代码、测试、运行环境或 BP-U06。
