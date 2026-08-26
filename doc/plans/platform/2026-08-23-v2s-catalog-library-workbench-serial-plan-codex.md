# 商品库唯一工作区 · 串行实施计划

- 日期：2026-08-24
- 需求正本：`doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md`
- Journey：`doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md`
- 交互：`doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md`
- IA：`doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md`
- 详设：`doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md`
- 四轴审计 intake：`doc/review/platform/2026-08-23-v2s-catalog-library-workbench-four-axis-design-audit-intake-codex.md`
- 状态：`READY_FOR_DEXTER_CLAUDE_DESIGN_REVIEW`
- 授权：只授权设计工件；不得据本计划开始实施、改契约/代码、跑测试或执行任何动态环境动作。

## 0. 实施纪律

未来获得实施授权后，工单为本文件全文，执行纪律唯一正本是
`doc/platform/implementation-task-template.md`。每个 CP 写前必须逐点双读其 RECALL：原需求、Journey/交互、
IA 对应级联、详设 CP、六维 memory 命中、owning source 与可复用能力；focused proof 后用同一组原文回读。

所有实现都必须遵守以下硬约束：

1. 服务端事实只住 RTK `currentData`，整单草稿只住 `useCatalogItemDraft`，界面瞬态只住最近组件/hook。
2. 工作区只用一个 `CatalogWorkspaceTask` 判别联合控制第一层任务，禁止多个 open 布尔。
3. View 与 Editor 分组件；View 零 Form/disabled 编辑控件；九事实族 View/Editor 分文件。
4. 控件上游变化严格执行 IA §3 的级联清理；没有写明的业务联动不得临场发明。
5. 分类四场景统一单选 TreeSelect，候选资格与原因来自 owner task read；不平铺、不本地猜。
6. 动态集合使用 owner ref/code 或持久化 editorId，禁止 index 做回写、异步结果、错误、testId 身份。
7. generated 文件只由 P1→tokens→M1→bindings→P3 生成链写入；禁止手改和 fallback。
8. 每次报告 first failure、last known good、broken boundary、business、cleanup；静态/HTTP/L2/UAT 档位分开。
9. 用户可见 copy 只使用 IA/interaction 基线；“商品元数据/当前结果域”仅限冻结入口，`SKU/预检/重新读取失败`
   与技术词不得进入 DOM/aria/toast；商品编码与规格编码是允许且必须正确标注的业务字段。
10. browser L2 不使用 DEV seed。测试数据只来自每 run TEST fixture owner commands；受管 runner/readiness 或授权
    任一缺失时 fail closed，旧 41 case、0 active case、focused/static 均不能报本批 L2 PASS。
11. 商品与生产标签是 0..1：商品草稿用 nullable 单值，SKU 制作覆盖和点单选项制作影响都不得携带生产标签；
    本批不实现生产路由、生产工作台、队列、默认路由或 fallback。
12. 商品表精确十列全部默认可见，每格最多四行，超出省略并 Tooltip；横向滚动是正常交互，不得以屏宽为由删列、
    合并斜杠列或隐藏来源/库存与 BOM。

## 1. CP-00 · 实时基线与锚点

**RECALL**：formal §5/§10、interaction §4.2、IA §2/§9、详设 §0/§9b。

1. 实时复算 catalog operations、全平台 operation union、商品库 UI 消费的 16 read/33 mutation、acceptance annotations、47 surface、IA-ID、problem exact-set。
2. 对详设 §9b 20 个锚点逐文件执行 literal count；每项必须=1。
3. 枚举当前 static/compile/typecheck/focused 门与退出码，不使用文档快照。
4. 复算 L2 当前树：18 scenario/41 case、39 TEST dataset、`FRAMEWORK_ONLY/ACTIVE_CASES=0`、受管 browser runner
   缺失、affected registry 无 catalog surface；任一事实不同先更新 design。
5. 记录当前 first failure；任一分母漂移即停机修订设计，不继续改代码。

