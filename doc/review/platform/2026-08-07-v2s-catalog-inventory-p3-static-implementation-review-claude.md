# P3 前端/L2 静态实施独立复核（Claude）

会话出处：fresh v2s-rooted 评审会话，非续接、非它仓。本轮按 Dexter 2026-08-07 裁定
「第二阶段的接口测试和第三阶段的 L2 测试都没做，把它们都放到 P4，本次只做静态验收」执行：
**runtime 类缺口不计入本轮 finding，一律转入 P4 登记**；本轮只判静态实现是否达标。

授权边界：仅 P3 operations-admin frontend、IA 控件对账与已声明的静态 evidence。
不授权 backend/OpenAPI/P1 redesign、数据库、migration、seed/reset、DEV/UAT、managed runtime。
本文不把任何静态或 fixture PASS 写成 API/L2 business PASS。

---

## 0. 结论

**NO-GO — M=6 / S=4 / N=1**

需要说清楚的判断前提：Dexter 的裁定把「测试没跑」移出了本轮，但**本轮 NO-GO 不是因为测试没跑，
而是因为静态实现本身未达标**。按作者自己的 IA 对账，89 个控件里完整实现只有 29 条（33%）。
把 L2 与 API 实跑挪进 P4 之后，剩下的静态部分仍然收不了。

---

## 1. 六个核验点的直接回答

| # | 核验点 | 结论 |
|---|---|---|
| 1 | 89 控件是否逐项对齐 | **否**。29 IMPLEMENTED_STATIC / 40 PARTIAL_STATIC / 7 NOT_IMPLEMENTED / 10 BLOCKED_UPSTREAM_CONTRACT / 3 OUT_OF_SCOPE（合计 89 ✓）。见 M-01 |
| 2 | 43 个 L2 case 是否只是静态绑定 | **是，且只能这么认定**。`managedL2: NOT_EXECUTED_REMOTE_GUARD`，89 个控件 `runtimeStatus` 全部为 `UNVERIFIED_REQUIRES_EVIDENCE`。作者未把静态绑定冒充浏览器通过，这点如实。但绑定质量本身不足，见 S-02 |
| 3 | 26/100 API 是否仅为场景分母 | **是**。P2 evidence `api100CaseRuntime: NOT_APPLICABLE_WITH_REASON; runtimeAuthority=false`，HTTP/API runtime 至今未执行。已按裁定转 P4 |
| 4 | generated query 类型与页面 filters 是否漂移 | **漂移，且是跨层断链**。见 M-03、S-01 |
| 5 | 五步复制 / quickManage 回填 / 临时商品转正 / 库存筛选动作详情 | **均未完整**。见 M-02、M-04、M-05、M-06 |
| 6 | business 与 cleanup | **均为 `NOT_STARTED`，分别判断，无一可判 PASS**。如实声明，无异议 |

---

## 2. Findings

### M-01｜89 个 IA 控件完整实现仅 29 条

**仓内事实**（`...p3-ia-control-reconciliation-codex.json`，我独立复算 89 条状态分布）：
`IMPLEMENTED_STATIC=29`、`PARTIAL_STATIC=40`、`NOT_IMPLEMENTED=7`、
`BLOCKED_UPSTREAM_CONTRACT=10`、`OUT_OF_SCOPE_STATIC=3`。

**影响**：三阶段设计 §2.2 明文「三阶段完成后才可对 89 IA-ID 判 `CLOSED`；任何 `PENDING`、
悬空 source 或未绑定 assertion 均 fail closed」。当前 60 条非完整态，P3 exit 的
「89 IA-ID 每条有最终实现与 evidence，零 orphan」远未达成。

**最小修复**：不建议一次补齐 60 条。10 条 `BLOCKED_UPSTREAM_CONTRACT` 是 P1 契约缺字段导致的，
**必须先由 Dexter 裁定是否重开 P1 补字段**（P3 不得擅改 P1 契约，作者克制正确）；
其余 47 条按 Journey 分批收，每批闭一个完整用户任务，不要按控件号平铺。

### M-02｜本库复制是三步骨架，IA 要求五步且差异逐类可处置

