---
reviewCycleId: BACKEND-PERFORMANCE-REFACTOR-DESIGN-20260808
reviewRound: 1
reviewRoundLimit: 2
reviewTarget: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
authorMaterialExcludedUntilVerdict: true
---

# 后台性能重构详设独立盲审输入｜Round 1

## 审查任务

先证伪后判定，不得先读取作者自审或 disposition。判断对象是 implementation-facing 详设是否真能解决“重复数据库往返和读侧拼装效率”这一问题，并且不会重新引入跨 owner 总线、丢失写事务中的授权 judgment、把 read budget 偷套给 command，或用设计承诺替代可执行的 exact-set 与基线证据。

你可判 `GO` / `NO-GO`；finding 用 `M` / `S` / `N`，必须指向具体 source、详设段落、有限适用面、反例与较小替代。不要接受“未来实现时再补”的悬空设计。

## 必须先读取的不可变输入

| 输入 | path | SHA-256 | 审查用途 |
|---|---|---|---|
| 仓库约束 | `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` | owner、事务、审查和授权边界 |
| Claude 入口 | `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | Claude 交接约束 |
| Blueprint | `PLATFORM-BLUEPRINT.md` | `38d6138be17a514ded4188f8f71555c480eb3582abcb4f265ffa757792d9b039` | deployable/owner 物理边界 |
| 当前 Roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` | 当前授权阶段 |
| 原始问题 | `doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md` | `7c0cf6a96175cfcce864797217373676ed8f9735716bcaa7568a1e3d86c583b6` | 计数、时延和证据边界 |
| Claude 方案 | `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md` | `010924cbe0630d0511f52196fe2f09aec69df4a65334cea3f4e4f9780e8077a9` | 已接受的方向及不做事项 |
| 设计授权 | `doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md` | `0595e3679cfc355a82098a5925a55bebe82b234693b6320113894d1f2db0f7a0` | design-only 边界 |
| 被审详设 | `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` | `e736750b0530c5d044ac78b1a70e0da71e6a1f007fe20120fd6afeff2cd27eaf` | 逐节证伪对象 |
| 详设 manifest | `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json` | `b759ebf0386e750b660bfe7e3653b69ea2c386b75ed388a5a39892363907fa56` | 6 个 unit 的分母和变更面 |

## 必须重开的记忆与治理来源

- `project-memory/kernel/01-workspace-and-roadmap.md` 至 `06-heritage-and-change.md`，全部读取；
- `project-memory/decisions/deterministic-context-only.md`，SHA `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`；
- `project-memory/decisions/http-crud-efficiency-design-redlines.md`，SHA `80efcb002dde542c9cbcc08f19b0cec62f20e66c54d6d581650809ef8f33c876`；
- `project-memory/operations/phase-retrospective-and-systemic-repair.md`，SHA `aa217082dd2dd9500ff3ce59258be46190c5941afe5cd813967c0773657e12ba`；
- `doc/decisions/2026-07-24-v2s-verification-governance.md`，SHA `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5`；
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`，SHA `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3`；
- `contracts/policy/standards-coverage-matrix.json`，SHA `3ccb1f7c1913e86a36fc6f39e3b1155478654a3cf41e5531d9bcbb79be2825a8`。

运行六维 recall：

```text
scripts/context/recall-memory --task-kind design --domain platform --consumer-face backend --owner catalog --impact performance --trigger refactor
```

读取所有命中的原文；命中若包含 workspace-iam、organization、inventory、contract 或 asset，必须相应扩展 owner，不得用 catalog 命中代替全局 handler 分母。

## 真实源码和反例读面

1. 两个唯一 route 分母：
   - `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`，SHA `1f7900fb24b930dfb41fd5c73659a094c75f7e4e827de1ecd2e763596d7e2824`；
   - `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json`，SHA `fe3c3f7bbc5dda2b1289d4ce81b61d93f9ac52d94845acae7fb3505180117118`。
2. 当前动态反例：
   - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java`，SHA `3f53ead93f88fecc7e7f5077b737535fc1169597c9a8121b7554fe3c7a8c4c10`；
   - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryApplicationService.java`，SHA `75c5def7fdf8fa52fa0fe48bd7a8184e3bebc10da14b81278403ce0ffd5b0339`；
   - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`，SHA `43e4a0a08602d8920b4682a1cfed39fc0864bff0e24a2459deaa4e9c50cfd342`。
3. scope/grant reality：
   - `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/CatalogScopeLookup.java`，SHA `185f3f9b06a030fe9c0f5ce3597a45d92f46c0fbbe881b3f30b4b95604b4160e`；
   - `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolver.java`，SHA `7dc39304d82aa0238d54c0e4d9b67f562f60b46780a14bef481c0bd338e919bd`；
   - `OperationsOwnerScopeGrant` 与所有 public owner API 的全文 `rg` 结果。
4. 计数/读取反例：`DatabaseOperationTracker`、`CountingDataSource`、`HttpRequestMetricsInterceptor`、catalog/inventory owner 的 save、BOM 与 readback 路径；确认该详设没有把 connection/transaction 的 raw kind 与逻辑 section 混同。

## 必须独立导出的 expected set

- 两 registry exact union=196、按 owner 切片，并验证不相交；
- 所有 GET operation 的逐条清单，独立审查五个 `PROTOCOL_READ_EXEMPT` 是否合理；
- catalog multipart asset 与 copy/replay 是不能套入普通 ObjectNode/string dispatcher 的反例；
- 任何“context 进入 owner 前”或“owner replay 前”遗漏对象事实重核的路径；
- C4 五分支与 BOM 多行 target 的最小正确性不变量。

## 输出格式与盲审声明

输出 JSON 到 `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round1.json`，字段遵循 `implementation-design-granularity` review schema。每个 BP-U01..BP-U06 必须给 unit verdict。不得修改被审详设、manifest、授权、实现或测试。

盲审声明必须逐字包含：

> I received this checklist in a fresh subagent context, tried to falsify the reviewed design, and wrote my findings and verdict before reading author self-review or author finding disposition.