**预期设计基线**：57 catalog、238 platform、80 annotation、47 surface、8 IA-ID、46 problem、20/20 anchor。

## 2. CP-01 · 契约生成源与红夹具

**RECALL**：formal §4.2/4.8/6.1、IA §3.1/3.2、详设 CP-01/§5、P1 owning source/README。

1. 在唯一 operation design source 与 P1 中新增：
   `getOperationsCatalogCategoryCandidates`、`getOperationsCatalogItemSkus`。
2. 定义 category lazy hierarchy cursor：`usage=ITEM_ASSIGNMENT|CATEGORY_CREATE|CATEGORY_REPARENT`、currentCategoryRef、
   parentCategoryRef、keyword、cursor、pageSize；row 含业务 path、selectable、disabledReason。
   新建/编辑/批量移动商品固定使用 `ITEM_ASSIGNMENT` 且 currentCategoryRef 为空；分类挪父固定使用
   `CATEGORY_CREATE` 时 currentCategoryRef 必须为空且第三级候选不可选；`CATEGORY_REPARENT` 时 currentCategoryRef 必填，移动后不得超过三级；从品牌复制复用目标同编码分类而导致任何待复制子树超过三级时，拒绝整次 execute，绝不压平、改挂或部分写入。usage 不进入用户可见文案。严格照详设 §5.1 的
   root/null、keyword、1..100、cursor/nextCursor、path segment、稳定排序与 disabledReason 对偶规则生成，不自行换字段。
3. 定义 parent-scoped SKU cursor page；parent item page 增 `hasSkuChildren`、规格数/维度/价格、owner 排序的
   `categoryPathLabels` 和结构化 `inventoryDeductionSummary`；SKU row 增稳定身份、属性组合、价格、状态、默认标识、
   同形扣减摘要、图片和自身更新时间。扣减摘要按 `grain + mode + consumptionUnitSnapshot/bomLineCount` 声明，
   禁止前端从库存对象数/BOM 数猜业务方式。`standardSalePrice` 保持 nullable；从商品列表/详情 read schema 退休
   `missingPriceCount`，不得把合法空价格生成成风险字段。
4. 按详设 §5.1.1 分别冻结 `CORE_CROSS_SCOPE_ASSERTION_SET=6`、`UI_SCOPED_OPERATION_READS=15`、
   `PUBLIC_NON_SCOPED_ASSET_READS=1`；两新 GET 同批补 problem、face、scope、database budget、RTK tags、
   placement、operation binding、read-only connection scope。
5. generator red fixtures：缺 path/selectable/disabledReason、把 SKU page 改 bounded 截断、缺 budget/tag/binding，
   或把 public asset 错并入 operations scope，任一必须红。
6. 同批收敛既有契约：商品 save/detail/page 的 `productionTagRefs` 改为 nullable `productionTagRef`；navigation 新增
   `productionTags[]`；item page query 新增专用 `productionTagRef`；制作 profile/SKU override 删除标签字段，option effect
   删除 `addProductionTagRefs`；生产标签定义的无业务语义 `tagKind` 也从 contract、owner、持久化、copy、seed 与 UI 退役。
   schema/self-test 的 singular/zero-legacy red mutation 必须真红。

**FORBID**：写接口、叶子规则、generated 手改、无限/待定预算、全详情 fallback。

## 3. CP-02 · catalog owner/task read/edge

**RECALL**：IA 不可见维度、详设 CP-02/§7、`CatalogOwnerApi`、`CatalogOwnerService`、
`CatalogTaskReadService`、`CatalogInventoryCoordinator`、controller、backend coding standard。

