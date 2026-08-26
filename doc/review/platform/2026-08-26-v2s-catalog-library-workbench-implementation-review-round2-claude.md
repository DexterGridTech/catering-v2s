# 商品库业务、用户 Journey 与 UI 交互优化 · 独立 IMPLEMENTATION Review(第 2 轮)

- REVIEW_TARGET=IMPLEMENTATION,动作 1-A(源码抽取)
- reviewerKind=EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE(非作者内部盲审 subagent,不占用其两轮上限)
- 会话出处:fresh v2s-rooted 会话,本轮零仓内写入(仅本文件)
- 本轮范围:按 Dexter 指示 **只做静态代码符合性复核**,不纠结证据链

## 结论

**NO-GO** · **M=1 · S=3 · N=7**

- **first failure**:`CatalogOwnerService.java` 第 2156–2194 行,品牌复制写入分类时不做任何深度校验
- **last known good**:分类的 create / move 两条写路径(第 5913、6096–6098、6265–6271 行)——深度判据完整,含子树深度,持锁在事务内
- **broken boundary**:「商品分类最多三级」这条业务不变量的**写入面不闭合**。本批把它在 contract、owner 写命令、候选查询、前端树选择器、seed 五处对齐了,唯独第六条写入面(品牌复制)在闭合范围之外

## 方案合理性判断(强制段落)

**问题对不对**:对。十列横向比较、父子同表、单一生产标签、配置抽屉、草稿恢复,解决的是"运营要在一个工作区里看清并改完一个商品"这个真实任务,不是为技术而技术。

**方案优不优**:主干选型经得起推敲,且多处**优于**我独立推导的方案:

- `Page(14 行) → Workspace(20 行) → Controller(289 行/9 hooks) + 5 个专职 controller` 这条链,是对上轮 S-02(1787 行/60 hooks 宿主)的真解耦,不是改名搬家。列与筛选分别归 `CatalogItemListTable` / `CatalogWorkbenchToolbar`,宿主对二者零引用——「新增列不需要改宿主」这条判据成立。
- `itemSkus` 用单条 CTE + LATERAL 一次往返拿全页规格事实,并把 `EXISTS(SELECT 1 FROM item_scope) AS item_exists` 折进同一条语句换取 typed 404。DB 操作从上轮的 24 降到 11,**是靠合并查询降的,不是靠砍业务事实降的**——这正是预算固化裁定所要的那种收敛方向。
- 配置抽屉与编辑抽屉之间用 `returnToEdit` 做"换位并可返回",而不是叠一层抽屉,比我原先设想的方案更干净。
- 三个简单库(商品标签 / 生产标签 / 计量单位)的筛选值都进了 `useCursorStack` 的 `resetKey`,§4.7「筛选必须作为 owner query 事实、重置游标并参与 cursor identity」全项落地。

**代价配不配**:配。没有发现为假想未来需求提前引入的抽象层。

**但方案合理性上有一处真缺口**:本批把「三级」这条规则在五个面上对齐,却没有把**第六个写入面**纳入分母。这不是实现瑕疵,是范围划定时漏了一条写路径——见 M-01。

## UI 与交互强制自问

- 操作是否来自明确批准的 Journey:是,十列/父子行/四抽屉/六库配置均逐条对应正式需求 §4.2–§4.8 的 DEXTER_ACCEPTED 裁定。
- 是否有更短路径:未发现。点击规格名直接打开父商品查看抽屉并定位「规格与价格」区段(`CatalogItemListTable.tsx` 第 313–320 行),没有制造第五种一层抽屉。
- 不合理之处来源:S-01(错误原因被改写)来自前端自建了一套不带编译期约束的文案表,属**历史实现惯性**,不是后台接口限制。

## Findings

### M-01 · 品牌复制可静默写出超过三级的分类树

**仓内事实**(逐行打开确认):