**仓内事实**：`LocalCatalogCopyDrawer.tsx` 全文 85 行，`Steps` 只有
`选择目标商品 / 差异预检 / 复制结果` 三项。IA 第 221 行要求「v4 五步」，
且「字段/结构/引用逐类差异可处置」；第 233 行要求「候选、预检、映射分别 loading；
无候选说明原因；stale digest/version 回到预检并保留用户映射选择；成功结果列新建/复用/跳过，
并可打开目标商品」。

**影响**：预检页只渲染 `blockingCount` 汇总数，用户看不到哪个字段、哪条引用不兼容，
无法逐类处置——这正是当初把复制拆成向导的理由。P2 后端已经返回了
`mappingPreview`、`compatibilityResults`、`referenceRewritePreview`、`objectVersions`
（`decodePreflight` 也已解出这四个数组），**后端能力齐备而前端未消费**，
属纯前端缺口，不需要动契约。

**最小修复**：把已解出的四个数组渲染成「映射 / 兼容 / 引用重写」三段可处置视图，
并补 stale 回退保留用户选择、结果页分列新建/复用/跳过。

### M-03｜商品列表筛选跨层断链，用户看到静默错误的结果

**仓内事实（三层各自成立，合起来才是缺陷）**：

1. 冻结契约 `CatalogItemPageQuery = { dataNodeRef?, keyword?, cursor?, pageSize? }` —— 只有 4 个字段；
2. 页面 `catalogModel.ts` 实际发送 `categoryRefs`、`status`、`governanceStatus`、`source` —— 契约外字段；
3. 后端 `CatalogOwnerService.items()` 只读 `keyword`，SQL 为
   `... WHERE data_node_ref=? AND brand_ref=? AND (?::text IS NULL OR (name ILIKE … OR code ILIKE …)) ORDER BY code LIMIT 100`
   —— 四个筛选字段被静默丢弃，且 `LIMIT 100` 硬编码、未实现 `cursor`/`pageSize`。

**失败场景**：某门店有 300 个商品。店长按「分类=酒水」筛选，前端把 `categoryRefs` 发过去，
后端整个忽略、只按 code 序返回前 100 条，前端再在这 100 条里本地过滤。
**结果是「前 100 个商品里恰好属于酒水的那些」，界面上却表现为「全部酒水商品」。**
没有任何报错，用户无从察觉。这是本轮最该先修的一条。

**为什么 P2 静态复核没抓到**：契约本就没声明这些筛选字段，后端「按契约实现」是自洽的；
缺陷只在前端开始发送契约外字段时才成立，是典型的跨层缺陷。**这不是 P2 复核的漏判**，
但说明 P1 冻结查询模型时漏了列表筛选这一层需求。

**最小修复（需 Dexter 裁定其一）**：
① 重开 P1 补齐 `CatalogItemPageQuery` 的筛选与分页字段，后端落库过滤 —— 正解，但要动 P1；
② 本期前端先撤掉后端不支持的筛选项，只保留 keyword —— 功能缩水但不骗人。
**不接受维持现状**：静默错误结果比没有筛选更糟。

### M-04｜库存分类计数按当前页本地计算，冒充全量

**仓内事实**：`InventoryManagementPage.tsx:30-31`——
`rows` 与 `counts` 都在 `page?.items` 上做 `.filter(...)`，
`counts` 对 `ALL/NEEDS_ATTENTION/LOW/OUT/NEGATIVE/UNKNOWN` 六个视图各自统计当前页。

**影响**：与 M-03 同源同性质。「需处理 3 项」实际含义是「当前页里需处理 3 项」，
店长据此判断今天要不要补货，是直接的业务误导。需求 §5.3 把「需处理」定为
query view key 而非状态枚举，本就要求由后端按全量算。

**最小修复**：与 M-03 合并处置，由后端返回分视图计数；在后端支持前，
前端不得展示全局口径的计数数字。

### M-05｜库存四动作里 `CONFIGURE` 是死按钮，其余三动作字段不全

**仓内事实**：`InventoryActionModal.tsx:36`——
`if (action === 'CONFIGURE') { setProblem('当前生成契约尚未提供快捷配置业务字段，未发送请求。'); return; }`
按钮可点、弹窗可开，但**永不发请求**。另外 `FormValues` 只有
`{quantity, direction, reasonCode, allowNegative, lowStockThreshold}`，
缺需求要求的单位、备注、零值确认与受控原因集合。

