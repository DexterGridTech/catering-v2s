# Catalog / Inventory P3 post-remediation recheck disposition (Codex)

status: `REMEDIATION_IMPLEMENTED_AWAITING_CLAUDE_RECHECK`
reviewTarget: `IMPLEMENTATION`
sourceReview: `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-claude.md`
reviewBoundary: P3 current-byte static implementation, IA control reconciliation, generated/static evidence only; no API/HTTP runtime, database/migration, seed/reset, DEV/UAT, managed L2, deployment or cleanup claim

本文件是对 Claude post-remediation current-byte 复核的逐条 intake 与修复收据。它不改写历史 review，不重置 review cycle，也不把静态状态升级成 runtime business PASS。

## Disposition

| finding | disposition | owning source / evidence | smallest complete repair |
|---|---|---|---|
| M-01 | `CONFIRMED` → `CLOSED_STATIC_PENDING_RECHECK` | `tools/catalog-inventory-p3/ia-reconciliation.mjs`、`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json` | 将已被源码证明具备契约与 owner 能力的 7 个 IA-ID 从 `BLOCKED_UPSTREAM_CONTRACT` 移出：`IA-CAT-LIST-003`、`IA-CAT-LIST-012`、`IA-INV-ACTION-COUNT-001`、`IA-INV-ACTION-INCREASE-001`、`IA-INV-ACTION-CONFIG-001`、`IA-INV-ACTION-ADJUST-001`、`IA-INV-ACTION-RESULT-001`；保留真正仍缺 P1 生命周期/库存列表事实的 3 个 blocker：`IA-CAT-LIFECYCLE-002`、`IA-INV-001`、`IA-INV-002`。`statusLedger` 记录变更前后分母与逐 ID basis。 |
| S-01 | `CONFIRMED` → `CLOSED_STATIC_PENDING_RECHECK` | `tools/catalog-inventory-p3/ia-reconciliation.mjs`、本文件的 status ledger、`tools/catalog-inventory-p3/cli.mjs` | 保留人工维护的语义状态集合，不用 locator 存在性冒充完成；在 reconciliation 内加入历史 86/0/0/0/3、最新整改前 29/40/10/7/3、逐条 7-ID migration diff 和当前计数。checker 现在要求 ledger 存在、计数与 controls 相等、每条 migration 的 from/to/basis 合法，并用 `P3_RED_MUTATION=IA_STATUS_LEDGER` 证明篡改会失败。 |
| N-01 | `CONFIRMED` → `REGISTERED_HANDOFF` | `tools/catalog-inventory-p3/ia-reconciliation.mjs`、`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json` | 保留 7 个 `NOT_IMPLEMENTED`，不把“locator 已存在”误报成实现完成；为每个 ID 登记具体缺口：`IA-CAT-LIST-007`（SKU 展开批选/旧请求/持久恢复 proof）、`IA-CAT-CATEGORY-001`（根子创建 readback/失败输入）、`IA-CAT-CATEGORY-002`（环检测/冲突/树 readback）、`IA-CAT-SOURCE-AUTO-001`（全字段锁定/来源映射/重试 proof）、`IA-CAT-SOURCE-AUTO-002`（无同步链的入口级 proof）、`IA-CAT-TAB-004`（三栏与具体校验/跨页签修复）、`IA-CAT-TAB-009`（候选 Drawer/分类搜索/owner 校验/readback）。 |

## Current status ledger

状态是实现语义，而不是 locator 存在性推导。每次集合变更必须同时具备：准确的 IA-ID、`from`/`to`、依据、剩余缺口，并在下一次 evidence 中复算 controls 与 counts。当前 reconciliation 的计数为：

| status | historical review declaration | latest remediation before | current byte after latest remediation |
|---|---:|---:|---:|
| `IMPLEMENTED_STATIC` | 86 | 29 | 36 |
| `PARTIAL_STATIC` | 0 | 40 | 40 |
| `BLOCKED_UPSTREAM_CONTRACT` | 0 | 10 | 3 |
| `NOT_IMPLEMENTED` | 0 | 7 | 7 |
| `OUT_OF_SCOPE_STATIC` | 3 | 3 | 3 |
| total | 89 | 89 | 89 |

这组数字描述的是不同时间点的状态口径，不表示源码发生了 86→29 的回退；最新 reconciliation 只把被证伪的 7 个 upstream blocker 改为 `IMPLEMENTED_STATIC`，并保留可复核的 7 个未完成行为缺口。`statusLedger` 与 `tools/catalog-inventory-p3/cli.mjs` 的机械检查共同防止后续只改集合、不写迁移依据。

## Static proof run

- `node tools/catalog-inventory-p3/ia-reconciliation.mjs`：PASS，89 个 IA-ID，当前计数 `36/40/3/7/3`。
- `node tools/catalog-inventory-p3/cli.mjs --self-test`：待本文件生成后执行；必须包含 locator exact-set、source、metadata、typed query/schema、contract `NOT_APPLICABLE` 与 IA status-ledger red mutations。
- `node tools/catalog-inventory-p3/cli.mjs`：待本文件生成后执行，静态主门应以 3 pages / 18 scenarios / 43 cases / 43 locators 与 89 IA exact-set 收口。

所有上述证据均属于静态/编译层；`businessStatus`、`cleanupStatus`、managed L2 与 89 个控件的 `runtimeStatus` 仍是未执行/未核验，不得升级为接口或浏览器业务 PASS。

## P4 preparation note (not authorized in this disposition)

P4 仍需另行授权。进入 P4 前应补两项验收规格：

1. 为 38 条否定 API 用例逐条绑定已有 `conditionToProblem` 条目，避免只断言“某个闭集 problem”而无法断言预期错误码；不在本 P3 包内修改或执行。
2. 为 seed loader 记录五个 seed dataset 的依赖顺序、可重跑/idempotency、与既有 `r5-full` profile 的关系；执行必须继续使用真实 HTTP 与资产 multipart，不能退回直写数据库；不在本 P3 包内执行。

## Handoff boundary

本收据不授权也不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、cleanup 或 Git。下一步仅请求 Claude 对当前字节重新独立核验上述三条 finding 的处置与门的红变异；若 Claude GO，再由 Dexter 决定是否进入 P4。
