---
reviewCycleId: BACKEND-PERFORMANCE-REFACTOR-DESIGN-20260808
reviewRound: 2
reviewRoundLimit: 2
reviewTarget: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
authorMaterialExcludedUntilVerdict: true
---

# 后台性能重构详设独立盲审输入｜Round 2（定向最终核验）

本轮是该 DESIGN cycle 最后一轮。先独立证伪当前 bytes，再看 Round 1 finding；不得第三轮。只审查 BP-M-001、BP-M-002、BP-M-003 的当前修复是否真实成立，并额外搜索修复引入的反例。

## 固定输入

| 输入 | path | SHA-256 |
|---|---|---|
| 当前详设 | `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` | `f22372eef78d26f36a5c6a3455c1b96735ddd2693fd5d1fb483a107e719cd68d` |
| 当前 manifest | `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json` | `9ad7d4f3128f3a2ec432c848990ddd46ff6c4cde06bb501c856ada43c7e437ad` |
| Round 1 verdict | `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round1.json` | read current byte and record hash |
| Round 1 immutable input | `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-input-round1.md` | `4b0c5fc1e1d2c034bfb580dc82d98d453b3e714cf2562cec503694f2f5963602` |
| design authorization | `doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md` | `0595e3679cfc355a82098a5925a55bebe82b234693b6320113894d1f2db0f7a0` |
| original problem | `doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md` | `7c0cf6a96175cfcce864797217373676ed8f9735716bcaa7568a1e3d86c583b6` |
| accepted Claude plan | `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md` | `010924cbe0630d0511f52196fe2f09aec69df4a65334cea3f4e4f9780e8077a9` |
| normal registry | `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json` | `1f7900fb24b930dfb41fd5c73659a094c75f7e4e827de1ecd2e763596d7e2824` |
| catalog registry | `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json` | `fe3c3f7bbc5dda2b1289d4ce81b61d93f9ac52d94845acae7fb3505180117118` |

同时重开 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/http-crud-efficiency-design-redlines.md`、独立审查治理 decision、standards matrix，以及真实 `OperationsCatalogInventoryController`、`CatalogInventoryApplicationService`、`CatalogOwnerService`、`CatalogScopeLookup`、`WorkspaceCapabilityScopeResolver`。

## 必须证伪的定向问题

1. **Context partition**：用 registry 复算 command face 分母，当前应为 operations-admin 75、platform-admin 29、public 9。验证当前 binding 设计是否让 platform/public 误入 workspace grant，或是否给 workspace protocol 留了 untyped fallback；检查三类 factory 的 transaction/start/recheck 要求是否足够而不形成 global dispatcher。
2. **Baseline denominator**：验证 75 workspace operations 的 deterministic selection，`saveOperationsCatalogItem` 普通分支是否被五分支恰好替代，数值基线是否是 74+5=79，platform/public 34 条是否明确 parity-only，C5/C6 是否被明确排除。检查 `UNMEASURED_BLOCKS_OPTIMIZATION` 不能被当作已验收数值。
3. **Unique binding**：真实运行 `scripts/check/implementation-design-granularity --manifest ... --review <your output>` 前，检查 BP-U01..BP-U06 anchors 各在 design 中唯一且 hashes 相等；不得放松 checker。
4. **回归搜索**：检查新的 `CommandContext` 示例是否仍允许 owner 接受 `Object`/裸 operationId、catalog scope 是否仍 workspace-only、task read 仍不进 command transaction。

仅允许写入 `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-independent-review-round2.json`，用 apply_patch 与 hooks。输出必须是 checker 的 `implementation-design-adversarial-review` schema；`reviewRound=2`、`roundFinalDecision=SELF_DECIDED`、`furtherCodexAdversarialRoundAllowed=false`，每个 unit 都给 verdict，并对 Round 1 三个 finding 给 verified disposition。任何未解决 M/S 必须 NO_GO；没有 M/S 才可 GO。

盲审声明：

> I received this checklist in a fresh subagent context, tried to falsify the current design, and wrote my findings and verdict before reading author self-review or author finding disposition.

