# Catalog / Inventory P3 post-remediation recheck round 2 disposition (Codex)

status: `REMEDIATION_IMPLEMENTED_AWAITING_CLAUDE_RECHECK`
reviewTarget: `IMPLEMENTATION`
sourceReview: `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round2-claude.md`
reviewBoundary: P3 current-byte static implementation, IA control reconciliation, generated/static evidence only; no API/HTTP runtime, database/migration, seed/reset, DEV/UAT, managed L2, deployment or cleanup claim

本文件只处置 Claude 第二次 post-remediation 复核的 S-01 与 N-01，不重写历史 review，不重置 review cycle，也不把静态状态升级为 runtime business PASS。

## Disposition

| finding | disposition | owning source / evidence | smallest complete repair |
|---|---|---|---|
| S-01 | `CONFIRMED` → `CLOSED_STATIC_PENDING_RECHECK` | `tools/catalog-inventory-p3/ia-reconciliation.mjs`、IA source、`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json` | 对 3 条残留 blocker 逐条复判：`IA-INV-002` 迁为 `IMPLEMENTED_STATIC`；`IA-CAT-LIFECYCLE-002` 与 `IA-INV-001` 迁为 `PARTIAL_STATIC`，分别写具名前端行为缺口和实际列表事实缺口；三条全部移出 `BLOCKED_UPSTREAM_CONTRACT`。当前计数由 36/40/3/7/3 变为 37/42/0/7/3。 |
| N-01 | `CONFIRMED` → `CLOSED_STATIC_PENDING_RECHECK` | `tools/catalog-inventory-p3/ia-reconciliation.mjs`、`tools/catalog-inventory-p3/cli.mjs` | 新增 `retainedBlockedReasons`，要求每个 `BLOCKED_UPSTREAM_CONTRACT` 逐条有具名理由、与 control.reason 一致且互不相同；当前无 blocker，因此结构为空集。主门新增重复 blocked reason 红变异 `P3_RED_MUTATION=IA_BLOCKED_REASON_LEDGER`。 |

## Round-2 status ledger

本轮复判依据：

- `IA-INV-002`：库存查询的 `stock_state` 仍是独立五态事实，`attention_count` 由 `COUNT(*) FILTER (WHERE stock_state <> 'OK')` 派生并由前端 `page.counts` 消费；这满足 IA 的“需处理只是视图、不进入 stockState”约束。
- `IA-CAT-LIFECYCLE-002`：`CatalogOwnerService.validateItemActivation` 已按 `priceGranularity` 执行启用前价格校验并由 `transitionItem` 调用；剩余缺口是 `CatalogItemDrawer` 尚未取得首错摘要、页签错误数/字段定位、启停/归档二次确认与写后 readback 的完整静态证明，因此是 `PARTIAL_STATIC`，不是 upstream blocker。
- `IA-INV-001`：owner 查询与 `targetType` 已存在，但 `InventoryOwnerService.targetListRow` 当前明确将 `productName`、`categoryName`、`materialRole` 置空；前端 `NameCodeText` 结构存在不等于实际事实可见，因此是 `PARTIAL_STATIC`，不是 upstream blocker。

| status | historical review declaration | before first remediation | before round-2 remediation | current byte after round 2 |
|---|---:|---:|---:|---:|
| `IMPLEMENTED_STATIC` | 86 | 29 | 36 | 37 |
| `PARTIAL_STATIC` | 0 | 40 | 40 | 42 |
| `BLOCKED_UPSTREAM_CONTRACT` | 0 | 10 | 3 | 0 |
| `NOT_IMPLEMENTED` | 0 | 7 | 7 | 7 |
| `OUT_OF_SCOPE_STATIC` | 3 | 3 | 3 | 3 |
| total | 89 | 89 | 89 | 89 |

`statusLedger.latestRemediationChanges` 现在包含此前 7 条迁移与本轮 3 条迁移，且每条均带 `from`、`to`、`basis`；`retainedNotImplementedReasons` 保留 7 条未完成控件的具体缺口；`retainedBlockedReasons` 为空集与当前 0 条 blocker 一致。

## Static proof run

- `node tools/catalog-inventory-p3/ia-reconciliation.mjs`：PASS，89 个 IA-ID，当前计数 `37/42/0/7/3`。
- `node tools/catalog-inventory-p3/cli.mjs --self-test`：必须包含既有 9 类红变异与新增 `IA_BLOCKED_REASON_LEDGER`。
- `node tools/catalog-inventory-p3/cli.mjs`：3 pages / 18 scenarios / 43 cases / 43 locators，IA exact-set 89。

所有证据均为静态/编译层；`businessStatus`、`cleanupStatus`、managed L2 与 89 个控件的 `runtimeStatus` 仍未执行/未核验，不得升级为接口或浏览器业务 PASS。

## P4 boundary reminder

38 条否定 API 用例的 condition→problem 绑定、seed loader 依赖/幂等设计及其 runtime 执行仍属于 P4，沿用 `doc/review/platform/2026-08-06-v2s-catalog-inventory-p4-scope-registry-claude.md`，不在本轮实施或验收。

## Handoff boundary

本收据仅请求 Claude 对当前 P3 字节做下一次静态复核；不授权也不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、cleanup 或 Git。