**影响**：用户可达的入口点了没反应，属最差的一类交互——不如不放该入口。
作者不擅改 P1 契约的克制是对的，但**正确的克制是隐藏入口并说明原因，不是留一个死按钮**。

**最小修复**：`CONFIGURE` 入口按 `IA-STATE-007` 的 capability 规则**不占位**（连同置灰一起去掉），
并在 P4/P1 重开时补契约字段；其余三动作补齐单位与备注。

### M-06｜生产标签字段级 quickManage 零实现

**仓内事实**：IA `IA-CAT-DICT-003`（第 362–363 行）要求「字段级 quickManage 只允许商品标签、
销售单位、SKU 销售属性和值；创建成功只刷新当前字段候选并自动选中」，
第 379 行进一步要求生产标签「不复用商品目录字典组件；创建携带当前总公司+品牌或门店 owner，
成功后回填当前字段」。全仓前端源码检索（多惯例：`quickManage`/`quick`/`快捷`/`快速管理`/`生产标签`）
**无任何对应实现**；唯一命中的「快捷配置」是库存动作弹窗的同名不同物。

**影响**：编辑商品时想加一个新标签必须跳出去到字典页、创建、回来重新选——
正是 quickManage 要消除的往返。且生产标签被并入普通字典，owner 归属（fulfillment-production）
在 UI 上不可见。

**最小修复**：先只做商品标签一种字段的 quickManage 闭环（创建→回填→自动选中），
验证交互后再铺开到销售单位与 SKU 属性；不要一次做四种。

---

### S-01｜generated client 把 query/path/header 降为通用 Record，typed schema 未成边界

**仓内事实**：`catalog-inventory-edge.ts` 里 typed query 类型确实存在
（`CatalogItemPageQuery`、`InventoryTargetPageQuery` 等 10 个），
但 operation map 的每一条都写成
`path: Record<string, string>; query: Record<string, JsonValue>; headers: Record<string, string>`。
即**类型定义了却没被用在边界上**，TypeScript 无法拦截 M-03 那种契约外字段。

**影响**：M-03 之所以能悄悄成立，就是因为这里失去了编译期保护；
后续任何页面都可以继续发任意字段而不报错。

**最小修复**：把 operation map 的 `query` 从 `Record<string, JsonValue>` 换成对应的 typed query，
一处生成模板改动即可覆盖 42 个 operation。

### S-02｜43 个 L2 case 只绑到约 14 个宽泛 locator，断言密度过低

**仓内事实**：`catalog-inventory-l2-locator-bindings.json` 中 locator 值 45 个、去重后 16 个
（其中 2 个是策略说明字符串，实际 locator 约 14 个）；
`catalog-inventory.spec.ts` 468 行 43 个 test，`expect(` 共 59 处，**平均约 1.4 个断言/case**。
且第 86 行等处出现 `/CI-L2-(012|013|014|016|017)/.test('CI-L2-001-01')`——
把 caseId 硬编码成**字面量**去做 regex 判断，是字符串替换批量生成的痕迹，该判断恒为常量。

**影响**：43 个 case 之间区分度很低，多数只验证「页面能打开、某个宽泛容器存在」。
即便 P4 把 L2 跑起来，这套 spec 也证明不了控件级业务行为。**现在修比跑完再修便宜。**

**最小修复**：不要求 43 条全部加深。先挑出承载业务判定的那批（复制向导、库存四动作、
临时商品转正），给每条补到能证伪的断言；纯导航类保持现状即可。

### S-03｜IA 对账中 18 个 locator 的 sourceFile 映射不准

**仓内事实**：29 条 `IMPLEMENTED_STATIC` 控件共声明 72 个 locator，
其中 19 个在其声明的 `sourceFile` 中不存在；我进一步检索全部前端源码，
**18 个存在于其他文件**（即控件真实存在，只是文件映射写错），1 个见 S-04。

**影响**：对账表被用作「控件已落地」的证据，映射不准会让后续 review 与 L2 定位跑偏。
不是功能缺陷，但削弱证据可信度。

**最小修复**：`sourceFile` 按 locator 实际所在文件回填，可脚本化。

### S-04｜1 个声明为已实现的控件，其 locator 全前端不存在

**仓内事实**：`IA-CAT-SOURCE-TEMP-001` 状态为 `IMPLEMENTED_STATIC`，
声明 locator `catalog-item-source-temporary`，**全部前端源码中零命中**。

