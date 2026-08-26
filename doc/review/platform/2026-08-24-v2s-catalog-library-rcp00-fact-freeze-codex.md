# 商品库根因修复 · RCP-00 实时事实冻结

- 日期：2026-08-24
- 方法：按冻结修复计划重开 owning source；三个独立只读 agent 的结论均由下列路径复核，不以历史 review 代替当前事实。
- `BUSINESS=NOT_RUN_STATIC_FACT_FREEZE_ONLY`
- `CLEANUP=NOT_APPLICABLE_READ_ONLY_NO_RUNTIME`

## 当前分母

| 分母 | 当前值 | 证据 |
| --- | ---: | --- |
| catalog OpenAPI operation | 59，重复 0 | 解析 `contracts/openapi/catalog-inventory.openapi.json` 的 paths/operationId |
| backend acceptance annotation | 80 | `rg @AcceptanceScenario apps/backend/catering-business-server` |
| CatalogAcceptanceScenarios annotation / declared host | 38 / 31 | `CatalogAcceptanceScenarios.java` 当前源码枚举 |
| L2 scenario / case | 26 / 65 | `contracts/policy/catalog-inventory-l2-case-blueprint.json` |
| catalog-library L2 增量 | 8 fixture / 24 case | `CI-L2-019…026`，每场景 3 case |
| TEST datasets | 47 | `contracts/policy/catalog-inventory-fixture-catalog.json` |
| locator cases / controls | 65 / 104 | locator binding policy |
| generated L2 profile | `FRAMEWORK_ONLY / 0` | `contracts/policy/catalog-inventory-l2-execution.json` |
| P1 rich fixture drift | 8 library dataset 均为 2 objects / 0 edges | P1 graph 对比 generated fixture catalog |

## 已闭合、不得重做的事实

1. 商品级 `productionTagRef` 的单值 schema/owner/reference/partial unique/migration 静态链已在当前树闭合。
2. copy coordinator 的 `productionTagRefs` 是多商品 reference closure，seed map/migration/red mutation 也是允许例外；它们不是商品绑定多值字段。
3. `missingPriceCount` 没有正向运行残留；剩余是 owner 退休清洗、migration 或 red/negative fixture。`skuBarcode` 为显式拒绝，不能误当活字段。
4. `CatalogItemSkuPage`、category candidate、parent list 的 owner read 字段静态足够；问题是部分 consumer fallback/fixture/oracle 没有严格消费，而不是再加 HTTP operation。
5. `CatalogItemViewDrawer` 已独立于 Form；不得以历史“禁用表单当详情”问题重写已拆分的只读树。

## 待修根因差集

| F 族 | 精确入口 | 已证实差集 |
| --- | --- | --- |
| F1 | P1 / design-byte policy / generated fixture | design-byte policy 仍引用 2026-08-06 的旧字段；P1 rich fixture 未物化；不能手改 generated。 |
| F1/F7 | P1 / browser runtime / L2 spec | active 24 set 分别在 P1、`CATALOG_LIBRARY_CASE_IDS`、`EXPECTED_ACTIVE_CASE_IDS` 三处；P1 需 PASS readiness 才激活，而 readiness 先要求 active profile，循环。 |
| F2/F3 | Workbench/controller/category hook/table | Composite picker 仍用 navigation tree；候选 hook 伪造 ancestor/selected disabled reason；分类展示 fallback；SKU child cache 仅 itemCode，未含 query generation。 |
| F4 | controller/view/testId/locator | index testId、exact-set 未覆盖真实 View/Editor、locator JSON duplicate `CATALOG_ITEM_SAVE` 覆盖正确 binding；治理 View 泄漏 version/ref/enum，Editor 仍显示技术性 SKU 词。 |
| F6 | CatalogAcceptanceScenarios | annotation host/request 混用至少含 attribute definition create/update、order option definition create/update；38 annotation 不能冒充 31 host 的一一覆盖。 |
| F6 | P1 seed / seed executor | 无 `getOperationsCatalogItemSkus` seed readback；十列表仅字段存在/类型，未逐对象比对价格/单位/顺序/制作/库存；深分类无完整 path/filter readback。 |
| F7 | L2 spec/runtime | generic owner map readback 不可表达 create/batch/config/copy；fixture default 必须退役为判别式 required validation；progress/action completion/join 必须成为 gate。 |

## 下一步

实施按冻结计划 RCP-01 至 RCP-05，且必须以本表为有限差集。完成后先运行 RCP-06 的原详设逐项对账与 fresh 静态代码审查，才允许任何测试。
