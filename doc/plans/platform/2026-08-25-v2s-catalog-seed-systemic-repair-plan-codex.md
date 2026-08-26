# 商品库 seed 全图系统修复计划

## 0. 目的、边界与首败

本计划只处理已批准的商品库 seed 在**同一业务图**中的物化、owner 读取与 readback 完整性；不改变商品、库存、生产标签或 L2 的产品语义，不引入直写 SQL、兼容读取或缺省数据。

首个正式 seed 首败为 `SEED_SKU_PAGE_ENVELOPE_INVALID:HEAD_COMPANY:LATTE-001`。首败前已完成 LATTE detail 与 SKU 第 1 页读回；第 2 页 `total` 变为剩余 SKU 数而非父商品完整 SKU 数。该分页问题已按 SR-01 至 SR-05 修复并取得静态、Testcontainers 80/80 与 L2 24/24 证据。

最新 fresh seed 首败为 `SEED_LIST_TEN_COLUMN_OWNER_READBACK_INVALID:HEAD_COMPANY:DINNER-SET-001`。首败前 `MILK-TEA-001` 的详情、SKU page 与全部十列 owner readback 已通过，`DINNER-SET-001` 的详情也已通过；唯一不一致字段是 `inventoryDeductionSummary`。业务为 `FAIL`，cleanup 为 `PASS_PRESERVED_DEV_STATE`，下一次 seed 必须从 fresh reset 开始。

## 1. 同根失败模式

**失败模式**：cursor page 的 SQL 在加入 cursor 条件之后才计算 `COUNT(*) OVER()`，于是第一页的 `total` 是全集，后续页的 `total` 变成剩余集合；同时 seed 的若干读取以 `pageSize=100` 假定数据不会超过一页。

这不是 LATTE、SKU 或某一个 fixture 的问题，而是“集合全量基数与分页窗口没有分层”的共同根因。`total` 的契约语义是完整匹配集合；cursor 只决定本页成员。没有这个分层，数据量不过页时会假绿，数据增长后才会暴露。

### 1.1 有限分母与结论

| 集合/operation | owner 当前形态 | executor 当前形态 | 结论 |
| --- | --- | --- | --- |
| `getOperationsCatalogItemSkus` | cursor 后 `COUNT(*) OVER()` | pageSize=2 完整遍历 | **确认缺陷**：第 2 页 total 漂移，seed 已实证 |
| `getOperationsCatalogCategoryCandidates` | cursor 后 `COUNT(*) OVER()` | 单页 pageSize=100 | **确认同根缺陷**：acceptance 未断言第 2 页 total |
| `getOperationsCatalogItems` | `filtered → aggregate → paged` | 早期单页，最终完整遍历 | owner 正确；执行器存在单页假设 |
| `getOperationsCatalogDictionary` | `matching → aggregate → paged` | 单页 pageSize=100 | owner 正确；执行器存在单页假设 |
| `getOperationsProductionTags` | `matching → aggregate → paged` | 单页 pageSize=100 | owner 正确；执行器存在单页假设 |
| `getOperationsInventoryTargets` | `base/classified → aggregate → paged` | 单页 pageSize=100 | owner 正确；执行器存在单页假设 |

反例：库存流水本次只读取刚写入记录所在的最新窗口；它不是 seed 的“全体对象 readback”，不纳入 complete-collection helper。列表、字典、标签、候选和库存对象索引则是依赖完整成员集合的读取，必须纳入。

### 1.2 相关但不同的 scope 根因

source fixture 的 `headquarterTemplate` 是唯一 source-item scope 谓词。当前已有 `sourceItemBelongsToClientScope`，但创建、复合保存、导航计数、库存/BOM 写入等处仍重复手写总部/门店条件。这个重复不是本次分页首败，却会让 scope 修复再次出现“某一个 readback 对、其他阶段错”的漂移，故同批收敛到该 helper。canonical dataset 是明确反例：它在两个 scope 都应物化，不能用 source-item helper 过滤。

## 2. 一次性修复方案

