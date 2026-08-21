# 商品库存与 BOM 正式需求合理性 Claude 评审请求

`REVIEW_KIND=REQUIREMENTS_REASONABLENESS`

`REVIEW_TARGET=ACCEPTED_REQUIREMENTS`

## 背景

Dexter 已将 `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md`
确认成正式需求，文档状态为 `ACCEPTED_BY_DEXTER`，需求分析层开放产品决策为 0。

本轮需要 Claude 独立判断的不是“文档是否自洽”，而是这份需求是否真正解决用户在商品详情中无法理解
“什么 shape 可以采用什么库存/BOM 形式”的问题，推荐方案是否比更小或更直接的替代方案合理，以及复杂度是否符合当前轻库存阶段。

本轮不是 Journey、IA、implementation-facing design 或 implementation review；也没有代码交付、动态验收或运行环境结果需要评审。

## 评审目标

请 Claude 先基于 V6 正式领域模型、v4 owning implementation 与当前 v2s owning source 独立推导自己认为合理的目标模型，再阅读 Codex 的正式需求并做对抗比较，重点判断：

1. 问题定义是否正确，还是把 UI 表象误判成领域模型问题。
2. “商品结构派生 owner 节点 + 每节点唯一扣减方式 + BOM 行只选择组件库存对象”是否是当前阶段最简单且语义完整的方案。
3. 库存/BOM contract 的分母是否足以让前端和后端消费同一真相，同时避免前端成为业务安全边界。
4. shape × owner 粒度 × 扣减方式矩阵是否符合 V6、已接受产品裁定和真实餐饮任务。
5. 需求是否遗漏会阻断 Journey/IA 的产品语义，或引入当前阶段不需要的生产、供应链、递归 BOM 等复杂度。

## 需阅读文件

请从 `catering-v2s` 仓库根按以下顺序阅读。

### A. 入口与业务边界

- `AGENTS.md`：执行入口、产品/owner/授权边界。
- `PLATFORM-BLUEPRINT.md`：平台总边界。
- `project-memory/decisions/confirmed-business-language-corpus.md`：G-11 商品与 G-12 轻库存业务语言。
- `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md`：方案合理性和 UI 用户任务核验。

### B. 盲审基线：先独立推导，不先读作者结论

- `../requirement-doc/design-v6/01.领域设计/05-商品目录域.md`：CatalogItem、SKU policy、usage capability 和 OptionValue 正式语义。
- `../requirement-doc/design-v6/01.领域设计/07-销售库存与物料扣减域.md`：StockTarget、ProductBom、单位、扣减和轻库存正本。
- `../requirement-doc/design-v6/02.跨域契约/08-商品销售库存可售与渠道发布契约.md`：库存提示与销售可售红线。
- `../catering-server-v4/docs/design/2026-06-08-catalog-item-integrated-inventory-bom-redesign.md`：v4 左树右详情与三态规则原始设计。
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/catalog-item-inventory-bom-state.ts`：v4 商品结构自动成树。
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemInventoryBomDetail.tsx`：v4 每 owner 节点详情。
- `../catering-server-v4/frontend/packages/generated-contracts/src/catalog-item-editor-manifest.ts`：v4 节点、模式和粒度契约。
- `../catering-server-v4/backend/inventory-service/src/main/java/com/next/catering/v4/inventory/application/CatalogInventoryBomOrchestrator.java`：v4 模式互斥、旧事实停用和组件校验。
- `scripts/generate/catalog-inventory-p1.mjs`：当前 v2s 七 shape、节点准入和生成契约源。
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`：当前扁平 InventoryBomEditor 与保存草稿。
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`：当前 CatalogInventoryBomEntry 结构。
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`：当前 catalog→inventory 写入分流。
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：当前 StockTarget 与 ProductBom owner 事实。

完成 B 组后，请先写出你独立推导的用户任务、概念边界、shape/owner/mode 矩阵、至少一个更小替代，以及你推荐的方案与理由。

### C. 再对照正式需求

- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md`：Dexter 已确认的正式需求。
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`：上一版三态规则和本专题需要纠偏的历史输入。
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`：上一版库存/BOM IA。

