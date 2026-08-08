# Claude 评审交付：P3 当前字节静态实施复核

## 背景

本轮交付单元为 `CATALOG-INVENTORY-P3-FRONTEND-L2-20260806`。P3 的第一轮与第二轮独立对抗复核均已保留在仓内；第二轮是该 review cycle 的硬上限，不能召集第三个独立子 agent。作者已逐条重开并修复 R2-M01（品牌复制库存 BOM 闭包）、R2-M02（分类作废并重建父级）和 R2-M03（TemporaryPromotion 上游契约/owner/UI 语义）。本轮另在作者双读中发现并补齐了 IA 要求但历史复核未覆盖的临时商品来源事实：typed `externalIdentity`、来源订单/记录/商品、原始快照摘要及 owner 白名单投影。

当前交付只声称 P3 静态 implementation 与 IA 控件级对账：89 个 IA-ID 中 86 个 `IMPLEMENTED_STATIC`、3 个 `OUT_OF_SCOPE_STATIC`，43 个 L2 case 均有静态 locator/位置/线框/业务断言元数据。P1 API、P2 API、P3 L2、seed/reset、DEV/UAT、数据库运行、runtime 与 cleanup 仍未执行或未获本轮授权。

## 评审目标

请独立从批准的业务需求、IA、三阶段详设和当前生产字节核验：

1. 临时商品来源事实是否确实由 catalog owner typed read model 提供，前端是否只读展示且没有猜测、任意 map 穿透或改变转正语义；
2. R2-M01/R2-M02/R2-M03 的修复是否真实落在 owner、契约/generated wire、frontend 和 focused proof，而不是只改证据文字；
3. 商品复制五步向导、复制闭包与引用重写、商品页签/形态准入、库存四动作、生产标签 quickManage、临时商品转正是否逐个符合 IA 与业务边界；
4. 89 个 IA-ID、43 个 L2 bindings、42 个 operation/25 个 read model 的 exact-set、sourceFile/locator/位置/线框绑定与生成物哈希是否与当前字节一致；
5. 是否存在新的静态遗漏、owner 越界、第二真相源、错误结果被静默展示或把未执行 runtime 误报成 PASS。

## 需阅读文件

从 `catering-v2s` 仓根打开：

- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`：业务需求与冻结差异；
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`：IA、线框、IA-ID 与临时商品/复制/库存交互；
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md`：P3 implementation-facing 详设、分母与 exit；
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`：89 个控件的源码、locator、位置、线框和状态；
- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json`：当前字节哈希、静态门与 runtime disclosure；
- `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json`：P3 source denominator 与 authorization boundary；
- `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-static-remediation-independent-review-round2-agent.md`：第二轮独立复核历史及硬停止声明；
- `contracts/policy/catalog-inventory-design-byte-coverage.json`、`contracts/openapi/catalog-inventory.openapi.yaml`、`contracts/catalog/catalog-inventory-read-models.json`：读模型字段与 typed contract；
- `contracts/policy/catalog-inventory-fixture-catalog.json`、`contracts/policy/catalog-inventory-l2-scenarios.json`、`contracts/policy/catalog-inventory-l2-locator-bindings.json`：共享 fixture、场景和控件绑定；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`、`apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：owner 事实/命令与复制闭包；
- `apps/frontend/operations-admin/src/features/catalog-management/`、`apps/frontend/operations-admin/src/features/inventory-management/`：三页面、Drawer、复制、转正、库存动作和生产标签消费；
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`：L2 场景声明（仅静态核对，本轮不声称 managed L2 执行）。

## 独立核验重点

可复跑的静态门与 focused proof：

```bash
node tools/catalog-inventory-p1/cli.mjs --self-test
node tools/catalog-inventory-p1/cli.mjs
node tools/catalog-inventory-p3/cli.mjs --self-test
node tools/catalog-inventory-p3/cli.mjs
scripts/check/standards-coverage --phase R5
scripts/check/implementation-design-granularity --self-test
gradle :apps:backend:catering-business-server:modules:catalog:test --tests com.catering.v2s.catalog.application.CatalogTemporaryPromotionContractTest --tests com.catering.v2s.catalog.application.CatalogPageQueryContractTest --no-daemon
```

前端静态证明已完成 `typecheck`、`lint:architecture`、商品管理 focused Vitest（12 tests）和 direct `vite build`。完整 package build 仍会被仓内未改动的 `src/styles.css` 13 条 stylelint baseline 规则阻断；这与本轮 P3 业务源码结果分账。应用级 backend Testcontainers 与 managed L2 必须经受管入口，本轮没有 runtime 授权，不要把 `COMPILED/NOT_EXECUTED_REMOTE_GUARD` 误读成测试 PASS。