### SR-01 · owner 先冻结匹配集合，再裁分页窗口

1. `CatalogOwnerService.itemSkus` 改为单 SQL CTE：`matching` 只含 item/scope/lifecycle 的完整 SKU 集；`aggregate` 对 matching 计数；`paged` 在 matching 上消费 cursor、排序、`LIMIT pageSize + 1`；结果携带 aggregate total。保留一条 JDBC 操作，避免以第二次数据库往返修正 total。
2. `CatalogOwnerService.categoryCandidates` 同样把 cursor predicate 从完整可见候选集合移入 paged CTE；关键字、父分类和 reparent 禁选关系都属于 matching，不得因翻页改变 total 或候选资格。
3. 空集合仍返回 `items=[]`、`total=0` 和 null continuation；不得用 sentinel row、默认 total 或客户端补算。

### SR-02 · seed 只以一处 complete-collection 读取协议消费分页 operation

在 `catalog-inventory-seed-executor.mjs` 增加一个内部 helper（不是新测试框架）：调用方只声明 operation、path params、基础 query、entries field、continuation field、是否 echo cursor、稳定业务 identity 与 stage 前缀。它必须：

- 每页校验稳定 `total`、数组形态、cursor echo（适用时）、continuation 不循环；
- 用业务 opaque ref 去重并在终页断言 `observed.length === total`；
- 将每个请求保持为独立 seed stage，保留 operationId/requestId 关联与脱敏日志；
- 不设“100 条即完整”的隐藏上限；总数为 0 时只接受空集合与无 continuation。

该 helper 覆盖 dictionary、production tag、catalog item、inventory target、category candidate 以及 SKU page。SKU 行的严格 owner projection 仍由现有 SKU-specific oracle 执行；helper 不吞掉其事实断言。

### SR-03 · scope 分区只从一个谓词派生

所有 source item 的 create/save/复合 save、导航计数、库存规则、BOM 写入与总部 inventory detail fallback 改为 `sourceItemsForClientScope(seedItems, client.scopeType)`（由既有谓词派生）。商品列表预期编码、创建分母与导航计数使用同一集合。canonical dataset 继续通过其自己的 dependency-order 路径双 scope 物化。

static plan 还必须从 source composite/BOM 引用构造 source dependency edge，并在 plan 阶段拒绝 dangling target 或跨 scope edge。当前实测 source 的 68 条边均在同一 scope（0 条跨 scope），这是可验证的正常反例，不是允许执行器跨 scope 猜 ref 的理由。

### 1.3 十列库存摘要的缺省模式根因

**失败模式**：seed 将详情 graph 中“没有 ITEM inventory node”推导为 `mode=null`，但 contract 对一个不按 SKU 管理的商品要求 `grain=ITEM` 且 mode 是完整闭集 `NONE|DIRECT|BOM`。库存 owner 对任何被请求、又没有启用库存定义的 item/SKU 明确返回 `NONE`；列表 coordinator 原样消费该事实。因此套餐只是第一个触发样本，不是套餐专有规则。

有限分母是一个推导函数 `inventorySummaryFromOwnerDetail` 的两个消费者（父商品十列 projection、SKU page projection），以及 coordinator 的两个提供面（item page、SKU page）。结论如下：

| 消费形态 | 无 matching inventory node 的唯一语义 | 反例边界 |
| --- | --- | --- |
| 无 SKU 的父商品（含套餐、服务、权益壳及未配置库存的普通/原料商品） | `grain=ITEM, mode=NONE` | 不得用 null 抹去“不参与库存”这一业务事实 |
| 按 SKU 管理的父商品 | `grain=SKU, mode=null` | 唯一允许 null；它表示扣减由子规格分别配置，不能伪造成 ITEM/NONE |
| 具体 SKU | `grain=SKU, mode=NONE` | 无规则不等于父行摘要；具体 SKU 必须可读为“不参与库存” |
| 有 node 的 item/SKU | node 的 `NONE|DIRECT|BOM` 与对应快照/行数 | 不得用“无 node”覆盖 owner 已返回的 node |