## 独立核验重点

1. **当前问题证据**：当前 v2s 是否确实把 owner、直接库存对象和 BOM 组件压成同一扁平 entry；“独立库存”是否错误复用了组件选择器。
2. **概念分离**：CatalogItem/SKU/OptionValue owner、StockTarget、ProductBom 和 ProductBomLine 是否被需求正确分开。
3. **粒度硬规则**：普通与称重商品无 SKU、固定 ITEM owner；只有按 SKU 管理商品存在 SKU 并固定 SKU owner，是否合理且无遗漏。
4. **互斥方式**：当前阶段同一销售 owner 只允许“不参与库存 / 直接扣本品 / 按 BOM 扣组件”，是否比允许 StockTarget 与 ProductBom 同时 active 更安全、更简单。
5. **物料规则**：MATERIAL 当前只允许不管理或建立本品库存对象，SEMI_FINISHED 当前禁止 BOM，是否避免把销售 BOM 错当生产配方。
6. **特殊 shape**：COMPOSITE、SERVICE、BENEFIT_SHELL 不准入普通库存/BOM；套餐内容不是 BOM，是否符合 V6。
7. **选项值**：OptionValue 只能拥有 BOM 增减耗用，不能成为 StockTarget；不得误伤点单选项的强制原料和实际用量。
8. **组件候选**：BOM 行只引用同 scope、可用、已有 StockTarget、基础计量单位完整且具备 BOM_COMPONENT 的组件，不得隐式创建。
9. **contract 分母**：shape 的 owner 粒度、节点、方式、字段、候选、生命周期、typed request/readback/summary 是否足够；后端是否能够不信任前端重新派生与拒绝。
10. **生命周期**：仅零余额、无流水、无引用、无历史依赖时允许切换方式；其余拒绝自动切换，是否是合理最小规则。
11. **单位继承**：基础计量单位、SKU 覆盖、盘点换算、precision 向零截断和历史快照是否被完整保留，没有回退 v4 旧语义。
12. **范围控制**：需求是否确实没有引入采购/WMS/成本、生产入库、递归 BOM、任意单位换算或可售/菜单语义。
13. **用户路径**：恢复“结构树 + 当前 owner 详情”是否比顶层新增卡片更自然；任务文案是否准确，是否存在更短路径。
14. **开放决策**：请主动寻找仍未裁定但会阻断 Journey/IA 的业务语义；不能因文档声明“开放决策为 0”而采信。

本轮不要求运行编译、测试、DEV、browser L2 或 UAT；如为验证静态事实需要只读搜索可以执行，但不得把未授权动态运行列为 GO 前置。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并单独写“方案合理性”判断。

- `GO`：需求解决了正确问题，推荐结构优于可行替代，产品语义足以进入 Journey/交互设计。
- `NO-GO`：存在会使用户任务、领域边界、contract 分母或 shape/mode 结果不成立的问题。

findings 使用 `M / S / N`：

- `M`：核心业务模型、用户任务或 owner/contract 边界错误，或仍有未裁定产品语义，阻止进入 Journey。
- `S`：需要修改正式需求的重要缺口，但不推翻核心方向。
- `N`：不影响需求成立的澄清或后续设计提醒。

每项 finding 必须提供精确相对路径与行号、事实/推论/产品判断分类、影响面、反例或适用边界、最小修订建议，以及是否需要 Dexter 产品裁决。请勿把 v4 历史实现、当前 v2s 代码或作者文档本身当作天然权威。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对本轮“商品库存与 BOM 业务模型正式需求”做一次独立 requirements reasonableness review。

背景：当前 operations-admin 的商品“库存与 BOM”页把 owner、直接库存对象和 BOM 组件压成扁平卡片，用户无法判断什么商品 shape 可以使用什么库存/BOM形式。Codex 已基于 V6 正式领域模型、v4 owning implementation 和当前 v2s owning source 形成需求分析；Dexter 已逐项确认全部推荐，正式需求状态为 ACCEPTED_BY_DEXTER，开放产品决策为 0。本轮请审查该需求本身是否合理，不是评审 Journey、IA、implementation design 或代码完成度。