## 期望结论

请给出明确结论：`GO` 或 `NO-GO`，并按 `M=<数量> / S=<数量> / N=<数量>` 统计。每个 finding 请给出精确文件/行号、依据类型（仓内事实/外部一手材料/推论/产品判断）、影响范围、最小修复建议，并标记是否需要 Dexter 产品裁决。请保留既有独立复核历史，不因本次文件名或哈希变化重置第二轮上限。

授权边界：本次复核只覆盖 P3 operations-admin 静态实现、P3 直接授权的 P1 TemporaryPromotion owner/契约修复、生成物、IA 控件对账与静态 evidence；不授权或不背书 P1/P2 HTTP/API 执行、Testcontainers runtime、数据库/migration 执行、seed/reset、DEV/UAT、managed L2、runtime deployment、媒体 cleanup 或 Git 操作。谢谢。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对 catering-v2s 的 P3 当前字节做独立 implementation review。

背景：P3 第一、二轮独立对抗复核历史均保留，第二轮是该 review cycle 的硬上限。Codex 已修复 R2-M01 品牌复制库存 BOM 闭包、R2-M02 分类作废并重建父级、R2-M03 TemporaryPromotion 上游契约/owner/UI 语义；作者双读还补齐了 IA 要求但历史复核未覆盖的临时商品 typed externalIdentity（来源订单、来源记录、来源商品、原始快照）及 owner 白名单读回。当前只声称 P3 静态 implementation 与 IA 控件对账，不声称 API/L2/runtime/seed/reset PASS。
目标：独立确认当前源码、契约/generated wire、owner 边界、前端 Journey、89 个 IA 控件对账和静态 evidence 是否真实闭环，并主动寻找会使实现偏离业务需求的遗漏或静默错误。

请从 catering-v2s 仓根阅读：
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md：业务需求与冻结差异；
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md：IA、线框与 89 个 IA-ID；
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md：P3 详设与 exit；
- doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json：89 个控件的 sourceFile/locator/位置/线框/断言；
- doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json：当前字节哈希、静态门与 runtime disclosure；
- doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json：分母和授权边界；
- doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-static-remediation-independent-review-round2-agent.md：第二轮独立复核历史；
- contracts/policy/catalog-inventory-design-byte-coverage.json、contracts/openapi/catalog-inventory.openapi.yaml、contracts/catalog/catalog-inventory-read-models.json：typed read model；
- contracts/policy/catalog-inventory-fixture-catalog.json、contracts/policy/catalog-inventory-l2-scenarios.json、contracts/policy/catalog-inventory-l2-locator-bindings.json：共享 fixture、43 个 L2 case 和 binding；
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java、apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java：owner 实现；
- apps/frontend/operations-admin/src/features/catalog-management/、apps/frontend/operations-admin/src/features/inventory-management/：前端三页面与 Journey；
- apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts：L2 场景声明。

重点独立核验：
1. 临时商品来源事实是否由 catalog owner typed read model 白名单提供，Drawer 是否只读展示且不穿透 raw payload；
2. R2-M01/M02/M03 是否是真行为修复；
3. 五步复制向导、闭包/引用重写、商品形态与页签、库存四动作、生产标签 quickManage、临时商品转正是否符合需求与 IA；
4. 89 IA-ID、43 L2 bindings、42 operations/25 read models 的 exact-set、locator/位置/线框和当前哈希是否一致；
5. 是否有新的静态遗漏、owner 越界、错误结果静默展示，或把未执行 runtime 误报为 PASS。

可复跑：node tools/catalog-inventory-p1/cli.mjs --self-test；node tools/catalog-inventory-p1/cli.mjs；node tools/catalog-inventory-p3/cli.mjs --self-test；node tools/catalog-inventory-p3/cli.mjs；scripts/check/standards-coverage --phase R5；scripts/check/implementation-design-granularity --self-test。不要把远程 Testcontainers 守卫下的 NOT_EXECUTED 或未授权 L2 当成 PASS/FAIL 业务结论。

请给出 GO 或 NO-GO，并按 M=<数量> / S=<数量> / N=<数量> 列出每个 finding 的精确文件/行号、依据类型、影响范围、最小修复建议及是否需要 Dexter 裁决；保留既有第二轮独立复核历史，不因换文件名或哈希重置 review 上限。

授权边界：仅 P3 当前字节静态 implementation、直接授权的 TemporaryPromotion 上游修复、生成物、IA 控件对账与静态 evidence；不授权/不背书 P1/P2 HTTP/API runtime、Testcontainers、数据库/migration、seed/reset、DEV/UAT、managed L2、runtime deployment、媒体 cleanup 或 Git。
``` 