1. owner 增两条且仅两条公开 read；task service 分别唯一消费。
2. SQL 侧完成 scope、filter、业务顺序、count、cursor；请求级只读 scope 借一次连接。
3. category 普通浏览按 parent lazy page；搜索按命中返回祖先路径；reparent usage 由 owner 标自身/后代不可选。
4. SKU page 只投影列表摘要，不做逐 SKU detail/inventory N+1；父 page 的 SKU 聚合不能随父行数线性查询。
5. edge 复用现行 `readRequest`/scope/session/problem mapper；两个 controller route 调 coordinator/task read。
6. focused/owner tests 先红后绿：过页、同名路径、reparent、无 SKU、scope、稳定排序、预算形态。
7. `CatalogItemReferenceFacts` 将 `PRODUCTION_TAG` 改为 singular replace/read；whole-save 对 0→1、1→0、1→另一个、
   停用既有、新绑定停用、越 scope 和双值篡改做 owner 判定；navigation/item page 以 set-based read 返回生产标签节点、
   去重父商品 count 和筛选结果，禁止逐行 detail/N+1。
8. copy/preflight 只映射商品级单值；无法唯一映射即 typed conflict，不丢弃、不选第一个。
9. 同 CP 新增 production-tag 只读 preflight 与 Flyway migration：直接分类持久化的 item `preparation_profile`、SKU
   `preparation_override.profile`、option `preparation_effect` 与 reference 四处标签事实，不把运行时派生
   `sections.productionTagRefs` 当存储；只折叠 0、商品单值及不改变有效结果的等值冗余。SKU 显式空集合清除非空商品
   canonical、nested 不同值、relation 额外值或畸形任一非零均 fail closed；Flyway 事务内重跑同 predicate，关系表增
   partial unique index。
   这里只写源码与静态/focused proof，真实 migration 执行仍需另行授权。

**FORBID**：内存分页、跨 schema 写 JOIN、UI 资格推导、默认 OWNER 分类止血。

## 4. CP-03 · 全生成链

**RECALL**：scripts/README、P1/tokens/M1/P3/bindings owning README、详设 CP-03。

按序执行并在每步保留输出：

1. P1 emit/write/check/self-test；
2. catalog-inventory workspace command tokens write/check/self-test；
3. backend performance M1 emit/check/self-test；
4. operation-handler-bindings write/check；
5. P3 frontend generate/self-test；
6. registry/OpenAPI/generated Java/TS/RTK/locator exact-set。

目标在 CP-00 基线未漂移时为 59 catalog、239 platform。任何 missing/extra/budget/tag/binding 首败先修生成源，
不得手改产物。

## 5. CP-04 · 前端状态骨架

**RECALL**：IA §2 全文、详设 CP-04、frontend standard §3-B/D/E/F/G/K、foundation capability lookup。

1. 新建 workspace task reducer；迁移 View/Edit/Config/Copy/Create/Category/Batch 八 variant；删除平行 open state。
2. 新建 `useCatalogItemDraft`：typed nine slices、dirty/error、hydrate-once、stale version、仅用于异常关闭/刷新后的 sessionStorage 恢复/放弃、
   active section/anchor；敏感/临时资产排除。
3. 新建 `useCatalogConfigLibrary`：六库、查询 identity、search、parent/definition selection、definition editor draft；不建立 return token。编辑内元数据维护由 Editor child task 持有瞬态 placement，且不读写过渡草稿。
4. 新建 `catalogTestIds.ts`，组件只能引用常量；动态行使用业务码/editorId。
5. 复用 foundation Drawer/submission/overlay/cursor 能力；不得改 foundation 承载 catalog 业务 state。
6. focused proof 覆盖 task transition 全表、dirty refetch、版本 stale、稳定身份重排、三关闭路径、编辑内元数据子任务。

## 6. CP-05 · 工作台、树形表与分类 TreeSelect

**RECALL**：U-CATUI-05/06/07、interaction 线框1/5、IA §3.1/3.2、详设 CP-05、V4 Table 只读参照。

