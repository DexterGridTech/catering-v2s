# P4 final acceptance remediation — Claude static recheck request

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=CATALOG-INVENTORY-P4-FINAL-ACCEPTANCE-REMEDIATION-20260808
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT

## 交付背景

Claude 的 `doc/review/platform/2026-08-08-v2s-catalog-inventory-p4-final-acceptance-review-claude.md` 给出 `GO — M=0 / S=1 / N=2`。本次只处置 S-01、N-01、N-02，不重跑 API、L2、DEV、reset、seed、数据库/migration、UAT 或部署；既有 runtime evidence 保持历史字节边界，不用本次静态修改冒充重新执行。

## 处置清单

1. S-01：`contracts/policy/catalog-inventory-fixture-catalog.json` 的 `seedExecutionPlan.cleanup` 已改为双角色契约：`seed.strategy=PASS_PRESERVED_DEV_STATE`，seed 只完成业务回读并保留 DEV 事实；`reset.strategy=MANAGED_RESET_RUN_SCOPED_REVERT`、媒体清理和清理回读由 `r5-reset` 负责；`businessAndCleanupSeparate=true` 保留。`scripts/generate/catalog-inventory-p1.mjs`、`contracts/policy/catalog-inventory-fixture-catalog.schema.json` 与 `tools/catalog-inventory-p1/cli.mjs` 同步消费该形状。
2. N-01：`scripts/dev/catalog-inventory-seed-executor.mjs` 的 `bomStageKey` 改为 `owner + sku + option` 三段编码，使用 `encodeURIComponent`，不再用 `optionValueCode || skuCode || ITEM`。self-test 的红变异改为 SKU 编码与 option value 编码相同的反例，证明旧扁平算法会被拒绝；真实复合键保持三组可区分。
3. N-02：`seedExecutionPlan.fullCatalogParity.requiredIn` 已固定为 `P4`，生成器输出同步固定；P4 交付的 73/34 全量对齐不再被误标为 P2。

## 当前静态证据

- `node --check scripts/dev/catalog-inventory-seed-executor.mjs` — PASS
- `node scripts/dev/catalog-inventory-seed-executor.mjs --self-test` — PASS；含 `BOM_OPTION_STAGE_COLLISION`
- `node scripts/dev/catalog-inventory-seed-plan.mjs --self-test` — PASS；73/72/1、34
- `node scripts/generate/catalog-inventory-p1.mjs` — PASS
- `node tools/catalog-inventory-p1/cli.mjs` 与 `--self-test` — PASS
- `node tools/catalog-inventory-p4/cli.mjs` 与 `--self-test` — PASS
- `node scripts/check/catalog-inventory-test-independence.mjs` — PASS
- `node scripts/check/standards-coverage --phase R5` — PASS（150 rules）
- `scripts/check/logging-boundaries` — PASS
- 当前契约 JSON/schema/evidence JSON 均可解析，cleanup 结构与 `requiredIn=P4` 可复算。

## 请 Claude 独立核验

- 不接受作者自报：重新打开上述 owning source，核对 cleanup 的两角色语义没有残留旧的 seed 销毁要求；确认生成器、schema、checker 与 fixture exact-set 一致。
- 用 same-name SKU/option-value 反例检查 `bomStageKey` 的真实行为与 self-test 是否能拒绝扁平回归；确认没有把 stage identity 再次压成单字段。
- 检查 `requiredIn=P4` 从生成器到 fixture、schema、checker 的闭环；历史 review/evidence 只能作为历史运行记录，不应被当作本次运行。
- 确认本轮没有 runtime rerun 或 DEV 状态破坏，既有 `businessStatus`/`cleanupStatus`/`noUatOrProductionClaim` 证据边界保持诚实。

请按 `GO 或 NO-GO + M=<数量> / S=<数量> / N=<数量>` 返回，并逐条给出 finding 的章节、依据类型、影响和最小修复建议。

授权边界：本轮只授权上述 P4 静态 remediation recheck；不授权、不执行 API/L2/DEV/reset/seed、数据库/migration、UAT、runtime deployment 或 cleanup。历史 runtime evidence 不因本轮静态修改而重新获得字节背书。