- 深度校验在全仓只有三处:`CatalogOwnerService.java` 第 5913 行(create)、第 6096–6098 行(typed move 的单条 SQL)、第 6265/6271 行(ObjectNode move)。复制路径一处都没有。
- 复制写入在第 2156–2194 行,`INSERT INTO catalog.catalog_category ... ON CONFLICT (data_node_ref,brand_ref,code) DO NOTHING`,子分类的 `parent_category_ref` 取自 `targetRefFor`(第 11575–11587 行),该函数在目标已存在同 code 行时**无条件返回既有 ref**,不看它在哪一层。
- 复制闭包确实携带多级链:`loadCategories` 第 10394–10407 行用 `WITH RECURSIVE` 向上并入全部祖先。
- preflight 对分类只贴 `REUSE_OR_CREATE`(第 6909–6914 行),既不做冲突判定也不做深度判定;单位有 `CATALOG_COPY_UNIT_CONFLICT`、点单选项有 `CATALOG_COPY_DEFINITION_CONFLICT`,分类什么都没有。
- 目标域是 `(scope.dataNodeId(), scope.brandRef())`(第 2100 行起),与门店自建分类 `createCategory(dataNodeRef, brandRef, …)` 是**同一个命名空间**。
- 数据库无兜底:`catalog_category` 相关迁移里没有任何深度 CHECK 或触发器。

**推论(未执行验证,仅由上述代码事实推导)**:目标门店已自建 `MENU(一级) → FOOD(二级)`,品牌侧存在 `FOOD(一级) → APPETIZER(二级) → SALAD(三级)`,门店复制 SALAD 下的商品时,`FOOD` 命中 `DO NOTHING` 被跳过并复用门店那条二级行,`APPETIZER` 落到三级、`SALAD` 落到四级。全程无报错。

**为什么这是 M 而不是 S**:写进去的是错误的业务事实,用户看不到任何拒绝,数据库没有约束能兜住,而下游(导航树、候选查询、move 守卫)全部假设该不变量成立。

**适用条件与可能反例**:仅当目标域已存在同 code 且层级更深的分类时发生。若运营实际上从不在门店自建与品牌重名的分类,则不会触发——但这依赖使用习惯,不是代码保证。`ON CONFLICT DO NOTHING` 的存在本身说明"目标已有同 code 分类"是被设计预期的常态。

**尚缺证据**:我未验证该缺口是本批引入还是既有。本批的验证点 1 要求「三级在 contract/owner/前端/seed 一致」,复制写入面属于该不变量的分母,故列入本轮。

**验收判据**:构造一条目标域二级同 code 分类,执行品牌复制,断言要么被 typed `CATEGORY_DEPTH_EXCEEDED` 拒绝、要么复制后全树深度 ≤ 3。判据自带反例:若实现只在 preflight 提示而 execute 仍写入,该断言应失败。

### S-01 · 服务端已把拒绝原因送到前端,catalog 把它丢掉换成「请重试」

**逐层打开确认的完整链路**(这条我最初算错过一次,已按真实 wire 形状重算):

1. owner 抛 `Problem("CATEGORY_DEPTH_EXCEEDED", 422, "商品分类最多只能建立三级")`(`CatalogOwnerService.java` 第 6352、6368 行)。
2. 边缘 `ContractProblemAdvice.java` 第 679–689 行以 `application/problem+json` 输出,**owner 的原文进入 `detail` 字段**,`errorCode` 同时带上。
3. `OperationsTransport.ts` 第 152–171 行对 catalog 业务码走专门分支,构造 `{title: '商品与库存操作失败', detail: value.detail ? value.detail : '请检查当前商品与库存资料后重试。'}`——**此时 `detail` 里确实是「商品分类最多只能建立三级」**。
4. `catalogUiProblemFeedback.ts` 第 55 行 `const {errorCode} = operationsProblemOf(error);` ——**只解构 errorCode,把已经拿到手的 `detail` 与 `title` 全部丢弃**;第 68 行查 `CATALOG_BUSINESS_PROBLEM_COPY` 未命中,第 81 行 `return {message: fallback, known: false}`。
5. 分类场景的 fallback 是 `useCatalogCategoryActionController.tsx` 第 226 行的 `'分类操作未完成，请重试。'`,渲染在 `CatalogCategoryActionModal.tsx` 第 62 行。

**业务后果**:用户把二级子树往二级分类下挪,服务端明确算出「商品分类最多只能建立三级」,用户看到的是「请重试」。重试永远不会成功。这正是前端规范 §3-D「失败必须可见,且原因不得改写」的反例形态——原因**收到了**,然后被改写。

**影响面**:闭集 46 个 code 中,有 23 个在整个 catalog-management feature 内以任何形式都未出现,全部落此路径。其中包括 `CATEGORY_DEPTH_EXCEEDED`、`HIERARCHY_CYCLE`、`MOVE_BOUNDARY`、`VOIDED_RECORD_IMMUTABLE`、`IDEMPOTENCY_MISMATCH`、`DEPENDENT_FACTS_BLOCK_VOID`、`COPY_CLOSURE_TOO_LARGE` 以及全部 `INVENTORY_*` 拒绝。