1. 保持冻结顶部工具区与结果域筛选区的结构、顺序、文案和相对位置。
2. 新建专用 `CatalogItemListTable` 和纯 presenter；默认 AntD Table tree-data、受控 expanded keys、stable row key。
3. 父展开只调 SKU page；loading/error/load-more 为共享列宽子行；无 SKU 无箭头；SKU checkbox 占位不可选。
4. 删除 `expandedRowRender` 文本块与 `acceptedPage` mirror；全部 query 读 `currentData`。
5. 将新建、编辑、批量、分类挪父四处统一接入同一个 category hierarchy presenter/协议。
6. 实现 IA 工作台级联：brand/scope、树、filter、reset、cursor、selection、expand、View open/close。
7. 十列精确按商品→商品形态→价格和单位→规格或选项→商品属性→制作信息→库存与 BOM→更新时间→状态→来源，
   全部默认可见且不提供隐藏入口。智能视图、标签、全部商品等跨分类结果直接消费 `categoryPathLabels`，不得从
   navigation 可见节点拼路径。
8. 按 formal §4.2 的单元格顺序、主次字体和最小宽度实现；每格最多四行，超出由第四行“还有 N 项”/ellipsis 与
   Tooltip 给完整有序内容；**规格或选项列除外，前四行必须都是实际规格或点单选项，超出只由 Tooltip 给完整有序内容。**
   `scroll.x` 按十列求和，选择/展开/商品列固定。横向滚动是正常交互；禁止删列、窄屏改卡片、
   商品列 240px，父图 72px、规格图 60px；有规格父行的显式展开控件、无规格不显示入口，且规格懒加载的 loading/error/retry/load-more 绑定同一父行。
   复制 V4 第二条 range 滚动控件或用复合斜杠列止血。focused proof 与 L2 blueprint 同步断言每种单元格、横滚和恢复。
9. 商品/规格价格为空时统一中性显示“未设置”；删除列表、View、Editor 中“缺价/缺少价格/缺价数”的风险表达，
   且不改变任何商品 actionAvailability。focused/L2 用合法无价商品证明可查看、可编辑其它事实；不得把菜单必须有价
   的准入复制进 catalog owner。
10. 树上新增与“商品标签”同级的“生产标签”，二级列出全部生产标签及状态/count；选择后只传
    `productionTagRef`，清旧 selector/cursor/selection/stale expanded。停用标签可筛既有绑定但不可作为新候选；展开父行
    显示其全部规格，父 total 不含规格。

## 7. CP-06 · 纯只读 View

**RECALL**：formal §4.3、interaction CATUI-VIEW/IMAGE/LIFECYCLE/GOVERNANCE、IA-CATUI-02/08、详设 CP-06。

1. 新建独立 View shell 与九事实族 View 文件；不 import Editor/Form 控件树。
2. 标题/首屏按维护者、店长、后厨、库存员的问题组织业务摘要；空态含影响与下一步。
3. 父行进入概览；规格行进入同 View 并定位规格；关闭恢复工作台上下文和触发焦点。
4. actionAvailability 是动作唯一来源；普通/危险动作分组，拒绝灰按钮阵列。
5. 图片预览、生命周期、治理为一个 child task；第三层仅 confirm。
6. render proof 搜索并断言 View 中 disabled Input/Select/Radio/Switch/InputNumber/TextArea、raw enum/ref/UUID/
   problem code/internal key 为零；商品编码与规格编码必须以业务标签正确显示，不得被误禁。

## 8. CP-07 · 新建、Editor、九事实族与恢复

**RECALL**：formal §4.4-4.6/§8、IA §2.3/§3.3/IA-CATUI-03/04、详设 CP-07、既有单位/库存/BOM/制作设计。

