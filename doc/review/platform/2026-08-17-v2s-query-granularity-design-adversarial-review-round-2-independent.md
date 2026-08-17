# Query granularity remediation — independent adversarial design review, round 2

`REVIEW_CYCLE_ID=QUERY_GRANULARITY_IMPLEMENTATION_DESIGN_20260817`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`  
`reviewerKind=INDEPENDENT_SUBAGENT`

## 第二轮、最终自主 verdict 声明

这是同一 cycle 的第二轮且是最终自主 verdict；不得以换 reviewer、局部改字或另建文件重置轮次。
本 fresh 独立 reviewer 未派生或咨询子 agent。仅作静态设计审查，并且只新增本文件；未改生产代码、契约、生成物、作者计划或环境，未运行 DEV、reset、seed、HTTP、浏览器、L2、RTK store、`EXPLAIN` 或 `backend-formatting-bytecode.mjs`。

## 输入与边界 checklist

- [x] `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/agent-operating-model.md`、platform README、Registry 及当前 Roadmap `CURRENT_*`。
- [x] `scripts/README.md`、全部六个 kernel；六维 deterministic recall 的 review/platform/platform-admin/platform/contract/task-start 及 review/backend/platform-admin/backend/contract/task-start 命中原文。
- [x] `deterministic-context-only`、`http-crud-efficiency-design-redlines`、independent-review governance、G-11/G-12、backend-acceptance decision/operation memory。
- [x] 作者详设、有效第一轮 verdict，以及 Organization、Catalog、Inventory、generated RTK/edge contract 和相关测试源码。
- [x] 审查范围只为 M-1/M-2/M-3/N-6 的设计闭合及修正引入的同族问题；静态计数不是 HTTP、JDBC、性能或浏览器结论。

当前 Roadmap 的 `CURRENT_*` 指向 backend-performance 后续实施；本轮由 Dexter 单独指定为 design review，既不消费其实施授权，也不产生实现授权。

## 独立复测口径

所有下列命令均为本机只读静态命令，以 exit code 0 判通过；数字的分母写在每行，不能外推为运行时请求数。

| 声称 | 独立命令与分母 | 输出 | 结论 |
| --- | --- | --- | --- |
| CTE wildcard | `rg -n 'SELECT \\*|SELECT [[:alnum:]_]+\\.\\*' OrganizationOverviewTaskReadService.java \| wc -l`；分母为该 task-read SQL string 的 wildcard `SELECT` | `5` | 与详设的 5 相符；另 `rg -n 'SELECT \\* FROM organization\\.' ... \| wc -l` 为 `0`，无 direct base-table `SELECT *`。 |
| catalog-inventory operation 闭集 | Node 读取 `contracts/catalog/catalog-inventory-edge-contract.json` 的 `operations[]`，按 `method==='GET'` 分组 | `GET=16`、`MUTATION=27`、`TOTAL=43` | 与 QG-13 一致。 |
| QG-13 provider/no-tag 分组 | 同一 Node 命令把表的 16 GET provider 和 4 个 explicit no-tag mutation 对 contract `operationId` 作集合比较 | `MAP_GET_PROVIDERS=16`、`MAP_UNTAGGED=4`、`MAP_TAGGED=23`、`UNMAPPED_GET=0`、`UNMAPPED_MUTATION=0` | 表覆盖了 43 个 operation 的分类，但分类正确性仍见 M-3/M-4。 |
| 精确 identity 可表达性 | `rg -n` generated `catalog-inventory-edge.ts` 的 relevant types | single item 的 path/request 含 `itemCode`；dictionary 含 `dictionaryKind`；inventory writes 含 `targetRef`；save/copy readback 含 inventory `targetRef` | save、single-item transition/promotion、dictionary、inventory write 与 copy 的已列 key 可由 request/result 表达。batch item status 是例外，见 M-3。 |
| 20 个 production tag | `rg -n 'Dexter 于 2026-08-17.*20|非绑定运营观察' 作者详设` | 仅命中 line 62 的“非绑定运营观察” | 只复测了文档的来源/措辞，不能从仓内静态源码独立测量 live cardinality；它不得成为设计理由。 |

## 对第一轮项的定向最终核验

### M-1 — 已闭合

- **位置：** QG-15 与 §1.2 CTE wildcard 行。
- **事实：** 详设已列出 `item.*`、`SELECT * FROM filtered`、hierarchy `target.*`、business-entity `SELECT * FROM target`、store `target.*`，独立命令为 5；direct base-table `SELECT *` 为 0。
- **后果：** 该项不再以“3”造成假闭集。
- **最小替代：** 无；按已列五处实施并用其三段 task-read focused proof 保持 mapper/predicate 语义即可。
- **证据边界：** 仅当前源码静态文本；不是 query plan 或性能证明。
- **M/S/N：无。**

### M-2 — 已闭合

- **位置：** QG-08。
- **事实：** 设计已冻结新增且非 HTTP 的 `readInventoryDisplayFacts(dataNodeRef, brandRef, orderedItemRefs)`；唯一调用者是 `enrichInventoryTargets`，输出仅为 `InventoryDisplayFact(itemRef,itemName,skuName,materialRole,categoryDisplayName)`，并明确输入顺序和 absent 行为。它显式禁止收窄旧 `readItems`。当前源码也证明旧 `readItems` 仍分别服务 list enrichment、target detail 和 consumption-reference enrichment，故保持其 JSON 投影是必要的兼容界线。
- **后果：** 实施者有足够输入避免为列表优化破坏 detail/reference/Catalog consumers，也不把 Inventory 事实移入 Catalog。
- **最小替代：** 无；实现时只需按 QG-08 的 focused owner/coordinator proof 验证该已定义边界。
- **证据边界：** public owner API 与 coordinator 静态调用面；尚未存在该 API，不声称实现完成。
- **M/S/N：无。**

### M-3 — 未完全闭合：batch status 无法精确命中 item detail fact

- **位置：** QG-13 的 `catalog-item:{itemCode}` 行及 43-operation mapping；generated `CatalogItemBatchStatusTransitionRequest/Readback`。
- **事实：** 表让 `getOperationsCatalogItem` 提供 `catalog-item:{itemCode}`，并把 `batchTransitionOperationsCatalogItemStatus` 归入 workbench/navigation/item-page/copy-candidates，却没有 detail invalidation。静态 generated wire 中 batch request 是 `items: [{itemRef, expectedVersion}]`，batch result 也只有 `itemRef`、`ok`、`failureCode`、`version`；两者均无 `itemCode`。故现有 QG-13 tag key 不能在 batch 成功后计算并命中已订阅的 `catalog-item:{itemCode}`。这不是动态推测：契约分母 43 中该 mutation 确实改变 item status，而 detail response含 status。
- **后果：** 已打开的 item detail 可在 batch transition 成功后保持 stale；QG-14 也无法据此判断该 detail 的 explicit refresh 是否可以删除或必须保留。
- **最小替代：** 在 QG-13 mapping 明确一种不改变 HTTP surface 的可计算 identity 策略并为其提供/invalidates tag 成对声明。例如把 item-detail fact 改为已由 detail response 和 batch request/result 共同可得的 `itemRef` key；或让 detail 同时提供一个有明确相关性边界的 collection fact，而 batch invalidates 该 fact。不得只添加一个无法由 batch request/result 推出的 `{itemCode}` tag，也不得以 endpoint-per-tag 或无依据的全局 invalidation 代替。
- **证据边界：** current generated contract/types、作者 mapping 与 current detail response 静态检查；未运行 RTK subscription/HTTP。
- **M/S/N：M。**

### M-4 — 同族新问题：category mutation 被错误排除出 inventory target page invalidation

- **位置：** QG-13 `inventory-target-page` 行的“catalog category/dictionary/production tag mutation”明确不 invalidates。
- **事实：** `InventoryOwnerService.targets` 接受 `categoryRef`，建立 recursive `catalog_category_scope`，并以该 scope join `catalog.catalog_item_category` 决定 target page 的成员；`CatalogInventoryCoordinator.enrichInventoryTargets` 又从 Catalog navigation 投影 `categoryName`。因此至少 category rename 会改变当前 page 的 display fact，category move 会改变带 category filter 的 membership。把三类 mutation合并为一条“不 invalidates”没有按事实区分，并与 QG-13 的“同一事实链 read/write 共享 tag”不符。
- **后果：** active inventory target page 可能在 category rename/move 后保留错误名称或成员；随后删掉其 explicit refresh 将产生真实 stale risk，而无理由的保留又破坏 QG-14 的重复读取判定。
- **最小替代：** 将 category operations 按影响分开：明确为 rename/move（及任何会改变已存在 target 的 category membership/display 的 operation）提供 `inventory-target-page` invalidation；对 create/delete 若 owner rule 能证明不影响已存在 target，则在表中写出该事实和 no-invalidation 理由。dictionary 与 production tag 保持 no-invalidation 也须各自以当前 inventory target read model 不消费该事实为理由，不能再借 category 的结论泛化。
- **证据边界：** Inventory SQL 与 coordinator display composition 静态源码；未测运行时 subscription 或 query result。
- **M/S/N：M。**

### N-6 — 已按非绑定观察正确定位

- **位置：** §1.2 line 62、§1.3。
- **事实：** 现在明确归因为 Dexter 于 2026-08-17 的“非绑定运营观察”，并同时排除 regular tag-list API、polling、tag-BOM materialization 与由规模推出的永久页面形态。仓内无产品 cardinality contract；上表的命令不能也没有假装测得 live 数量。
- **后果：** 数量变化会重开 task/read-budget 审视，不会改变 G-11/G-12 owner/model 边界。
- **最小替代：** 无；保持这种非绑定标签和 source/date 归因。
- **证据边界：** 设计文本及 G-11/G-12 的无 cardinality 规则；无 live-data measurement。
- **M/S/N：无。**

## QG-14 与动态/BOM 边界

QG-14 的顺序正确：它只在 QG-13 mapping 成立后才处置 catalog-inventory refresh，并保留 retry/manual reload/scope change/失败恢复/独立 UI zone。由于 M-3 与 M-4 仍使 mapping 不成立，QG-14 现在不得删除相应 explicit refresh；这不是允许恢复通用 `void refetch` 或全仓 55 处批删。

设计仍明确：dynamic HTTP、RTK subscription/store 和 `EXPLAIN` 均未授权；其未来观测只验证 request-set，不倒推设计已有效。BOM reverse relation 仍是 `DEXTER_DECISION`，本审查未把 tag 或 cache key 推导为关系、表、FK、read model 或新 user surface。

## 最终 verdict

**NO-GO — 2 M / 0 S / 0 N。**

M-1、M-2 与 N-6 已在设计层闭合；QG-13 的分母和分类表虽完整，但 M-3 证明 batch item status 不能命中它声称的 detail fact，M-4 证明 category mutation 的 no-invalidation 合并违背 current inventory page 的真实事实依赖。先以最小 mapping 修订闭合这两项，再按同一 cycle 的 `ROUND_FINAL_DECISION=SELF_DECIDED` 由作者处置；本 cycle 不得再启动第三轮独立子 agent 审查。
