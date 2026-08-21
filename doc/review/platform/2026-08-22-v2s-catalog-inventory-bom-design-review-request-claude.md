REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN

REVIEW_TARGET=CATALOG_INVENTORY_BOM_DESIGN

# 商品库存与 BOM 业务模型 · Claude DESIGN review 请求

## 背景

Dexter 已确认“商品库存与 BOM 业务模型正式需求”，并接受普通/称重单节点直接详情、按 SKU 商品左树右详情且主壳只读、点单选项值只配置物料耗用而不拥有库存对象的线框。本轮已形成 Journey、交互稿、IA、implementation-facing design 与 serial plan。

内部 fresh 独立 DESIGN review 使用同一 cycle 两轮硬停止：Round 1 `NO-GO，M/S/N=1/1/0`，指出 A-05 历史定义事实源与 CP-07 RECALL 缺口；作者按 owning source 处置后，Round 2 最终 `GO，M/S/N=0/0/0`。本轮请 Claude 做外部 design review，不把内部 GO 当结论。

## 评审目标

请独立判断这套设计能否让 contract、catalog/inventory owner 与 operations-admin 对同一个 shape×owner×mode 模型负责；重点证伪单一 `inventoryRules` detail aggregate、inventory 原子 replace、A-05 四维生命周期、完整验收矩阵与丰富 seed 是否可实施、不过度设计且未回退单位模型。

## 需阅读文件

请从 `catering-v2s` 仓库根按顺序阅读：

- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md`：Dexter 已确认的正式需求及 A-01..A-05。
- `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md`：批准用户任务与失败后事实。
- `doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md`：已接受线框、交互与技术 gap。
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md`：两 screen IA、集合形态、15个 typed problem。
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md`：17行横切表、contract/owner/migration/acceptance/seed详设。
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md`：CP-00..08 串行实施与授权闸门。
- `doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-independent-review-round-1.md`：内部 Round 1 原始 NO-GO。
- `doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-review-intake-codex.md`：作者逐 finding 辩证处置。
- `doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-independent-review-round-2.md`：内部 Round 2 最终 GO。

owning source 请至少重开：

- `scripts/generate/catalog-inventory-p1.mjs`
- `contracts/catalog/CatalogInventoryShapeManifest.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`
- `scripts/dev/catalog-inventory-seed-executor.mjs`

## 独立核验重点

1. 七 shape×ITEM/SKU/OPTION_VALUE×NONE/DIRECT/BOM 是否完整且只有 contract 单一真相；usageCapabilities 是否只作为组件候选门。
2. 一个 `inventoryRules` detail aggregate 取代三个 flat rule 住址是否是最小形态；catalog 重派生 owner、inventory 原子 replace 与同一 REQUIRED rollback 是否闭合。
3. A-05 的 `BALANCE/LEDGER/BOM_REFERENCE/HISTORICAL_DEFINITION` 是否有互不重叠的 owner fact；首次切换不自阻断、第二次自动切换拒绝是否与正式裁定一致；两表 `DISABLED` immutable snapshot 是否无需第三 truth。
4. component candidate 的同 scope、可用、BOM_COMPONENT、已有 StockTarget、单位完整五条件及自引用，是否在 cursor query 和 save 双复核。
5. accepted wireframe 的单节点退化、SKU左树右详情、option只BOM能否从 generated detail/readback直接实现；是否误伤标签、属性、SKU销售属性或点单选项。
6. 17行横切机制表第四列是否为真实适用全集；授权、缓存、幂等、日志、problem mapping、migration与原子组是否可执行。
7. 当前 77 条 acceptance 只增3条到80，参数化覆盖15需求、63矩阵、8 switch、6 component red、3 option分支是否真实可证伪；20个非法普通shape+SKU fixture是否全部有迁移路径。
8. seed 10b 是否坚持P1唯一业务生成源、executor唯一HTTP物化，且覆盖七shape、三方式、SKU独立BOM、option正负/实际量、公共物料、盘点有/无、历史阻断；generated fixture未成为手写源。
9. serial plan 的每个可写 CP 是否具 RECALL/双读，CP-07是否把首败修复回流原CP；动态授权是否严格隔离。
10. 主动寻找未经 Dexter 裁定的新语义、fallback/双写、第三规则真相、owner越界或比当前方案更小且同样完整的替代。