1. 新建商品改中型 Modal，最小身份原子创建；成功 readback 后显式 task transition 到 EDIT。
2. Editor 宿主只装配；九事实族各自 View/Editor 分文件，新增字段不改宿主。
3. 逐行落实 IA §3.3 cascade：分类、单位继承/覆盖、价格粒度、图片、标识、SKU、属性、选项、制作、库存/BOM、套餐。
4. 所有集合行以 owner ref/code 或 editorId 定位；删除 index 回写、上传归属、错误路径与 testId。
5. 子任务使用 working copy；Apply 写 parent draft 并 dirty，Cancel 零写。
6. whole-save 前按 field/row/group/section 定位；成功才清 session；known reject/unknown/version conflict 分流。
7. 编辑内维护元数据严格执行 open child task→维护对应库→关闭 child task→焦点回原触发控件；EDIT 不关闭，草稿不持久化/恢复，相关候选失效但 draft 的值、错误、区段与滚动位置不变。
8. 制作信息区的生产标签为商品级可清除单选；SKU 制作覆盖只含显示名称/时长/说明；选项影响只含非负时长增量与
   有序说明。提交体、draft type、testId 和错误定位均不得恢复标签数组、SKU 标签或选项标签。

## 9. CP-08 · 六库配置抽屉

**RECALL**：formal §4.7/4.8、IA §2.4/§3.4/IA-CATUI-05、详设 CP-08、frontend standard §3-K。

1. 将现有万能 Modal 改为全高 Drawer：左六库固定导航，右内容区独立 loading/error。
2. 简单库：商品标签、单位、生产标签，列表即详情，只开小 Modal/confirm。
3. 父子库：规格维度/值主从两列，父切换只清/取子侧。
4. 复杂库：属性/点单选项列表与详情编辑同栏切换，删除嵌套 Drawer。
5. 逐项落实填写方式、选择方式、父级、物料候选的级联；停用与历史绑定边界不变。
6. mutation 成功按 IA §4 精确 invalidation；删除单一 `dictionaryRevision` 粗信号。
7. 配置失败不得清商品草稿；从编辑打开时关闭 child task 后直接回到仍打开的编辑面，工作台不得呈现继续编辑入口。

## 10. CP-09 · Batch、Copy、治理结果

**RECALL**：Journey 06-08、interaction CATUI-BATCH/COPY/GOVERNANCE、IA §3.4、详设 CP-09。

1. 批量 Modal 三态；提交冻结父 item+version；SKU 永不进入集合；partial receipt 权威展示。
2. 失败项保留选择，成功项从选择移除；业务结果与 list/navigation refresh failure 分开。
3. 本地/品牌 copy 共用向导骨架但 flow 文案/来源/目标不同；输入变化使 preflight token stale。
4. execute 结果逐项显示，不把 unknown/5xx 降级成业务失败，也不只 toast。
5. 治理字段变化需重新检查影响；执行成功采用 readback；治理不混入普通 Editor。

## 11. CP-10 · focused、static 与 L2 蓝图

**RECALL**：formal §9、IA §5/§7、详设 CP-10、既有 L2 blueprint/P1/locator bindings。

1. reducer/cascade tests 覆盖 IA §3 每一行，至少一正一反；不能只加标题。
2. View/Edit/Config/Table/Batch/Copy render proof 覆盖布局分支、非法入口、空/加载/失败、长内容、业务文案。
3. `catalogTestIds.ts` 逐字实现详设 §11b.1 的 47 surface 映射与 §11b.2 control API；组件引用、locator
   bindings、AST 交互控件枚举三方对账，字符串散写、index 身份或自造 slug 均为红。
4. 扩既有 L2 blueprint：旧 18 scenario/41 case 保留，本批新增 8/24，generated 总数 26/65；本批 active exact-set
   只能在全部 readiness 通过后原子设为 24。移除 spec 内复制的 41 常量，分母由 generated policy 消费。
5. 按详设 §11c 在 fixture catalog 新增且仅新增 8 个 TEST dataset（39→47），其中 FIND/EDIT/CONFIG dataset 必须
   覆盖生产标签树筛选、商品单选/清除、停用既有绑定与非法双值/SKU/选项篡改；每个 case 明确
   preState/actionInput/expectedReadback/unchangedReadback；owner HTTP setup/readback，不读取 seed/report。
