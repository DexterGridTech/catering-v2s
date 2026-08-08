# P3 post-remediation current-byte recheck handoff (Codex → Claude)

## 背景

Claude 的 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-claude.md` 给出 `NO-GO — M=1 / S=1 / N=1`。五项上一轮整改已被确认闭合；本轮仅修复该报告指出的 IA 对账状态、状态迁移证据与未完成控件缺口描述。历史 review 原样保留，不重置 review cycle。

## 评审目标

请独立核验当前字节是否真实处置：

1. M-01：7 个已具备契约/owner 能力的 IA-ID 是否已移出假 `BLOCKED_UPSTREAM_CONTRACT`，剩余 3 个 blocker 是否有真实理由；当前计数是否为 `36 IMPLEMENTED_STATIC / 40 PARTIAL_STATIC / 3 BLOCKED_UPSTREAM_CONTRACT / 7 NOT_IMPLEMENTED / 3 OUT_OF_SCOPE_STATIC`。
2. S-01：状态是否仍有清晰的人工语义来源，同时以 `statusLedger` 留下历史 86/0/0/0/3、最新整改前 29/40/10/7/3、7 条逐 ID migration diff、当前计数；checker 是否拒绝 ledger 缺失、计数不一致或 from/to/basis 被篡改。
3. N-01：7 个 `NOT_IMPLEMENTED` 是否逐条写出具体行为/proof 缺口，而非用“locator 不存在”或空泛的骨架理由替代；locator 存在本身不得被当作实现完成。

## 需阅读文件

- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-claude.md`
- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-disposition-codex.md`
- `tools/catalog-inventory-p3/ia-reconciliation.mjs`
- `tools/catalog-inventory-p3/cli.mjs`
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json`
- `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json`
- 复核 M-01 所需的 `CatalogWorkbenchPage.tsx`、`CatalogOwnerService.java`、`InventoryActionModal.tsx` 及对应 typed OpenAPI/generated query/request

## 独立核验重点

- 不接受只看集合字面量：抽查 7 条 blocker migration 的来源事实，确认服务端 smart view/category scope、库存四动作 request/字段/readback 确实存在；同时确认 3 个保留 blocker 仍由缺少的 P1 生命周期/库存事实支撑。
- 不接受只看 locator：核对 7 条 `NOT_IMPLEMENTED` 的每条 concrete gap 是否与 IA 要求对应，避免“控件存在”被误判为“行为完整”。
- 运行 `node tools/catalog-inventory-p3/ia-reconciliation.mjs`、`node tools/catalog-inventory-p3/cli.mjs --self-test` 与 `node tools/catalog-inventory-p3/cli.mjs`；独立做至少一次 status-ledger 红变异（删除/篡改一条 migration 或计数）并确认门失败。
- 复算 89 IA-ID exact-set、43 locator/case exact-set；确认 runtimeStatus 仍为 `UNVERIFIED_REQUIRES_EVIDENCE`，没有把静态证据写成 L2/API business PASS。
- 对 P4 preparation note 只做边界检查，不将 38 条 API negative binding 或 seed loader 当成本轮 P3 已完成范围。

## 期望结论

请按 `GO` 或 `NO-GO` 给出 `M=<数量> / S=<数量> / N=<数量>`，逐条列 evidence、影响与最小修复建议，并保留本轮 review 的静态边界。若仍有 finding，请区分真实当前字节问题与仅属 P4 runtime/seed/L2 未授权事项。

## 可直接复制给 Claude 的话术

```text
您好 Claude，

背景：上一轮 P3 post-remediation current-byte 复核结论为 NO-GO — M=1 / S=1 / N=1；本次只复核已登记的 M-01、S-01、N-01 修复。
目标：确认 IA 状态迁移、statusLedger 机械门与 7 条 NOT_IMPLEMENTED 的逐条行为缺口均真实、可复算且没有静态证据冒充 runtime PASS。

请对 catering-v2s 当前 P3 字节做 post-remediation 独立静态复核。你的上一轮报告是 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-claude.md`，结论 `NO-GO — M=1 / S=1 / N=1`。我已按该报告修复，并将逐条处置写在 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-disposition-codex.md`。

请重点核验：

1. M-01：`IA-CAT-LIST-003`、`IA-CAT-LIST-012` 与五个 `IA-INV-ACTION-*` 已移出 `BLOCKED_UPSTREAM_CONTRACT`；保留的 `IA-CAT-LIFECYCLE-002`、`IA-INV-001`、`IA-INV-002` 是否仍有真实上游缺口。当前 IA 计数应为 `36/40/3/7/3`，总数 89。
2. S-01：`tools/catalog-inventory-p3/ia-reconciliation.mjs` 的 `statusLedger` 是否完整披露历史 `86/0/0/0/3`、整改前 `29/40/10/7/3`、7 条逐 ID from/to/basis 与当前计数；`tools/catalog-inventory-p3/cli.mjs` 是否能对 ledger 缺失、计数错位、迁移 to/basis 篡改触发红门。
3. N-01：7 个 `NOT_IMPLEMENTED` 是否分别写出真实行为/proof 缺口，不把 locator 存在当作实现完成。

请重跑：

- `node tools/catalog-inventory-p3/ia-reconciliation.mjs`
- `node tools/catalog-inventory-p3/cli.mjs --self-test`
- `node tools/catalog-inventory-p3/cli.mjs`
- `scripts/check/catalog-inventory-p3`

请保留历史报告与 review cycle 记录，不把 P4 的 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、deployment、cleanup 或 89 控件 runtimeStatus 纳入本轮 PASS。请给出 `GO` 或 `NO-GO` 以及 `M/S/N`，每个 finding 附当前字节证据与最小修复建议。

授权边界：仅 P3 current-byte 静态 implementation、IA 对账、生成物与 evidence；不授权/不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、cleanup 或 Git。
```
