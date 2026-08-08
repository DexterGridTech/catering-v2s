# P3 post-remediation recheck round 3 handoff (Codex → Claude)

## 背景

Claude 第三次 P3 current-byte 独立静态复核结论为 `GO — M=0 / S=0 / N=1`，报告为 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round3-claude.md`。本轮只处置其中关于 `IA-INV-001` 留痕文字不准确的 N-01，不重置 review cycle 或历史分母。

## 评审目标

请独立确认：`IA-INV-001` 的 PARTIAL reason 与 `retainedPartialReasons` 已从“所有三个字段都端到端为空”修正为“owner 先置空三个字段，协调器回填 `productName` 与 `categoryName`，只有 `materialRole` 没有回填点”；确认当前状态仍为 PARTIAL 而不是误升为 IMPLEMENTED，并确认 P3 证据与哈希没有漂移。

## 需阅读文件

- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round3-claude.md`
- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round3-disposition-codex.md`
- `tools/catalog-inventory-p3/ia-reconciliation.mjs`
- `tools/catalog-inventory-p3/cli.mjs`
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json`
- `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryApplicationService.java`
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx`

## 独立核验重点

1. 重开 `InventoryOwnerService.targetListRow`：确认 owner 只负责基础行并将三个 catalog-derived 字段置空。
2. 重开 `CatalogInventoryApplicationService.enrichInventoryTargets`：确认 `productName` 与 `categoryName` 被协调器回填，且全仓没有 `materialRole` 的 coordinator/read-path 回填。
3. 确认 `IA-INV-001` 在控制表与 `retainedPartialReasons` 中仍是 `PARTIAL_STATIC`，理由逐字相等且只保留真实的 `materialRole` 缺口。
4. 重跑 `node tools/catalog-inventory-p3/ia-reconciliation.mjs`、`node tools/catalog-inventory-p3/cli.mjs --self-test`、`node tools/catalog-inventory-p3/cli.mjs`、`scripts/check/catalog-inventory-p3`；复算当前 `37/42/0/7/3`、89 IA-ID、43 L2 binding/case 与 47 artifacts SHA-256 零漂移。
5. 不把 P4 的 38 条 API negative binding、seed loader、API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、deployment 或 cleanup 纳入本轮结论。

## 期望结论

请给出 `GO` 或 `NO-GO`，并按 `M=<数量> / S=<数量> / N=<数量>` 列出每个 finding 的精确证据、影响和最小修复建议。若发现文字之外的真实缺口，请区分 P3 静态问题与未授权的 P4 runtime 范围。

## 可直接复制给 Claude 的话术

```text
您好 Claude，

背景：你对 P3 current-byte post-remediation 的第三次独立静态复核结论为 GO — M=0 / S=0 / N=1，报告为 doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round3-claude.md。Codex 已按该报告处置，收据见 doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round3-disposition-codex.md。
目标：独立确认 IA-INV-001 的 PARTIAL 留痕已准确反映端到端事实，并确认 P3 静态证据仍零漂移。

请重点核验：
1. InventoryOwnerService.targetListRow 是否先将 productName、categoryName、materialRole 置空；
2. CatalogInventoryApplicationService.enrichInventoryTargets 是否随后回填 productName 与 categoryName；
3. 全仓是否确实没有 materialRole 的 coordinator/read-path 回填，因此当前唯一端到端缺口是 materialRole，IA-INV-001 应继续为 PARTIAL_STATIC；
4. tools/catalog-inventory-p3/ia-reconciliation.mjs、生成的 IA reconciliation 与 implementation evidence 中，control.reason、retainedPartialReasons、迁移依据是否逐字一致；
5. 重跑 node tools/catalog-inventory-p3/ia-reconciliation.mjs、node tools/catalog-inventory-p3/cli.mjs --self-test、node tools/catalog-inventory-p3/cli.mjs、scripts/check/catalog-inventory-p3，并复算 37/42/0/7/3、89 IA-ID、43 L2 binding/case 与 47 个 evidence artifact 的 SHA-256 零漂移。

请给出 GO 或 NO-GO，并按 M=<数量> / S=<数量> / N=<数量> 列出 findings；保留所有历史 review 与 review cycle 上限。不要把 runtimeStatus、API/HTTP、数据库/migration、seed/reset、DEV/UAT、managed L2、deployment 或 cleanup 的未执行状态写成 PASS。

授权边界：仅 P3 current-byte 静态 implementation、IA 对账、生成物与 evidence；不授权/不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、cleanup 或 Git。
```
