# Claude 评审交付：P3 current-byte post-remediation 静态复核

## 背景

Claude 的 P3 current-byte implementation review 已给出 `GO — M=0 / S=2 / N=3`，原始报告保留在 `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-implementation-review-claude.md`。本次交付只处置其中的 S-01、S-02、N-01、N-02、N-03；不改写历史 verdict，也不创建第三轮独立子审查。该 review cycle 的独立 adversarial review 已达到两轮上限，本文件请求的是 Claude 对整改后当前字节的 post-remediation recheck。

整改目标是让 IA 对账、生成物身份、既有 baseline 归因、关键 L2 断言与 upstream 授权留痕都能被重新核验。P3 仍是静态 implementation package；API/HTTP、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment 与 cleanup 仍未执行或不在本轮授权内。

## 评审目标

请独立重开当前源码、契约、生成物、前端 L2 声明与 evidence，确认：

1. `IA-CONTRACT-001..011` 已明确为无渲染控件的契约断言，使用 `NOT_APPLICABLE`，且 checker 会拒绝重新写回散文 locator；UI 控件 locator 仍能在声明的 `sourceFile` 内解析。
2. catalog P1 definition/projection 不再被 IAM capability inventory 当作第二个 owner 面，`edge-codegen` 的 operation identity 不再重复，生成物与受控 receipt 一致。
3. 七条既有 `frontend-architecture` baseline 欠账已登记并与本域新增 surface 分开；本域新增表不再污染 baseline 结论。
4. 复制向导、库存四动作与临时商品转正的关键 L2 场景包含状态推进、提交后 readback、失败后输入保留等业务断言，而不只是 locator 可见性；本轮只检查静态声明，不把未执行 L2 当作 PASS。
5. `CatalogItemPageQuery` 扩展的已批准 P1 upstream provenance 已写入 P3 evidence，未被冒充为本轮新增契约授权。
6. 本次整改没有引入新的 owner 越界、第二真相源、静默错误或 runtime/business/cleanup 误报。

## 需阅读文件

- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-implementation-review-claude.md`：原始 findings 与边界；
- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-review-disposition-codex.md`：逐条 disposition 与静态 proof；
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json`：当前字节哈希、状态与授权 provenance；
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`：89 个 IA-ID 的 locator、位置、线框与状态；
- `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json`：P3 分母、change surface 与授权边界；
- `tools/catalog-inventory-p3/ia-reconciliation.mjs`、`tools/catalog-inventory-p3/cli.mjs`：契约 locator 语义与红变异；
- `tools/capability-invariants/cli.mjs`、`scripts/check/edge-codegen`、`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java`：projection 排除、身份唯一性与生成物；
- `HANDOFF.md`：七条既有 frontend-architecture baseline 记录；
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`：关键 L2 状态级断言声明；
- `contracts/openapi/catalog-inventory.openapi.yaml`、`apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`、`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`：已批准 P1 查询扩展的消费链路。

## 独立核验重点

请先以当前字节为准，不接受只看 evidence 文本的结论。建议复跑：

```bash
node tools/catalog-inventory-p3/cli.mjs --self-test
node tools/catalog-inventory-p3/cli.mjs
node tools/capability-invariants/cli.mjs --self-test
node tools/capability-invariants/cli.mjs check
scripts/check/edge-codegen --self-test
scripts/check/edge-codegen
scripts/check/standards-coverage --phase R5
scripts/check/frontend-architecture
scripts/check/claude-review-handoff --self-test
```

请对以下红变异/反例做针对性核验：

- 把一个 `IA-CONTRACT-*` locator 改回 prose 时，P3 checker 必须失败；
- 删除 projection 的机器可读标记时，capability self-test 必须失败，而保留标记时不得重复计入 IAM inventory；
- 回看 `CatalogItemPageQuery` 的新增字段是否在契约、generated query 类型、owner 校验与前端调用之间保持同一字段集合；
- 检查 L2 声明是否真的包含复制步骤推进、库存动作结果域/readback、临时商品转正失败后的输入保留；
- 检查七条旧页面 baseline 是否只作 HANDOFF 登记，没有把本域的新表或新增 surface 混入既有债务；
- 重新计算 evidence artifacts 的 SHA-256，确认 `manifest`、IA reconciliation、checker、生成物、L2 spec、HANDOFF 与当前文件一致。

## 期望结论

请给出明确结论：`GO` 或 `NO-GO`，并按 `M=<数量> / S=<数量> / N=<数量>` 统计。每个 finding 请给出精确文件/行号、依据类型（仓内事实/外部一手材料/推论/产品判断）、影响范围、最小修复建议，并标记是否需要 Dexter 裁决。请保留原始 review 与本次 disposition，不因换文件名或哈希重置 review cycle；若静态整改已闭合，请明确说明仍未执行的 runtime/API/L2/business/cleanup 范围。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对 catering-v2s 的 P3 current-byte post-remediation 做独立静态 implementation recheck。

背景：你此前的 current-byte 结论为 GO — M=0 / S=2 / N=3，原始报告是 doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-implementation-review-claude.md。Codex 已逐条处置 S-01、S-02、N-01、N-02、N-03，处置记录在 doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-review-disposition-codex.md。本 review cycle 的独立 adversarial review 已达到两轮上限，本次是整改后 current-byte recheck，不创建第三轮独立子审查，不改写历史 verdict。

目标：独立重开当前字节，确认契约级 IA locator 的 NOT_APPLICABLE 语义与红变异、catalog P1 definition/projection 与 IAM capability inventory 的边界、edge-codegen 唯一身份、既有 frontend-architecture baseline 归因、关键 L2 状态级断言，以及 CatalogItemPageQuery 已批准 P1 upstream repair 的授权留痕均真实成立；同时主动寻找新的 owner 越界、第二真相源、静默错误或 evidence 误报。

请从仓根阅读：
- doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-implementation-review-claude.md
- doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-review-disposition-codex.md
- doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json
- doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json
- doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json
- tools/catalog-inventory-p3/ia-reconciliation.mjs
- tools/catalog-inventory-p3/cli.mjs
- tools/capability-invariants/cli.mjs
- apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java
- HANDOFF.md
- apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts
- contracts/openapi/catalog-inventory.openapi.yaml
- apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java

请复跑：node tools/catalog-inventory-p3/cli.mjs --self-test；node tools/catalog-inventory-p3/cli.mjs；node tools/capability-invariants/cli.mjs --self-test；node tools/capability-invariants/cli.mjs check；scripts/check/edge-codegen --self-test；scripts/check/edge-codegen；scripts/check/standards-coverage --phase R5；scripts/check/frontend-architecture。请针对性证明：prose contract locator 红变异会失败；删除 projection 标记红变异会失败；query 扩展字段在契约/generated/owner/frontend 四层一致；复制、库存动作、临时商品转正具备状态级静态断言；七条旧 baseline 只登记不冒充本域缺陷；evidence artifacts 当前 SHA-256 零漂移。

请给出 GO 或 NO-GO，并按 M=<数量> / S=<数量> / N=<数量> 列出每个 finding 的精确文件/行号、依据类型、影响范围、最小修复建议及是否需要 Dexter 裁决。保留历史 review 与第二轮上限，不因本次 recheck 文件名或哈希重置 review cycle。

授权边界：本次只覆盖 P3 current-byte 静态 implementation、IA 控件对账、生成物与 evidence recheck；不授权或不背书 P1/P2 HTTP/API 执行、Testcontainers、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、媒体 cleanup 或 Git 操作。谢谢。
```
