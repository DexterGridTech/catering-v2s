# 扩展字段列表展示与类型化搜索：N-02 修复后的 fresh 步骤级独立复查

```text
REVIEW_TARGET=STEP_RECONCILIATION
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=N/A
OPEN_COUNT=0
VERDICT=MATCHED
EVIDENCE_TIER=STATIC_SOURCE_PLUS_LSP_PLUS_ARCHITECTURE_TESTS
```

## 盲审声明

本轮是 fresh 独立只读复核；未继承作者结论或上一轮 reviewer verdict；未写文件，未执行 Git，未启动/停止 DEV，未 reset/seed，未跑 browser L2。结论只基于当前源码、指定设计章节、只读 diagnostics 与静态 architecture tests。

## 读取文件清单

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md` §7.3。
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md` §1、§7。
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md` §6.3。
- `libraries/frontend/admin-ui-foundation/src/extension/staleRecovery.ts`、`src/index.ts`、`src/foundation.test.ts`。
- operations 三页：`BusinessEntityManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx`。
- platform `PlatformReadPage.tsx`。
- operations/platform `extension-filter-recovery.test.mjs`、`query-filter-submit-boundary.test.mjs`、`platform-read-boundary.test.mjs`。
- 两侧 `extensionList.tsx` adapter、foundation `typedExtension.ts`、`usePageQuery.ts`。

## 逐项结论

### N-02a：recovery 失败不得退化为 core-only 查询

结论：`REJECTED_WITH_EVIDENCE`；不是当前代码逻辑问题。

设计依据：需求 §7.3；交互 §1、§7；详设 §6.3。

当前实现：`isExtensionDefinitionRevisionAtLeast` 对缺失、非法或低 revision fail closed；operations 三页在 recovery 失败时置 `extensionRecoveryFailed=true`，并以 `extensionRecoveryBlocked` 继续 skip list query；platform 组织、platform 合同两个 scope 同样处理。五个 scope 均渲染字段配置恢复错误和手动“重试”入口，因此不会发送无扩展条件的 core-only list 请求。

### N-02b：自动恢复只能按同一 scope 一次，且必须校验 revision 下界

结论：`REJECTED_WITH_EVIDENCE`；不是当前代码逻辑问题。

设计依据：需求 §7.3；交互 §7；详设 §6.3。

当前实现：foundation gate 使用 `Set<scopeKey>` 做一次 claim；`staleRevision` 不再扩大自动恢复次数。五个 recovery scope 都读取 stale payload 的 `currentDefinitionRevision`，并以 `isExtensionDefinitionRevisionAtLeast(definition, expectedRevision)` 验证定义版本后才进入成功路径。

### N-02c：typed reconcile、核心筛选、第一页和显式解除

结论：`REJECTED_WITH_EVIDENCE`；不是当前代码逻辑问题。

设计依据：需求 §7.3；交互 §1、§7；详设 §6.3。

当前实现：五个 scope 都调用 `reconcileExtensionFilterValues`，只重建 `extensionFilterValues` 命名空间并保留 core filters；成功后回第一页。显式查询/重置清除 recovery failed/in-progress；operations 直接设置第一页，platform 通过 query identity 复位。

## 验证状态

- 指定 TS/TSX 文件 diagnostics：0 error。
- recovery architecture tests：4/4 PASS。
- foundation tests：55/55 PASS。
- operations-admin：architecture 42 PASS、4 TODO；unit 257/257 PASS；typecheck PASS。
- platform-admin：architecture 17 PASS、1 TODO；unit 26/26 PASS；typecheck PASS。
- 未验证 browser L2/DEV/runtime；该边界不扩展为代码 finding。

## 最终结论

```text
STEP_RECONCILIATION=MATCHED
OPEN_COUNT=0
N-02_CODE_LOGIC=FIXED
NEXT=主 agent 可更新实施对账并提交 Claude 的 IMPLEMENTATION 复审 brief
```