**为什么不是更小的方案,以及为什么更不该是更大的方案**:更大的方案(把 46 个 code 逐条补文案、并把键类型换成生成闭集联合)不必要——服务端已经逐场景算好了话术,再抄一份到前端反而制造第二处真相。**最小且正确的修法是:未命中显式映射时回落到 transport 已带来的 `detail`,而不是回落到调用方的通用串。** 显式映射表只保留那些确实需要改写成任务化话术(带 tab 跳转)的少数 code。

**需要区分的既有事实**:前端并非完全不知道三级规则——`CatalogWorkbenchNavigationTree.tsx` 第 101 行有 `catalogCategoryDepthLimitCopy = '商品分类最多只能建立三级'`,用于**预防性**禁用三级节点的新建入口。本 finding 针对的是**反应式**路径:并发、陈旧树、批量移动或任何绕过预防性禁用而真的被 owner 拒绝时,用户拿不到原因。

**验收判据**:让 owner 返回任一未映射 code,断言 UI 呈现的文本等于服务端 `detail`,而非调用方 fallback。判据自带反例:若只补 `CATEGORY_DEPTH_EXCEEDED` 一条映射,其余 22 个 code 仍会命中该断言失败。

### S-02 · 分类树选择器自造第三套候选生命周期,逐字符发请求

**仓内事实**:

- 正式需求 §503-5:「有限候选与搜索候选各有一个标准 hook;禁止第三套候选生命周期。」
- `useCatalogCategoryCandidates.tsx`(316 行)未使用 foundation 的 `useCursorCandidates`,自己起了 10 个 `useState` 管 childrenByParent / loadedParents / loadingParents / nextCursorByParent / searchValue / searchCandidates / searchNextCursor / searchLoading / searchError / error。
- 其 `onSearch`(第 235–266 行)在每次输入变化时直接 `void readPage({keyword})`,**没有任何防抖**。有 `searchSequence` 乱序保护,但请求照发。
- 四个调用点全部直连:`CatalogItemBasicEditor.tsx:215`、`CatalogBatchActionModal.tsx:116`、`CatalogCategoryActionModal.tsx:86` 和 `:114`,均为 `onSearch={…onSearch}` + `filterTreeNode={false}`,外层无防抖。
- 对照组:`CatalogItemCompositeEditor.tsx:89` 与 `useInventoryConsumptionTargetCandidates.ts:24` 都走 foundation 的 `useCursorCandidates`,拿到的是 `debouncedQueryText`。

**业务后果**:在任一分类选择器里输入四个字,就是四次 `getOperationsCatalogCategoryCandidates`,每次实测 8 次 DB 操作。这与本批刚固化的 DB 预算方向相反——预算门只按单次请求计,拦不住"请求次数本身被放大"。

**需要区分的一点**:树形候选确实需要 per-parent 的游标与加载态,foundation 的单列表 hook 表达不了,这部分自建是合理的。但**搜索分支**(searchValue/searchCandidates/searchNextCursor/searchLoading/searchError)恰好就是一个扁平游标候选列表,正是标准 hook 的形状。

**验收判据**:搜索分支复用标准 hook 后,连续输入 N 个字符只应产生 1 次请求。判据自带反例:仅在树 hook 内手写一个 setTimeout 也能让计数变 1,但那是第四套生命周期,不满足 §503-5。

### S-03 · 两个区段用逐字段 props,新增字段要改宿主

**仓内事实**:

- 正式需求 §507-8:「新增一个区段字段时,改动只落在该区段 View、Editor 与 draft 类型;宿主文件零改动。**做不到即结构未达标**。」判词是需求自带的。
- `CatalogItemEditorSectionAssembler.tsx` 第 110–143 行,`CatalogItemBasicEditor` 收到的是逐字段 props:`categoryRef`、`selectedTagRefs`、`selectedSalesUnitRef`、`selectedBaseMeasureUnitRef`、`standardSalePrice`,外加五个一一对应的 `on*Change`。production 区段(第 222 行)同类。
- 加一个基础信息字段的实际改动面是四处:`useCatalogItemEditorWorkspaceState.tsx`(760 行,第 195 行读 draft、第 242 行 setter、第 709/719 行导出)、`CatalogItemEditorSectionAssembler.tsx`(第 50/58/68 行解构 + 第 110 行传参)、Editor、draft 类型。前两个都是宿主。
- **同一文件里已有正确写法**:identifiers(第 146 行)、attributes(第 196 行)、orderOptions(第 209 行)收的都是 `values` + `readOnlyValues` + `onChange` 切片型 props,加字段确实不碰宿主。