该偏差的根因在 seed readback oracle，不在 fixture：`DINNER-SET-001` 没有合法库存 node 是 COMPOSITE 准入矩阵的正确结果。修复不得改套餐为库存商品、不得让 owner 为详情添加虚假 node，也不得把列表 mode 改回 null。

### SR-04 · 让真实 HTTP 验收能证伪该类错误

不新增第 81 条 scenario：在既有两个适当的 80 条 catalog scenario 内补强。

- `catalog.item-sku-page-contract`：第二页必须断言 `total` 仍等于 4；现有 4 SKU / pageSize=3 fixture 正好跨页。
- `catalog.category-candidate-hierarchy`：第二页必须断言 `total` 与第一页相等；保留不重不漏断言。

这两条会在旧 owner SQL 上变红，不能仅检查 next cursor、最终成员或 HTTP 200。

### SR-05 · 静态 red controls 与计划/实现对账

- 执行器 self-test 增加：连续页 total 漂移、重复 cursor、重复 row identity、提前终页、零集合 continuation 和单页溢出六个独立 red mutation。
- static plan self-test 增加 source dangling edge 与 source cross-scope edge 两个独立 red mutation；不让它们等到 owner HTTP 阶段才暴露。
- seed source test 从 `pageSize: 100` 字符串存在性升级为“所有 complete-collection consumer 经过 helper”的结构性断言；不把格式化字符串当语义。
- 对照本计划逐项复读：owner SQL 形态、helper consumer 分母、source/canonical scope 反例、acceptance oracle、无 SQL fallback 和报告/cleanup 边界。

### SR-06 · 十列库存摘要由 contract 语义而非详情节点存在性推导

1. `inventorySummaryFromOwnerDetail` 保留“SKU 父行先返回 `SKU/null`”的显式分支；其余无 node 分支统一返回 `mode=NONE`，不再用 `sku ? NONE : null` 的条件表达式隐式改变叶子 item 语义。
2. executor self-test 固定三态：无 node 的 leaf item 为 ITEM/NONE、SKU parent 为 SKU/null、无 node 的 concrete SKU 为 SKU/NONE；每项都有独立 red mutation，避免只比较整个对象时漏掉 mode。
3. source test 只断言该三态结构与十列 strict-owner oracle 均存在；不得通过把 `inventoryDeductionSummary` 从 `LIST_TEN_COLUMN_OWNER_FACTS` 移除、放宽 null 等价或跳过 COMPOSITE fixture 来止血。
4. static reread 同时核实 inventory owner 的 request-complete summary 仍对缺少启用定义的 requested item/SKU 返回 `NONE`，coordinator 仍只允许 SKU parent 的 mode 为 null。此项是 cross-owner reader contract，不新增任何 HTTP operation 或产品语义。

## 3. 实施顺序与停机条件

1. 写前双读本计划、`collection-boundary-modes`、seed executor、两个 owner query、两个 existing acceptance scenario。
2. 完成 SR-01 至 SR-04 的代码与 generated chain 所需变更；不手改 generated files。
3. 先跑 executor/plan self-test、相关 Node tests、生成链、Java compile/test compile、Node health；任何静态首败先完成同根扫描，不启动动态环境。
4. 静态源码按本计划逐条对账，进行两轮反证 review：第一轮找遗漏 consumer/SQL 形态；第二轮针对修订后的实际 source 验证 finite denominator 与 red controls。若仍发现 mismatch，按 Dexter 已定的无上限详设对账规则修复再复读。
5. 静态全绿后才执行 fresh Testcontainers 80/80；之后 fresh L2 24/24；两者均 PASS 才 reset → DEV start → full seed。任何代码变动后先前动态证据只作历史记录，不作当前结论。

**停机条件**：发现 another cursor response whose contract cannot明确其 total/continuation 语义，或 scope/source/canonical 语义与本计划冲突时，停止该条并交 Dexter；不得以固定 pageSize、忽略 total、fallback collection、人工拼接或 direct SQL 止血。

## 4. 完成判据

