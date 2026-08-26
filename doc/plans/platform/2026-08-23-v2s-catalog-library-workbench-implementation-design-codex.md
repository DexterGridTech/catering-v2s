---
title: 商品库唯一工作区 implementation-facing 详设
status: READY_FOR_DEXTER_CLAUDE_DESIGN_REVIEW
date: 2026-08-24
---

# 商品库唯一工作区 implementation-facing 详设

## 0. 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md
JOURNEY_REFS=doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md#J-CATUI-01..J-CATUI-08
IA_REF=doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md
FOUR_AXIS_AUDIT_INTAKE=doc/review/platform/2026-08-23-v2s-catalog-library-workbench-four-axis-design-audit-intake-codex.md
AUTHORIZED=正式需求、Journey、交互、IA、implementation-facing design、串行实施计划与设计期独立审查
NOT_AUTHORIZED=生产代码、契约/生成物修改、迁移真实执行、测试执行、DEV、reset、seed、browser L2、UAT、部署、数据操作
IMPLEMENTATION_AUTHORITY=false
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
BASELINE_CATALOG_OPERATIONS=57
BASELINE_PLATFORM_OPERATIONS=238
TARGET_CATALOG_OPERATIONS=59
TARGET_PLATFORM_OPERATIONS=239
UI_OPERATION_DENOMINATOR=49（16 read，含既有 public asset read；33 mutation）
```

2026-08-23 的历史输入快照为 57/238；CP-00 在当前树重算后，实施目标收敛为 59/239。
若后续开工树再漂移，不把 59/239 当权威，先更新本设计并重新 review。

2026-08-24 最终裁定增补：本设计现同时承载十列表格、商品级单一生产标签、生产标签树筛选及旧多值制作标签
模型的 fail-closed 迁移。凡旧段落仍出现“来源默认隐藏”“七默认列”“制作处理标签”“生产标签数组”、
SKU/选项值可增减生产标签或“本批不改 DB 事实形状”，均以 §11e 为唯一权威覆盖，不得择旧条款实施。

## 1. 真实业务目标与方案比较

### 1.1 结构性问题

当前商品库除了目录树之外，把父商品与规格、查看与编辑、简单字典与复杂定义、业务草稿与服务端事实都压进
少数巨型组件。结果是规格不可比较、disabled 表单冒充详情、弹层可叠出多条任务、候选与草稿互相覆盖、
切换范围后旧事实仍可能停留，实施者无法回答“这个控件由谁控制、上游变化后哪些值必须清理”。如果只改布局，
这些状态错误会在新皮肤下继续存在。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 保留现有巨型组件，只调整 CSS、文案与 disabled 状态 | 改动小，但服务端镜像、多布尔弹层、index 身份和 View/Edit 混树全部保留 | 拒绝，因为没有解决任务和状态边界 |
| B. 每类任务拆成独立路由/配置页 | 状态边界清楚，但破坏 Dexter 已裁“关于商品的操作都在一个工作区”，丢失树表上下文 | 拒绝，因为改变已确认 Journey |
| C. 唯一工作台 + 互斥任务 reducer + View/Edit 分壳 + 三状态住址 + 两个闭合 task read | 保留工作台上下文，同时让 owner 事实、业务草稿、UI 瞬态各有唯一控制者 | **采用** |

我选了 C 而不是 A/B，因为它用最小的两个读契约缺口闭合父/规格同表与分类树选择，同时删除当前错误的
状态组织，不新增独立页面、并行编辑语义或新的写业务规则。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-00 | 实时分母、锚点与红基线 | contract/frontend/test | 59/239、80 annotation、47 surface、20 anchor、当前红门 | 无 |
| CP-01 | 契约生成源与两个 task read | catalog contract | category candidate、SKU summary page、parent summary、RTK tags/budgets | CP-00 |
| CP-02 | catalog owner/task-read/edge | catalog owner + operations edge | scoped SQL、cursor、业务路径、可选原因、两条 HTTP read | CP-01 schema |
| CP-03 | P1→tokens→M1→bindings→P3 生成链 | generators | 59 catalog、239 platform、generated backend/frontend | CP-01/02 |
| CP-04 | 前端状态骨架 | operations-admin | task reducer、draft/config hooks、testIds、problem map | CP-03 |
| CP-05 | 工作台与父/规格树形表 | operations-admin | 冻结区保留、Table tree-data、TreeSelect 分类任务 | CP-02..04 |
| CP-06 | 查看与生命周期/治理 | operations-admin | 纯只读 View、业务摘要、动作可用性、治理子任务 | CP-04/05 |
| CP-07 | 新建、编辑、九事实族与恢复 | operations-admin | 超宽 Editor、typed draft、稳定身份、session recovery | CP-04/06 |
| CP-08 | 六库配置抽屉 | operations-admin | 简单/父子/复杂三形态、编辑内元数据子任务 | CP-04/07 |
| CP-09 | 批量、复制与结果 | operations-admin | 三态批量、复制向导、精确 readback/refresh | CP-04/05 |
| CP-10 | focused/static/L2 准入 | frontend/contract/test/scripts | reducer/cascade/render proof、testId 双分母、65-case 单链、TEST fixture、受管 runner 与诊断 join | CP-04..09 |
| CP-11 | acceptance、预算与 seed 设计落地 | backend/test/seed | 80 annotation、2 新 read 场景、预算实测、丰富体验夹具 | CP-02/03/10 |
| CP-12 | 全链验证与受管动态（动态项需届时授权） | scripts/test | 静态、compile/typecheck、80/80；browser L2 仅在 readiness+授权同时成立时运行 | CP-01..11 |
| CP-13 | fresh implementation review 与交付 | independent reviewer | verdict、first failure/business/cleanup/UI 未验证清单 | CP-12 |

## 3. 横切机制对照表

| 机制 | ① 用哪个现成能力/规范 | ② 如何验证 | ③ 无现成时必须符合的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `OperationsSessionResolver`、`OperationsCatalogInventoryController.readRequest`、`CatalogScopeLookup` | [acceptance] 两个新 read 与 context/navigation/items/item 用 A 身份读 B 节点全部拒绝 | 与现有 controller read 同形：先解析 session/scope，再进 task read；不得从 query 自信任 dataNodeRef | context、navigation、parent items、item detail、category candidates、SKU summaries 共 6 条 read |
| 写授权与 grant 复核 | 现有 generated operation authorization + coordinator command context | [acceptance] 33 个写 variant 的篡改请求由 owner 拒绝且 version/事实不变 | N/A；本批不新增写 operation，不改变 grant 语义 | interaction §4.2 的 33 个 mutation variant |
| 跨 owner 写与事务 | `CatalogInventoryCoordinator`、现行 `REQUIRED` coordinator 和 owner command API | [acceptance] whole-save 任一目标 owner 拒绝则整单已存事实不变 | N/A；只重组 UI，不把当前事务拆成区段保存 | save item、inventory rules、option material、asset ref、copy、promotion；其它写为单 owner |
| 集合形态与分页 | foundation charter §1-J、`collection-boundary-modes.md`、`useCursorStack`/`useCursorCandidates` | [acceptance] SKU 和 category fixture 超过单页，第二页可达、无重漏、total≠本页长度 | category 使用 lazy hierarchy cursor（根/子级或搜索命中+祖先路径）；SKU 使用 parent-scoped cursor page | 父 item Page、SKU Cursor、category Cursor、6 库现有 Page/Bounded、copy/inventory candidate Cursor、detail 子聚合 |
| 缓存失效 / 改完刷新什么 | generated RTK tag policy、frontend standard §3-J | [focused] 每个 mutation 只触发 IA §4 指定 query；其它库 fetch spy 为 0 | 缺 tag 关系时只改唯一 P1 tag policy source；不得加 revision counter | 33 mutation、内容页统一刷新、编辑内元数据子任务候选刷新 |
| **RTK 数据读取与加载判定** | frontend standard §3-B；generated RTK hooks | [focused] query args 改变时旧 `data` 不渲染，`currentData` 未就绪显示局部 loading | 新两个 read 由 P3 生成 hook；App 不手搓 fetch | 16 read operation、父表、SKU child、category TreeSelect、View、图片、6 库、候选、copy |
| **同一事实只有一个住址** | frontend standard §3-E；IA §2 | [static+focused] `acceptedPage` 归零；detail/page/tree/actionAvailability 无 `useState` mirror；dirty refetch 不改 draft | App 新建 `useCatalogItemDraft` 与 `useCatalogConfigLibrary`；不得把它们放 foundation | server facts、item draft、config draft、workspace task、list/picker transient 全集 |
| **失败可见且原因不得改写** | frontend standard §3-D/3-K-4；IA §6 | [focused] 46 code exact-set 全映射；unknown/refresh failure 不冒充 business failure | catalog 专属 map 与 generated exact-set 对账；用户文案不含 code/raw detail | 46 catalog problems、transport unknown、query failure、batch refresh failure |
| owner 错误到 HTTP 的映射与注册处 | `CatalogOwnerApi.Problem`、operations edge problem mapper、P1 operation problemCodes | [acceptance] 两新 read 只声明 VALIDATION_ERROR/SCOPE_FORBIDDEN/NOT_FOUND（SKU）；不注册伪 code | 与现有 catalog operation 同一 mapper；零调用者 problem 不新增 | 59 catalog operations，重点为 2 新 read 和 33 UI writes |
| 幂等键构成与重放语义 | frontend standard §3-G；`useDrawerFormLifecycle`、`useSubmissionLifecycle` | [focused+acceptance] 同意图重放同 readback；改变字段产生新意图；unknown 精确读回 | N/A；read operation 无幂等键 | create/edit/config/category/batch/copy/promotion/asset/production-tag 的 33 writes |
| **该用生成物的地方不得手搓字符串** | P1、tokens、M1、operation-handler-bindings、P3 | [static] operationId/path/problem/tag/testId locator exact-set；generated 文件手改为 0 | 新 task read 只进 owning generator/design contract，消费 generated constant/hook | 2 新 read、4 changed read models、33 write consumers、59 catalog metadata |
| 日志落点与脱敏字段 | AGENTS 日志硬约束、`operationsLogger`/`createObservedBaseQuery`、HTTP completion、DB operation tracker | [static+L2] `case/action/testId→requestId→completion→DB section` join；NO_NEW_LOG 矩阵与脱敏 red mutation | 新读只记 operation/cardinality/elapsed；runner 生成 join artifact、lastKnownGood/brokenBoundary；不记录 keyword/path 名称值、draft、raw body/SQL/bind | 24 L2 cases 的全部声明 action、2 新 read、workspace task transition、draft restore/save、candidate load、33 writes、runner phases/cleanup |
| 迁移回填与可逆性 | catalog 既有三段式 preflight + Flyway 事务内重复 predicate | [static+真实迁移另授权] 安全等值行确定性折叠；任一真冲突使 preflight/Flyway fail closed；单一关系有 partial unique index | 迁移前只读分类，报告不含名称、ref、说明或 raw JSON；禁止“取第一个”、双读、fallback 或默认生产标签 | 持久化的 `catalog_item.preparation_profile.productionTagRefs`、`catalog_sku.preparation_override.profile.productionTagRefs`、option `preparation_effect.addProductionTagRefs`、`catalog_item_reference(PRODUCTION_TAG)` 全集；运行时派生 `sections.productionTagRefs` 不冒充第四份存储 |
| 前端共享行为 | `adminDrawerSurfaceProps`、`adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useSubmissionLifecycle`、overlay lock、list/cursor primitives | [focused] X/Esc/mask/cancel 同结果；第一层 task 互斥；Shell lock 随 overlay | App 只新增 catalog-specific reducer/draft/config hook，不复制 foundation lifecycle | View/Edit/Config/Copy、Create/Category/Batch Modal、所有 child/confirm、父表与 12 candidate controls |
| 候选/下拉数据源 | IA §3、`useCursorCandidates`、manifest descriptors、2 新 task read | [focused+acceptance] 12 个候选控件逐项改变上游并断言下游清理；category/SKU 过页 | 仅 finite 与 cursor 两个生命周期；TreeSelect 是 cursor hierarchy presenter | category 4 场景、标签、单位、规格维度/值、属性、选项、production tag、BOM、composite、copy source |
| 编码与名称呈现 | business corpus G-05B/G-11、frontend standard §3-I/3-K | [render proof] 商品列父行四行、规格子行两行；每格最多四行且溢出 Tooltip；raw enum/ref/UUID 零命中 | 新 SKU row presenter 与 View section presenter 分开；商品编码/规格编码是业务编码；category path 由 owner read model 返回 | 十列父表、SKU child、View 9区段、6库列表/编辑、batch/copy/governance结果 |
| **会同时坏的东西是否已声明为原子组** | charter §5-C、P1→tokens→M1→bindings→P3 | [static] 新 operation 缺任一 wire/handler/budget/tag/hook/L2 locator 即链路失败 | 原子组 A=两个 task read 全链；B=task reducer+surface；C=draft store+九区段；D=testIds+locator+L2 | A:2 ops；B:8 workspace variants；C:9 fact families；D:catalog interactive exact-set |

## 4. 每个 CP 的门控

### CP-00 · 实时基线

- 失败条件：59/239、80 annotations、47 surfaces 或 20/20 unique anchors 任一不等于开工树；设计仍按快照继续。
- 不变量：只读复算；当前 first failure 真实记录。
- FORBID：不为吻合设计改源码、删场景、改分母。
- 验证：[静态] exact-set 脚本/`rg -cF`，不执行生成或测试。
- 形态理由：先复算而不是信设计数字，因为共享工作树会漂移。
- RECALL：正式需求 §5/§10、IA、interaction §4.2、本设计 §9b、Roadmap 授权。

### CP-01 · 契约生成源

- 失败条件：TreeSelect 仍靠平铺 navigation 猜可选性；SKU 展开仍读完整 item detail；跨分类结果的路径仍由 UI 从
  navigation 可见节点猜出；任一新 operation 无预算/tag/problem/consumer face。
- 不变量：新增且仅新增 `getOperationsCatalogCategoryCandidates`、`getOperationsCatalogItemSkus`；parent page、detail
  只增展示必要字段；parent page 每行含 owner 排序的 `categoryPathLabels` 与结构化 `inventoryDeductionSummary`，
  SKU page 每行含同形扣减摘要、价格、属性组合、状态、默认标识、图片与自身更新时间；operation 总数由 57→59；
  两条 GET 连接借用预算≤1；既有 save/detail/page 同批把 `productionTagRefs` 收敛为 nullable `productionTagRef`，
  navigation 增 `productionTags[]`，items query 增专用 `productionTagRef`，profile/SKU/option schema 删除标签字段；
  生产标签定义的旧 `tagKind` 同时从 contract、owner、Flyway、copy、seed 与前端退役，不保留隐藏默认值。
- FORBID：手改 generated OpenAPI/Java/TS；新增 write；把 Journey/IA ID 放 runtime；为树设未经裁定的叶子规则。
- 验证：[generator self-test] schema exact-set、red fixture 缺字段即红；[静态] operation count/budget/tag coverage。
- 形态理由：新增两个闭合 task read，而不是复用 detail/N+1 或让 UI 推导 owner 事实。
- RECALL：formal §4.2/§4.8/§6、IA §3.1/3.2、collection boundary、P1 source。

### CP-02 · owner 与 edge

- 失败条件：category 搜索丢祖先、挪父候选含自身/后代可选；SKU 第二页不可达或 total=本页；查询随父列表 N 增长。
- 不变量：SQL 侧 filter/order/cursor/count；read scope 内一连接；category row 带 path/selectable/disabledReason；SKU row 只含列表摘要；
  production tag navigation/count/filter set-based；whole-save 与 relation 表共同强制商品级 0..1。
- FORBID：内存分页、跨 schema 写、逐父详情、UI 回推可选性、默认把 unknown SQL 分类成 OWNER。
- 验证：[acceptance] 越 scope、过页、reparent negative；[performance] DB/connection budget。
- 形态理由：task read 由 catalog owner 输出用户任务事实，不暴露通用查询引擎。
- RECALL：owner API/service/task read/controller、backend standard、performance budget policy。

### CP-03 · 生成链

- 失败条件：任一 generated registry 不为 59/239、operation token/binding 缺项、P3 无 hook、预算 null/sentinel。
- 不变量：顺序 P1→workspace tokens→M1→operation bindings→P3；每步 emit/write 后 check/self-test。
- FORBID：手改 generated；用 fallback path/字符串；在实值未齐时留无限预算。
- 验证：[静态] 各生成器 exit=0、59/239 exact-set、调高差集空。
- 形态理由：保持既有单向生成链，避免第三个 registry。
- RECALL：scripts/README、P1/M1/P3 README、自检与性能 budget library。

### CP-04 · 前端状态骨架

- 失败条件：两个第一层 surface 可同时开；server fact 出现本地 mirror；重排后错误/上传结果回到错误行；脏 refetch 覆盖草稿。
- 不变量：IA §2 三住址逐字实现；一个 task union；draft/config hook 各一住址；testIds 单一模块。
- FORBID：foundation 内放 catalog draft；多个 open 布尔；index identity；持久化签名/授权/raw problem。
- 验证：[focused] reducer transition table、draft hydrate/dirty/stale/restore、config switch guard、testId exact-set。
- 形态理由：App 业务 hook + foundation 生命周期，各自在职责内，不造全局 store 或第二套 overlay。
- RECALL：IA §2、frontend standard §3-B/D/E/F/G/K、foundation capability lookup。

### CP-05 · 工作台、Table、分类

- 失败条件：冻结两区变化；SKU 仍文本块/嵌套表；无 SKU 仍有箭头；SKU 可勾选；筛选后旧 child 留存；分类平铺；
  跨分类路径缺失或由当前树拼接；隐藏/可关闭任一业务列；列宽触发请求或改变结果分母；
  为避免横向滚动压缩列、删除默认列、改卡片或增加第二条 range 滚动控件；把合法空价格渲染成缺价风险。
- 不变量：普通 AntD Table tree-data 默认；十列精确为商品、商品形态、价格和单位、规格或选项、商品属性、
  制作信息、库存与 BOM、更新时间、状态、来源，全部默认可见且不提供隐藏入口；`scroll.x` 按十列最小宽度求和，
  选择/展开/商品列固定左侧，表格自身横向滚动；父行与规格行共享列宽，每个单元格最多四行；
  父 total 不含 SKU；query identity 变化清失效展开；TreeSelect 四场景同协议。
- FORBID：为保 ProTable 加平行适配层；`expandedRowRender`；读取 detail 当 SKU page；从 tree 本地算 selectable。
- 验证：[focused] parent/child 十列 presenter、四行截断/Tooltip、loading/error/load-more placeholder、
  最小宽度/固定列/无 range 控件、cascade reducer；[L2另行授权] 键盘、横纵滚动、抽屉关闭后滚动恢复。
- 形态理由：采用 V4 验证过的普通 Table 父子表达；保留父子同表、身份列、懒加载和父行选择，删除技术/风险列、
  range 滑块与小字堆叠，并以业务单元格视觉正本替代。
- RECALL：U-CATUI-05/06/07、IA §3.1/3.2、V4 只读参照 hash。

### CP-06 · View

- 失败条件：View DOM 出现 disabled Input/Select、dirty hook、保存按钮、raw enum；点击 SKU 不定位对应规格。
- 不变量：View 九区段独立 presenter；业务摘要优先后厨/库存员/店长；动作取 actionAvailability。
- FORBID：共享 Editor 控件树；读取 draft；本地从 status 拼动作。
- 验证：[render focused] 零 Form 控件、空态/长内容、规格 focus、业务文案扫描；[acceptance] detail facts/action。
- 形态理由：专用只读 presenter 比“同表单禁用”更直观、可访问且状态来源单一。
- RECALL：formal §4.3、interaction CATUI-VIEW、IA-CATUI-02、business corpus。

### CP-07 · Create/Edit/Draft

- 失败条件：创建失败进入编辑；任一九区段独立保存；异常关闭/刷新恢复偏离已裁定规则；编辑内维护元数据时父编辑关闭、该子任务读写过渡草稿/`returnToEdit`、或候选以外事实被改写；index 身份仍用于回写。
- 不变量：create 最小原子；whole-save；九 View/Editor 分文件；session key 含 scope/brand/item/version；编辑内元数据维护由 Editor child-task UI state 控制，不写 `returnToEdit` 或过渡 session；IA §3.3 级联逐项实现；商品草稿最多一个 `productionTagRef`，SKU 制作覆盖与选项影响均不持有生产标签。
- FORBID：自动 merge 版本冲突；持久化 staged grant；隐藏不适用 draft 仍提交；把 owner admission 改成本地规则。
- 验证：[focused] 级联矩阵每行一正一反；编辑不关闭、关闭子任务焦点归还触发控件、无过渡 session write；[acceptance] whole-save rules；[L2另行授权] refresh restore/focus。
- 形态理由：typed slice 收敛整单草稿，但不把九类事实重新塞回巨型宿主。
- RECALL：formal §4.4-4.6/§8、IA §2.3/§3.3、既有单位/库存/BOM/制作正式设计。

### CP-08 · Config

- 失败条件：配置仍是顶部 Tabs/万能 Modal；复杂定义打开 Drawer；切库不拦 dirty；其它五库被无差别 refetch。
- 不变量：左六库；“生产标签”是简单库且列表即详情；三右栏形态；`useCatalogConfigLibrary` 单住址；工作台配置是第一层，编辑内配置是唯一 child task，父编辑保持打开。
- FORBID：配置持有商品 draft；简单字典详情页；第三套 picker；停用删除混词。
- 验证：[focused] 三代表态、切库/父子/definition 级联、精确 fetch spy、编辑子任务关闭后的焦点归还与 draft 不变。
- 形态理由：按实体复杂度分三种固定形态，比一个万能弹窗更小且更一致。
- RECALL：formal §4.7/4.8、IA §2.4/3.4、frontend standard §3-K。

### CP-09 · Batch/Copy/Governance

- 失败条件：批量假装全原子、receipt 被 message 覆盖；copy 旧 token 可执行；治理混进普通 Editor。
- 不变量：批量逐项尽力；copy/preflight token 绑定全部输入；治理 preflight stale；刷新失败与 business 分开。
- FORBID：SKU 批量；一步 copy；本地重算 closure；5xx/unknown 降级成业务结果。
- 验证：[focused render] 三态/100项滚动/脱敏；[acceptance] partial outcome、stale token、unknown escapes。
- 形态理由：保留现有业务语义，只重组可理解的阶段和状态。
- RECALL：Journey 06-08、IA §3.4、backend performance batch ruling。

### CP-10 · TestId/L2 blueprint/focused proof

- 失败条件：可交互控件无 testId、字符串散写、locator/L2 差集非空；本批 24 case 仍只在文档；fixture 无
  before/expected/unchanged；受管 runner/diagnostic join 不存在却把 L2 标 ready；focused 标题存在但行为没断言。
- 不变量：`catalogTestIds.ts`→components→locator bindings→既有 L2 blueprint→Playwright 单链；旧 18 scenario/41 case
  保留，本批新增 8 scenario/24 case，generated 总分母精确为 26/65；本批 execution exact-set 为 24；八 Journey
  成功/失败/恢复和 concrete control testId 全集双清零。
- FORBID：新建第二套 L2、使用 DEV/seed/report 输入、用元素存在当 oracle、用 focused 冒充浏览器、让
  `FRAMEWORK_ONLY/ACTIVE_CASES=0` 返回成功、手写 selector 或直接执行裸 Playwright。
- 验证：[static exact-set] 41+24=65、execution active=24、surface/control/binding/touched 双差集；[red fixture] 移除
  binding/case/fixture unchanged/action-request join/cleanup readback 任一必须红；[focused] reducer/render/cascade；
  [runner self-test] identity/heartbeat/log/firstFailure/lastKnownGood/brokenBoundary/business/cleanup schema。
- 形态理由：扩现有 policy、fixture validator、locator 与 Playwright spec，并新增唯一 capability-named managed runner
  `scripts/test/browser-l2`；这是补齐既有链的执行边界，不是第二套用例框架。
- RECALL：formal §9、L2 blueprint/P1/locator generator、frontend standard §1-1。

### CP-11 · Acceptance、预算与 seed

- 失败条件：annotation 不等于 80；任何 scenario 的业务 request 与 annotation operation 不一致；新 read 只有未过页 happy path；
  生产标签 0..1/navigation/filter 无 owner 断言；新 operation budget 缺失/超阈值；DEV seed 没有父+3规格/无规格对照。
- 不变量：annotation 仍 80；三组合并、tag 场景一拆二、再加两 read scenario；GET connection≤1；seed 只改唯一生成源/执行器。
- FORBID：删断言降分母；用 Testcontainers fixture 代替 seed；新增 seed plan 文件；抬预算遮 SQL 问题。
- 验证：[acceptance] discovered=selected=results=80；生产标签保存拒绝后 version 不变、导航去重 count、专用 filter 均命中；
  [seed self-test] 十列摘要/单一生产标签 strict readback；seed 执行另行授权。
- 形态理由：保持 80 上限和正确 operation identity，同时让新 task read 有真实 HTTP 证明。
- RECALL：backend acceptance standard、performance budget policy、P1 seed/executor README。

### CP-12 · 验证

- 失败条件：静态/compile/typecheck/acceptance 任一红；business PASS 但 cleanup 非 PASS；run 早于产物 mtime；
  browser L2 在 runner/fixture/case/join/cleanup readiness 任一非 PASS 时启动；action 后无预期日志仍等到 timeout。
- 不变量：先静态，再按授权执行 Testcontainers；DEV 联动遵守 manifest ownership；L2/UAT 不冒充。browser L2 若
  后续获授权，必须只走 `scripts/test/browser-l2`，在本机运行 Spring Boot/双 Vite/Playwright，经受管 tunnel 使用
  每 run 隔离的远端 DB/资产命名空间；business 与本机/远端 cleanup 分开。
- FORBID：无授权 reset/seed/L2/UAT；失败后重试止血；静态当浏览器证据。
- 验证：生成/static/compile/typecheck/focused 的实际退出码；授权后 80/80 manifest；L2 授权后 24/24、concrete
  testId 差集空、action-request-DB join 完整，并输出 first failure/last known good/broken boundary/business/cleanup。
- 形态理由：按证据档位逐级闭合，不用高成本运行替代低档红门根因。
- RECALL：AGENTS Testcontainers/DEV 联动、managed runtime skill、scripts/README。

### CP-13 · Review

- 失败条件：作者自审冒充 independent review；设计 GO 冒充 implementation GO；UI 未验证清单为空但未跑 L2。
- 不变量：fresh reviewer、两轮上限、逐点双读证据；Claude 外部 review 单列角色。
- FORBID：实施 finding 全盘接受或自行改变产品语义。
- 验证：review artifact metadata、intake disposition、M/S/N、未验证边界。
- 形态理由：重开真实源码和 evidence，而不是验证“是否照设计写”。
- RECALL：independent review governance、cs-review、Claude handoff standard。

## 5. operation / path / face / 集合形态

### 5.1 本批新增、扩展或继续消费的 read（16）

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
| --- | --- | --- | --- | --- | --- |
| 工作台权限与动作 | `getOperationsCatalogWorkbenchContext` | GET `/api/operations/catalog-inventory/workbench/context` | operations-admin | Detail | 单 scope 单对象 |
| 目录树/计数 | `getOperationsCatalogNavigation` | GET `/api/operations/catalog-inventory/navigation` | operations-admin | Detail aggregate | 智能视图、标签与导航摘要整体读取；分类选择不再复用它猜资格 |
| 父商品页 | `getOperationsCatalogItems` | GET `/api/operations/catalog-inventory/items` | operations-admin | Cursor/Page | 数十至数千父商品；按经营商品增长；扩展 parent summaries 与每行 `categoryPathLabels`，供跨分类结果直接展示 |
| 单商品详情 | `getOperationsCatalogItem` | GET `/api/operations/catalog-inventory/items/{itemCode}` | operations-admin | Detail aggregate | 单商品九事实族；子集合按既有 aggregate/边界 |
| 分类树选择 | `getOperationsCatalogCategoryCandidates` | GET `/api/operations/catalog-inventory/category-candidates` | operations-admin | Cursor hierarchy | 数十至数千分类；根/子级 lazy cursor，搜索返回命中及祖先路径；`usage=ITEM_ASSIGNMENT` 服务新建、编辑、批量移动商品，`usage=CATEGORY_CREATE` 服务新建分类选父，`usage=CATEGORY_REPARENT` 服务分类挪父；create/move 均由 owner 限制根起最多三级 |
| 父商品规格页 | `getOperationsCatalogItemSkus` | GET `/api/operations/catalog-inventory/items/{itemCode}/skus` | operations-admin | Cursor | 通常 0–几十，极端更多；只在展开父行读取 |
| shape/字段准入 | `getOperationsCatalogShapeManifest` | GET `/api/operations/catalog-inventory/shape-manifest` | operations-admin | Detail | 固定 7 shape 与已裁规则 |
| 通用字典 | `getOperationsCatalogDictionary` | GET `/api/operations/catalog-inventory/dictionaries/{dictionaryKind}` | operations-admin | Cursor/Bounded 按 kind | 标签/规格定义与值随配置增长；简单库管理的 `query/status` 属于 owner 过滤与 cursor identity |
| 生产标签 | `getOperationsProductionTags` | GET `/api/operations/catalog-inventory/production-tags` | operations-admin | Cursor | 数十至数百标签；管理列表的 `query/status` 由 owner 过滤并进入 cursor identity |
| 本地复制来源 | `getOperationsLocalCatalogCopyCandidates` | GET `/api/operations/catalog-inventory/copy/local/candidates` | operations-admin | Cursor | 随商品增长 |
| 品牌复制来源 | `getOperationsBrandCatalogCopyCandidates` | GET `/api/operations/catalog-inventory/copy/brand/candidates` | operations-admin | Cursor | 随品牌商品增长 |
| BOM/物料候选 | `getOperationsInventoryConsumptionTargetCandidates` | GET `/api/operations/catalog-inventory/inventory-consumption-target-candidates` | operations-admin | Cursor | 随库存对象增长 |
| 商品属性定义 | `listOperationsCatalogAttributeDefinitions` | GET `/api/operations/catalog-inventory/attribute-definitions` | operations-admin | Detail aggregate/现行 bounded | 定义库整体维护；以 owner 现行替换语义为准 |
| 点单选项定义 | `listOperationsCatalogOrderOptionDefinitions` | GET `/api/operations/catalog-inventory/order-option-definitions` | operations-admin | Detail aggregate/现行 bounded | 定义库整体维护 |
| 计量单位 | `listOperationsCatalogUnits` | GET `/api/operations/catalog-inventory/units` | operations-admin | Bounded | hard max 99；`query/status` 仍由 owner 过滤，不能以当前页前端筛选替代 |
| 图片内容 | `getPublicAssetContent` | GET `/api/public/assets/{assetRef}/content` | public（由 operations-admin 图片 presenter 消费） | Detail | 单个已绑定 asset；assetRef 改变时必须读新 `currentData`，不得短暂显示旧图 |

`getOperationsCatalogCategoryCandidates` 的 `usage` 是技术上的任务意图闭集，不是新的分类业务状态：

- `ITEM_ASSIGNMENT`：用于新建商品、编辑商品和批量移动商品。`currentCategoryRef` 必须为空；owner 只按现行“商品可归入该分类”命令准入返回 `selectable/disabledReason`。
- `CATEGORY_CREATE`：用于新建分类选择父级。`currentCategoryRef` 必须省略/null；深度已为三级的候选返回不可选和“商品分类最多只能建立三级”。
- `CATEGORY_REPARENT`：用于分类挪父。`currentCategoryRef` 必填；owner 在同一现行 move admission 上排除当前分类及其全部后代，并拒绝会使移动子树超过三级的目标。
- 两种 usage 都接收 `parentCategoryRef/keyword/cursor/pageSize`；切换 usage、scope、brand 或 `currentCategoryRef` 必须形成新的 query identity，旧 `currentData` 不得继续渲染。前端不得用节点是否有子节点、当前树形位置或历史选择结果自行推导资格。

从品牌复制同样属于分类写入路径：execute 在分类层级 advisory lock 内，以目标现行父链和待复制闭包构成有效树；若目标复用同编码分类会使任一节点超过三级，整次 command 以 `CATEGORY_DEPTH_EXCEEDED` 拒绝，任何目标分类、商品或关联事实均不得写入。该裁定不允许压平、改挂或 pick-first；preflight 仅作当时影响检查，execute 必须在事务内重新计算。

`CatalogCategoryCandidateQuery` 精确协议：

| 字段 | 类型/边界 | 组合规则 |
| --- | --- | --- |
| `dataNodeRef` | optional UUID | 省略时取当前 session scope；传入时仍由 `readRequest(CATALOG_SCOPE)` 校验 |
| `usage` | required enum `ITEM_ASSIGNMENT \| CATEGORY_CREATE \| CATEGORY_REPARENT` | 闭集外 400；不进入用户文案 |
| `currentCategoryRef` | UUID 或 null | `ITEM_ASSIGNMENT` 必须省略/null；`CATEGORY_REPARENT` 必填 |
| `parentCategoryRef` | UUID 或 null | 省略/null 表示读取根分类；有值时只读该父级的直接子分类 |
| `keyword` | optional string | 有非空关键词时 `parentCategoryRef` 必须省略/null；返回匹配节点及完整 `path`，不把搜索命中伪成根节点 |
| `cursor` | opaque string 或 null | 只可在同一 scope/brand/usage/current/parent/keyword identity 下续页；漂移或伪造为 400 |

### 9c. 2026-08-25 实施期收敛 addendum

1. `V20260825_...retire_production_tag_kind` 删除没有业务语义、且不再有 consumer 的生产标签 `tag_kind`。这是单一生产标签裁定后的持久化收敛，不创建替代字段、兼容读取或默认值。
2. 分类层级的唯一真相是 owner create/move guard：最大深度为三级。候选协议只消费同一规则以提前呈现不可选原因，P1 seed 自检对超过三级直接失败。
3. `getOperationsCatalogItemSkus` 将同一 catalog item 的制作 profile、SKU override 与单一生产标签 reference 收敛进其既有 set-based SKU 查询；标签名称仍经 fulfillment owner API 读取一次。不得在懒加载页重新逐族读取相同 catalog 事实。
4. option production effect 只保留非负制作时长增量和制作说明；P1 不得再声明或生成 `tagOperation`/`x-tagOperation`。这两个已退役符号的任一回归必须由 generator self-test 失败，而不是由 UI 忽略或 owner fallback 消化。
5. 工作台路由宿主保持只装配；`CatalogWorkbenchController` 只组合 read-model、task coordinator、内容和任务 surface，目标不超过 300 行。query/filter/cursor/SKU cache 只在 `useCatalogWorkbenchReadModel`，first-level task transition 只在 `useCatalogWorkbenchTaskCoordinator`，树/内容/任务面均为独立 presenter；新增列表列或筛选不得修改路由宿主。
| `pageSize` | integer 1..100，default 50 | 前端不得请求 unlimited |

`CatalogCategoryCandidatePage` 精确协议：外层固定 `revision/requestId/data`；`data` 必须含
`items/total/cursor/nextCursor`，其中 cursor 与 nextCursor 均为 string 或 null、total 为当前查询条件下的
匹配总数。每个 item 必须且只能包含：

- `categoryRef: UUID`、`code: string`、`name: string`、`parentCategoryRef: UUID|null`；
- `displayOrder: integer`、`hasChildren: boolean`；
- `path: CategoryPathSegment[]`，从根到当前节点且包含当前节点；segment 精确为
  `{categoryRef: UUID, code: string, name: string}`，不得只给拼接字符串；
- `selectable: boolean`、`disabledReason: string|null`。`selectable=true` 时 `disabledReason` 必须为 null；false 时必须是
  用户可理解的业务原因，不得返回 problem code、ref 或原始枚举。

无关键词时每页只含同一父级的直接子节点，按 `displayOrder, name, code, categoryRef` 稳定排序；关键词搜索按
完整路径的同一排序键稳定分页。`hasChildren` 只控制是否显示展开入口，不推导 `selectable`。reparent usage
下当前节点及其全部后代必须返回为不可选（而非从结果删除），以便用户理解层级和原因。owner command 仍在
提交时重验自环、后代环、scope 和版本；candidate read 不是写防线。

`getOperationsCatalogItems` 父行和 `getOperationsCatalogItemSkus` 规格行必须共享同一套结构化
`inventoryDeductionSummary`，不能继续让 UI 用 `stockTargetCount/bomCount` 猜业务方式：

- 商品级节点：`grain=ITEM`，`mode=NONE|DIRECT|BOM`；`DIRECT` 带消费单位快照，`BOM` 带 `bomLineCount`；
- 按规格商品父行：`grain=SKU`，不伪造一个商品级 mode；presenter 据此显示“各规格分别设置”；
- 规格行：`grain=SKU`，带该规格的 `mode` 及 mode 对应的消费单位快照或 `bomLineCount`；
- mode 与 grain 是 contract 事实，只在 generated wire/owner/presenter 传递；用户文案由共享 presenter 映射为
  “不参与库存/直接扣当前商品或规格/按用料扣减/各规格分别设置”，不得显示 raw enum、target、ref 或技术 code；
- 父页对上述摘要、已设置价格的可选范围、规格计数与完整分类路径使用 set-based projection；`missingPriceCount`
  从列表/详情 read schema 与 presenter 退休；规格页只投影单父商品
  的规格摘要，不读取完整 detail，也不逐规格调用 inventory owner。

`standardSalePrice` 在 catalog contract 中继续是 nullable 商品资料；catalog owner 对 null 不返回 typed problem，
也不以其驱动 action availability。App 只按 nullable readback/草稿显示“未设置”或金额，不建立完整度状态。
菜单项必须有价由菜单/销售集合 owner 在菜单项写入边界复核；本批不得把该规则复制成 catalog schema required、
catalog owner 守卫或前端商品启用条件。

#### 5.1.1 read boundary exact-set

以下分母不得再互相代称：

- `CURRENT_CONTRACT_CATALOG_GETS=20`，本批新增两条后 `PLANNED_CONTRACT_CATALOG_GETS=22`；与总 operation 的 `57→59` 同步。
- `CORE_CROSS_SCOPE_ASSERTION_SET=6`：context、navigation、parent items、item detail、category candidates、item SKUs。这是工作台主链的强化断言集，不是全部读授权分母。
- `UI_SCOPED_OPERATION_READS=15`：下表除 public asset 外的全部 operations-admin read；每条都必须经过 controller `readRequest` 的 `CATALOG_SCOPE` 或 `STORE_SCOPE`，并接受越 scope/brand 反例。
- `PUBLIC_NON_SCOPED_ASSET_READS=1`：`getPublicAssetContent` 不读取 operations session，而由 asset owner 的 active public reference 守卫负责。
- `UI_READ_CONSUMERS=16 = 15 + 1`。catalog contract 规划中的另外 7 条 GET 属于门店库存管理页，不是本商品库 UI consumer；不得塞进本批 UI 分母。

| # | operationId | read boundary / owner task read | state owner | 商品库 consumer | 权限与可证伪 proof |
| --- | --- | --- | --- | --- | --- |
| 1 | `getOperationsCatalogWorkbenchContext` | `readRequest(CATALOG_SCOPE)` → `CatalogTaskReadService.workbenchContext` | generated RTK `currentData` | 工作台范围/动作能力 | A 身份读 B scope 为 403，旧 A `currentData` 不渲染 |
| 2 | `getOperationsCatalogNavigation` | `readRequest(CATALOG_SCOPE)` → `CatalogTaskReadService.navigation` | generated RTK `currentData` | 目录树/智能视图/计数 | 越 scope 拒绝；失败只占树区，不改父表事实 |
| 3 | `getOperationsCatalogItems` | `readRequest(CATALOG_SCOPE)` → `CatalogTaskReadService.items` | generated RTK `currentData` | 父商品页 | 越 scope 拒绝；query identity 改变时旧页不显示 |
| 4 | `getOperationsCatalogItem` | `readRequest(CATALOG_SCOPE)` → `CatalogTaskReadService.item` + inventory enrich | generated RTK `currentData` | View 与 Editor 基线 | 越 scope 拒绝；Editor dirty 时 refetch 不覆盖草稿 |
| 5 | `getOperationsCatalogCategoryCandidates` | `readRequest(CATALOG_SCOPE)` → 新 `CatalogTaskReadService.categoryCandidates` → `CatalogOwnerApi.readCategoryCandidates` | generated RTK `currentData` + candidate hook 仅持 UI cursor | 四个分类 TreeSelect | 越 scope/brand 返回 403 且候选为零；不可选行仍可见原因 |
| 6 | `getOperationsCatalogItemSkus` | `readRequest(CATALOG_SCOPE)` → 新 `CatalogTaskReadService.itemSkus` → `CatalogOwnerApi.readItemSkus` | generated RTK `currentData` + 每父 itemCode cursor UI state | 父行规格子行 | 越 scope/错父拒绝；规格 over-page 不改变父 total |
| 7 | `getOperationsCatalogShapeManifest` | `readRequest(CATALOG_SCOPE)` → `CatalogTaskReadService.shapeManifest` | generated RTK `currentData` | create/edit 区段与字段准入 | 未授权 scope 不借静态 manifest 绕过会话；UI 不本地复制矩阵 |
| 8 | `getOperationsCatalogDictionary` | `readRequest(CATALOG_SCOPE)` → `CatalogTaskReadService.dictionary` | generated RTK `currentData` | 标签/规格维度值及有限候选 | dictionaryKind/scope 篡改拒绝；切库清累计 cursor |
| 9 | `getOperationsProductionTags` | `readRequest(CATALOG_SCOPE)` → `CatalogInventoryCoordinator.readProductionTags` → `ProductionTagOwnerApi.readTags` | generated RTK `currentData` | 生产标签库/商品级单选候选 | 越 scope 与错误 usage 拒绝；停用项不进入新候选但既有绑定可见 |
| 10 | `getOperationsLocalCatalogCopyCandidates` | `readRequest(STORE_SCOPE)` → `CatalogTaskReadService.localCopyCandidates` | generated RTK `currentData` | 本地复制来源 | 非门店 scope/来源等于目标均不可进入候选 |
| 11 | `getOperationsBrandCatalogCopyCandidates` | `readRequest(STORE_SCOPE)` → `CatalogTaskReadService.brandCopyCandidates` | generated RTK `currentData` | 品牌复制来源 | 未授权品牌/门店拒绝；旧品牌候选不闪现 |
| 12 | `getOperationsInventoryConsumptionTargetCandidates` | `readRequest(CATALOG_SCOPE)` → `InventoryOwnerApi.readCatalogInventoryConsumptionTargetCandidates` | generated RTK `currentData` + candidate hook UI cursor | BOM/用料/选项物料 | 越 scope、非消费资格对象不返回；owner 单位快照为准 |
| 13 | `listOperationsCatalogAttributeDefinitions` | `readRequest(CATALOG_SCOPE)` → `CatalogOwnerApi.listAttributeDefinitions` | generated RTK `currentData` | 商品属性库/赋值候选 | 越 scope 拒绝；定义类型决定控件，不由 UI 猜 |
| 14 | `listOperationsCatalogOrderOptionDefinitions` | `readRequest(CATALOG_SCOPE)` → `CatalogOwnerApi.listOrderOptionDefinitions` | generated RTK `currentData` | 点单选项库/商品点单设置 | 越 scope 拒绝；组和值身份不得跨定义串用 |
| 15 | `listOperationsCatalogUnits` | `readRequest(CATALOG_SCOPE)` → `CatalogOwnerApi.listUnitDefinitions` | generated RTK `currentData` | 单位库/销售与计量单位候选 | 越 scope 拒绝；停用仅影响新候选，既有绑定可见 |
| 16 | `getPublicAssetContent` | `PublicAssetController.content` → `PlatformAssetService.requireActivePublicReference` | public generated RTK `currentData` | `CatalogAssetPreview` | 非 active public reference 为 404/拒绝；assetRef 改变不显示旧图 |

实现期生成器需分别产出并核对上述 exact-set；不得以“6 条核心读通过”冒充 15 条 scoped read 全部通过，
也不得要求 public asset 带 operations scope 来换取表面一致。

### 5.2 写 operation exact-set（33）

本批不新增写 operation。精确集合逐字沿用交互工件 §4.2 的 33 行：item create/save/status/batch、category
create/update/move/delete、dictionary create/update/reorder/status、production tag create/update/status、attribute
definition create/update/delete、order option definition create/update/delete、unit create/update/disable/delete、asset
stage/release、local copy preflight/execute、temporary promotion preflight/execute、brand copy preflight/execute。
每个 request 必须继续由其 annotation/consumer 使用相同 operation identity。

当前 catalog-inventory contract 有 `CURRENT_CONTRACT_NON_GET=37`。UI exact-set 的另外 4 条明确排除，避免以后
把“当前契约全部写”误称为“商品库 UI 写分母”：

| operationId | disposition |
| --- | --- |
| `countOperationsInventoryTarget` | `OUT_OF_SCOPE_WITH_REASON`：门店库存管理的盘点动作，商品库只配置扣减方式 |
| `increaseOperationsInventoryTarget` | `OUT_OF_SCOPE_WITH_REASON`：门店库存管理的收货/增加动作 |
| `adjustOperationsInventoryTarget` | `OUT_OF_SCOPE_WITH_REASON`：门店库存管理的报损/人工调整动作 |
| `updateOperationsInventoryTargetConfiguration` | `OUT_OF_SCOPE_WITH_REASON`：门店库存对象配置动作；商品整单保存只经 coordinator 的现有 owner command，不由 UI 直调此 route |

## 6. 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时回滚事实 |
| --- | --- | --- | --- | --- |
| whole-save 商品与库存规则 | catalog 保存/校验当前商品事实 | inventory `replaceCatalogInventoryRules` | 现行同一 `REQUIRED` | catalog version、inventory target/BOM 全部不变 |
| whole-save 制作/选项物料 | catalog 保存选项/制作声明 | fulfillment-production / inventory 现行公开 command | 现行同一 `REQUIRED` | 商品、制作、物料关系不产生半包 |
| 商品图片引用 | asset stage 独立完成后，catalog whole-save 绑定 ref | 放弃时 asset release 独立命令 | stage/release 各自事务；绑定随 whole-save | 失败保旧图片；只清当前任务拥有的 staged asset |
| copy/promotion | catalog coordinator 读取 preflight token并调用既有 owner commands | 涉及 inventory/production 时沿现行方向 | 现行 coordinator 事务/逐项语义不变 | 按既有 readback，无新增补偿 |

本批前端拆分不得把上述跨 owner write 拆成区段保存，也不得在 UI 直接调用第二 owner 绕开 coordinator。

## 7. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| 父商品/规格同表 | formal §4.2、IA-CATUI-01 | parent page `hasSkuChildren/summary` + SKU cursor read | `CatalogItemListTable` tree-data | focused parent/child + HTTP over-page |
| 十列、横滚与跨分类路径 | formal §4.2、IA §3.1 | parent/SKU page 的十列结构化摘要 + parent `categoryPathLabels` | 十列全部常显、四行上限、Tooltip、最小宽度求和的 Table 横滚、跨分类商品副信息 | focused parent/SKU cell presenter/width/ellipsis + acceptance summary/path + L2 find 三态 |
| 分类树候选 | formal §4.8、IA §3.2 | query `usage/currentCategoryRef/parentCategoryRef/keyword/cursor/pageSize`; row `path/selectable/disabledReason` | 四个 TreeSelect presenter | acceptance self/descendant/scope + focused cascade |
| 三状态住址 | IA §2 | RTK `currentData` / draft hook / component reducer | 全部 catalog surfaces | static no-mirror + focused dirty refetch |
| 整单草稿 | formal §4.5、IA §2.3 | detail readback hydrate；session key；whole-save request | 九区段 Editor、恢复/放弃、save | focused restore/stale/index + L2 pending |
| actionAvailability | formal §6.1 | context/detail/readback contract | View/Editor/治理动作 | acceptance tamper + render no gray matrix |
| typed problems | IA §6 46 exact-set | P1 operation codes→HTTP mapper→generated TS | catalog problem feedback/field resolver | exact-set + focused wording |
| **集合形态** | IA 各 `collectionShapeAndScale` | contract cursor/pageSize/total/nextCursor/path | no client slice；Table/picker 读 owner total | over-page acceptance |
| **授权执行点** | IA 各 `stateAndPermission` | controller `readRequest` / generated write authorization | owner scope/version/admission 复核 | cross-scope acceptance |
| **缓存失效** | IA §4 | P1 RTK tag policy与 command readback | exact current queries refetch，draft 不被覆盖 | fetch spy + L2 pending |
| **错误映射** | 46 problem rows | `CatalogOwnerApi.Problem`/edge mapper/P1 code list | business copy + field/row/group/task placement | exact-set + render proof |
| **日志与脱敏** | IA §6.2 + AGENTS | Playwright action window→foundation request headers→HTTP completion→DB rows→manifest | requestId/stage/count only；action-request join 与 no-new-log fail closed | static forbidden key scan + acceptance logs + L2 join/red mutation |
| **testId/L2** | formal §9 | `catalogTestIds.ts`→component→locator→65-case blueprint→24 active profile→TEST fixture→managed runner | Playwright locator + owner readback oracle | two exact-set diffs + fixture/runner/join red fixture |

## 8. 业务规则 → owner 判定点

| 规则 | owner 判定点 |
| --- | --- |
| U-CATUI-01/02/03（surface 形态） | UI reducer/foundation；owner 不判视觉形态 |
| U-CATUI-05 父/规格同表 | catalog task read 提供 hasSkuChildren 与 SKU page；父结果分母 owner 维持 |
| U-CATUI-06 冻结两区 | UI focused/L2；owner 不判布局 |
| U-CATUI-07 分类层级/可选性 | catalog candidate read 声明；create/save/move owner command 再复核 |
| 商品 shape/区段/字段准入 | shape manifest 声明，catalog owner save 最终复核 |
| 单位/库存/BOM/制作/标识既有规则 | 对应现行 catalog/inventory/production owner；生产标签的商品级 0..1 由 catalog contract/owner/DB 三层强制，UI 只消费 |
| 批量逐项尽力 | batch coordinator 每项事务与 receipt；UI 只展示 |
| copy/preflight | catalog copy owner token/closure/version 复核 |

空号声明：本批没有新增产品业务规则编号；仅落地已接受 U-CATUI 与既有 owner 规则。

## 9. owner API 与消费者清单

| owner 方法 | 谁调用 |
| --- | --- |
| `CatalogOwnerApi.readCategoryCandidates(...)`（新增） | `CatalogTaskReadService.categoryCandidates`→`CatalogInventoryCoordinator`→operations controller |
| `CatalogOwnerApi.readItemSkus(...)`（新增） | `CatalogTaskReadService.itemSkus`→`CatalogInventoryCoordinator`→operations controller |
| `CatalogOwnerApi.readItems(...)`（扩摘要） | 既有 `CatalogTaskReadService.items` |
| `CatalogOwnerApi.readItem(...)`（扩展示事实如确有缺口） | 既有 `CatalogTaskReadService.item` |

两项新增 API 都有且仅有一个 task-read caller；若实施时零调用者，删除，不保留“未来接口”。

## 9b. 变更定位（2026-08-24 当前树 20/20 唯一命中）

| 文件 | 唯一锚点 | 变更目的 |
| --- | --- | --- |
| `scripts/generate/catalog-inventory-p1.mjs` | `const OPERATION_CONTRACT_PATH =` | 读契约源与生成路径 |
| `scripts/generate/catalog-inventory-p1.mjs` | `const CATALOG_DATABASE_OPERATION_MAX = Object.freeze({` | 新 GET budget |
| `scripts/generate/catalog-inventory-p1.mjs` | `const catalogDefinitionSeed = {` | DEV 体验 seed/断言 |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java` | `JsonNode readNavigation(` | 增 task read API |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogTaskReadService.java` | `public JsonNode navigation(` | 新 read wrapper |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `public JsonNode readCatalogNavigation(` | coordinator read |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `record CopyReferencePlan(` | copy closure 收敛商品级单一生产标签 |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogPreparationFacts.java` | `final class CatalogPreparationFacts {` | profile/effect allowed-field 删除标签字段 |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemReferenceFacts.java` | `final class CatalogItemReferenceFacts {` | `PRODUCTION_TAG` singular replace/read |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | `private void validateProductionTagRef(` | whole-save/copy/readback 从数组收敛为单值 |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java` | `return readResponse(application.readCatalogItems(` | 两条 route 邻接落点 |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx` | `export function CatalogWorkbenchController({` | 工作台查询与任务控制器；路由宿主只负责 Store/Brand 入口 |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemListTable.tsx` | `export function catalogItemExpandControl(` | 显式 SKU 展开、加载、失败重试与继续加载 |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `export function CatalogItemDrawer(props:` | View/Edit 巨型混壳退役 |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx` | `export function CatalogItemCreateDrawer(` | 改 Modal/接力状态 |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx` | `export function CatalogDictionaryDrawer(props:` | 改全高 Config Drawer |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx` | `export function CatalogDefinitionLibraries(` | 复杂定义同栏化 |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx` | `export function BrandCatalogCopyDrawer(` | 复制 state/refresh |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java` | `id = "catalog.sku-inventory-identity-and-removal"` | 合并场景释放 annotation |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java` | `id = "catalog.copy-definition-semantic-conflicts"` | 合并场景释放 annotation |

新建文件没有旧锚点：`catalogTestIds.ts`、workspace task reducer、draft/config hooks、专用 Table、View/Editor 九族文件。
它们由 CP 输出路径与模块职责约束，不伪造锚点。

## 10. 数据迁移

| 迁移 | 加/改什么 | 旧行回填 | 唯一事实 | 可否回滚 |
| --- | --- | --- | --- | --- |
| `V20260824_120000_000__catalog_single_production_tag.sql`（计划名，实施时按实时版本序号复核） | 将生产标签收敛为商品级 0..1；从 `catalog_item.preparation_profile`、`catalog_sku.preparation_override.profile`、option `preparation_effect` 删除标签字段；`catalog_item_reference` 的 `PRODUCTION_TAG` 增 item 级 partial unique index | 商品 profile 为 0 个标签→空；恰 1 个→唯一 canonical。SKU 标签字段缺失表示继承；显式集合仅在与 canonical 等值且不会改变有效结果时可删，显式空集合清除了非空 canonical 因而是冲突。option add 集合仅空或只重复 canonical 时可删。relation 缺 canonical 可确定性补齐，含不同/额外值则冲突 | 商品与生产标签的唯一绑定住 `catalog_item_reference(kind=PRODUCTION_TAG)`；三个 JSON 字段不再保存标签事实；运行时 `sections.productionTagRefs` 只是待退休的旧派生投影 | 结构可由 migration 回退；业务数据不做“取第一个”式逆推 |

迁移前必须先跑只读 preflight，按 `EMPTY / SAFE_SINGLE / SAFE_REDUNDANT_NESTED / SAFE_RELATION_REPAIR /
CONFLICT_ITEM_MULTI / CONFLICT_SKU_CLEAR / CONFLICT_NESTED_DIFFERENT / CONFLICT_RELATION_EXTRA / MALFORMED` 分类，只输出
分类计数、scope 计数和建议 disposition，不输出名称、ref、说明或 raw JSON。
`CONFLICT_*` 或 `MALFORMED` 非零即 `DEXTER_DECISION_REQUIRED`，不得启动 Flyway。Flyway transaction 内在 DDL/DML
之前再次执行同一 predicate，防止 preflight 与迁移之间漂移；命中即 `RAISE EXCEPTION`。禁止双读、fallback、默认
生产标签、静默选第一项或把 SKU/选项标签提升为商品标签。迁移真实执行仍需另行授权。

## 10b. seed 数据

### 10b.1 受影响 seed 全集

| seed 文件 | 本批为什么受影响 | 处置 |
| --- | --- | --- |
| `scripts/generate/catalog-inventory-p1.mjs` 的 `catalogDefinitionSeed` | 唯一 catalog/inventory seed 生成源；树表/View/Editor/配置需可体验分支 | 保持唯一源；补缺失代表对象与稳定业务名称，不手改 fixture |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 唯一物化与 readback executor；需验证父/规格行、分类路径、各摘要 | 扩严格 readback，不降低单位/BOM/标识/制作现有断言 |

### 10b.2 两类改动

| 类型 | 设计 |
| --- | --- |
| 新功能上线 | 新增十列表格可读覆盖：至少一个父商品 3 个规格、一个无规格商品、深度≥3 分类路径、价格与双单位、多属性、多选项、制作摘要、每种库存摘要；至少 2 个生产标签（含 1 个停用）、0 标签商品与各绑定 1 标签的商品；禁止任何商品多标签 |
| 旧功能调整 | 将所有制作 profile/SKU override/option effect 中的标签数据迁到商品级单值或按 preflight 停机；现有按 SKU 商品必须让三个 SKU 拥有不同价格/库存摘要/状态/图片边界；普通/称重商品不得挂 SKU；分类控件夹具不得只有一级；空态/长名称/引用阻止对象齐全 |

### 10b.3 覆盖判据

- seed executor 读父 page 后断言按规格父行 `hasSkuChildren=true`、规格数=3，逐 cursor 读到三个稳定 skuCode；
- 无规格商品 `hasSkuChildren=false`；父 total 不因读 SKU 改变；
- category candidate 搜索深层节点返回完整祖先路径；reparent use-case 中自身/后代不可选；
- View 九区段至少分别有一个非空代表和一个合法空态；配置三形态都有数据；停用定义从新候选消失但既有绑定可读；
- seed executor 断言每个商品 `productionTagRef` 为 null 或单一 ref、停用既有绑定仍可读、新候选不含停用项；
- 断言任何 SKU preparation override 与 option effect 均没有标签字段；保留单位、BOM、标识、制作内容、快照 strict readback，
  不把 UI 摘要断言替代业务事实断言。

### 10b.4 同步与边界

同批更新 seed static test；seed 直接按现模型物化，不写兼容层。设计不授权执行 reset/start/seed。

DEV seed 只服务人工体验和 seed readback，不能作为 browser L2 前置数据。L2 测试数据只由 §11c 的 8 个 TEST
dataset 在每 run 隔离命名空间内经 owner HTTP commands 建立；两者可以复用已确认业务语料和生成 helper，但
不得互相读取 report、引用对象身份或以一个执行结果证明另一个。

## 11. 验收场景设计

为保持 annotation hard max 80，并修正现有 `catalog.tag-navigation-and-filter` 在一个 annotation 内混用
navigation/items 两个 operation 的宿主身份问题，先做三组合并、再拆分该场景并新增两条 task-read 场景；业务断言不删：

1. 合并 `catalog.sku-removal-blocked-by-inventory` 与 `catalog.sku-code-change-keeps-inventory` 为
   `catalog.sku-inventory-identity-and-removal`，operation 仍为 `saveOperationsCatalogItem`；
2. 合并 `catalog.copy-definition-semantic-conflict` 与 `catalog.copy-order-option-definition-semantic-conflict` 为
   `catalog.copy-definition-semantic-conflicts`，operation 仍为 `executeOperationsBrandCatalogCopy`；
3. 合并 `inventory.count-truncates-converted-quantity-toward-zero` 与
   `inventory.count-preserves-consumption-precision-without-counting-unit` 为
   `inventory.counting-unit-precision-semantics`，operation 仍为 `countOperationsInventoryTarget`；
4. 将 `catalog.tag-navigation-and-filter` 拆成 `catalog.tag-navigation`（仅 navigation request）与
   `catalog.item-tag-filter`（仅 items request）；商品标签与生产标签分别作为两个具名 subcase，前者保持既有断言，
   后者断言商品级单值、停用既有绑定可见及 `productionTagRef` 专用筛选；
5. 新增以下两条 task-read 场景后 annotation 仍为 80。

合并只减少 annotation，不减少旧断言。实施者必须照下表把两个旧方法体改为同一 scenario 内的具名 subcase；
任一 subcase fixture、请求或断言被删除都属于语义删测：

| 旧 scenario/subcase | 新 scenario | 必须保留的请求与事实断言 | red mutation |
| --- | --- | --- | --- |
| `sku-removal-blocked-by-inventory` | `catalog.sku-inventory-identity-and-removal` / `removalBlocked` | 真实 target/composite/BOM 三类引用；保存返回 422 + `REFERENCE_BLOCKS_VOID`；业务原因不泄露 schema/column；拒绝后 SKU ref、target link 与 catalog version/事实不变 | 任一引用计数改 0、允许 VOID、删 owner 来源文案或让拒绝后 SKU 消失必须红 |
| `sku-code-change-keeps-inventory` | 同上 / `codeChangeKeepsIdentity` | 真实 save 把 `ACC-SKU-OLD` 改为 `ACC-SKU-NEW`；SKU ref 不变；inventory target 仍以同一 ref 关联 | 按 skuCode 重新建 target、改变 productSkuRef 或断开 target 必须红 |
| `copy-definition-semantic-conflict` | `catalog.copy-definition-semantic-conflicts` / `attributeDefinitionConflict` | 属性定义同码但类型/语义不同；preflight 定位 objectType/id、`BLOCKED`、typed reason、blockingCount>0；execute 422 同 code；目标商品 404 | 把冲突降为 confirmable、execute 不重验或目标产生半个商品必须红 |
| `copy-order-option-definition-semantic-conflict` | 同上 / `orderOptionDefinitionConflict` | 点单定义同码但 selection mode/语义不同；preflight 定位 option object、`BLOCKED`、typed reason、blockingCount>0；execute 422；目标商品 404 | 只保属性 subcase、选项冲突可确认、execute 写入目标任一必须红 |
| `count-truncates-converted-quantity-toward-zero` | `inventory.counting-unit-precision-semantics` / `convertedQuantityTruncatesTowardZero` | 0.3567kg 以 g precision=0 记为 356g，余额与流水都不是 357 | 任一前端/后端进位或目标单位精度未消费必须红 |
| `count-preserves-consumption-precision-without-counting-unit` | 同上 / `withoutCountingUnitUsesConsumptionPrecision` | 未配盘点单位且消耗单位 precision>0 时小数 readback 保留 | SQL NULL 映成 precision=0 或回落链删除必须红 |

| scenario id | owner 文件 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| `catalog.item-sku-page-contract` | `CatalogAcceptanceScenarios` | STORE + edit catalog | 一个按规格父商品造 pageSize+1 SKU，另造无 SKU 商品 | `getOperationsCatalogItemSkus` 第一页/第二页/越 scope/无 SKU | total 为完整 SKU 数、两页无重漏、稳定父子身份、无 SKU 空页、越 scope 拒绝；父 item page total 不变 |
| `catalog.category-candidate-hierarchy` | 同上 | STORE + edit catalog | 深度≥3、同名不同路径、当前节点及后代、pageSize+1 siblings | `getOperationsCatalogCategoryCandidates` assign/reparent/search/cursor | 搜索命中含祖先路径；cursor 无重漏；assign 资格来自 owner；reparent 自身/后代不可选且原因可见；越 scope 拒绝 |
| `catalog.tag-navigation` | 同上 | STORE + edit catalog | 商品标签、生产标签各含启用/停用/零引用/单一绑定；停用生产标签已有绑定仍存在 | `getOperationsCatalogNavigation` | 两个一级节点分开；生产标签二级节点含全部定义及状态；count=绑定该生产标签的未作废父商品去重数；不含 SKU 行重复计数 |
| `catalog.item-tag-filter` | 同上 | STORE + edit catalog | 两商品共享商品标签但生产标签不同，另有无生产标签商品；一个按规格父商品带 3 SKU | `getOperationsCatalogItems` 分别传 `tagRef`、`productionTagRef` | 两种筛选互不串用；生产标签筛选只返回匹配父商品；展开后返回该父全部 SKU；父 total 不含 SKU；越 scope 与错误 ref 拒绝 |

既有 33 写 operation 的业务 coverage 不因场景合并减少；每个 scenario 的 annotation operation 与其业务断言所针对的
实际 HTTP request 必须完全一致，前置建数与最终 readback 不冒充宿主 operation。red fixtures：删 path ancestor、把
descendant selectable 改 true、让 total=page length、把 `productionTagRef` 错接到 `tagRef`、允许同一商品保存两个生产
标签、让生产标签 count 把 SKU 重复计入、让 UI 用 detail 替 SKU page、删除任一 testId binding，分别必须变红。
category 断言字段统一为 `disabledReason`，不得另造 `reason` 别名。

## 11b. `catalogTestIds` 与 L2 双分母（设计时冻结）

### 11b.1 47 surface exact-set

`catalogSurfaceTestIds` 必须逐字导出以下映射，不允许组件自写 literal：

| ID | testId literal | ID | testId literal |
| --- | --- | --- | --- |
| CATUI-01 | `catalog-store-workbench` | CATUI-25 | `catalog-item-edit-identifiers` |
| CATUI-02 | `catalog-brand-workbench` | CATUI-26 | `catalog-item-edit-skus` |
| CATUI-03 | `catalog-workbench-toolbar` | CATUI-27 | `catalog-sku-edit-identifiers` |
| CATUI-04 | `catalog-navigation-tree` | CATUI-28 | `catalog-sku-edit-preparation` |
| CATUI-05 | `catalog-item-table` | CATUI-29 | `catalog-item-edit-attributes` |
| CATUI-06 | `catalog-sku-rows` | CATUI-30 | `catalog-item-edit-order-options` |
| CATUI-07 | `catalog-category-task-modal` | CATUI-31 | `catalog-item-edit-preparation` |
| CATUI-08 | `catalog-batch-task-modal` | CATUI-32 | `catalog-item-edit-inventory` |
| CATUI-09 | `catalog-item-view-drawer` | CATUI-33 | `catalog-item-edit-composite` |
| CATUI-10 | `catalog-item-view-summary` | CATUI-34 | `catalog-promotion-task-modal` |
| CATUI-11 | `catalog-item-view-identifiers` | CATUI-35 | `catalog-lifecycle-confirm` |
| CATUI-12 | `catalog-item-view-skus` | CATUI-36 | `catalog-config-drawer` |
| CATUI-13 | `catalog-item-view-attributes` | CATUI-37 | `catalog-config-tags` |
| CATUI-14 | `catalog-item-view-order-options` | CATUI-38 | `catalog-config-units` |
| CATUI-15 | `catalog-item-view-preparation` | CATUI-39 | `catalog-config-sku-attributes` |
| CATUI-16 | `catalog-item-view-inventory` | CATUI-40 | `catalog-config-production-tags` |
| CATUI-17 | `catalog-item-view-composite` | CATUI-41 | `catalog-config-attributes` |
| CATUI-18 | `catalog-item-view-references` | CATUI-42 | `catalog-config-order-options` |
| CATUI-19 | `catalog-item-view-media` | CATUI-43 | `catalog-config-quick-create` |
| CATUI-20 | `catalog-item-view-sync-source` | CATUI-44 | `catalog-config-atom-modal` |
| CATUI-21 | `catalog-item-view-temporary` | CATUI-45 | `catalog-config-definition-editor` |
| CATUI-22 | `catalog-item-create-modal` | CATUI-46 | `catalog-brand-copy-drawer` |
| CATUI-23 | `catalog-item-edit-drawer` | CATUI-47 | `catalog-local-copy-drawer` |
| CATUI-24 | `catalog-item-edit-basic` |  |  |

### 11b.2 interactive control key exact-set

下表中的 key 是 `catalogTestIds.ts` 的完整公开 API。literal 固定使用 `catalog-` 前缀；带参数者由模块内唯一
constructor 生成。`codeToken` 必须由传入的 item/category/SKU/definition/value 业务码做 UTF-8 byte hex
编码并以 `-` 连接，确保无 index、无 ref、无碰撞；未保存行使用 draft store 创建后永不变化的 `editorId`
做同样编码。组件不得自行 slugify，也不得把数组位置带进 testId。

| key group | exact keys / constructors |
| --- | --- |
| `controls.workbench` | `viewTree`, `viewTable`, `openConfig`, `openBrandCopy`, `openCreate`, `treeSearch`, `filterKeyword`, `filterStatus`, `filterSource`, `filterReset`, `refresh` |
| `controls.itemTable` | `root`, `selectAll`, `itemSelect(itemCode)`, `itemOpen(itemCode)`, `itemExpand(itemCode)`, `skuOpen(itemCode,skuCode)`, `skuMore(itemCode)`, `skuRetry(itemCode)` |
| `controls.create` | `root`, `name`, `code`, `shape`, `category`, `submit`, `cancel`, `problem` |
| `controls.view` | `root`, `close`, `edit`, `more`, `section(sectionKey)`, `retry` |
| `controls.edit` | `root`, `close`, `cancel`, `save`, `errorSummary`, `restorePrompt`, `restore`, `discard`, `anchor(sectionKey)`, `section(sectionKey)`, `field(sectionKey,fieldKey)`, `row(sectionKey,businessCodeOrEditorId)`, `rowAction(sectionKey,businessCodeOrEditorId,action)` |
| `controls.childTask` | `root`, `search`, `result(businessCode)`, `more`, `apply`, `cancel`, `error` |
| `controls.config` | `root`, `close`, `library(libraryKey)`, `search`, `create`, `row(libraryKey,businessCode)`, `action(libraryKey,businessCode,action)`, `detail`, `back`, `save`, `delete`, `valueRow(libraryKey,parentCode,valueCode)` |
| `controls.categoryTask` | `root`, `name`, `code`, `parent`, `impact`, `submit`, `cancel`, `problem` |
| `controls.batch` | `root`, `action`, `category`, `tags`, `summary`, `progress`, `submit`, `cancel`, `resultRow(itemCode)`, `refreshError` |
| `controls.copy` | `root(copyKind)`, `sourceSearch`, `sourceRow(businessCode)`, `target`, `section(sectionKey)`, `preflight`, `back`, `execute`, `resultRow(businessCode)`, `close`, `problem` |
| `controls.governance` | `root`, `action`, `impact`, `gap(fieldKey)`, `submit`, `cancel`, `result`, `problem` |
| `controls.common` | `dirtyConfirm`, `dirtyStay`, `dirtyDiscard`, `confirm`, `confirmYes`, `confirmNo`, `inlineRetry(surfaceKey)` |

三道机械 gate 同批进入既有 P1/locator/L2 链：

1. `catalogTestIds` exported leaf key exact-set = locator binding key exact-set；任一 missing/extra/inline string 均 FAIL。
2. AST 枚举商品工作区所有 Button/Input/Select/TreeSelect/Checkbox/Radio/Switch/Upload/可交互行与关闭入口；每个都必须消费上述 key，差集点名组件和控件。
3. 结合 seed business code/editorId 物化动态 testId 后，`declared concrete testIds - L2 touched concrete testIds = ∅`；只打开 surface 或只断言元素存在不计 touched。

### 11b.3 L2 business-case exact-set（24）

本批在既有 `catalog-inventory-l2-case-blueprint.json` 扩展以下 24 个 case ID；每条都必须写业务 oracle，写场景的
failure case 还必须断言 owner readback 未变。`locator key group` 在生成时展开为 §11b.2 的具体 key，不能由
Playwright 自写 selector；同时自动并入该 Journey 覆盖的 §11b.1 surface IDs，因而 47 个 surface testId 也进入
同一个 touched exact-set，不另建只查元素存在的假 case。

| Journey | caseId | locator key group | business oracle |
| --- | --- | --- | --- |
| J-CATUI-01 | `catalog-find-success` | workbench + itemTable | 筛选后父 total 正确；展开父行得到逐 SKU 对齐行且父 total 不变 |
| J-CATUI-01 | `catalog-find-failure` | workbench filters + itemTable.skuRetry | SKU read 失败只占展开区，筛选/父页/其它展开不变 |
| J-CATUI-01 | `catalog-find-recovery` | itemTable + view.close | 打开再关闭详情后原筛选、cursor、滚动、展开和焦点恢复 |
| J-CATUI-02 | `catalog-view-success` | itemTable.itemOpen + view.* | 九区段用业务文本回答且 DOM 中无 Form/disabled 编辑控件 |
| J-CATUI-02 | `catalog-view-failure` | view.retry | detail 失败可重试，列表与商品事实不变 |
| J-CATUI-02 | `catalog-view-recovery` | view.close | 关闭回触发行；长内容滚动与焦点归还正确 |
| J-CATUI-03 | `catalog-create-success` | create.* + category candidate | 树形选分类后只建立 DRAFT，并接力打开同商品 Editor |
| J-CATUI-03 | `catalog-create-failure` | create.problem + create.submit | 重码/越 scope 拒绝；列表零新增且不打开伪编辑态 |
| J-CATUI-03 | `catalog-create-recovery` | create fields + create.cancel | 失败后修正可成功；取消后焦点回“新建商品”且无半商品 |
| J-CATUI-04 | `catalog-edit-success` | edit.* + childTask.* | 区段级 dirty/error 聚合；一次保存后 readback 与 View 一致并清 session 草稿 |
| J-CATUI-04 | `catalog-edit-failure` | edit.errorSummary + edit.field | typed problem 定位字段/区段，owner version 与事实不变、草稿保留 |
| J-CATUI-04 | `catalog-edit-recovery` | edit.restorePrompt/restore/discard | 意外关闭或页面刷新后恢复同商品、同版本、同区段和字段草稿；编辑内维护元数据不触发恢复链 |
| J-CATUI-05 | `catalog-config-success` | config.* | 三种配置形态各完成一次合法变更，返回原库原行且只刷新相关候选 |
| J-CATUI-05 | `catalog-config-failure` | config.action + config.detail | 被引用删除/非法更新拒绝，既有绑定和版本不变、原因可见 |
| J-CATUI-05 | `catalog-config-in-editor` | edit + config child + trigger focus | 编辑保持打开；关闭元数据 child task 后草稿、区段和滚动位置不变，焦点回原维护控件；新建配置仅通过精确候选失效出现 |
| J-CATUI-06 | `catalog-batch-success` | itemTable select + batch.* | SKU 行不可选；提交前摘要、进度、成功 N/失败 M 与逐项原因一致 |
| J-CATUI-06 | `catalog-batch-failure` | batch.category/tags/resultRow | 非法目标或旧版本逐项拒绝，失败项 owner facts 不变、先前成功项保留 |
| J-CATUI-06 | `catalog-batch-recovery` | batch.refreshError/close | receipt 已成立但刷新失败仍可见；重试刷新不伪造批量结果 |
| J-CATUI-07 | `catalog-copy-success` | copy.* | 来源/目标/范围贯穿 preflight→execute；结果逐项与目标 readback 一致 |
| J-CATUI-07 | `catalog-copy-failure` | copy.problem/resultRow | semantic conflict 阻断且目标不存在/版本不变，不用 toast 覆盖逐项结果 |
| J-CATUI-07 | `catalog-copy-recovery` | copy.back/section/preflight | 返回修改来源或范围立即作废旧 token，重新预检后才可执行 |
| J-CATUI-08 | `catalog-governance-success` | governance.* + common.confirm | 只显示 contract 允许动作；确认后状态/version/readback 正确 |
| J-CATUI-08 | `catalog-governance-failure` | governance.problem + lifecycle confirm | 篡改 action/旧版本/引用阻止被拒，状态、版本、引用不变 |
| J-CATUI-08 | `catalog-governance-recovery` | governance.cancel/result + view | 取消或失败回到同一商品 View 和触发动作；转正补全不丢已填业务字段 |

L2 执行仍需 Dexter 单独授权；本节只冻结实现与 locator/blueprint 分母，focused test 不得冒充这些 case 已通过。

## 11c. Browser L2 readiness、TEST fixture 与执行动作

### 11c.1 当前能力分层（设计修订时静态亲验）

| 层 | owning source 当前事实 | readiness |
| --- | --- | --- |
| case/locator 骨架 | `catalog-inventory-l2-scenarios.json` 为 18 scenario/41 case；locator 与 spec 同为 41 | `PARTIAL_OLD_BASELINE` |
| execution profile | `catalog-inventory-l2-execution.json` 为 `FRAMEWORK_ONLY`、`enabledCaseIds=[]` | `NOT_READY_ACTIVE_CASES=0` |
| fixture boundary | `catalog-inventory-l2-fixture.mjs` 已拒绝 seed/report 输入并要求 TEST/owner commands | `PARTIAL_SCHEMA_ONLY` |
| 本批 fixture | fixture catalog 现有 39 个 TEST dataset 均未提供本批 24 case 的 before/action/expected/unchanged | `NOT_READY` |
| managed runtime | `apps/frontend/operations-admin/playwright.config.ts` 仅配置 baseURL/trace；`scripts/` 无 browser L2 runner | `NOT_READY` |
| affected selector | `affected-l2-registry.json` 无商品库 surface 映射，仍可能 fallback all | `NOT_READY` |
| action diagnostics | 无 case/action/testId 到 requestId/completion/DB section 的 join artifact | `NOT_READY` |

因此 `L2_EXECUTION_READY=false`。实施完成前任何 0 active case、旧 41 case、focused、静态或手工 Playwright 结果都
不得称为本批 L2。静态 self-test 的目标是证明准入条件闭合，不授权启动浏览器。

### 11c.2 单链目标与激活

1. P1 在既有 `catalog-inventory-l2-case-blueprint.json` 追加 8 个本批 scenario、24 个 case；旧 18/41 不删，
   generated 总分母 `SCENARIOS=26; CASES=65`。`catalog-inventory.spec.ts` 消费 generated policy 分母，不再复制
   `caseCount===41`；P1 self-test 仍以 41+24 的 exact-set 和 red mutation 防止静默漏发。
2. `catalog-inventory-l2-locator-bindings.json` 同一生成链加入 `catalogTestIds.ts` 的 surface/control bindings；
   `affected-l2-registry.json` 新增唯一 `OPERATIONS-CATALOG-LIBRARY`，路径覆盖 catalog-management UI/model 与本批
   generated API，测试仍指向既有 `catalog-inventory.spec.ts`，不使用 fallback 证明选择正确。
3. 唯一受管入口为 `scripts/test/browser-l2`，内部 runner 只编排既有 Playwright projects/specs/policy/fixture，
   不另造用例 DSL。它在本机启动 Spring Boot、platform-admin、operations-admin、Playwright，建立 middleware/HTTP/
   asset tunnel，并为远端 DB 与资产创建每 run 隔离命名空间；它不得复用或修改长期 DEV，也不得读取 DEV seed。
4. 只有 runner identity/资源预检、fixture setup+readback、65-case/binding 生成链、24 active case、diagnostic join、
   local+remote cleanup self-test 全 PASS 后，execution profile 才由 owning generator 一次性改为
   `mode=INCREMENTAL; enabledCaseIds=<§11b.3 exact 24>`。任一缺失继续 `FRAMEWORK_ONLY` 且受管入口 fail closed。

### 11c.3 本批 TEST fixture exact-set（8）

在 `catalog-inventory-fixture-catalog.json#testDatasets` 追加且仅追加以下 8 个 TEST dataset；39→47。每个 dataset
`generatorRecipe.kind=OWNER_COMMAND_FIXTURE`，运行时由受管 runner 经 owner HTTP commands 物化，并输出按 case
分区的 `preState/actionInput/expectedReadback/unchangedReadback`。`seedDatasets` 仍为独立 DEV 体验数据，不参与 L2。

| fixtureRef | 关键事实与边界 | 覆盖 cases |
| --- | --- | --- |
| `FIXTURE-CATALOG-LIBRARY-FIND` | 深度3分类、同名不同路径、智能视图/商品标签/生产标签/全部商品跨分类结果、父商品3规格且 pageSize+1、无规格商品、两种生产标签及无标签商品、十列长短/空值组合、稳定滚动锚点、规格读取故障注入 | find success/failure/recovery |
| `FIXTURE-CATALOG-LIBRARY-VIEW` | 九事实族非空商品、合法空区段商品、长名称/长说明/多图、只读身份、detail 故障；全部 actionAvailability | view success/failure/recovery |
| `FIXTURE-CATALOG-LIBRARY-CREATE` | 可创建身份、树形分类候选、唯一业务码、重复码、越范围身份、创建前父列表 digest | create success/failure/recovery |
| `FIXTURE-CATALOG-LIBRARY-EDIT` | 两区段可改商品、商品级 0/1 生产标签、SKU 制作覆盖但无标签字段、选项影响但无标签字段、稳定集合行、配置缺口、同版本恢复草稿、旧版本冲突、typed field/row error、before version/digest | edit success/failure/recovery |
| `FIXTURE-CATALOG-LIBRARY-CONFIG` | 简单/父子/复杂三库；生产标签可新建、被引用不可删、停用但既有绑定可见且不进入新候选、非法更新、其它五库 fetch baseline | config success/failure/recovery |
| `FIXTURE-CATALOG-LIBRARY-BATCH` | 三个父商品：合法项、旧版本项、引用阻止项；另有不可选择规格行；深分类和标签候选；逐项 before digest | batch success/failure/recovery |
| `FIXTURE-CATALOG-LIBRARY-COPY` | 品牌/本地来源与目标、兼容范围、语义冲突、旧影响检查 token、目标不存在/目标旧版本、逐项 before digest | copy success/failure/recovery |
| `FIXTURE-CATALOG-LIBRARY-GOVERNANCE` | 可转正临时商品、缺口商品、旧版本/引用阻止、可用/不可用生命周期动作、历史快照 baseline | governance success/failure/recovery |

共同 fixture 还必须创建当前 run 独有的有权限、只读、越范围登录身份，以及 DB/资产 namespace。fixture report
只能写业务码、版本、数量和不可逆 HMAC fact digest，不得写用户输入、识别码值、说明、token/cookie/raw payload。
setup business 或 setup cleanup 非 PASS 时不启动浏览器。readiness 阶段资源为了交给浏览器继续使用，
`cleanupStatus` 必须保持 `PENDING_HELD`，不得伪报 PASS；最终 L2 execution 才负责按 manifest identity
删除本 run 事实与资产并做零残留 readback，结束后的 local/remote cleanup 必须分别为 PASS。

### 11c.4 24 case 的动作与 oracle

| Journey | success 动作/结果 | failure 动作/结果 | recovery 动作/结果 |
| --- | --- | --- | --- |
| 查找 | 选深分类→设状态/来源→搜索→展开父行→加载更多规格；父 total、3 个规格的十列/共享表头逐格正确；再选“生产标签”二级节点，只有匹配父商品且展开后显示全部规格；横滚到来源列，四行溢出 Tooltip 可读 | 对故障父行展开或篡改 `productionTagRef`；只出现对应错误，父页、筛选、其它展开、owner facts 不变，商品标签筛选不得被串用 | 刷新后筛选、cursor、横纵 scroll、expanded keys 保留且零额外请求；关闭 View 后焦点回触发行 |
| 查看 | 以只读身份开长内容商品并逐区段滚动；九区段业务 copy、动作能力、空态成立，DOM 零 Form/disabled/技术词 | 注入 detail 读取失败后打开；显示逐字读取失败文案，工作台和 owner facts 不变 | 点击重新加载成功，再关闭；滚动无双祖先、焦点回商品/规格名称 |
| 新建 | 输入名称/业务码/类型，TreeSelect 展开路径并选分类，提交；只建 DRAFT，readback 后接力同商品 Editor | 用重复码及越范围篡改分别提交；定位字段/任务原因，父列表/owner count/version 不变且不打开 Editor | 修改重复码后成功；另一路取消，零新增并回“新建商品” |
| 编辑 | 修改两个区段并为商品单选/清除生产标签、重排稳定行、应用子任务并保存；一次 request，View/readback 一致，SKU/选项提交体无标签字段，session 草稿清空 | 篡改提交两个生产标签、向 SKU/选项 effect 注入标签、触发 field/row problem 或 version conflict；owner 拒绝且 version/facts 不变 | 制造意外关闭或页面刷新，重开并恢复同商品/版本/区段/单一标签/错误/焦点；编辑内维护元数据时编辑保持打开、草稿不进入恢复链；放弃后 session 零残留 |
| 配置 | 生产标签简单库改名、父子库新增值、复杂库同栏保存；各自 readback 正确，仅相关库/候选请求增加 | 删除被引用生产标签并提交非法更新；逐字原因，定义/绑定/version 不变 | 从 Edit 打开子任务新建生产标签；关闭后编辑仍打开、草稿不变，候选刷新并可单选新标签 |
| 批量 | 只选父商品，选树形分类后提交；出现摘要→进度→逐项结果，规格行不可选，receipt 与 owner readback 一致 | 混合合法/旧版本/引用阻止项；成功项保留、失败项 unchanged，原因逐项可读 | 注入列表刷新失败；receipt 不变且显示“结果已保存，列表暂未更新”，重新加载后列表一致 |
| 复制 | 从品牌复制选择来源/目标/范围→检查影响→复制；全过程对象持续可见，逐项结果与目标 readback 一致 | 选语义冲突范围；影响检查阻断，目标不存在或 version/digest 不变 | 返回修改范围使旧 token 失效；不重新检查时不能复制，重新检查后成功 |
| 治理 | 查看可执行动作并确认转正/生命周期；结果 readback 的状态/version 正确，技术 code 不显示 | 用隐藏动作、旧版本、引用阻止请求；owner 拒绝，状态/version/引用/历史快照不变 | 失败或取消后回同商品同动作；补齐缺口重新检查，已填业务字段保留并可成功 |

每个 action 在 blueprint 声明 `expectedNetwork=REQUIRED|FORBIDDEN|BACKGROUND_ALLOWED` 与精确 operationId 集合。
写 case 的 DOM 结果只证明用户反馈，权威 oracle 必须从 fixture 声明的 owner HTTP readback 取 before/after 对账。

### 11c.5 同拓扑时长预算与 timeout 派生

本机 Spring Boot 经受管 tunnel 访问远端每 run PostgreSQL namespace，会重新承受
`project-memory/decisions/http-crud-efficiency-design-redlines.md#PERFORMANCE_IS_TWO_MULTIPLIERS` 所记录的
往返成本。历史同口径实测为每次 DB 操作约 `42.7ms`；这个数值是 `DB duration / DB operation count` 的实测，
但“全部由 SSH tunnel 导致”仍是推论，不写成因果事实，也不能用 Testcontainers 同侧数字替代。

每个 L2 action 除 operationId exact-set 外，还必须声明该 operation 的 `maxRequestCount`。每个 fresh browser case 先计入
登录、会话和商品工作台首次读取这一公共 HTTP envelope，再叠加该 case 的专属 action 请求；生成器从唯一 generated
operation registry 读取 `databaseOperationBudget.max`，不得在 L2 blueprint 复制 DB 预算：

```text
caseDbOperationUpperBound = Σ(maxRequestCount × databaseOperationBudget.max)
caseExpectedDbMs = caseDbOperationUpperBound × 42.7ms
caseLocalActionMs = actionCount × readinessProbe.localNoNetworkActionP95Ms
caseTimeoutMs = ceilToSecond(2 × (caseExpectedDbMs + caseLocalActionMs))
fullRunExpectedMs = namespaceAndFixtureBudgetMs + Σ(caseExpectedDbMs + caseLocalActionMs) + cleanupBudgetMs
fullRunTimeoutMs = ceilToSecond(2 × fullRunExpectedMs)
```

`2` 是全套统一的 `L2_TIMEOUT_HEADROOM_FACTOR`，不是逐 case 手调值；任何 case 自写 timeout、缺 operation budget、
公共 fresh-case envelope 漏算、`maxRequestCount` 为 null/无限或 registry 预算变化后未重算都 fail closed。readiness 在同一主机和浏览器配置下对
无网络本地交互做固定 20 次 probe，记录 p95；namespace/fixture/cleanup 预算由其阶段 manifest 的 operation 预算与
受管 provision/cleanup self-test 上界合成。作为量级校验，4 次 DB 操作的历史 DB 期望约 `171ms`，102 次约
`4.36s`，均为 headroom 前数值。P1/runner 必须生成 `l2-timing-budget-report.json`，列出 24 个 active case 的
actionCount、operation multiset、DB 上界、expected/timeout 和整场 expected/timeout；实现期以精确 blueprint 计算出的
报告为准，不在设计文档猜一个整场常量。

runner 的 action 窗口仍遵守 §11d：预期日志缺失立即报 `NO_NEW_EVENT`，不得因为 timeout 尚未到而等待；实际耗时
超过派生 timeout 时记录首败与分段耗时，不允许现场抬高 factor 止血。未来若执行拓扑不再经 DB tunnel，必须重做
同口径 calibration 与设计复核，不能继续沿用 42.7ms。

### 11c.6 `SECRET_INJECTION` 合同

`scripts/test/browser-l2` 同批新建唯一 runner-local adapter `scripts/test/browser-l2-credentials.mjs`。它只复用
`scripts/dev/r5-dev-environment.mjs` 已有的非 secret 远端 host trust/allowlist 读取与
`scripts/dev/r5-dev-runner.mjs` 已验证的随机 secret、0600 文件、远端 PostgreSQL/MinIO bootstrap 形态；不得读取
长期 DEV manifest/credential 文件、DEV namespace 或 DEV session，也不得把 helper 变成 App/business runtime 能力。

runner runtime 为 `.runtime/browser-l2/<runId>/`，目录权限 `0700`；`credentials.env`、platform/operations
Playwright storageState 与任何一次性 session 文件均为 `0600`。credential adapter 的有限 secret 类如下：

| secret 类 | 唯一来源与 run 绑定 | 最小注入目标 | 明确不接收 |
| --- | --- | --- | --- |
| 远端 host 访问 | 现有受管 SSH agent/keychain + host fingerprint allowlist；runner 只校验 host/fingerprint/boot identity，不复制 private key | namespace provision/cleanup 与 HTTP/asset tunnel 子进程 | Spring Boot、Vite、Playwright、manifest |
| 每 run DB app role | adapter 为 `<runId>` 生成 username/password，并绑定 exact DB namespace；远端 bootstrap 只创建该 run role/database | 远端 DB provision/cleanup；本机 Spring Boot 的既有 `CATERING_BUSINESS_DB_*` env | Vite、Playwright、日志/join |
| 资产存储访问 | 通过受管 SSH 从既有远端非生产 MinIO 取得权威 access/secret，绑定本 run object prefix；不建立第二套对象存储 | 远端 asset provision/cleanup；本机 Spring Boot 的既有 object-storage env | Vite、Playwright、manifest raw value |
| 应用 HMAC/诊断 | adapter 每 run 生成 rate-limit、DB-operation HMAC 与测试诊断 secret | 仅本机 Spring Boot；DB event verifier 只收所需 HMAC | Vite、浏览器 DOM、HTTP body |
| TEST 登录/OTP | fixture bootstrap 为本 run 创建随机 platform/operations 密码和固定 TEST OTP；账号身份与 namespace 一并绑定 | owner-command fixture setup；Playwright global setup | Spring Boot 日志、case artifact、业务 contract |
| 浏览器 session | Playwright global setup 用上行登录材料生成本 run storageState/cookie 文件 | 对应 Playwright project | fixture catalog、跨 run case、manifest raw value |

两个 Vite 只接收本机 HTTP proxy target/port；Playwright test worker 只接收 base URL 与其 project 的 storageState 路径；
HTTP/asset tunnel 只由受管 SSH identity 建立，禁止再给 tunnel 发明 token/password 环境变量。每个 child process 的 env
由独立 allowlist 投影，禁止把 `credentials.env` 整体 spread 或打印 environment dump。

`credentials.env` 旁的非 secret binding metadata 必须记录 `runId`、DB namespace、asset prefix、host fingerprint、
created/expires epoch、允许 key exact-set 与 key-set digest；manifest 只记录 credential/session 文件路径、mode、存在性、
key-set digest、binding metadata 和 cleanup 状态，不记录 raw secret、secret digest、password/hash、OTP、login name、token、
cookie、Authorization、signed URL 或 storageState 内容。

`resource-preflight` 后、`namespace-provision` 前创建材料；每次子进程启动和 `fixture-setup` 前重新验证。失败码闭集：
`L2_SECRET_FILE_REQUIRED`、`L2_SECRET_FILE_MODE_INVALID`、`L2_SECRET_REQUIRED_MISSING`、
`L2_SECRET_ALLOWLIST_MISMATCH`、`L2_SECRET_FORMAT_INVALID`、`L2_SECRET_STALE`、
`L2_SECRET_RUN_BINDING_MISMATCH`、`L2_SECRET_NAMESPACE_BINDING_MISMATCH`、`L2_SECRET_LEAK_DETECTED`。
任一失败禁止启动浏览器 business，但仍进入 owned-resource cleanup。

cleanup 顺序为撤销 storageState/session → 删除本 run asset prefix/DB/role → 关闭 owned tunnel/process tree → unlink
runner credential/session 文件 → readback 本地路径不存在且远端 namespace 零残留。任一步失败分别写 local/remote cleanup
FAIL。red mutation 至少覆盖：删一项 required secret；加入一个 undeclared secret；把 required secret 改为格式非法值并
精确命中 `L2_SECRET_FORMAT_INVALID`；把 binding metadata 的 expires epoch 改为已过期并精确命中
`L2_SECRET_STALE`；文件 mode 改为非 0600；复用旧 run credential/session；改错 namespace binding；向
manifest/log/join 注入一个 secret-shaped 字段。八项必须各自独立真红，不能由一个泛化 throws 代替。

## 11d. 可观测性、no-new-log 与首败链

### 11d.1 关联产物

受管 runner 生成 `action-request-join.jsonl`，每行只含：

```text
runId,caseId,stepId,actionId,testId,actionWindowId,requestKind,
method,routeTemplate,generatedOperationId,requestId,correlationId,traceId,
frontendEventId,backendPhase,databaseOperationCount,sectionCounts,outcome
```

Playwright 在 action 开始/结束间监听 request，读取 `createObservedBaseQuery` 已写入的 request/correlation headers，
再以 generated method+route registry 解析 operationId；无需在生产请求 body 或业务 contract 加测试字段。并发自动
刷新按 blueprint 的 operation exact-set 标为 `BACKGROUND`，无法归属、operation 不在声明集合或同 request 跨两个
action 均 fail closed。

### 11d.2 expected-event/no-new-log 矩阵

| action 类型 | Playwright step | frontend lifecycle | frontend request | backend completion | DB rows | runner heartbeat |
| --- | --- | --- | --- | --- | --- | --- |
| 本地展开/关闭/切区段且声明无网络 | 必须新增 | 必须新增 | 必须为 0 | 必须为 0 | 必须为 0 | 必须新增 |
| read/search/load-more | 必须新增 | 必须新增 | 必须新增且 operation exact | 必须同 request | count>0 时必须同 request | 必须新增 |
| write/影响检查/重试 | 必须新增 | 必须新增 | 必须恰有声明 write/read | 必须同 request/outcome | count>0 时必须同 request | 必须新增 |
| background refresh | 归属触发 action | 可选独立 lifecycle | 只允许声明集合 | 必须同 request | count>0 时必须同 request | 必须新增 |

预期事件在 action 窗口结束时不存在，立即写 `NO_NEW_EVENT:<source>`；artifact 文件不可读写
`LOG_NOT_AVAILABLE:<source>`。不得用等待、增加 timeout 或重复点击掩盖。`databaseOperationCount>0` 时，
`db-operation-events.jsonl` 必须存在同 run/correlation/request/operation rows，row section 聚合与 completion
`sectionCounts` 一致，否则 `DB_OPERATION_EVENTS_MISSING` 或 `DB_SECTION_JOIN_MISMATCH`。

### 11d.3 manifest、脱敏与 red mutation

browser L2 manifest 每阶段维护 `lastKnownGood`，首败写结构化 `firstFailure={code,caseId,actionId,source}` 与
`brokenBoundary`；阶段闭集为 `resource-preflight / namespace-provision / process-start / tunnel-ready /
fixture-setup / browser-execution / artifact-join / business-verification / cleanup-local / cleanup-remote`。stdout 必须
分别打印 business、local cleanup、remote DB cleanup、remote asset cleanup；任一 cleanup 非 PASS 整体失败。

前端复用 `operationsLogger`、`createObservedBaseQuery` 和 foundation lifecycle diagnostics；后端复用 HTTP completion
与 DB tracker。禁止日志包含商品/人员名称、搜索词、识别码、制作说明、草稿值、URL query、body、SQL/bind raw、
password/OTP/token/cookie/Authorization、原始 IP 或资产签名。red mutation 至少覆盖：删 requestId join、错
operationId、删 DB row、sectionCounts 不一致、丢 heartbeat、只写 firstFailure 不写 lastKnownGood/brokenBoundary、
注入 Authorization/raw payload 字段、伪造 cleanup PASS 而 namespace 仍存在；每项必须真红。

## 11e. 2026-08-24 最终裁定的契约—状态—owner 闭环

### 11e.1 契约唯一事实

| 业务事实 | contract declaration | owner 强制 | UI 消费 |
| --- | --- | --- | --- |
| 商品生产标签 | `CatalogItemSaveRequest.productionTagRef: uuid|null`；detail/page item 同名 nullable 字段 | catalog whole-save 只接受 0 或 1；非空 ref 必须属于当前 scope/brand 且新绑定时启用 | 商品编辑区为可清除单选；既有停用绑定照常显示；不得出现多选、数组或“至少选一个” |
| SKU 制作覆盖 | profile 只保留制作单显示名称、预计制作时长、制作说明 | SKU 可覆盖这三项；不得提交生产标签 | Editor 不渲染 SKU 生产标签控件，提交体没有相关字段 |
| 点单选项制作影响 | effect 只保留非负时长增量与按业务序追加的制作说明 | owner 拒绝任何生产标签增删字段 | 子任务不渲染生产标签控件；多选合成仍为非负求和与稳定文本追加 |
| 导航生产标签节点 | `CatalogNavigationView.data.productionTags[]` 每行至少含 `tagRef/code/name/status/count` | 返回全部定义；count 是绑定该标签的未作废父商品去重数，不把 SKU 重复计入 | 与“商品标签”并列一级节点，二级逐标签；停用项显示“已停用”且仍可筛历史绑定 |
| 生产标签筛选 | `CatalogItemPageQuery.productionTagRef: uuid|null`，与 `tagRef` 是两个不同字段 | SQL 在 scope/brand 内按 `PRODUCTION_TAG` 关系筛父商品；total 不含 SKU；不做本地后过滤 | 选生产标签节点清 cursor/selection/stale expanded；展开命中父商品时加载其全部 SKU |
| 十列表格摘要 | parent/SKU page 返回各 owner 已排序的结构化摘要，不返回拼好的 JSX/HTML | catalog task read 做 set-based 投影；价格 nullable；不把盘点单位当商品单位 | 精确十列全部默认可见；每格最多四行，溢出省略并 Tooltip；横向滚动承载完整信息 |

树上同一时刻只有一个业务结果选择器：smart view、shape、category、catalog tag、production tag 或 uncategorized。
keyword/status/source 是结果域过滤条件，可与该选择器组合。切换业务结果选择器必须清除旧选择器字段；尤其
`tagRef` 与 `productionTagRef` 不得同时残留。该级联由 workspace reducer 控制，字段合法性和实际筛选由 contract/owner
控制，组件不得从标签名称或 tree key 猜 query。

### 11e.2 十列结构化投影与视觉消费

1. 商品：父行依次为名称、编码、完整分类路径、商品标签；规格子行仅规格名称与规格编码。名称不拼编码。
2. 商品形态：父行显示业务形态；规格子行显示“规格”，默认规格用同格弱强调 Tag。
3. 价格和单位：第一行价格或中性“未设置”；其后完整列出销售单位、基础计量单位并标明类型。两类单位均无时不造占位；
   盘点单位不进入此列。若类型行超过四行，第四行显示“还有 N 项”，Tooltip 给出完整有序清单。
4. 规格或选项：父商品按业务顺序罗列实际规格维度或点单选项，不显示“共 N 个”；规格子行每行一个“规格名：规格值”，
   最多四行均为实际业务内容，不用“还有 N 项”替代第四行；超出仅由 Tooltip 按业务顺序承载完整清单。
5. 商品属性：按定义业务顺序显示“属性名：值”，合法空为“未设置商品属性”。
6. 制作信息：显示生产标签、制作单显示名称、预计制作时长、制作说明的业务摘要；空为中性“未设置”。不得显示
   route、owner、profile、ref、override 等技术词。
7. 库存与 BOM：用“直接扣当前商品或规格”“按配方扣减 N 种用料”“不参与库存”等业务句；不显示内部 mode/ref。
8. 更新时间使用短格式并在 Tooltip 给完整时间；状态使用全库统一 Tag；来源使用业务名称。

所有单元格统一 14px 主信息、12px 次信息、主色/次色/弱提示三级，行内不能塞操作按钮。Tooltip 只补完整内容，
不放新增事实或唯一操作入口。横向滚动是预期交互，禁止因屏宽删列、压成复合斜杠列或把默认列藏进设置。

### 11e.3 数据与 owner 实现边界

- `catalog_item_reference` 继续承载 `PRODUCTION_TAG` 与 `CATALOG_TAG` 两类关系；新增
  `UNIQUE(item_ref) WHERE kind='PRODUCTION_TAG'`（索引名由 migration 统一生成），数据库最后一道保证同商品最多一行。
- `CatalogItemReferenceFacts` 提供 singular replace/read；商品标签继续集合接口。禁止给 singular 再套 array 兼容层。
- `CatalogPreparationFacts` 的 profile/effect allowed-field exact-set 删除生产标签字段；持久化迁移直接处理
  `catalog_item.preparation_profile`、`catalog_sku.preparation_override` 与 option override 的 `preparation_effect`，不得把
  运行时合成的 `sections.productionTagRefs` 当成独立存储再迁一遍。`CatalogOwnerService` 的 create/save/
  copy/promotion/readback/reference closure 同步改 singular。跨 owner 只用 production owner 验证标签定义与生命周期，
  catalog 拥有商品绑定事实。
- copy/preflight 对生产标签只映射商品级单值。来源标签无法唯一映射、目标标签停用或映射冲突时沿既有 typed conflict
  阻断，不丢弃、不选第一个。
- 本期没有 production route HTTP operation、dispatcher、工作台、队列、KDS、默认路由或 fallback。未来生产链只能消费
  catalog 已保证的 0..1 标签事实；“最多一个”不等于“必须有一个”。

### 11e.4 生成、测试、日志与停机

- P1 的 schema self-test 必须证明：singular 字段存在且 array 字段精确为零；navigation/query 字段分离；SERVICE 等 shape
  的既有制作准入不被改写。红变异分别把 singular 改 array、恢复 SKU tag、恢复 option add tag、删 query 字段，必须真红。
- owner focused/integration 必须覆盖 0→1、1→0、1→另一个、重复/双值篡改、停用既有可见、新绑定停用拒绝、跨 scope
  拒绝、copy mapping conflict、数据库 unique constraint。拒绝后 catalog version 与关系事实不变。
- acceptance 按 §11 的三组合并、一拆二、两新增保持 80；L2 仍为 26/65、active 24，不新增平行 case 链，只增强 find/edit/
  config 三组 case 与对应 TEST fixture。用户 oracle 包含单选、清除、树筛选、十列、四行 Tooltip 和失败后事实不变。
- completion/log 只记 operationId、requestId、scope kind、结果数量、是否有生产标签、耗时和 problem code；不得记录标签名、
  标签 ref、制作说明、raw query/body。migration preflight 只记分类与计数。
- 任一 preflight 冲突、现有生产标签定义无法稳定取得 scope/brand、列表摘要必须 N+1、annotation 宿主 identity 无法保持、
  或实施需要生产路由语义，均立即停机交 Dexter；不得用兼容读取、客户端过滤或默认标签止血。

## 12. 未决项处置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| 自动合并版本冲突草稿 | 未裁 | 保留草稿并阻止保存，查看最新或放弃后重开 | 自动 merge/last-write-wins |
| 分类只能选叶子还是任意节点 | owner/contract 场景化事实 | candidate row 声明 selectable/disabledReason | UI 全局硬编码 |
| 浏览器后退/深链编辑 | 已接受非目标 | sessionStorage 恢复当前商品任务 | 新建独立路由/伪深链 |
| 浏览器 L2/UAT | 未授权 | 前置 blueprint/testId/locator 设计 | focused/静态冒充执行结果 |
| DEV reset/start/seed | 未授权 | 设计 seed 与 executor proof | 实际执行 |

## 13. 停机条件

1. CP-00 任一实时分母或锚点不符；
2. 分类 candidate 无法在不新增“只能叶子”等产品语义下给出 selectable；
3. 轻量 SKU task read 需要改库存/价格 owner 事实主权或新增跨 schema 写；
4. 80 annotation 无法通过同 operation 场景合并保持全部业务断言；
5. 现有 category/SKU 数据无法在预算内读取且必须新增有业务语义的表/缓存；
6. IA 的 state/cascade 不变量相互冲突或实现必须恢复 View/Edit 共树、平铺分类、server mirror、fallback；
7. 生成链 operation exact-set、budget、bindings、P3 不能同时闭合；
8. 实施期发现新的产品/Journey 语义缺口。

上游设计、评审 finding、数字均是待验证输入；停机时给源码事实、两种候选理解、倾向与理由，不自行补义。

## 14. 交付前自查

| 检查 | 判据 |
| --- | --- |
| §3 行完整 | 17/17，无删除；生产标签迁移的 preflight、事务内重复 predicate 与 unique index 齐全 |
| §3 ④ 全集 | 6 核心 scoped reads、33 writes、16 read consumers、12 candidate controls、8 task variants、9 fact families 均有清单 |
| §7 机制行 | collection/auth/cache/error/log/testId 均跨层逐值 |
| 详设 ↔ IA | state 三住址、task union、cascade、refresh、46 problem、8 IA-ID 逐字一致 |
| seed 全集 | 仅 P1 `catalogDefinitionSeed` 与 seed executor，两类改动齐全 |
| 计数 | 开工实时复算；历史输入 57→59、238→239、80→80、20 anchors |
| 证据档位 | focused/static/acceptance/browser L2 分开；L2 未授权即留未验证 |
| 控制权 | contract/owner/RTK/App/foundation 逐控件一个职责；现有 acceptedPage/category-local-admission gap 点名退役 |
| L2 readiness | current NOT_READY；目标 26/65、active 24、TEST datasets 39→47、managed runner/join/cleanup 全有 red mutation |
| 日志首败 | action→request→completion→DB section 可关联；no-new-log、lastKnownGood、brokenBoundary 与四类 cleanup 可判 |

```text
DESIGN_STATUS=PROPOSED_FOR_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
OPEN_PRODUCT_DECISIONS=0
KNOWN_UNVERIFIED=browser L2(current readiness NOT_READY);UAT;real migration separately authorized;reset/start/seed;implementation runtime
```

> 2026-08-26 观察问题整改附录：展开入口、生命周期体验 seed 与引用/作废表达按
> `2026-08-26-v2s-catalog-workbench-observed-remediation-design-addendum-codex.md` 覆盖。