**为什么不是更小的修法**:不需要新抽象,把 basic/production 改成与同文件另外三个区段一致的切片形状即可,模式已在仓内被证明。

**验收判据**:给 basic 区段加一个字段,`git diff --name-only` 不得出现 `CatalogItemEditorSectionAssembler.tsx` 与 `useCatalogItemEditorWorkspaceState.tsx`。

### N 级(7 条)

- **N-01** `CatalogOwnerService.java` 第 7872、7991 行仍写「制作标签」,其中第 7991 行是 `PRODUCTION_TAG_NOT_BINDABLE` 的 detail,会直接呈现给用户。仓内「制作处理标签」残留为 0,只剩这两处旧称。同一功能两套叫法。
- **N-02** 规格子行缺三项已裁视觉规约:§4.2 要求「24px 缩进、极浅层级底色、连续层级引导」,全 App 无 `indentSize`、无行样式、无主题定制,只保留 AntD 默认缩进(15px)。功能层级(缩进存在、列对齐、无 colSpan、占位行独占一条)全部正确,缺的是视觉分层。
- **N-03** `CatalogWorkbenchNavigationTree.tsx` 第 70 行的节点名用裸 `textOverflow: ellipsis` 截断,未包 `EllipsisTooltip`。表格侧同类截断处处都包了。三级分类路径正是长名易发处;父层 `aria-label` 保住了可访问性,鼠标用户看不到全名。
- **N-04** 商品级 0..1 的生产标签在详情里以数组 `data.productionTags` 回带(第 4182–4184 行,由 `productionTagDetails` 产 0 或 1 条),前端要 `find` 才能取回。当前无法表达两个标签,不构成多值残留,但形态给未来留了口子。同名 `productionTags` 在导航层(第 3359 行)表示"scope 内全部标签定义",一名两义。
- **N-05** `scripts/test/backend-performance-budget.test.mjs` 前两个 test(第 36–130 行)是对源码做 `assert.match(interceptor, /"getOperationsCatalogItemSkus"/)` 式的字符串钉桩,属仓规明令退役的「用关键词匹配把语义伪装成 checker」。该文件其余 15 个 test 是真行为门(直接调用 `validateControlledBudgetException` 等),连接作用域的真实行为也已由 run 级 `connectionBudgetEvidence` 覆盖,故这两条是冗余且会因重构误报。
- **N-06** 本批确立的工程结构(宿主只装配、controllers 分层、testId 常量模块)只写在本批需求文档 §499–509,未进 `doc/platform/frontend-coding-standard.md` 正本(该文件止于 §3-K)。下一个 feature 会重新即兴发挥。按当前阶段右尺寸,建议登记 `HANDOFF.md` 而非立即建门。
- **N-07** 子树深度这条判据无区分性测试:`CatalogCategoryOwnerIntegrationTest.java` 第 191–226 行与 `CatalogAcceptanceScenarios.java` 均把**一级**节点往**三级**叶子下移(3+1>3),只算被移节点自身也会被拒。真正有区分力的用例(二级子树 → 二级父,2+2=4)没有。代码是对的,测试没证明它对。

## 已亲验通过、不构成 finding 的部分

