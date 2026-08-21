# 商品属性库、点单选项库与两步新建 — implementation Round 2 disposition

```text
REVIEW_CYCLE_ID=CATALOG_DEFINITION_LIBRARY_IMPLEMENTATION_20260820
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
authorDisposition=POST_REVIEW_INTAKE
```

本文件只记录对最终独立 Round 2 finding 的逐条 intake，不改写 reviewer 的原始 verdict，也不建立第三轮审查。所有动态结论均来自受管 backend acceptance；浏览器 L2、DEV、seed、reset、UAT 均未执行。

| Finding | 当前处置 | 证据与边界 |
| --- | --- | --- |
| M-01 多原料编辑丢失 | `CLOSED_STATIC` | `CatalogDefinitionLibraries.tsx` 使用每个值的 `materials[]` Form.List，`catalogDefinitionForm.ts` 对多行原料做 hydrate/serialize round-trip；focused `catalogDefinitionForm.test.ts` PASS。浏览器 L2 未运行。 |
| M-02 逐变更点双读 ledger | `RETAINED_GOVERNANCE_FINDING` | 不能追溯制造历史 pre-read 记录。本轮保留该治理缺口；本次复制修复另有真实日志链与 proof，但不冒充完整历史 ledger。 |
| S-01 hard-block 契约与业务词闭合 | `CLOSED_STATIC_AND_HTTP` | generated problem union、edge Java/JSON registry 含 `CATALOG_COPY_DEFINITION_CONFLICT`；`CATALOG_ORDER_OPTION_DEFINITION` 映射为“点单选项”。attribute 与 order-option same-code conflict 场景在 full run 均 PASS。 |
| S-02 商品 detail 刷新 | `CLOSED_STATIC` | 两类定义 mutation 的 generated RTK invalidation 均包含 `catalog-item-detail`；无浏览器 L2，因此不宣称视觉刷新已验证。 |
| S-03 原料候选截断 | `CLOSED_STATIC` | option-definition Drawer 使用 foundation `useCursorCandidates`，page size 50、cursor continuation；不再固定 200 条。 |
| S-04 红夹具与完整 oracle | `CLOSED_HTTP` | acceptance 已覆盖组/值编码变更拒绝、order-option same-code hard block、ORDER_OPTIONS + OPTION_VALUE_BOM 关系/原料/数量/目标映射；full run 72/72 business 与 contract PASS。 |
| N-01 退役表/JSON test-only 残留 | `CLOSED_STATIC` | `CatalogCategoryOwnerIntegrationTest` 不再查询退役表；仅保留 raw legacy payload 明确拒绝测试；历史 migration 中的旧 DDL 是迁移历史，不是运行路径。 |

## 第三次失败的日志驱动修复记录

在 `r5-tc-1787229384842-88619` 中，结构化日志显示外层合并处置为商品 1 条 + 库存 1 条且 `outcome=MATCH`，但 catalog owner 内部重预检收到期望 1 条、提交 2 条（额外 `STOCK_TARGET`）。根因是 `mergeCopyPreflight` 原地追加 owner compatibility 后，过滤 catalog 处置时再次读取了已合并对象。修复是在合并前保存 catalog-only compatibility snapshot，local-copy 与 brand-copy 均只以该 snapshot 构造 catalog owner command。

修复后的 focused run `r5-tc-1787229777851-95550`：`catalog.local-copy-section-outcomes` 的 `CONTRACT=PASS`、`BUSINESS=PASS`、`RESOURCE_CLEANUP=PASS`。随后移除了本次一次性诊断日志，仅保留根因修复与业务测试。

## 设计语义备注

Round 2 reviewer 提出的“组/值 code 唯一范围”与当前实现的 scope-wide uniqueness 仍需在后续产品语义复核时对照正式需求；本文件不替 Dexter 追加产品裁定。该备注不改变本轮已通过的 HTTP 业务结果。