本轮不要求也不授权执行编译、测试、DEV、reset、seed、browser L2、UAT或部署；只读源码检索可用于证伪。请不要把内部独立 GO 当作 Claude GO 的依据。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并汇总 `M/S/N`。每项 finding 请给相对路径与行号、事实链、业务/用户影响、反例边界、最小修复，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对本轮“商品库存与 BOM 业务模型”做一次独立 implementation-facing DESIGN review。

背景：Dexter 已确认正式需求并接受线框：普通/称重商品单节点直接详情；按 SKU 商品左树右详情且主壳只读；点单选项值只配置物料耗用、不拥有库存对象。Codex 已完成 Journey、交互稿、IA、implementation-facing design 与 serial plan。内部 fresh 独立审查 Round 1 为 NO-GO（M/S/N=1/1/0），修订 A-05 历史定义事实源和 CP-07 RECALL 后，Round 2 最终 GO（0/0/0）。请不要采信内部 GO，请从正式需求和 owning source 独立证伪。

目标：请判断 contract、catalog/inventory owner 与 operations-admin 是否真正遵守同一 shape×owner×mode 模型；单一 inventoryRules aggregate、inventory 原子 replace、A-05 四维守卫、验收矩阵和 seed 设计是否可实施、最小、可靠，且没有回退已完成的单位模型。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md
- doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md
- doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md
- doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-independent-review-round-1.md
- doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-review-intake-codex.md
- doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-independent-review-round-2.md

请同时重开 owning source：scripts/generate/catalog-inventory-p1.mjs；contracts/catalog/CatalogInventoryShapeManifest.java；CatalogInventoryCoordinator.java；InventoryOwnerApi.java；InventoryOwnerService.java；CatalogItemDrawer.tsx；CatalogAcceptanceScenarios.java；scripts/dev/catalog-inventory-seed-executor.mjs。

请重点独立核验：
1. 七 shape×ITEM/SKU/OPTION_VALUE×NONE/DIRECT/BOM 是否由 contract 完整约定，前后端不能各自补义。
2. 单一 inventoryRules detail aggregate、catalog 重派生、inventory 原子 replace 与 REQUIRED rollback 是否是最小可靠形态。
3. A-05 四维事实，特别是 pre-existing DISABLED definition 作为 HISTORICAL_DEFINITION、首次切换不自阻断且第二次自动切换拒绝，是否符合正式裁定且无需第三 truth。
4. component candidate 五条件+自引用是否在 cursor query/save 两端复核。
5. 已接受三种布局是否能直接消费 generated detail，且未误伤标签、属性、SKU销售属性和点单选项。
6. 17行横切表、15个typed problem、migration、幂等、缓存、日志和owner边界是否闭合。
7. 77+3=80 的参数化 acceptance 是否完整覆盖15需求、63矩阵、8 switch、6 component red、3 option分支；20个非法普通shape+SKU fixture是否全处置。
8. seed 是否只在P1唯一源和executor落地，并有七shape、三方式、SKU/option/shared material/counting/history等丰富实例。
9. serial plan 的双读/首败/授权闸门是否可执行；是否存在未裁产品语义、fallback、双写、第三真相或更小完整替代。

烦请给出明确 GO 或 NO-GO，并汇总 M/S/N。每项 finding 请标注相对路径与行号、事实链、业务/用户影响、反例边界、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本轮 GO 只表示设计可作为后续 implementation 授权的输入，不等于实施授权，也不授权契约/代码修改、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作；NO-GO 也只是待 Dexter/Codex 逐条复核的独立输入，不自动改写正式需求。谢谢。
```

## 授权边界

本轮 Claude `GO` 只表示设计合理且可作为后续 implementation 授权输入；不自动授权 implementation、契约/代码修改、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。Claude finding 也只是待验证输入，不自动改写 Dexter 已确认的产品语义。