- 上轮 **S-02 已修**:宿主 1787 行 → 14 行,拆为 Page/Workspace/Controller + 5 个专职 controller,列与筛选各有归属。
- 上轮 **M-01 的连接作用域部分已修**:两个新 GET 都在 `ReadOnlyTaskConnectionScopeInterceptor` 的 allowlist 内(第 30、33 行),复用共享机制而非另起一套;实测 borrow 均为 1。预算门的 env 开关已去除,`budgetEvidence` 与 `connectionBudgetEvidence` 均为 239/239、exceeded=0。预算提升的双证明门是真行为门(`validateControlledBudgetException` 要求 businessFactsPreserved + sharedMechanismsReused + rejectedAlternative + costComparison + narrowScope,且拒绝 scope 不匹配),两个新 GET 是 `from: null` 新增而非提升,不需要例外记录。
- **单一生产标签**全链路符合 0..1:契约单数、owner 三态迁移共用唯一写入点、partial unique index 谓词正确、迁移前 preflight 对多标签商品直接中止而非静默取首条、SKU/选项四层独立拦截(类型层无字段 / UI 不渲染 / owner 白名单 422 / DB CHECK)、前端单选无 `mode="multiple"`、seed 三种情况齐备。**未发现任何多值残留、fallback 或兼容层**;30 处复数命中逐个打开后全部是构建期删除、缺席断言、红夹具或运行期拒绝。
- **三级分类**在 create 与 move 两条写路径上完全正确,move 的**子树深度被正确计入**(typed 路径 SQL 第 6096–6098 行 `MAX(parent_ancestors.depth)+MAX(subtree.depth)>3`,ObjectNode 路径第 6356–6370 行同式),持 `pg_advisory_xact_lock` 在事务内,无并发绕过窗口。**前端未发现两级限制残留**(逐个打开导航树、四个选择器、字段运行时与 foundation 渲染器确认)。seed 真造了三级。
- **十列表格**逐项符合正本:列序完全一致;四行上限 + `EllipsisTooltip` + 「还有 N 项」;规格或选项列按 §4.2 例外用 `preserveVisibleFacts` 保留四条真实内容;父图 72px / 规格图 60px 与正本逐字吻合;状态与来源走 `catalogEnumLabel(manifest, …)` 服务端业务文案,子行来源显示「同商品」;AntD 原生 tree-data;rowKey 用业务码;`scroll.x` 由列宽求和;占位行只在商品列出提示、其余列空单元格、无 `colSpan`;`missingPriceCount` 已退休(进 `retiredPositiveCoverageFields` 并在生成期 delete)。
- **草稿恢复**是真 sessionStorage(`useCatalogItemDraft.ts` 第 213–237 行),记录含 schemaVersion / scopeRef / brandRef / itemCode / baselineVersion / sectionState,并分型处理 `STALE_SERVER_VERSION` / `CORRUPT` / `PERSIST_FAILED`。
- **弹层互斥与嵌套**:`CatalogWorkspaceTask` 是单槽判别联合(8 个 kind),结构上互斥;编辑抽屉之上的「选择套餐组件商品」抽屉是 §4.6 点名允许的子任务面本身(候选列表、搜索、已选摘要都在面内完成),不是被禁的二次候选 Drawer;配置与编辑之间用 `returnToEdit` 换位返回而非叠层。
- **foundation 复用**:50 处引用,覆盖 testId / EllipsisTooltip / CursorPagination / useCursorStack / useCursorCandidates / useDrawerFormLifecycle / useOverlayLock / createContentIdempotencyKey / DescriptorFieldRenderer 等;未发现自造 HTTP、分页、生命周期。9 处裸 `data-testid` 逐个打开确认合理(AntD Tabs label 内层 span 与 `CatalogAssetPreview` 的 testId 入参)。
- **后端不变量未被性能整改削弱**:advisory lock 6 处、幂等 89 处、审计/receipt 115 处、权威 readback 262 处、typed problem 334 处、`@Transactional` 45 处;`itemSkus` 的 24→11 是合并成单条 CTE 所致,不是删事实。
- **模块边界干净**:catalog 主源码对 `fulfillment_production.` 的直连 SQL 为 0,全部经 `ProductionTagOwnerApi` 接口(第 6、79 行);仅有的 3 处直连在 catalog 模块的测试夹具里。

## business 与 cleanup 分离结论

按本轮 Dexter 指示,证据链不作复核重点,以下为读取 manifest 所得、未独立复算:

- 后台验收 run:`testExecution=PASS`,`firstFailure=null`,discovery 声明 discovered=selected=80;cleanup 五项全 PASS(remoteProcess / remoteWorkspace / testcontainersContainers / testcontainersVolumes)。
- L2 run:discovered=selected=results=24,`business=PASS`,`cleanup=PASS`。
- 两份 seed:`business=PASS`,`cleanup=PASS_PRESERVED_DEV_STATE`。

**business 与 cleanup 均无红**。本轮 NO-GO 全部来自静态代码符合性,与 cleanup 无关。

## 授权边界

- 本文件是静态 review 结论,**不授权**下一 Roadmap step、DEV 操作或任何数据操作。
- M-01 与三条 S 均在既有批准边界内,可直接交 Codex 自主修复,**不需要 Dexter 裁决**。
- 唯一可能需要 Dexter 一句话的是 M-01 的产品语义:品牌复制遇到"目标已有同 code 但更深"的分类时,应当**拒绝整次复制**,还是**把子树改挂到目标那条分类下并压平到三级内**。两种都能守住不变量,业务含义不同。在此之前实现方按"拒绝并给 typed problem"处理即可,那是更保守的一侧。
- N-06 指向 `HANDOFF.md` 欠账登记,不作为本批交付条件。
