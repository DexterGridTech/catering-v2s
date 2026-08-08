# P3 post-remediation recheck round 2 handoff (Codex → Claude)

## 背景

Claude 第二次 P3 post-remediation 复核结论为 `NO-GO — M=0 / S=1 / N=1`，报告为 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round2-claude.md`。本轮只处置残留 blocker 的逐条复判与 blocked-reason 留痕机制，不重置历史 review cycle 或上限。

## 评审目标

请独立核验：

1. `IA-INV-002` 是否已迁为 `IMPLEMENTED_STATIC`，其“需处理是派生视图、不进入 stockState”的 owner SQL 与前端 counts 消费是否对应 IA；
2. `IA-CAT-LIFECYCLE-002` 是否已迁为 `PARTIAL_STATIC`，理由是否准确指向尚未完成的前端错误摘要/页签定位/确认/readback，而非虚假的上游契约缺口；
3. `IA-INV-001` 是否已迁为 `PARTIAL_STATIC`，理由是否反映 `targetListRow` 对 productName/categoryName/materialRole 的实际置空事实；
4. `retainedBlockedReasons` 是否与 `retainedNotImplementedReasons` 对称，门是否拒绝重复 blocked reason、缺失 reason 或 reason 与 control 不一致。

## 需阅读文件

- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round2-claude.md`
- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round2-disposition-codex.md`
- `tools/catalog-inventory-p3/ia-reconciliation.mjs`
- `tools/catalog-inventory-p3/cli.mjs`
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json`
- `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json`
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`

## 独立核验重点

- 以源码为准，不接受三条 status 迁移的文字声明：重开 owner SQL、generated read shape 与前端消费链路；特别注意 `targetListRow` 是否真的返回名称、分类和物料角色。
- 复算当前 IA 分母应为 `37 IMPLEMENTED_STATIC / 42 PARTIAL_STATIC / 0 BLOCKED_UPSTREAM_CONTRACT / 7 NOT_IMPLEMENTED / 3 OUT_OF_SCOPE_STATIC`。
- 运行：

```bash
node tools/catalog-inventory-p3/ia-reconciliation.mjs
node tools/catalog-inventory-p3/cli.mjs --self-test
node tools/catalog-inventory-p3/cli.mjs
scripts/check/catalog-inventory-p3
```

- 独立做 blocked-reason 红变异：构造两个 `BLOCKED_UPSTREAM_CONTRACT` 使用相同 reason，门必须失败；再验证 reason 缺失、与 control.reason 不一致也会失败。
- 复算 89 IA-ID、43 L2 binding/case 与 43 artifacts SHA-256；确认 runtimeStatus 仍为 `UNVERIFIED_REQUIRES_EVIDENCE`。
- 不把 P4 的 38 条 API negative binding、seed loader、API/L2 runtime、DEV/UAT、cleanup 纳入本轮结论。

## 期望结论

请给出 `GO` 或 `NO-GO`，并按 `M=<数量> / S=<数量> / N=<数量>` 列出每个 finding 的精确证据、影响和最小修复建议。若仍发现问题，请区分真实 P3 静态问题与未授权的 P4 runtime 范围。

## 可直接复制给 Claude 的话术

```text
您好 Claude，

背景：你对 P3 current-byte post-remediation 的第二次独立复核结论为 NO-GO — M=0 / S=1 / N=1，报告为 doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round2-claude.md。Codex 已按该报告处置，记录见 doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-post-remediation-recheck-round2-disposition-codex.md。
目标：独立确认 3 个残留 blocker 已逐条复判，状态迁移准确，retainedBlockedReasons 与红变异门能够防止共享模板理由再次出现。

请重点核验：
1. IA-INV-002 是否为 IMPLEMENTED_STATIC，且 stockState 五态与 attention_count 派生视图符合 IA；
2. IA-CAT-LIFECYCLE-002 是否为 PARTIAL_STATIC，理由是否准确写明前端错误摘要、页签定位、确认和 readback 缺口；
3. IA-INV-001 是否为 PARTIAL_STATIC，理由是否如实反映 InventoryOwnerService.targetListRow 将 productName/categoryName/materialRole 置空；
4. retainedBlockedReasons 是否逐条覆盖 BLOCKED_UPSTREAM_CONTRACT、理由互不相同且与 control.reason 一致；重复理由、缺失理由或篡改理由是否被 cli.mjs 红门拦截；
5. 当前 IA 计数是否为 37/42/0/7/3，89 IA-ID、43 L2 binding/case、43 artifacts 哈希是否零漂移。

请运行：node tools/catalog-inventory-p3/ia-reconciliation.mjs；node tools/catalog-inventory-p3/cli.mjs --self-test；node tools/catalog-inventory-p3/cli.mjs；scripts/check/catalog-inventory-p3。

请给出 GO 或 NO-GO，并按 M=<数量> / S=<数量> / N=<数量> 列出 findings。保留所有历史 review 与 review cycle 上限，不把 runtimeStatus、API/HTTP、数据库/migration、seed/reset、DEV/UAT、managed L2、deployment 或 cleanup 的未执行状态写成 PASS。

授权边界：仅 P3 current-byte 静态 implementation、IA 对账、生成物与 evidence；不授权/不背书 API/HTTP runtime、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、cleanup 或 Git。
```
