# Claude Review Request：商品属性库、点单选项库与两步新建正式需求分析

REVIEW_TARGET=REQUIREMENTS_ANALYSIS
REVIEW_STATUS=REQUESTED

## 背景

Dexter 已对商品属性库、点单选项库、强制多组件扣料、总部→门店复制、级联删除和两步新建作出 12 项直接产品裁定。Codex 已在正式需求分析中归纳这些裁定，并独立重开历史需求、IA、旧详设、当前前端、后端、契约、数据库迁移和品牌复制实现，标出 8 类旧材料冲突、13 项前端冲突及 18 项后端/契约/数据库/复制冲突。

本轮只请求对**正式需求分析**做独立合理性与覆盖性审查；不请求 implementation-facing 详设、实施计划、代码、动态运行或数据操作。

## 评审目标

请独立判断这份正式需求分析是否：

1. 真正解决“商品定义重复维护、同一业务事实口径漂移”的问题，而没有把 SKU 销售属性、标签、`ORDER_OPTION_VALUE` 或库存对象误当成新库；
2. 完整且准确地反映 Dexter 的 12 项裁定，特别是私有 scope、品牌复制深复制/同码语义冲突阻断、有限级联删除、强制多组件与两步创建；
3. 对现状冲突的前端、后端、契约、数据库、复制和库存影响覆盖充分，没有将可复用能力误列为冲突，或遗漏会造成双真相的旧路径；
4. 保持 catalog/inventory owner、`REQUIRED` 事务、双管理后台、生成 client、foundation、库存 target/单位真相以及“本期只做运营配置”的边界；
5. 对未裁定精度保持诚实，没有把旧实现、文档惯性或作者推测伪装成 Dexter 决策。

## 需阅读文件

- `AGENTS.md`：仓库入口、双后台、owner、运行与协作边界；
- `PLATFORM-BLUEPRINT.md`：单 deployable、多 owner schema、HTTP 与事务红线；
- `CLAUDE.md`：Claude 独立评审、方案合理性与授权边界；
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-requirements-discussion-codex.md`：Dexter 的 12 项裁定原始记录；
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md`：本次评审对象；
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`、`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`、`doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md`：被新裁定有界替代的旧需求/IA/详设；
- `contracts/openapi/components/catalog/catalog-item.schemas.json`、`contracts/catalog/catalog-item-editor-manifest.json`：当前公开模型与前端字段来源；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx`、`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`、`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx`、`apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`：当前运营端行为；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`、`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOrderOptionFacts.java`、`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`、`apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：当前 owner、复制和 BOM 边界；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql`、`apps/backend/catering-business-server/src/main/resources/db/migration/V20260814_101000_000__catalog_order_option_relations.sql`、`apps/backend/catering-business-server/src/main/resources/db/migration/V20260816_010000_000__catalog_dictionary_attribute_parent_and_order_option_kind.sql`：当前持久化与引用约束。

## 独立核验重点

1. **先独立推导再读结论**：请先从用户问题和现有源码判断更简单方案是否足够，再审查“定义库 + 商品赋值/覆盖”的方案是否必要、是否过度设计。
2. **属性模型**：核验自由 JSON、SKU 销售属性、现有 dictionary 与新商品属性库确实不同；确认“可改 code + stable ref + 删除级联 assignment/value”没有被误扩展到商品或 SKU。
3. **点单选项与库存**：核验当前 per-item 组/值、`FIXED`、本地 BOM 选择器和 `ORDER_OPTION_VALUE` 均不能满足库控制顺序、禁止本地改定义和强制多组件；确认库存 target/单位仍是 inventory owner 真相。
4. **复制与删除**：核验现有品牌复制会按同 code 自动 reuse，缺少新定义族 closure 和语义指纹；确认正式分析要求的硬阻断、深复制、有限级联范围符合 owner/历史边界。
5. **两步创建与 UI**：核验首步当前确为含 JSON 属性的 Drawer、无分类；确认 Modal → 原子 DRAFT → 既有详情 Drawer 是用户任务上更自然的路径，并且不把 operations-admin 与 platform-admin 合并。
6. **冲突清单完整性**：逐项抽查正式文件 §5–§7 的证据路径与行号。发现漏项时，请给出同根 search surface，而不是只报单文件问题。
7. **未决精度**：审查 §9 的六项 `UNRESOLVED` 是否应保留为 Dexter 决策，或是否有可由已裁定业务语义唯一推出的结论；不要用旧代码填空。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并先写一段“方案合理性”判断：问题是否正确、方案是否比更小替代更合适、复杂度是否符合本期仅运营端配置的范围。

如有 findings，请按 `M`（major）/`S`（significant）/`N`（note）汇总数量，并逐条提供：精确仓库相对路径与行号、已验证事实、影响面、最小修复建议、反例/适用边界，以及是否需要 Dexter 产品裁决。无法亲验的内容标 `UNVERIFIED`，不得用文档自述代替源码核验。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审本次“商品属性库、点单选项库与两步新建”正式需求分析。

背景：Dexter 已直接裁定私有属性/选项库、品牌复制、强制多组件扣料、级联删除和两步新建共 12 项产品语义。当前交付仅是一份正式需求分析：它标出了旧需求、IA、前端、后端、契约、数据库和品牌复制实现的冲突；本轮不进入详设、实施计划、代码或动态运行。
目标：请先独立判断用户真正的问题、可能的更小替代和本方案的阶段成本，再核验正式需求分析是否准确覆盖所有现状冲突，是否保持 catalog/inventory owner、库存 target/单位、双后台、生成 client 与 foundation 边界，并且没有把未裁定事项写成结论。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、CLAUDE.md：项目与评审边界；
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-requirements-discussion-codex.md：Dexter 的 12 项裁定；
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md：本次评审对象；
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md、doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md、doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md：旧规则及被替代范围；
- contracts/openapi/components/catalog/catalog-item.schemas.json、contracts/catalog/catalog-item-editor-manifest.json：当前公开模型；
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx、apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx、apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx、apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx：当前前端事实；
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java、apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOrderOptionFacts.java、apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java、apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java：当前 owner、复制与 BOM 事实。

请重点独立核验：自由 JSON 与 SKU 属性是否确实不能承载新商品属性库；每商品内联点单选项、FIXED、本地 BOM 选择与 ORDER_OPTION_VALUE 是否确实不能满足库控制顺序和强制多组件；品牌复制是否缺少新定义族的深复制、语义冲突阻断和引用重写；级联删除是否被限制在商品配置引用而不误删商品、库存 target、原材料或未来历史；首步 Modal、可空单分类、形态解释、原子 DRAFT 与既有详情 Drawer 的衔接是否符合真实用户任务。请抽查正式文件 §5–§7 的每类冲突至少一项源码证据，并说明任何遗漏的同根搜索面。

烦请给出明确 GO 或 NO-GO。请先给“方案合理性”判断；如有问题，按 M / S / N 汇总并逐条写明精确相对路径和行号、影响面、最小修复建议、反例/适用边界，以及是否需要 Dexter 产品裁决。无法亲验的内容请标 UNVERIFIED。

授权边界：本次 GO/NO-GO 仅评价正式需求分析的业务合理性、冲突覆盖与边界正确性；不授权 implementation-facing 详设、实施计划、代码、契约/数据库变更、DEV、数据操作或其他范围扩大。谢谢。
```