目标：请先独立推导正确的用户任务、概念边界、shape/owner/mode 矩阵和更小替代，再阅读作者正式需求；重点判断“商品结构派生 owner 节点 + 每节点唯一扣减方式 + BOM 行只选择组件库存对象”、contract 单一真相及前后端共同复核，是否是当前轻库存阶段正确、最简单且可维护的方案。

请从 catering-v2s 仓库根阅读：

入口与业务边界：
- AGENTS.md
- PLATFORM-BLUEPRINT.md
- project-memory/decisions/confirmed-business-language-corpus.md
- doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md

盲审基线（请先读这些并形成自己的预期，不要先读作者结论）：
- ../requirement-doc/design-v6/01.领域设计/05-商品目录域.md
- ../requirement-doc/design-v6/01.领域设计/07-销售库存与物料扣减域.md
- ../requirement-doc/design-v6/02.跨域契约/08-商品销售库存可售与渠道发布契约.md
- ../catering-server-v4/docs/design/2026-06-08-catalog-item-integrated-inventory-bom-redesign.md
- ../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/catalog-item-inventory-bom-state.ts
- ../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemInventoryBomDetail.tsx
- ../catering-server-v4/frontend/packages/generated-contracts/src/catalog-item-editor-manifest.ts
- ../catering-server-v4/backend/inventory-service/src/main/java/com/next/catering/v4/inventory/application/CatalogInventoryBomOrchestrator.java
- scripts/generate/catalog-inventory-p1.mjs
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx
- apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java
- apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java

形成独立预期后，再对照：
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md

请重点独立核验：
1. 当前问题是否真是 owner、StockTarget 与 BOM 行混模，而非单纯 UI 文案问题。
2. 普通/称重无 SKU、固定 ITEM owner；仅 SKU shape 固定 SKU owner是否合理。
3. 每个销售 owner 的“不参与库存 / 直接扣本品 / 按 BOM 扣组件”当前互斥是否正确。
4. MATERIAL 当前只建库存对象、SEMI_FINISHED 禁止 BOM，是否避免误造生产语义。
5. COMPOSITE、SERVICE、BENEFIT_SHELL 不准入普通库存/BOM，OptionValue 仅 BOM，是否完整。
6. contract 是否完整声明 owner 粒度、节点、方式、字段、候选、生命周期、typed request/readback/summary；后端是否能基于真实结构重新派生并拒绝非法组合。
7. 方式切换守卫、组件候选、基础计量单位与历史快照规则是否足够且不过度设计。
8. 是否仍有会阻断 Journey/IA 的未裁定产品语义；不要采信“开放决策为 0”的自报。
9. 左树右详情与任务文案是否来自真实用户任务，是否存在更短、更自然的方案。
10. 非目标是否守住轻库存边界，没有引入生产、供应链、递归 BOM、菜单可售或 fallback。

请给出明确 GO 或 NO-GO，并单独写“方案合理性”判断。findings 请按 M / S / N 汇总数量；每项提供精确相对路径与行号、事实/推论/产品判断分类、影响面、反例或适用边界、最小修订建议，以及是否需要 Dexter 产品裁决。

授权边界：本轮 GO 只表示该正式需求在合理性与完整性上可作为后续 Journey/交互设计输入；不授权下一 Roadmap step，不授权 IA、implementation-facing design、实施、契约/代码修改、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。NO-GO 也只形成待 Dexter/Codex 复核的独立输入，不自动改写已确认需求。谢谢。
```

## 授权边界

本轮 `GO` 只表示该正式需求在合理性与完整性上可作为后续 Journey/交互设计输入。

本轮结论不授权下一 Roadmap step，不授权 Journey、IA、implementation-facing design、实施、契约/代码修改、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。

Claude finding 是独立评审输入，不自动改写 Dexter 已确认需求；涉及产品语义的变更仍需 Dexter 裁决。