6. 实现唯一 `scripts/test/browser-l2` 受管 runner：本机 Spring Boot/双 Vite/Playwright、受管 tunnel、每 run 远端
   DB/资产 namespace、manifest/identity/heartbeat/log、business 与 local/remote cleanup；不建第二套 spec/DSL。
7. 同批实现详设 §11c.6 的 `scripts/test/browser-l2-credentials.mjs`：只复用受管 host trust/bootstrap 形态，不读取
   DEV manifest/credential/session；0700 run 目录与 0600 credential/storageState；DB/资产/HMAC/TEST 登录/session 六类
   allowlist 按 child process 最小注入。缺失、额外、格式/mode 错、陈旧、跨 run、错 namespace 或泄露必须在
   fixture/browser business 前 fail closed，owned secret/session cleanup 仍执行并 readback。
8. `catalogTestIds.ts` 的 47 surface 与全部 concrete interactive controls、locator bindings、L2 touched 双差集为零；
   affected registry 精确选中 `OPERATIONS-CATALOG-LIBRARY`，禁止 fallback 证明本批。
9. 按详设 §11d 生成 action-request join 和 expected-event matrix；每个 action 声明网络 REQUIRED/FORBIDDEN/
   BACKGROUND_ALLOWED 与 operation exact-set。无新日志立即 fail closed。
10. 按详设 §11c.5 为每个 action 声明 operation `maxRequestCount`；每个 fresh browser case 先计入登录、会话与商品工作台
    首次读取的公共 HTTP envelope，再从 generated performance budget 与 42.7ms 同口径基线生成 24-case/整场
    `l2-timing-budget-report.json` 和 timeout，禁止逐 case 魔法值。缺预算、非法倍数、公共 envelope 漏算、
    registry 漂移、报告与 runner timeout 不一致必须各自真红。
11. 每个写 case 有失败后 owner facts/version 不变 oracle；元素存在/页面打开不算 oracle。red fixture 删除一个
   testId binding、Journey case、fixture unchanged、category path、SKU cursor、error placement、requestId join、DB row、
   lastKnownGood/brokenBoundary、secret、namespace binding 或 cleanup readback，门必须真红；另加 undeclared secret、
   required secret 格式非法→`L2_SECRET_FORMAT_INVALID`、expires epoch 过期→`L2_SECRET_STALE`、non-0600、旧 run
   session 与 secret-shaped manifest/log 字段六类独立真红变异，禁止用一个泛化 throws 合并证明。

本 CP 实现 L2 的静态准入能力和 runner 本体，但不启动浏览器；browser L2 实际执行仍需 Dexter 单独授权。

## 12. CP-11 · Acceptance、预算与 seed

**RECALL**：backend acceptance standard、详设 §10b/§11、CatalogAcceptanceScenarios、P1 seed/executor、性能预算正本。

1. 合并三对同 operation scenario，逐 subcase 保留详设 §11 的六行 assertion-preservation checklist；
   原 fixture/request/readback/red mutation 一条不删，annotation 80→77。
2. 将混用 navigation/items 的 `catalog.tag-navigation-and-filter` 拆为两个 operation-identity 精确场景；再新增
   `catalog.item-sku-page-contract` 与 `catalog.category-candidate-hierarchy`，annotation 回到 80。生产标签 navigation/count
   放 navigation 宿主，`productionTagRef` 筛选放 items 宿主；每个业务断言实际 request 与 annotation operation 一致。
3. 每条 fixture 超页；断言 cursor、total、无重漏、scope、category ancestor/reparent、父列表分母。
4. 测量两新 GET 的 DB/connection；connection≤1，预算不超设计阈值；超限修查询，不调高止血。
5. 只改 P1 `catalogDefinitionSeed` 与 seed executor；补父+3规格、无规格、深分类、十列长短/空值、九区段空/非空、
   启用/停用生产标签、0/1 绑定；删除 seed 中 production profile/SKU/option 的标签字段，严格断言无商品多标签。
