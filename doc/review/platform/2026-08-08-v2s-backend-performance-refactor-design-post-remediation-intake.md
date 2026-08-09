---
kind: post-remediation-author-intake
reviewCycleId: BACKEND-PERFORMANCE-REFACTOR-DESIGN-20260808
reviewRound: 2
implementationAuthority: false
currentBytesNotReviewedByAdversarialReviewer: true
claudeRecheckRequired: true
---

# 后台性能重构详设 Round 2 后修订 intake

本文件只处理 Round 2 独立盲审的两个 M finding；同一 DESIGN cycle 已到两轮上限，不能借修订再发起第三轮独立审查。当前字节必须由 Claude 复核，不能宣称历史独立 GO。

| finding | 复核结论 | 根因与有限分母 | 最小修订 | 未采用的替代 |
|---|---|---|---|---|
| BP-M-001 | CONFIRMED | `OwnerOperationBindings.invoke(CommandContext,Object)` 接受 sealed 超类型；113 command（75 workspace、29 platform、9 public）都可能通过共同入口获得错误 context | 删除共同 callable command 接口；生成四个 kind-specific public binding interface，每 operation 一个 concrete typed method，`Object` 只可留在各 method 内立即分支，不得跨 public boundary | runtime `instanceof`/cast：更小但不能满足编译期隔离，拒绝 |
| BP-M-002 | CONFIRMED | C6 的 `CatalogOwnerService.dictionary` 同时服务 task read 与 `reorderOperationsCatalogDictionaryEntry` POST readback；后者已在 74 workspace normal rows | 将 C6 定义为 owner-local `DictionaryReferenceSnapshot`，task reader 和 command readback 都可构造/使用，但 command 不调用 TaskReadService；关联 reorder fixture，79 条 numeric baseline 不变 | 把 reorder 偷放入 task reader：违反事务外 read boundary，拒绝 |

Round 1 的 BP-M-003 已在 Round 2 verified；不再改变其 solution。Round 2 的 platform-admin 数量为 29（非 Round 1 文本中的 30），由当前 registry 复算。

Claude 必须重点检查：kind-specific 绑定是否真的让错误 context 编译不可达、C6 snapshot 是否避免 loop/N+1 且不跨越 owner/事务边界，以及此 post-remediation 字节仍是 design-only。