1. SKU 与分类候选第二页 total 均保持全集，且两个 existing HTTP acceptance oracle 可在旧实现上失败。
2. 六个 complete-collection seed consumer 都由一处 helper 遍历至终页；无 `pageSize=100` 作为“完整集合”的隐含证明。
3. source scope predicate 只有一个执行定义，所有 source-item stage 从它派生；canonical 双 scope 是显式反例。
4. 最新代码上的静态门、Testcontainers 80/80、L2 24/24、reset/start/seed 均分别提供 business 与 cleanup 证据。
5. 十列 seed readback 对全部 shape 不再由详情 node 缺失错误推导 null；仅 SKU parent 为 `grain=SKU, mode=null`，leaf item 与 concrete SKU 的缺省模式均为 `NONE`。

## 5. 计划静态 review

### Round 1 · source-first counterexample review

**结论：可实施，但补入了两项约束。**

- 分母复算：executor 的 complete-collection consumer 为 6 个（SKU、分类候选、字典、生产标签、商品列表、库存对象）；没有第 7 个以 `pageSize` 读取后再用作“完整集合”的 operation。
- owner 复算：SKU 与分类候选是仅有的 cursor predicate 位于 `COUNT(*) OVER()` 之前的 catalog collection SQL；商品列表、字典、复制候选、生产标签及库存列表都已采用 `matching/aggregate/paged` 或 window-before-offset 的正确形态。
- 反例复算：source 72 个 eligible item 为总部 6、门店 66；source composite/BOM 68 条依赖边跨 scope 为 0。由此发现 source edge closure 原先没有静态计划门，已写入 SR-03/SR-05。
- 实施限制：helper 必须显式区分 `cursor` 为“echoed inbound cursor、nextCursor 为 continuation”的 SKU/分类协议，和 `cursor` 自身为 continuation 的字典、标签、商品、库存协议；不得将其压成猜字段的通用 JSON 访问。
- 预算限制：SKU 修复保持一个 JDBC query/HTTP request；以独立 count query 解决 total 虽功能正确，却会改变 operation budget，故排除。

Round 1 未发现需要新增产品裁定的语义缺口。Round 2 只在完成实际修改后的源代码上进行，核验上述六个 consumer、两个 owner query、source scope edge gate 与两个 HTTP oracle 的闭包。

### Round 2 · approved-design and contract counterexample review

**结论：计划与已批准详设一致，可以实施。**

- 详设明确 category page 的 `total` 是“当前查询条件下的匹配总数”，并要求 SQL 侧完成 scope、filter、count、cursor；SKU over-page 是既有 owner/acceptance proof 的明确范围。因此 SR-01 修复的是已批准契约，不是扩展语义。
- 详设的 collection matrix 明确禁止 client slice 与 bounded 截断；SR-02 只强化 seed owner-readback，不改变前端 RTK cursor state，也不把 seed 数据用于 L2。
- 当前 source 72 个 eligible fixture 最大 scope 为门店 66，现阶段没有越过 100；这正是单页实现看似正确的原因，不是对 `pageSize=100` 的业务上界授权。helper 必须验证 `total` 是非负整数，后续每页 total 不变，row identity 不重复，终页累计严格等于 total。
- 既有 acceptance 已提供刚好过页的 SKU（4/3）和分类（至少 3/2）真实 HTTP fixture；只补第二页 total oracle，不新增 scenario，保持 80 条总分母和 operation host 不变。
- L2、DEV seed 与 Testcontainers 数据面保持隔离：本计划的 static/self-test 不读 runtime 数据；后续 seed 只在 fresh reset/start 后执行。

Round 2 没有发现遗漏的 product decision、scope 语义或 operation contract 变更。实施进入前的必要输入、影响面和反例均已复读。

## 6. 实施后源码—详设逐项对账

本节是实现后的静态对账记录，不替代后续 Testcontainers、browser L2 或受管 seed 的动态证据。

### Pass A · 同根反证与修复

