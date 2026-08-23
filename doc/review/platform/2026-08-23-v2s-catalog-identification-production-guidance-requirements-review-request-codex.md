# 商品条码与标识、制作信息优化需求分析 Claude 评审请求

## 背景

当前 operations-admin 的“条码与识别”和“生产提示”页面把底层不完整契约直接暴露给用户：识别码是自由 `kind/code/value`，SKU 只有单值 `skuBarcode`；制作信息则是没有具体 SKU/选项值身份的三份 generic map，并混入生产标签、自由处理标签、打印标签、过敏原和 `materialRole` 兼容语义。

Codex 已只读核验 V4 实现、V6 领域设计、V2S 2026-08-06 原始需求与当前 contract/owner/persistence/UI/seed，形成一份 `PROPOSED_FOR_DEXTER_DISCUSSION` 需求讨论稿。该稿尚未成为正式需求，D-01 至 D-16 均未因文档存在而自动裁定。本轮需要 Claude 独立判断这套业务与技术模型是否合理、是否过度设计、是否遗漏关键用户任务或领域边界。

## 评审目标

请 Claude 不采信 Codex 的结论和证据摘要，先从 V4、V6、V2S 原始需求及当前 owning source 形成独立判断，再对照讨论稿，回答：

1. 将识别码建成 catalog owner 的可反查、可唯一约束关系子实体是否合理，是否有更小且长期可靠的实现；
2. “商品默认 + SKU 继承/完整覆盖 + 选项值增量 effect”是否符合 SKU 与点单选项的真实业务差异，是否存在无法确定合并的反例；
3. production tag、打印参数、过敏原、营销标签、物料角色的 owner 边界是否正确；
4. 当前 gap、迁移风险、typed problem、验收场景和 seed 要求是否足以支持后续需求定稿；
5. D-01 至 D-16 是否覆盖全部产品裁决，哪些其实可由现有来源直接确定，哪些仍必须交 Dexter。

## 需阅读文件

请从 `catering-v2s` 仓库根阅读：

- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-requirements-discussion-codex.md`：本轮待评审需求讨论稿；
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`：V2S 原始合并需求；
- `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`：既有 IA 与“三层独立”来源；
- `../requirement-doc/design-v6/01.领域设计/05-商品目录域.md`：ProductIdentifier、SKU、点单选项与 PreparationProfile 领域事实；
- `../requirement-doc/design-v6/01.领域设计/13-履约与生产域.md`：production tag 与履约生产 owner 边界；
- `../requirement-doc/design-v6/01.领域设计/21-打印规则域.md`：商品可打印参数与打印规则边界；
- `../catering-server-v4/backend/edge-bff-service/src/main/resources/db/migration/V009__catalog_items_rebuild.sql`：V4 identifier/preparation persistence；
- `../catering-server-v4/backend/commerce-catalog-service/src/main/java/com/next/catering/v4/catalog/adapter/persistence/CatalogIdentifierPersistenceWriter.java`：V4 item/SKU identifier 写路径及其缺陷；
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogEditableTables.tsx`：V4 用户可见编辑模型；
- `contracts/openapi/components/catalog/catalog-item.schemas.json`：当前 V2S identifier、skuBarcode、productionProfiles 契约；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`：当前保存、读回、引用与 owner 校验；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`：当前 opaque profile 与 `materialRole` 提升 fallback；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260814_100000_000__catalog_p3_model.sql`：当前 SKU 单条码持久化；
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`：当前两个页面的真实交互；
- `scripts/generate/catalog-inventory-p1.mjs`：当前 shape/tab/字段声明与 seed 唯一生成源；
- `contracts/policy/catalog-inventory-reference-path-matrix.json`：typed production tag ref 的现有正确对照路径。

## 独立核验重点

请重点证伪以下判断，不要只检查文档结构：

1. `ProductIdentifier` 是否真的需要独立关系事实；若建议继续 JSON，请证明目录级唯一性、扫码反查、SKU 多识别码和 whole-save 并发可由更小方案正确承接。
2. `BARCODE / PLU / MNEMONIC` 首期闭集是否遗漏真实类型；商品 `code`、SKU `skuCode`、外部主数据编码是否应保持独立，而不是自动双写成 identifier。
3. 唯一范围 `dataNode + brand + type + normalizedValue` 是否与实际扫码入口、复制和隔离边界一致。
4. SKU 商品禁止父商品识别码、改在具体 SKU 行维护是否合理；是否存在必须支持“扫父码后再选 SKU”的已知任务。
5. SKU 使用 `INHERIT_ITEM | OVERRIDE` 完整覆盖是否优于旧 IA 的三层完全独立和逐字段隐式合并；清除覆盖后的语义是否闭合。
6. 选项值只表达增量 effect 是否足够；多选项标签、说明、时长的合并是否确定，负时长和移除标签是否应保留为 Dexter 裁决。
7. 删除自由 `stationTags`、`printTags`，将过敏原移回 catalog 属性/标签，并把 production tag 收敛成真实制作处理语义是否符合 V6 owner 边界。
8. `productionProfiles.item.materialRole` 提升是否确属应删除的兼容 fallback；迁移冲突是否必须 fail closed，而不能静默选一边。
9. shape 矩阵是否误伤商品标签、SKU 销售属性、点单选项、库存/BOM、单位模型、套餐/服务/权益壳。
10. 迁移、acceptance 与 seed 场景是否覆盖非法 `BARCODE4`、前导零、重复值、SKU 多码、profile 继承/覆盖/清除、选项多选合并、停用标签历史可见及营销标签归位。

请明确区分：来源直接支持的事实、Codex 的推荐推论、需要 Dexter 产品裁决的语义。若否定某项推荐，请给出更小替代、适用边界和反例，避免仅按 V4 现状回退。

## 期望结论

请将完整评审写入：

`doc/review/platform/2026-08-23-v2s-catalog-identification-production-guidance-requirements-review-claude.md`

请给出明确 `GO` 或 `NO-GO`：

- `GO` 仅表示该讨论稿方向合理、可以继续由 Dexter 分轮裁决并收敛为正式需求；
- `NO-GO` 表示核心模型、来源解释或领域边界存在必须先修正的问题。

使用 `M/S/N` 分类，每项必须包含精确文件与行号、影响面、最小修复建议、反例或证据，以及是否需要 Dexter 产品裁决。请给出总计 `M/S/N = x/y/z`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对“商品条码与标识、制作信息优化”的需求讨论分析做一次独立 reasonableness review，判断这套设计是否真正合理，而不是只检查文档是否完整。

背景：当前 operations-admin 的“条码与识别”和“生产提示”页面把不完整契约直接暴露给用户：识别码是自由 kind/code/value，SKU 只有单值 skuBarcode；制作信息是没有具体 SKU/选项值身份的三份 generic map，还混入 production tag、自由处理标签、打印标签、过敏原和 materialRole 兼容语义。Codex 已只读对账 V4 实现、V6 领域设计、V2S 2026-08-06 原始需求以及当前 V2S contract/owner/persistence/UI/seed，形成需求讨论稿。该稿状态仍是 PROPOSED_FOR_DEXTER_DISCUSSION，D-01 至 D-16 尚未因文档存在而自动裁定。

目标：请不要采信 Codex 的结论或证据摘要。先从 V4、V6、V2S 原始需求和当前 owning source 形成你自己的业务模型，再对照讨论稿，独立判断：
1. ProductIdentifier 是否应成为 catalog owner 的可反查、可唯一约束关系子实体，还是存在更小且同样可靠的方案；
2. “商品默认 + SKU 继承/完整覆盖 + 选项值增量 effect”是否符合 SKU 与点单选项的真实差异，是否存在无法确定合并的反例；
3. production tag、打印参数、过敏原、营销标签、materialRole 的 owner 边界是否正确；
4. 当前 gap、迁移风险、typed problem、验收和 seed 草案是否充分；
5. D-01 至 D-16 哪些可由来源直接确定，哪些仍必须交 Dexter 产品裁决。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-requirements-discussion-codex.md：待评审讨论稿；
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md：V2S 原始需求；
- doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md：既有 IA；
- ../requirement-doc/design-v6/01.领域设计/05-商品目录域.md、13-履约与生产域.md、21-打印规则域.md：V6 领域边界；
- ../catering-server-v4/backend/edge-bff-service/src/main/resources/db/migration/V009__catalog_items_rebuild.sql；
- ../catering-server-v4/backend/commerce-catalog-service/src/main/java/com/next/catering/v4/catalog/adapter/persistence/CatalogIdentifierPersistenceWriter.java；
- ../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogEditableTables.tsx：V4 实现；
- contracts/openapi/components/catalog/catalog-item.schemas.json；
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java；
- apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260814_100000_000__catalog_p3_model.sql；
- apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx；
- scripts/generate/catalog-inventory-p1.mjs；
- contracts/policy/catalog-inventory-reference-path-matrix.json：当前 V2S owning source。

请重点证伪：identifier 独立关系事实及唯一范围是否成立；BARCODE/PLU/MNEMONIC 闭集是否遗漏真实类型；商品 code、skuCode、外部编码是否应避免双写；SKU 父码禁用是否合理；SKU 继承/完整覆盖是否优于三层完全独立或逐字段合并；选项 effect 的多选合并是否确定；stationTags、printTags、过敏原与营销标签是否应移出制作信息；materialRole opaque-profile fallback 是否必须退役；shape 矩阵及迁移/acceptance/seed 是否存在遗漏或误伤。

请明确区分“来源直接支持的事实、Codex 推荐推论、Dexter 产品裁决”。若否定某项，请给出更小替代、适用边界和反例，不要仅按 V4 旧实现回退。

请将完整评审写入 doc/review/platform/2026-08-23-v2s-catalog-identification-production-guidance-requirements-review-claude.md，并给出明确 GO 或 NO-GO。findings 按 M/S/N 分类，每项带精确文件与行号、影响面、最小修复建议、反例或证据，以及是否需要 Dexter 裁决；最后汇总 M/S/N = x/y/z。

授权边界：本轮只评审需求分析的合理性。GO 只表示可以继续由 Dexter 分轮裁决并收敛正式需求；不授权实施、契约或代码修改、测试、DEV、reset、seed、browser L2、UAT、部署、数据操作或任何新增产品语义。谢谢。
```