**影响**：这是一条与事实不符的已实现声明。数量只有 1 条，但性质与 S-03 不同——
S-03 是映射错，这条是**控件不存在却报已实现**。

**最小修复**：改判其真实状态（临时商品转正整体处于 `PARTIALLY_CONFIRMED`，
本条应随之下调），并在对账生成环节加一条「locator 必须在仓内可解析」的机械校验。

---

### N-01｜`frontend-architecture` 门的 FAIL 中有两条是 P3 新引入

我 fresh 复跑该门，`R4_GATE=FAIL`，原因分两类：
`REQUIRED_EXPRESSION` 缺失的 7 条落在 `platform-contract-overview`、`operations-stores`、
`operations-contracts`、`operations-head-company-brand-selector`——**既有页面的 baseline 债**；
但 `UNREGISTERED_TABLE` 的两条是
`CatalogWorkbenchPage.tsx` 与 `InventoryManagementPage.tsx`——**P3 本期新建的两个页面**。

evidence 的 `frontendArchitecture: FAIL_BASELINE_POLICY_GAPS_PLUS_NEW_UNREGISTERED_TABLES`
已如实区分了新旧，未把新增违规混进 baseline，这点值得肯定。
最小修复：把两个新表注册进 policy surface 即可，成本很低，建议本轮顺手收掉。

---

## 3. 方案合理性

- **问题对不对**：对。P3 要解决的是「店长/店员在两个后台里真正把商品和库存管起来」，
  IA 的 89 个控件是从 v4 实地交互推导的，不是从接口反推。方向没问题。
- **方案优不优**：**有一处方向性偏差**。当前实现把 89 个控件平铺推进，
  导致 40 条停在 `PARTIAL_STATIC`——每个 Journey 都开了头、没有一条走通。
  更优做法是**按用户任务纵向切**：先把「复制一批商品到本店」这一条从入口到结果页完整闭合，
  再开下一条。这样每个批次都有可验证的业务价值，也便于 L2 写出有区分度的断言。
  当前形态下即使补到 89/89，也可能是 89 个半成品。
- **代价配不配**：作者在 P1 契约不支持时选择不擅改契约，判断正确；
  但把「契约不支持」表达成死按钮（M-05）和静默错误结果（M-03、M-04）是错的表达方式，
  **正确表达是隐藏入口或如实降级，绝不能让用户以为功能生效了**。

## 4. UI 与交互强制自问

- 该操作是否来自用户明确要求/批准 Journey：是，89 控件均可回溯到 IA 与 v4 实地。
- 用户在此时这样操作是否合逻辑：**M-05 的 `CONFIGURE` 不合逻辑**——可点击但永不响应。
- 是否有更短路径：M-06 的 quickManage 正是那条更短路径，未实现。
- 不合理之处的归因：M-03/M-04/M-05 三条**均源自 P1 冻结契约缺字段**，不是前端偷懒；
  M-02/M-06 是纯前端未消费已有后端能力，无外部约束。
  这个归因区分决定了修复路径：前者需 Dexter 裁定是否重开 P1，后者 Codex 可直接做。

## 5. 转入 P4 的项（本轮不计 finding）

按 Dexter 2026-08-07 裁定转入 P4，已登记于
`doc/review/platform/2026-08-06-v2s-catalog-inventory-p4-scope-registry-claude.md`：

- P2 的 26 definitions / 100 cases API runtime（原 A-1）；
- P3 的 18 definitions / 43 cases 受管 L2 runtime（**本轮新增，原登记未含**）；
- P3 的 business evidence 与 cleanup evidence（均 `NOT_STARTED`，**本轮新增**）；
- 89 个控件的 `runtimeStatus`（全部 `UNVERIFIED_REQUIRES_EVIDENCE`，**本轮新增**）。

## 6. 授权边界

本节仅授权「P3 current-byte 静态实施复核」。不授权 backend、OpenAPI/P1 redesign、
数据库、migration、seed/reset、DEV/UAT、managed runtime。
本文对 L2 与 API 的执行结果**不作任何背书**；business 与 cleanup 均为 `NOT_STARTED`，
不存在可判 PASS 的部分。

M-03/M-04/M-05 涉及是否重开 P1 补契约字段，**需 Dexter 裁决**；
其余 findings 在既有批准边界内，可交 Codex 自主修复。