- `CatalogOwnerService.categoryCandidates` 与 `itemSkus` 均为 `matching → aggregate → paged`；cursor 只出现在 `paged`，并仍只执行一条 JDBC query。
- 两个查询的最终投影均以 `aggregate LEFT JOIN paged` 承载 total：即使合法 cursor 落在匹配集合之后，空页也保留完整匹配 total；真实空集合仍为 `items=[]、total=0、continuation=null`。这补齐了 SR-01 的“总数先于窗口”语义，未使用 sentinel 或第二条 count SQL。
- executor 的 complete-collection helper 已逐页验证 envelope、稳定 total、适用的 cursor echo、continuation 闭环、opaque-ref 去重及终页 `entries.length === total`；SKU 特定 projection oracle 仍保留在 helper 的 `onEntry`，未被泛化读取吞掉。
- 所有 source-item 阶段均改由 `sourceItemsForClientScope` 派生；canonical dataset 仍走独立双 scope 路径。静态 plan 复算为 73 source、72 eligible、68 dependency edges，cross-scope edge 为 0。
- 首个静态门失败是 retired hand-written list-loop 的 source test assertion；该断言已迁移为对 final ten-column complete-collection call 的结构性约束，未删除 list owner readback assertion。

### Pass B · 闭包复读

- six-operation exact set（SKU、分类候选、字典、生产标签、商品列表、库存对象）均经 `readCompleteCollection`；所有 `pageSize:100` 仅为 page preference，未再作为完整集合证明。
- 两个既有 HTTP acceptance scenario 仍保持 80 scenario 分母，分别在第二页断言 SKU total=4 和分类 total 与第一页相同；旧 cursor-after-count SQL 会使这些断言失败。
- source plan 的 dangling/cross-scope 两个 red mutation 与 executor 的 total drift/cursor cycle/duplicate identity/premature terminal/empty continuation/page overflow 六个 red mutation均独立通过；不以一个泛化异常代替。
- 静态复跑结果：P1→tokens→M1→P3 generation PASS；Java `compileJava + compileTestJava` PASS；seed plan/executor self-test、dry-run、identity test PASS；Node health `THCL_NODE_TEST_ENTRY=PASS`、`DISCOVERED_TEST_FILES=EXECUTED_TEST_FILES=28`。
- `scripts/verify --validate-only` 以 `R5_VERIFY_VALIDATE_ONLY=PASS`、`EXECUTED=15/15` 收口；静态 cleanup 明确为 `NOT_APPLICABLE_STATIC_ONLY`。其唯一中途首败为 P1 design-byte coverage 的 retired `valueName` 路径，已在同一 policy source 改为 owner/contract 当前的 `valueLabel` 并补齐 `status`，未手改生成物。

### Pass C · 十列缺省库存模式

- `DINNER-SET-001` 暴露的是 seed oracle 对“无 ITEM node”的错误 null 推导；库存 owner 的 requested-summary 已明确返回 `NONE`，item list 的真实 row 因而是 contract 正确值。
- SR-06 已在 executor 唯一推导函数实施：SKU parent 的早返回仍为 `SKU/null`；其余无 node 分支统一 `NONE`。该函数仅有父商品与具体 SKU 两个 projection consumer，未发现第三个住址。
- 两轮静态反证均通过：Round 1 逐层核实 approved design 的 ITEM mode 闭集、inventory owner 的缺省 `NONE` 与 coordinator 的唯一 SKU-parent null 分支；Round 2 核实 COMPOSITE 的 `ownerGrain=NONE` 是“没有合法 node”而非“列表 mode=null”，三项独立 red mutation 和十列/SKU strict oracles 均仍在。没有移除字段、放宽 null 等价、跳过 fixture 或修改套餐语义。
- 本段的 executor self-test、source tests、P1→tokens→M1→P3、Node health 28/28 与 `scripts/verify --validate-only` 15/15 已 fresh PASS；依第 3 节，下一步必须重新取得 Testcontainers、L2、reset/start/seed 的动态证据。

**对账结论：SR-01 至 SR-05 的行为、关系、限制、位置和失败语义已与本计划一致；后续仍须按第 3 节顺序取得 fresh 动态证据。**
