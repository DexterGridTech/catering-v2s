# 查询粒度与重复读取详设：作者对设计期盲审 intake

`REVIEW_CYCLE_ID=QUERY_GRANULARITY_IMPLEMENTATION_DESIGN_20260817`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUNDS_CONSUMED=2/2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

## 独立 verdict

- Round 1：`NO-GO · M=3 · S=0 · N=1`，产物 `doc/review/platform/2026-08-17-v2s-query-granularity-design-adversarial-review-round-1-independent-retry.md`。
- Round 2：`NO-GO · M=2 · S=0 · N=0`，产物 `doc/review/platform/2026-08-17-v2s-query-granularity-design-adversarial-review-round-2-independent.md`。

首个 round-1 尝试在阶段一误见作者材料后自行声明无效；它没有形成 verdict，不计入该 cycle 的两轮上限。两份上述 verdict 均由 fresh 独立子 agent 产生，且未改生产代码、契约、生成物、计划或动态环境。

## Finding intake

| 来源 | 结论 | 作者处置与证据 |
|---|---|---|
| R1 M-1：CTE wildcard 不是 3 而是 5 | `CONFIRMED` | 重开 `OrganizationOverviewTaskReadService`，确认 overview `item.*`、`filtered.*`，以及 hierarchy/business-entity/store 三个 target wildcard；详设 QG-15、分母和检查表已改为 5。直接 base-table `SELECT *` 为 0 只是反例，不再混入分母。 |
| R1 M-2：QG-08 收窄泛用 `readItems` 会破坏其他 consumer | `CONFIRMED` | 重开全部 `readItems` coordinator 调用方。详设改为新增非 HTTP typed `readInventoryDisplayFacts(dataNodeRef, brandRef, orderedItemRefs)`，唯一调用者为 inventory page enrichment；泛用 JSON `readItems` 和其 detail/reference/Catalog callers 明确不动。已规定 ordered/absent/read payload/测试边界。 |
| R1 M-3：RTK 映射被留给实施期 | `CONFIRMED` | 详设把范围收窄为 custom catalog-inventory generator 的 16 GET + 27 mutation，列出 operation→事实 key→provider/invalidator/no-tag 的闭集；未列入的 platform/operations/public output 保持现状。动态请求集仍是未来证据，未冒充完成。 |
| R1 N-6：20 个商品处理标签没有仓内基数契约 | `CONFIRMED` | 改为“Dexter 于 2026-08-17 提供的非绑定运营观察”，保留不因规模建立 list API、polling 或 tag↔BOM 关系的边界；规模漂移必须重开 task/read-budget 审视。 |
| R2 M-3：batch status 只有 itemRef，不能 invalidates `itemCode` detail key | `CONFIRMED` | 重开 generated request/detail types。详设将 detail provider 改为同时提供 `catalog-item-code:{itemCode}`（request path）和 `catalog-item-ref:{itemRef}`（detail response）；batch status 用 request/result 的 `itemRef` invalidates ref key，save/single transition/promotion 使用 code key。无新 HTTP surface 或伪造 identity。 |
| R2 M-4：category mutation 会影响 inventory page 名称/分类筛选成员 | `CONFIRMED` | 重开 `InventoryOwnerService.targets` 的 recursive category scope 与 coordinator category display enrichment。详设改为所有 category create/update/move/delete invalidates `inventory-target-page`；dictionary/production tag 保持 no-invalidation 的理由限定为当前 target page 不读取它们。 |

## 自主收口

本 cycle 已达两轮上限，依 `doc/platform/agent-operating-model.md` 与 round-2 的 `ROUND_FINAL_DECISION=SELF_DECIDED` 不发起第三轮。两条 round-2 finding 均以可由现有 request/result 表达的 tag identity 和已验证的 Inventory category 事实依赖修订；没有涉及产品/Journey 语义、范围/批次变更或破坏性动作，故无需上提 Dexter。

当前设计 verdict：**GO_FOR_POST_HOC_CLAUDE_REVIEW_ONLY · M=0 · S=0 · N=0**。

这个 `GO` 只表示详设已能作为后续授权的输入；不表示任何 CP 已实施，也不表示 Testcontainers、HTTP、DEV、seed、L2 或 UAT 已运行。后续实施仍须逐项 RECALL、三方回读、focused proof，并在获得动态授权后按详设 §7 经受管 runner 执行 Testcontainers。