6. 为 CP-02 migration/preflight 补静态、空库与冲突红夹具；真实 migration 不在本 CP 执行。
7. seed static/self-test 严格 readback；不执行 reset/start/seed，除非 Dexter 后续明确授权。
8. DEV seed 与 L2 TEST fixture 分母、artifact 和执行入口严格隔离；共享业务 helper 不等于共享运行数据或证据。

## 13. CP-12 · 全链验证（实施获批后按届时运行授权）

**RECALL**：AGENTS 动态与 Testcontainers/DEV 联动、scripts/README、managed runtime skill、详设 CP-12。

1. 生成链 check/self-test、node static gate、backend compile/test compile、frontend typecheck/focused test。
2. 若 backend-acceptance 获授权：运行前发现 manifest-owned DEV 则按联动规则 stop；business/cleanup 双 PASS 后且原先
   存在 DEV 才 start 最新代码；失败不自动重启；不 reset/seed。
3. Testcontainers manifest 必须 discovered=selected=results=80、failure=0；两新 operation 在 run events 中出现，budget/connection 通过。
4. browser L2 只有新授权且 readiness manifest 的 `businessStatus=PASS`、`setupCleanupStatus=PASS`、
   `cleanupStatus=PENDING_HELD` 且 `lifecycle=HELD_FOR_BROWSER_L2_RUN` 才走 `scripts/test/browser-l2`；运行前 fixture setup/readback、
   §11c.5 timing budget report 与 §11c.6 secret/session allowlist、0600 mode、run/namespace binding PASS，执行中
   24/24、concrete testId 差集空、
   action-request-completion-DB join 完整，结束时 business、local secret/session cleanup、local process cleanup、remote DB
   cleanup、remote asset cleanup 全 PASS。原先 DEV 是否运行不改变这条隔离拓扑，也不把 DEV credential/seed 带入。
5. seed/reset/start、browser L2、UAT 只有新授权才执行；未授权明确留在 UI 未验证清单。
6. 每个动态 run 从 manifest/log 读取 firstFailure、lastKnownGood、brokenBoundary；`NO_NEW_EVENT`、
   `LOG_NOT_AVAILABLE`、DB join mismatch 立即定位，不等 timeout。任何首败或同 signal 重复失败调用 systematic
   debugging，根因修复后 fresh run，不延长 timeout/轮询止血。

## 14. CP-13 · 独立复核与交付

**RECALL**：independent review governance、cs-review、Claude handoff standard、详设 CP-13。

1. 新建 `REVIEW_TARGET=IMPLEMENTATION` fresh 独立审查；设计 GO 不代替实施合理性复核。
2. reviewer 重开 20 anchors、59/239/80 exact-set、三状态住址、IA 级联、46 problem/失败 copy class、控制权矩阵、
   用户技术词扫描、testId/L2 26/65+active24 双分母、8 TEST fixture、runner/join/cleanup 与 seed strict readback。
3. 作者逐条做 CONFIRMED/PARTIALLY/REJECTED/UNVERIFIED/DEXTER_DECISION intake；最多两轮。
4. 最终交 Dexter/Claude：first failure、last known good、broken boundary、business、cleanup、生成链、80/80 manifest、
   budget/connection、seed、UI 未验证清单与 M/S/N。

## 15. 停机与完成条件

只在详设 §13 八类停机条件或实施模板四类停机条件触发时停；不得加 fallback、兼容层、缩范围、改业务规则。

```text
SERIAL_PLAN_STATUS=PROPOSED_FOR_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
COMPLETION_REQUIRES=all CP business proof + cleanup proof + fresh implementation review
DYNAMIC_ACTIONS=separately authorized only
```

> 2026-08-26 观察问题整改附录：展开入口、生命周期体验 seed 与引用/作废表达按
> `2026-08-26-v2s-catalog-workbench-observed-remediation-design-addendum-codex.md` 覆盖。
