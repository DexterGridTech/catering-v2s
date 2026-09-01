SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# v2s 门店销售菜单 · implementation-facing 详设

- 日期：2026-09-01
- 状态：`EXTERNAL_CLAUDE_DESIGN_REVIEW_GO_S_FINDINGS_RESOLVED_READY_FOR_DEXTER_IMPLEMENTATION_DECISION`
- 设计 owner：Codex
- 页面：运营管理后台唯一“门店销售菜单”页面
- 计划：`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- 外部评审：`doc/review/platform/2026-09-01-v2s-sales-menu-design-review-claude.md`
- 作者 intake：`doc/review/platform/2026-09-01-v2s-sales-menu-external-design-review-intake-codex.md`

## 0 · 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md
JOURNEY_REFS=门店运营编排并发布销售菜单；内部堂食/外带经营入口读取各自有效销售视图
IA_REF=doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md
INTERACTION_REF=doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md
TEMPLATE_REF=doc/decisions/templates/implementation-design-template.md
AUTHORIZED=基于 Dexter 已确认 IA 编写 implementation-facing 详设、串行实施计划和两轮 DESIGN 对抗审查
NOT_AUTHORIZED=生产代码实施；契约生成物写入；迁移执行；Testcontainers 动态执行；DEV start/stop/reset/seed；浏览器 L2；UAT；部署
IMPLEMENTATION_AUTHORITY=false
```

本设计遵循当前 Roadmap 的授权记录，但“当前做什么”只来自 Dexter 本次直接指派。本文所列动态命令均是后续实施的验证设计，不代表本轮执行授权。

## 1 · 真实业务目标与方案比较

### 1.1 这一批要解决的结构性问题

当前仓库有商品、库存和经营入口事实，却没有门店销售菜单 owner。若继续让商品目录、库存状态或经营入口页面临时承担菜单职责，会同时造成以下结构性错误：

1. 商品“是什么”与门店在某入口“怎么卖”混住，门店的名称、图片、规格和挂牌价覆盖会污染可复用商品事实；
2. 草稿与已发布内容没有冻结边界，编辑下一版会直接改变营业中的对客内容；
3. 多菜单与时段被压成“唯一当前菜单”，渠道无法同时取得多份已启用菜单并自行判断；
4. 库存派生不可售与人工沽清被合并，用户无法判断恢复动作属于库存还是人工决定；
5. 页面即使做出来，也没有 contract、owner、真实 HTTP、浏览器 L2 和 DEV seed 的同一业务事实闭环。

本批真正要建立的是：**门店拥有、按经营入口启用、草稿可编辑、发布后冻结、由前台菜单读取，并与库存及人工沽清保持独立维度的销售菜单事实**。页面只是这组事实的运营入口。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A · 把菜单字段加进 CatalogItem / SKU | 目录 owner 同时持有门店入口、销售分区、挂牌价、时段和发布状态；同一商品被多个销售项重复编入时无法独立表达 | 拒绝，因为破坏 CatalogItem 与 SalesCollection 的 owner 边界 |
| B · 页面实时读取商品、库存和渠道并即时拼菜单 | 没有不可变发布物；商品或库存变化会悄悄改写“当时发布了什么”；每次读取都产生跨 owner 合并和 N+1 风险 | 拒绝，因为无法证明发布冻结，也把有效销售视图变成现场推导 |
| C · 新建 `sales-menu` owner，稳定销售项身份 + 可变草稿版本 + 不可变发布版本/有效视图；库存只读叠加，人工状态由菜单 owner 持有 | 商品、菜单、库存、渠道各自保有主权；前台读取的是冻结定义和两个独立可售事实；同一入口可同时启用多份菜单 | **采用** |
| D · 本批同时建设 terminal-data-server/TDP/POS 投递 | 会把“本系统已生成前台菜单”扩张成终端同步项目，并违反 terminal-data-server 当前空占位边界 | 拒绝，因为超出当前批准需求和架构授权 |

**我选了 C 而不是 A/B/D，因为它是当前能同时满足 owner 主权、发布冻结、多菜单、独立可售维度和现有单 deployable 红线的最小完整方案。**

### 1.3 本批不扩张的边界

- 不建设品牌/总公司菜单、项目级菜单、菜单模板或参考菜单；
- 不建设“当前应该用哪一份菜单”的选择器、菜单合并器或入口形态动作矩阵；
- 不建设营销权益价、支付实付价、整单/桌台约束；
- 不建设 TDP、terminal-data-server runtime、POS ACK、外部平台同步或终端诊断面板；
- 不把库存事实复制进菜单表，不因库存缺货下架销售项；
- 不把操作记录扩展成发布诊断工作台；
- 不为本专题新建第二套 edge、browser runner、fixture catalogue、locator 协议或测试专用 API。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-00 | 契约、operation、页面/能力与生成链 | edge contract / admin catalog | 手写唯一源、生成物闭包、授权 requirement、operation binding | 已确认需求与 IA |
| CP-01 | 菜单领域模型、迁移与 owner API | `sales-menu` | 新 owner module/schema、草稿/发布/启用/人工状态/记录事实 | CP-00 wire 形状 |
| CP-02 | 跨 owner 判定、edge 编排与有效销售视图 | `sales-menu` + edge | Catalog/Inventory/BusinessChannel/Organization/Asset 任务 API；真实 HTTP | CP-01 |
| CP-03 | 后端真实业务验收 | backend-acceptance | `SalesMenuAcceptanceScenarios` 与聚焦/全量受管证明 | CP-00..02 |
| CP-04 | 运营后台单页工作台 | operations-admin | 路由、RTK model、工作台、抽屉、弹窗、分页与失败恢复 | CP-00..02 API 闭包 |
| CP-05 | 受管浏览器 L2 | shared browser L2 | sales-menu P1、同一 runner 扩展、fixture/readback、Playwright Journey | CP-03..04 |
| CP-06 | DEV Seed | sales-menu seed | 独立 domain plan/executor，接入 `r5-full` 父编排 | CP-03..05 动态闭包后才允许执行 |
| CP-07 | 全批静态/动态收口与三维对账 | 全批 | 阶段对账、整体对账、生成/测试/cleanup 证据边界 | CP-00..06 |

## 3 · 横切机制对照表

| 机制 | ① 用哪个现成能力/规范（精确路径或符号名） | ② 如何验证（可执行观察） | ③ 无现成时：必须符合什么形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `project-memory/decisions/confirmed-business-language-corpus.md` §G-05A；`PLATFORM-BLUEPRINT.md`“运营写权限与范围解析红线”；`WorkspaceSessionEntry.selectedDataNode`；`OperationsBusinessChannelController.requireScopedStore` 与 `OperationsBusinessChannelControllerScopeTest`；`contracts/registry/iam-org-governance-manifest.json` 的 `AUTHENTICATED_WORKSPACE_ROLE_NODE_RANGE` | `[acceptance]` 同角色可读所选门店菜单，换同 workspace 外门店或项目节点均得到 typed denial 且无数据泄漏；GET operation 不产生 capability requirement/ownerRecheck | N/A，必须复用 selected STORE equality + owner store judgment 同形判定；capability 只控制写，不能替代或缩窄主对象读取范围 | 经营入口、菜单选择、分区、草稿项、前台项、详情、发布预检、操作记录、候选已有数量 |
| 写授权与 grant 复核 | `WorkspaceCapabilityScopeResolver`；`OperationsOwnerScopeGrant`；`contracts/registry/iam-org-governance-manifest.json` 的 operation requirement/ownerRecheck | `[acceptance]` 缺 `EDIT_STORE_SALES_MENU`、跨门店或篡改 store/channel/menu/item ref 时 owner 拒绝，receipt/CAS/audit/operation log 均未写 | 新增 `OWNER_RECHECK_SALES_MENU`，每条菜单 command 在 receipt/CAS/audit 前复核 workspace + STORE + capability + 实际 aggregate；图片 stage/release 先由 SalesMenu owner 判定 URL 中 store/menu/item 关系，再由 Asset owner 复核 server-minted STORE grant、同一 target、usage/status | 17 条 sales-menu command 与 2 条菜单图片 Asset command |
| 跨 owner 写与事务 | backend 规范 §1-B；现有 `CatalogAssetCommandApi` 是机制先例；新增并列 `SalesMenuAssetCommandApi`；`@Transactional(REQUIRED)` | `[focused]` 保存自定义图片时 asset claim 与菜单版本同事务；任一步失败两边事实均不变；放弃 STAGED 图片只由 Asset owner 改状态 | 只有图片 stage/claim/release-STAGED 是跨 owner 写；其他跨域关系只任务读，不得直写 catalog/inventory/business_channel/organization schema | stage/release-STAGED 菜单图片、保存销售项时 claim；已进入任一 immutable publication 的 active 图片不得因草稿替换/归档释放；其余操作 N/A（反例：引用 ref 不转移 owner） |
| 集合形态与分页 | `OpaqueCollectionCursor`；`CursorPagination`；`useCursorStack`；IA“经营入口与菜单集合的可达性澄清” | `[acceptance+browser]` channel/menu/candidate/item/log 各自 21 条时第一页 20 条、第二页 1 条，无重无漏；换 query identity 后旧 cursor 被 owner 拒绝且 UI 回第一页 | owner-local keyset，cursor 编码 query identity + sort frontier + UUID tie-breaker；channel cards、menu selector、manager、candidate panel 都有显式顺序分页，禁止自动抽干/OFFSET/客户端 slice/总数/任意跳页 | 经营入口、菜单选择器、菜单管理、草稿销售项、前台销售项、添加候选、操作记录；销售分区为 Detail aggregate 完整有序结构 |
| 缓存失效 / 改完刷新什么 | RTK Query tag invalidation；`createRefreshSignal`/`useRefreshVersion`；`operationsContentTabRefreshSignal` | `[focused]` 每个 command 成功后只失效矩阵声明的 tags；失败不清空表单，不显示未经 owner readback 的新顺序 | 新建 sales-menu tag 类型，禁止靠组件本地数组改写权威事实 | channel context、menu summaries、draft sections/items/detail、published sections/items/detail、publish preview、operation log；catalog/inventory owner facts不由菜单 command失效 |
| **RTK 数据读取与加载判定**（`currentData` / `isFetching`） | `doc/platform/frontend-coding-standard.md` §3-B；`useCatalogWorkbenchReadModel` | `[focused]` query 参数切换时不闪回上一入口数据；refresh 时保留当前数据并展示 fetching 状态 | N/A | 8 类 RTK reads：channels、menus、sections、items、detail、preview、candidates、logs |
| **同一事实只有一个住址** | 前端规范 §3-E；RTK cache；AntD Form | `[static+focused]` 服务端 menu/section/item/status 不进入 `useState` 镜像；仅 cursor stack、选中 ref、抽屉开闭和未提交表单留本地 | N/A | 全页面所有服务端事实；允许本地状态全集仅 scope selection、mode、cursor stack、overlay、unsaved form、intent idempotency key |
| **失败可见且原因不得改写** | 前端规范 §3-D；后端规范 §2-B/§1-D；typed Problem registry | `[acceptance+browser]` 发布 blocker、保存失败、排序边界、上传失败分别显示 owner 原因；失败后输入/弹窗保持，可重试或删除失败图片 | 新错误必须声明 owner code → HTTP status/problem type → user presentation；禁止 catch-all “操作失败”覆盖原因 | 全部 reads、19 条 commands、图片上传及 L2 fixture/readback 失败 |
| owner 错误到 HTTP 的映射与注册处 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java`；edge contract error disposition catalog | `[focused+acceptance]` 每个 owner code 唯一映射，未登记 code 测试红；Problem 不泄露 raw payload/SQL/token | 在 `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json` 登记 sales-menu closed set，并扩当前唯一全局 advice，不新建第二套 handler | §5 全部 operations 的共同错误 + §8 规则特定错误 |
| 幂等键构成与重放语义 | 前端规范 §3-G；`createContentIdempotencyKey`；`useSubmissionLifecycle`；owner receipt 先例 | `[acceptance]` set-value 同内容重放返回同 readback；additive 操作同 intent 重放不重复，新 intent 可再创建；同 key 异内容报冲突 | sales-menu 独立 receipt 表，以 workspace + operation + idempotencyKey 唯一；response readback 可重放 | additive：新建/复制菜单、新建分区、批量加入销售项、stage 图片；set-value：改名/归档/启停/时段/区重命名删除移动/项保存删除移动/发布/人工状态 |
| **该用生成物的地方不得手搓字符串** | `r5-edge-materialize.mjs` → `edge-codegen.mjs` → `operation-handler-bindings.mjs`；generated RTK/hooks/wire/route registry | `[static]` 生产 Java/TS 对 `/api/...sales-menu...` 字面搜索为 0；generated path/operation 逆向 equality 通过 | 扩唯一 edge catalog 和 schema fragment；禁止手改 `contracts/openapi/**`、generated Java/TS | 31 条 HTTP operation、route identity、wire DTO、RTK endpoints、handler bindings、backend budget registry |
| 日志落点与脱敏字段 | `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`；production HTTP completion events | `[acceptance+L2]` requestId/correlationId/operationId/phase 可 join；名称、原因正文、搜索词、payload、Authorization、cookie、signed URL、SQL/bind 不出日志/artifact | owner 命令阶段日志只记录 opaque refs、状态类别、计数和失败 code；operation log 是业务事实，不代替诊断日志 | edge/owner/跨 owner/asset、acceptance、L2、seed runner 全链 |
| 迁移回填与可逆性 | 单 Flyway history；`apps/backend/catering-business-server/src/main/resources/db/migration` | `[focused integration]` 空库迁移后 schema/table/index/constraint 齐全；已有库 additive migration 不改任何旧表事实 | 新 schema 无旧行回填；forward-only；失败由同 migration 事务回滚，不写兼容列/fallback | sales_menu 全部表、索引、FK（仅本 schema 内）、无跨 schema FK |
| 前端共享行为（Drawer/列表/表单生命周期） | `adminWideDrawerSurfaceProps`、`adminDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useOverlayLock`、`CursorPagination`、`EllipsisTooltip`、`testId` | `[focused+browser]` dirty close 有确认、成功归还焦点、失败保持表单、overlay 锁住 shell、长文本 ellipsis tooltip、分页样式同商品管理 | 菜单图片编辑只抽取业务适配，不复制 foundation 生命周期 | 工作台、添加/编辑/详情/管理/时段/发布抽屉、分区和状态确认弹窗、三张表 |
| 候选/下拉数据源 | Catalog owner 的 category/workbench/candidate 读能力；BusinessChannel owner 的 store channel task read | `[acceptance+browser]` 完整分类树保留空节点；同商品已编入仍可选并显示当前菜单数量；只列 INTERNAL DINE_IN/TAKEAWAY STORE 渠道 | 新增精确 sales-menu candidate task read 仅补“当前菜单已有 N 个销售项”和菜单所需价格/shape 投影，不复制 CatalogItem | 经营入口卡片、菜单选择器、完整分类树、商品候选、规格候选、商品默认图/菜单图片候选 |
| 编码与名称呈现 | `NameCodeText`/`NameCodePathText`；Catalog 中文 shape presenter；前端规范 §3-I | `[focused]` 首列名称可点击，编码副文案；用户界面无 SKU、shape key、raw enum | sales-menu API 返回业务 enum/ref/code/name 分离，由 frontend presenter 映射既有中文商品形态 | channel/menu/section/item/category/specification/actor 展示 |
| **会同时坏的东西是否已声明为原子组** | `doc/platform/foundation-charter.md` §5-C | `[static+review]` 每组任一成员修改而其他成员未同步时 focused test 红；实施计划同 CP 内完成 | 原子组见下方 AG-01..AG-08，不增 compliance 台账 | AG-01 contract-generated、AG-02 owner-schema、AG-03 auth、AG-04 publication、AG-05 availability、AG-06 frontend-IA、AG-07 L2、AG-08 seed |

### 3.1 原子组

| 原子组 | 必须同一步完成的全集 |
| --- | --- |
| AG-01 contract-generated | edge catalog、schema/path fragment、placement/error catalog、materializer、OpenAPI、wire、RTK、operation binding、backend operation budget registry |
| AG-02 owner-schema | `sales-menu` module、public API、service/repository、Flyway、module dependency registry、app/module Gradle wiring、owner focused tests |
| AG-03 auth | admin page/action capability、session page access、operation authorization requirement、scope resolver、owner recheck、negative acceptance |
| AG-04 publication | draft version、stable section/item identities、published version、effective view、publication command/readback、front read、copy boundary |
| AG-05 availability | inventory set-read、manual status/current+history、front table/detail、status command、两个独立 oracle |
| AG-06 frontend-IA | route/page、RTK model、工作台、所有 overlays、31 条 IA focused/static checks、testId 常量、refresh/focus/dirty behavior |
| AG-07 L2 | sales-menu blueprint、P1、generated scenario/execution/locator/network/timing、shared runner suite、fixture/readback、spec、runner self-test/red mutations |
| AG-08 seed | sales-menu plan/executor/tests、business-channel prerequisite stage、`r5-full` parent ordering/report/cleanup、seed report tests |

## 4 · 每个 CP 的门控

### CP-00 · 契约、页面能力与生成链

- **可证伪失败条件**：任一 route 不是唯一 `operations-admin` face；生产代码手写 path/operation；generated 分母与 source catalog 不相等；写操作没有 `EDIT_STORE_SALES_MENU` requirement 或 owner recheck。
- **不变量**：唯一手写输入 → 全部生成物；只有 STORE 作用域页面；GET 用角色节点范围，command 用 capability + actual target recheck。
- **FORBID**：手改 OpenAPI/generated wire/RTK；复活旧 exact-set/compliance control；把 journey/R/CP 编号写入 runtime identity。
- **比例验证**：generator self-test、`--check`、frontend/backend compile、generated route reverse equality、auth manifest focused test。
- **形态理由**：选择扩既有 edge source，而不是单独 OpenAPI 或手写 controller path，因为当前全仓已有一条唯一 materialize/codegen/binding 链。
- **RECALL**：需求 §4.1..4.9、IA 全文、backend/frontend standards、foundation charter、edge catalogs/generators。

### CP-01 · 菜单 owner 与发布模型

- **可证伪失败条件**：草稿修改能改变已发布 front read；复制带入发布/库存/人工状态/启用关系；同商品第二次编入被去重；发布后 Catalog 名称/价格变化改写旧快照。
- **不变量**：stable `SalesItemRef` 不可换绑；一份菜单一个可变 draft；每次发布生成不可变 published version 和持久化 effective view；同渠道多份 activation 可同时 enabled。
- **FORBID**：把菜单字段塞 CatalogItem；跨 schema FK/DML；每次前台读取现场重建有效视图；以 enabled version 代替 `(collection, channel)` activation。
- **比例验证**：owner integration test + migration integration + acceptance 的 frozen/copy/multi-menu oracle。
- **形态理由**：选择稳定身份 + version membership，而不是每次发布重建 SalesItem 身份，因为人工状态必须稳定指向销售项且发布不能隐式清除它。
- **RECALL**：需求 G-11/G-12、owner-read-model standard、ordering practice、template §10。

### CP-02 · 跨 owner 与 edge

- **可证伪失败条件**：菜单 owner 直接查别的 schema；读取 20 行菜单产生逐行 Catalog/Inventory SQL；project channel 被忽略而非明确拒绝；store/channel disabled 仍发布。
- **不变量**：Catalog/Inventory/BusinessChannel/Organization 都经公开 task API 批量读取；Asset 只经 command API 同事务写；所有关系 ref 在 owner command 内再判定。
- **FORBID**：read edge 推导写、锁或事务；N+1；未知库存阻断销售；发布声称终端已获取。
- **比例验证**：module boundary/ArchUnit、owner API focused、acceptance 的 DB_OPERATIONS 观察与 business oracle、run-level generated budget verifier。
- **形态理由**：选择菜单 task-shaped set read，不复用 screen-shaped JSON，也不让 edge 循环调用 item detail。
- **RECALL**：backend standard、http efficiency redlines、module dependency registry、现有 owner APIs。

### CP-03 · backend-acceptance

- **可证伪失败条件**：场景只断言 2xx/Problem 形状；fixture 不超过一页；直接调 service；负向场景不证明 owner facts 未写；§5 的任一 operationId 在 §11.1a 覆盖矩阵中缺行、重复、没有业务 acceptance，或其用户可见动作没有 L2 case/`L2_NA_WITH_REASON`。
- **不变量**：真实 Testcontainers、真实 app、真实 HTTP；CONTRACT/BUSINESS 分开；每条 identity/fixture/request/businessOracle 非空；cleanup 单独 PASS。
- **FORBID**：provider/SPI/JSON scenario registry、scenario performanceCriterion、旧分母、直接 response.ok。
- **比例验证**：单场景 `scripts/test/backend-acceptance --operation ...`，批次 `--operation all`，再 `scripts/verify`；均以后续动态授权为前提。
- **形态理由**：按业务闭环组合场景，而不是按每条 route 机械生成场景，因为业务 oracle 必须证明跨操作结果。
- **RECALL**：active backend acceptance standard、§11 场景表、实际 production source。

### CP-04 · operations-admin

- **可证伪失败条件**：页面重复门店选择；草稿出现库存列；前台出现操作/查看列；disabled 表单冒充详情；分区/销售项拖拽；前端假分页/本地乐观排序。
- **不变量**：一个页面、31 条 IA 全匹配；读由 RTK currentData；成功后权威读回；失败保留输入；焦点归还；同一商品可重复加入。
- **FORBID**：复制 Catalog 页面业务组件而形成第二事实 owner；手写 fetch/path；第二套 Drawer/分页/图片生命周期；暴露 SKU/raw enum。
- **比例验证**：Vitest/architecture/static IA tests + typecheck；浏览器 L2 做用户行为证明。
- **形态理由**：复用 foundation primitive 和 catalog image behavior 的可复用部分，而不是复用整张 Catalog 编辑表单，因为菜单拥有不同 owner 和字段。
- **RECALL**：IA、交互设计、frontend standard、frontend capability lookup、Catalog 先例。

### CP-05 · 浏览器 L2

- **可证伪失败条件**：新增第二 runner；spec 手写 case list/path/testId；fixture 从 DEV seed 读取；只断言 DOM；未声明请求或失败后事实变化。
- **不变量**：同一 `scripts/test/browser-l2` managed chain；sales-menu P1 唯一源；readiness → activation → generated check → finalize → run；business/cleanup 分账。
- **FORBID**：browser `page.evaluate(fetch)`、raw CSS/XPath、网络空闲等待、扩 timeout 止血、删 case 降分母。
- **比例验证**：P1 self-test、runner self-test/red mutations、同 run 受管 L2 全 active set；动态执行另需授权。
- **形态理由**：为同一 runner 增加显式 `sales-menu` suite adapter，而不是复制 catalog runner；仅抽取两套 suite 真正共享的生命周期和 join 协议，不预建通用插件框架。
- **RECALL**：browser L2 standard、现有 runner/P1/spec、IA 31 条。

### CP-06 · Seed

- **可证伪失败条件**：销售菜单 fixture 被塞进 catalog/business-channel seed plan；父 `r5-full` 没有执行 sales-menu stage；seed 直接写 DB；业务成功但 cleanup/report 缺失。
- **不变量**：每域独立 plan/executor；真实 HTTP owner commands；父 runId 一致；business/cleanup 分开；sales-menu 在 business-channel 与 catalog-inventory 后执行。
- **FORBID**：start/restart 隐式 seed、兼容旧行、复用 acceptance/L2 fixture、手动 SQL。
- **比例验证**：plan/executor/parent static tests；后续显式 `scripts/dev/seed --profile r5-full` 真实 readback，须另获 reset/seed 动态授权。
- **形态理由**：把当前独立 business-channel seed 纳入父编排后再执行 sales-menu，而不是让 sales-menu seed 偷偷创建别域前置事实。
- **RECALL**：template §10b、scripts README、现有四个 seed source/parent runner。

### CP-07 · 收口与三维对账

- **可证伪失败条件**：任一 CP 进入下一步前仍有 OPEN；静态 PASS 被称为 HTTP/L2；整体测试前没有重新逐条全批对账；business PASS 掩盖 cleanup FAIL。
- **不变量**：每 CP focused proof 后由 fresh 独立子 agent 做需求/详设IA/项目记忆三维对账；全部 CP 后再做整体对账；最后另做 IMPLEMENTATION 对抗 review。
- **FORBID**：用测试代替设计对账；把动态未执行写成 PASS；第三轮同 cycle review。
- **比例验证**：阶段 MATCHED/OPEN 记录、整体重新对账、两轮以内正式 implementation review。
- **形态理由**：阶段对账捕获局部偏移，整体对账捕获跨 CP 偏移，两者不能互相替代。
- **RECALL**：AGENTS 实施节奏、independent review governance、review standard。

## 5 · operation / path / face / 集合形态

所有路径只由 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 与
`contracts/openapi-source/sales-menu.schemas.json` 声明，再由既有生成链物化。表中固定 `pageSize=20`
是 IA 已接受的 UI/请求值；owner 仍验证 pageSize，不以 total 或 OFFSET 实现。

| # | 业务意图 | operationId | method/path | consumer face | 集合形态 | 预期规模与增长驱动 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 列门店可管理的菜单经营入口（修改既有 operation） | `getOperationsStoreBusinessChannels` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels?usage=SALES_MENU&cursor&pageSize` | operations-admin | Cursor，20/页；卡片组下方显式 `CursorPagination` | 随门店 business_channel 增长；owner 以 usage 过滤 STORE + INTERNAL + DINE_IN/TAKEAWAY；现有 `LIMIT 101/nextCursor=null` 必须退休为真实 keyset cursor |
| 2 | 列当前入口的菜单 | `getOperationsSalesMenus` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus?channelRef&query&cursor&pageSize` | operations-admin | Cursor，20/页；selector 与管理抽屉各有独立页栈 | 随门店为该入口创建的菜单增长；selector 支持服务端 query，面板底部显式分页；manager 菜单行下方显式分页；都不自动抽干 |
| 3 | 读菜单摘要、草稿/发布版本和当前入口启用事实 | `getOperationsSalesMenu` | `GET /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}?channelRef` | operations-admin | Detail aggregate | 单菜单、单入口 activation、current draft/latest publication 摘要 |
| 4 | 列草稿真实销售分区 | `getOperationsSalesMenuDraftSections` | `GET .../sales-menus/{salesMenuRef}/draft/sections` | operations-admin | Detail aggregate（完整有序结构） | 随用户设计分区增长；左侧必须同时持有真实全序，禁止虚拟节点 |
| 5 | 列草稿分区销售项 | `getOperationsSalesMenuDraftItems` | `GET .../sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/items?cursor&pageSize` | operations-admin | Cursor，20/页 | 随该分区显式编入项增长；需要跨页全序 |
| 6 | 读草稿销售项编辑事实 | `getOperationsSalesMenuDraftItem` | `GET .../sales-menus/{salesMenuRef}/draft/items/{salesItemRef}` | operations-admin | Detail aggregate | 单销售项 + 其开放规格/价格/约束/图片 |
| 7 | 列前台冻结销售分区 | `getOperationsSalesMenuPublishedSections` | `GET .../sales-menus/{salesMenuRef}/published/sections` | operations-admin | Detail aggregate（完整有序结构） | latest publication 的完整真实分区全序；无发布时为空态 |
| 8 | 列前台冻结销售项和当前两个状态维度 | `getOperationsSalesMenuPublishedItems` | `GET .../sales-menus/{salesMenuRef}/published/sections/{salesSectionRef}/items?channelRef&cursor&pageSize` | operations-admin | Cursor，20/页 | 随冻结销售项增长；Inventory 一次 set-read、manual status 一次 set-read |
| 9 | 读前台销售项详情 | `getOperationsSalesMenuPublishedItem` | `GET .../sales-menus/{salesMenuRef}/published/items/{salesItemRef}?channelRef` | operations-admin | Detail aggregate | 单冻结销售项 + 图片 + 两个独立状态事实 |
| 10 | 列可编入商品 | `getOperationsSalesMenuItemCandidates` | `GET .../sales-menus/{salesMenuRef}/draft/item-candidates?categoryRef&query&cursor&pageSize` | operations-admin | Cursor，20/页；候选区下方显式 `CursorPagination` | 随当前门店可用商品增长；同商品不去重，附当前菜单已有销售项数量；分类/query 变化回第一页，不自动抽干 |
| 11 | 读发布预检 | `getOperationsSalesMenuPublicationPreview` | `GET .../sales-menus/{salesMenuRef}/draft/publication-preview?channelRef` | operations-admin | Detail aggregate | 单草稿的变更摘要和 closed-set blockers |
| 12 | 列普通操作记录 | `getOperationsSalesMenuOperationRecords` | `GET .../sales-menu-operation-records?channelRef&cursor&pageSize` | operations-admin | Cursor，20/页 | 随该入口菜单操作持续增长；按 occurredAt/ref 倒序，无详情/诊断链 |
| 13 | 新建菜单并建立当前入口的停用关系 | `createOperationsSalesMenu` | `POST .../sales-menus` | operations-admin | Command readback | additive；请求含 channelRef/name；创建独立空草稿与 disabled activation |
| 14 | 复制当前草稿定义 | `copyOperationsSalesMenu` | `POST .../sales-menus/{salesMenuRef}/copies` | operations-admin | Command readback | additive；复制当前草稿/时段，创建“原菜单名 副本”并返回新 ref |
| 15 | 改名 | `renameOperationsSalesMenu` | `PATCH .../sales-menus/{salesMenuRef}/name` | operations-admin | Command readback | set-value；只改 menu identity，不改版本内容 |
| 16 | 归档菜单 | `archiveOperationsSalesMenu` | `POST .../sales-menus/{salesMenuRef}/archive` | operations-admin | Command readback | set-value；归档后不再作为工作对象/入口候选，冻结历史保留 |
| 17 | 启用或停用 `(菜单,经营入口)` | `setOperationsSalesMenuActivation` | `PUT .../sales-menus/{salesMenuRef}/channels/{channelRef}/activation` | operations-admin | Command readback | set-value；多菜单可同时 enabled，不做互斥 |
| 18 | 保存草稿菜单时段 | `updateOperationsSalesMenuSchedule` | `PUT .../sales-menus/{salesMenuRef}/draft/schedule` | operations-admin | Command readback | set-value；ALL_DAY 或 DAILY_TIME_RANGE，发布后才影响前台冻结视图 |
| 19 | 新建销售分区 | `createOperationsSalesMenuSection` | `POST .../sales-menus/{salesMenuRef}/draft/sections` | operations-admin | Command readback | additive；追加在真实分区末尾 |
| 20 | 重命名销售分区 | `renameOperationsSalesMenuSection` | `PATCH .../sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/name` | operations-admin | Command readback | set-value |
| 21 | 删除销售分区 | `deleteOperationsSalesMenuSection` | `DELETE .../sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}` | operations-admin | Command readback | set-value；仅空分区可删，非空返回 blocker，防隐式删除销售项 |
| 22 | 上移/下移销售分区 | `moveOperationsSalesMenuSection` | `POST .../sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/move` | operations-admin | Command readback | set-value；direction=`UP|DOWN`，owner 交换全局相邻位置 |
| 23 | 批量加入商品形成独立销售项 | `addOperationsSalesMenuItems` | `POST .../sales-menus/{salesMenuRef}/draft/sections/{salesSectionRef}/items` | operations-admin | Command readback | additive；每个选中 occurrence 新建独立 SalesItemRef，不按 CatalogItem 去重 |
| 24 | 保存销售项定义 | `updateOperationsSalesMenuItem` | `PUT .../sales-menus/{salesMenuRef}/draft/items/{salesItemRef}` | operations-admin | Command readback | set-value；whole-save 展示名、形态适配销售内容/价格、约束和图片 |
| 25 | 从草稿删除销售项 | `deleteOperationsSalesMenuItem` | `DELETE .../sales-menus/{salesMenuRef}/draft/items/{salesItemRef}` | operations-admin | Command readback | set-value；只移除 current draft membership，保留旧 published/history |
| 26 | 上移/下移销售项 | `moveOperationsSalesMenuItem` | `POST .../sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/move` | operations-admin | Command readback | set-value；跨 cursor 页仍按 owner 全序移动 |
| 27 | 上传暂存菜单图片 | `stageOperationsSalesMenuAsset` | `POST /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage` | operations-admin | Command readback | additive intent；请求含 expectedDraftVersion、file metadata/content；usage=`SALES_MENU_ITEM_IMAGE` |
| 28 | 放弃未绑定暂存菜单图片 | `releaseOperationsSalesMenuStagedAsset` | `POST /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage/{assetRef}/release` | operations-admin | Command readback | set-value；请求含 expectedAssetVersion；只释放 target 完全相同、同 workspace、usage 正确且仍 STAGED 的资产 |
| 29 | 发布草稿并生成前台菜单 | `publishOperationsSalesMenu` | `POST .../sales-menus/{salesMenuRef}/publications` | operations-admin | Command readback | set-value；从 current draft 冻结 published version；current draft 本身保留，latest publication 的 source revision 用于判定此后是否 dirty |
| 30 | 设置人工沽清 | `setOperationsSalesMenuItemSoldOut` | `POST .../sales-menus/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-sold-out` | operations-admin | Command readback | set-value；原因必填，目标是 stable SalesItemRef + channelRef |
| 31 | 显式恢复人工销售 | `restoreOperationsSalesMenuItemSale` | `POST .../sales-menus/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-restore` | operations-admin | Command readback | set-value；保留 sold-out/restore 历史，current state 恢复 NORMAL |

#### 集合形态与用户可达性对照

“全部”统一解释为**当前查询的每一项都能经显式控件到达**，不是一次响应、浏览器全量数组或后台自动抽干。所有 Cursor 请求固定 `pageSize=20`，仅 owner 返回 `nextCursor`，页面只保存已访问 cursor stack。

| 集合 | owner/contract 形态 | 精确 UI 遍历 | identity 变化与保留 | 21st 可执行证明 |
| --- | --- | --- | --- | --- |
| eligible 经营入口 | `getOperationsStoreBusinessChannels` Cursor | 卡片组下方共享 `CursorPagination` | store/usage 变化清栈；翻页不改变已选 channel，点击新卡片才改变 | 20+1 channels；第二页可选第 21 个，回第一页无重无漏 |
| 页面菜单选择器 | `getOperationsSalesMenus(channelRef,query,cursor)` Cursor | 可搜索下拉面板底部共享 `CursorPagination` | channel/query 变化清栈；selected menu detail 独立读，选项不在当前页仍显示已选摘要 | 20+1 menus；第 21 个可搜索或下一页选中 |
| 管理菜单抽屉 | 同一 operation、独立 query/cursor | 菜单行下方共享 `CursorPagination` | 每次打开以 page1 开始；创建/复制/归档后权威刷新，非首空页回退上一已访问页 | 20+1 menus；第 21 个可启停/复制/改名/归档 |
| draft/published sections | Detail aggregate 完整有序结构 | 左侧完整列表；不分页 | menu/version/mode 变化重读 | 21 section 不作为本批种子目标；owner/contract 不截断且 focused test 证明完整集合 |
| draft/published items | section-scoped Cursor | 表格下方共享 `CursorPagination` | store/channel/menu/version/section/mode 变化清栈 | 20+1 items；第二页读、跨页 move 后无重无漏 |
| add-item candidates | category/query scoped Cursor | 右侧候选区下方共享 `CursorPagination` | store/menu/category/query 变化清栈；选中项按稳定 candidate identity 保留，隐藏项不提交 | 20+1 candidates；第 21 个可找到并新增独立 salesItemRef |
| operation records | channel scoped Cursor、倒序 | 表格下方共享 `CursorPagination` | store/channel/mode 变化清栈 | 20+1 records；结果/actor 顺序无重无漏 |

禁止项：任何组件循环请求直到 `nextCursor=null`、用本地数组切页、用 OFFSET、显示虚构 total、把 selector 与 manager 共用页栈、因当前选择不在选项页而清空选择。

### 5.1 contract 唯一源与生成物

手写唯一源的同步修改全集：

1. `contracts/openapi-source/sales-menu.schemas.json`：schema、enum、request/readback/page/problem refs；`business-channel.schemas.json` 同步补 usage 与一般 channel facts；
2. `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`：上表 30 条新增 + 1 条既有 operation 修改，与最终 denominator；
3. `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`：sales-menu component/path placement；
4. `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`：§5.4 closed errors；
5. `contracts/catalog/admin-catalog.json`：`PG-SALES-MENU-STORE`、`SALES_MENU_MANAGEMENT`、`EDIT_STORE_SALES_MENU`；
6. `contracts/registry/iam-org-governance-manifest.json`：31 条 operation identity，GET role-node scope，19 条 command capability/recheck；
7. `scripts/generate/r5-edge-materialize.mjs`、`edge-codegen.mjs`、`operation-handler-bindings.mjs` 的 input/owner 支持。

派生物全集由生成链写入，实施者不得手改：

- `contracts/openapi/components/sales-menu/**`、`contracts/openapi/paths/operations-admin/sales-menu.paths.json`、`contracts/openapi/edge.openapi.json`；
- generated Java wire、route/face/capability registry、operation handler binding、backend performance operation registry；
- `apps/frontend/operations-admin/src/app/api/generated/**` 的 sales-menu edge/RTK/types；
- `apps/frontend/operations-admin/src/app/catalog/generatedAdminCatalog.ts` 与 page/action keys。

`scripts/generate/edge-codegen.mjs` 当前把 `canonicalOperationCount=180` 复制为 JS 常量。本批不得只把该数改成新数字；最小根因修复是让 codegen 从 source catalog 的 `denominator.operations` 读取，并双向验证 `operations.length`，随后由 generated operation count source 驱动 handler/budget 分母。这样后续新增 operation 只改唯一 catalog，不再维护第二计数住址。

### 5.2 关键 schema

| schema | 字段与约束 |
| --- | --- |
| `SalesMenuSchedule` | `kind=ALL_DAY|DAILY_TIME_RANGE`；DAILY 必须同时有 `startLocalTime/endLocalTime` 且两者不相等；start < end 表示同日区间，start > end 表示跨午夜，统一为 start-inclusive/end-exclusive；时区由门店事实提供，菜单不存 display 字符串 |
| `SalesMenuSummary` | menuRef/name/archived、draftRevision、latestPublishedRevision/nullable、draftDirty、activation `{channelRef,status}`、draft schedule；启用与发布分开 |
| `SalesMenuSectionView` | salesSectionRef/name/displayOrder/itemCount/canMoveUp/canMoveDown；count 紧跟名称由 UI 决定 |
| `SalesMenuDraftItemView` | salesItemRef/catalogItemRef/itemCode/displayName/productShape、saleContent、listedPrice、orderingConstraints、displayMedia、displayOrder/canMove*、version |
| `SalesMenuPublishedItemView` | 冻结定义 + `inventoryAvailability` + `manualSaleStatus` 两个必备独立对象；禁止 `available:boolean` 合并字段 |
| `SalesMenuItemSaleContent` | tagged union：`DIRECT`/`SKU_SELECTION`/`WEIGHTED`/`COMPOSITE`；SKU_SELECTION 每个已选 sku 有独立 `listedPriceCents`，不含公共挂牌价；其他适用形态使用 item `listedPriceCents` |
| `SalesMenuOrderingConstraints` | JSON object `additionalProperties=false`，仅 `minItemQuantity`、`quantityStep` 两个 nullable positive integer 键；称重形态必须两者均 null |
| `SalesMenuDisplayMedia` | `mode=INHERIT_CATALOG|CUSTOM`；CUSTOM 为有序 assetRef 列表、第一张主图；1 主 + 最多 5 附、单张最大 2 MB 与 Catalog 图片规则逐字一致 |
| `InventoryAvailabilityFact` | `applicability=NOT_APPLICABLE|APPLICABLE`；适用时 `state=AVAILABLE|AUTO_UNAVAILABLE|UNKNOWN`、`reason=OUT_OF_STOCK|NEGATIVE_NOT_ALLOWED|READ_UNAVAILABLE|null`；UNKNOWN 不阻断 |
| `ManualSaleStatusFact` | `state=NORMAL|MANUAL_SOLD_OUT`、reason/nullable、changedAt、changedByDisplayName；不携带库存状态 |
| `SalesMenuOperationRecord` | occurredAt、operationKind、target refs、result=`SUCCESS|FAILED`、failureCode/nullable、actor display；用户文案由 frontend presenter 生成，不存整句 display copy |
| `SalesMenuPage<T>` | `items`、`cursor`、`nextCursor`；不返回 total/page count，pageSize 请求固定 20 |
| `SalesMenuAssetTarget` | 只由 URL + owner readback 形成：workspaceUuid/groupWorkspaceKey/storeRef/salesMenuRef/salesItemRef/expectedDraftVersion；业务 target 是当前菜单的 stable item，不以 channel 或 ambient UI state 代替 |
| `SalesMenuAssetStageRequest` | multipart metadata/content + `expectedDraftVersion`；store/menu/item 只在 path，不允许 body 覆写；服务端生成 idempotency context 包含 operation + 完整 target + digest |
| `SalesMenuAssetReleaseRequest` | `expectedAssetVersion`；完整 target 在 path；body 不接受 store/menu/item/usage/status；release readback 返回 assetRef/status/version |

价格沿用 Catalog wire 的整数分单位：`listedPriceCents` / `standardPriceCents` 为非负 integer，前端按人民币显示；不得引入浮点。商品默认价只作只读对照，菜单 owner 只持有发布时使用的挂牌价。

### 5.2a Sales-menu 图片 actual-target 授权与生命周期

图片 stage/release 不是 workspace 级“通用上传”。两条 edge command 必须按以下固定顺序执行，实施者不得只检查 session、workspace、usage 或前端当前门店：

1. edge 从 path 读取 `groupWorkspaceKey/storeRef/salesMenuRef/salesItemRef`，认证 session 并校验 selected STORE；body 无权覆盖 target；
2. `WorkspaceCapabilityScopeResolver` 针对 path 中实际 STORE、当前 operation requirement 和 `EDIT_STORE_SALES_MENU` 生成 `OperationsOwnerScopeGrant`；
3. edge 调用 `SalesMenuOwnerApi.requireSalesMenuItemAssetTarget(mode, target, ownerScopeGrant, contextVersion)`；owner 在同一次 judgment 中证明 workspace/store/menu/stable item 关系。`STAGE|CLAIM` 要求 menu 未归档、item 仍在 current draft、`expectedDraftVersion` 匹配；`RELEASE_STAGED` 允许 menu 已归档或 item 已从 draft 移除，但仍必须由 stable item/history 证明原 menu 关系，以便只清理该 target 的 STAGED 资产；
4. SalesMenu owner 返回不可由客户端构造的 `SalesMenuAssetTargetReadback`；edge 将该 readback、原 `OperationsOwnerScopeGrant` 和 session `contextVersion` 传给 `SalesMenuAssetCommandApi`；
5. Asset owner 再验证 grant 的 workspace/group/targetType=`STORE`/targetId=`storeRef`/requirement/capability/contextVersion，且 `SalesMenuAssetTargetReadback` 与 grant/store 相符；stage 以 usage=`SALES_MENU_ITEM_IMAGE` 写 owner-local target；release 还必须匹配同一 assetRef 的 target、workspace、usage、`STAGED`、expectedAssetVersion；
6. item whole-save claim 再以 `mode=CLAIM` 调用 `requireSalesMenuItemAssetTarget`，Asset owner仅允许相同完整 target 的 STAGED refs 被 claim；仅持有 bindGrant、同 workspace 或同 menu 但不同 item 均不足以 claim。

Asset migration新增 owner-local `platform_asset.sales_menu_asset_target(asset_ref PK/FK staged_asset, workspace_uuid, group_workspace_key, store_ref, sales_menu_ref, sales_item_ref, created_at)`；这些 opaque refs 不建跨 schema FK，也不成为菜单业务 membership。Asset owner在 stage、release、claim时都锁 asset lifecycle 并读取该表；release 不删除 target row，只改变 lifecycle，保证重放/审计可判定。此表不替代 SalesMenu owner judgment，且不得被 Catalog API消费。

事务边界沿用现有 Asset 规则：multipart bytes/materialization/object I/O 在数据库事务外完成；actual-target 与 capability judgment 在 object I/O 前完成，Asset relational stage 在其 owner transaction 写入；若判断到关系写之间 target 变化，后续 claim 必须重判并拒绝，STAGED 资产由同 target release 清理。不得为追求一个跨 object-storage 的大事务而借住数据库连接。

### 5.3 形态适配与保存 payload

`updateOperationsSalesMenuItem` 是 whole-save，不把同一销售项拆成多条容易形成半状态的 command：

- 普通销售商品、商品型套餐、服务/费用商品：`saleContent.kind=DIRECT|COMPOSITE`，公共 `listedPriceCents` 必填；约束可填；
- 按规格管理商品：`saleContent.kind=SKU_SELECTION`，至少一条 `{skuRef, listedPriceCents}`；公共价必须缺省；目录新增 SKU 不自动进入；
- 称重销售商品：`saleContent.kind=WEIGHTED`，公共 `listedPriceCents` 按 Catalog 有效销售单位解释；两个按“份”的约束必须缺省；
- `catalogItemRef` 和 stable `salesItemRef` 不在 update payload 中可换绑；服务端以 URL itemRef 定位原绑定；
- `displayNameOverride` 为空表示沿用当前 Catalog 展示名；published version 仍冻结最终 resolved displayName；
- 图片 INHERIT 不复制资产所有权；CUSTOM 引用经 Asset owner claim 的 sales-menu image refs。

### 5.4 typed problem closed set

| owner code | HTTP | 触发与前端动作 |
| --- | --- | --- |
| `SALES_MENU_NOT_FOUND` / `SALES_SECTION_NOT_FOUND` / `SALES_ITEM_NOT_FOUND` | 404 | 关闭失效 overlay，刷新当前范围；不改写为权限错误 |
| `SALES_MENU_SCOPE_MISMATCH` | 403 | ref 不属于 selected STORE/channel；不泄露实际 owner |
| `SALES_MENU_CAPABILITY_REQUIRED` | 403 | 无 `EDIT_STORE_SALES_MENU`；写控件按 capability 隐藏/禁用，服务端仍复核 |
| `SALES_MENU_VERSION_CONFLICT` | 409 | expectedVersion/CAS 过期；保留输入，提供刷新后重试 |
| `SALES_MENU_IDEMPOTENCY_CONFLICT` | 409 | 同 key 不同 request hash；不得创建第二事实 |
| `SALES_MENU_ARCHIVED` | 409 | 归档 menu 不再编辑/发布/启停 |
| `SALES_MENU_CHANNEL_INELIGIBLE` | 422 | 非 STORE、非 INTERNAL、非 DINE_IN/TAKEAWAY 或 channel 不属 store；明确“当前只处理门店内部堂食/外带入口” |
| `SALES_MENU_STORE_DISABLED` | 422 | 仅发布阻断；编辑、保存、复制不阻断 |
| `SALES_MENU_CHANNEL_DISABLED` | 422 | 仅发布阻断；菜单自身 activation disabled 不阻断发布 |
| `SALES_MENU_DRAFT_INVALID` | 422 | 发布预检/发布返回结构化 violations，不以一个模糊 message 替代 |
| `SALES_MENU_ITEM_REFERENCE_INVALID` / `SALES_MENU_SKU_REFERENCE_INVALID` | 422 | Catalog item/SKU 不存在、scope 不符或不可作为本次销售内容 |
| `SALES_MENU_PRICE_REQUIRED` | 422 | 形态所需挂牌价缺失；SKU 逐行指出 skuRef |
| `SALES_MENU_SCHEDULE_INVALID` | 422 | DAILY 字段不全或 start = end；跨午夜 start > end 合法 |
| `SALES_MENU_CONSTRAINT_INVALID` | 422 | 非正整数、未知键或称重项携带按份约束 |
| `SALES_MENU_ASSET_INVALID` | 422 | usage/workspace/status/claim 失败；保留图片编辑区重试/删除 |
| `SALES_MENU_ASSET_TARGET_MISMATCH` | 403 | stage/release/claim 的 store/menu/item target 或 `EDIT_STORE_SALES_MENU` grant 不匹配；不泄露资产实际 target |
| `SALES_MENU_ASSET_LIFECYCLE_CONFLICT` | 409 | asset 已 release/claim、expectedAssetVersion 过期或并发状态变化；刷新当前图片事实后重试适用动作 |
| `SALES_MENU_SECTION_NOT_EMPTY` | 409 | 删除非空分区；要求先逐项删除/移动，不做隐式级联 |
| `SALES_MENU_MOVE_BOUNDARY` | 409 | 已在首/尾仍提交 UP/DOWN；刷新权威全序 |
| `SALES_MENU_MANUAL_REASON_REQUIRED` | 422 | 设置人工沽清但原因空；保持弹窗和输入 |
| `SALES_MENU_PUBLICATION_REQUIRED` | 409 | 前台详情/人工状态目标尚无 published membership |
| `SALES_MENU_RESULT_UNKNOWN` | 503 | 写后响应不确定且无 receipt readback；前端先查询权威状态，不自动重放新 intent |

校验格式错误继续使用全仓通用 `VALIDATION_ERROR`；认证/session/role scope 使用既有 common problem。未知 owner code 必须 fail closed 到受控内部错误并记录 code，不向客户端透传 exception message。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时的回滚事实 |
| --- | --- | --- | --- | --- |
| 暂存菜单图片 | edge 先以 `mode=STAGE` 调用 `SalesMenuOwnerApi.requireSalesMenuItemAssetTarget` 获得 server-owned target judgment | `SalesMenuAssetCommandApi.stageSalesMenuItemImage(target, grant, contextVersion, command)` | object I/O 事务外；Asset relational stage 自有 REQUIRED | judgment/stage 失败不产生 menu 事实；若 object 已物化但 relational stage 失败，仅 owner cleanup 接管物理对象；无 assetRef readback |
| 放弃未绑定暂存图片 | edge 先以 `mode=RELEASE_STAGED` 调用 `SalesMenuOwnerApi.requireSalesMenuItemAssetTarget` 的 cleanup 语义 | `SalesMenuAssetCommandApi.releaseStagedSalesMenuItemImage(target, grant, contextVersion, command)` | Asset owner 自有 REQUIRED | release 失败保持 STAGED，可在编辑器重试；target/workspace/usage/status/version 任一不符均不改资产 |
| 保存 CUSTOM 菜单图片 | `SalesMenuOwnerApi.updateDraftItem` 在 draft lock 内重新判定 target | `SalesMenuAssetCommandApi.claimSalesMenuItemImages(target, bindings)` | 同一 REQUIRED transaction；sales-menu 是发起 owner，asset 是目标 owner | 任一 target/claim、版本 CAS 或 item write 失败，全部新 asset 仍为 STAGED、draft 仍为旧版本、无 success operation record |
| 无 CUSTOM 图片的菜单 command | `SalesMenuOwnerApi` 对应 command | N/A | sales-menu REQUIRED | 菜单、receipt、success operation record 同时回滚 |
| 已授权的已知业务拒绝记录 | command 已失败并完整回滚 | `SalesMenuOwnerApi.recordRejectedOperation` | edge 在原 transaction 结束后启动独立 sales-menu REQUIRED transaction；再次复核 workspace/store/menu/capability | 只追加 FAILED 普通操作记录；不得补写 receipt、业务聚合或 success record；若记录自身失败，只保留诊断日志，不改变原 typed Problem |

除表中 Asset 写外，本批跨 owner 关系全部是公开 task read/judgment：Catalog、Inventory、BusinessChannel、Organization 的被依赖模块不得反向 import sales-menu，sales-menu 不得直写其 schema，也不得建立跨 schema FK。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| 门店独占菜单 owner | 需求 §0/§3.1 | contract path 同时含 groupWorkspaceKey/storeRef；owner aggregate 存 workspace/store | 所有 command/read owner-recheck selected STORE | cross-store negative acceptance |
| 菜单目标是 `business_channel` | 需求 §4.3 术语警告 | request/activation 只传 channelRef，不传 bindingRef/templateRef | `BusinessChannelOwnerApi.requireSalesMenuChannel` 判实际 instance | project/external/binding confusion red fixture |
| 同入口多菜单 | 需求 §4.2 | list 返回多个 activation，不返回 selected/effective-one 字段 | 前端 selector 仅改变工作对象；消费者获得所有 enabled publications | 两个 enabled menu readback + browser |
| 启用主语 `(menu, channel)` | 需求 §4.2/§4.3 | `SalesMenuActivation` schema/DB unique pair | setActivation 只改 relation；publish 不隐式启停 | publish 前后 activation 不变 oracle |
| 时段是菜单版本事实 | IA 管理/时段原文 | draft schedule → publish clone → published schedule | 前台读取 published schedule；销售端自行判断 | 修改 draft 时 front 不变，publish 后变 |
| stable SalesItem 不可换绑 | G-11 | add 生成 ref；update payload 无 catalogItemRef | owner URL ref 找原绑定；publication reuse stable ref | duplicate add + rebind rejected |
| 挂牌价形态适配 | 需求 §4.1/IA item | tagged saleContent；integer cents | owner closed shape validator；frontend 形态分支 | SKU 无公共价、direct 有公共价、weighted 单位价 |
| 两个约束键 | 需求 §4.6 | `SalesMenuOrderingConstraints` explicit properties | owner tolerant read known keys、write only known keys；sales consumer读规则 | unknown write rejected、legacy unknown read ignored focused test |
| 展示图片覆盖 | IA item | INHERIT 或 ordered CUSTOM asset refs | draft editor/Published effective view；asset owner claim | 1+5/2MB、upload retry、published frozen |
| 图片实际目标授权 | IA item + backend actual-target owner rule | URL store/menu/item → STORE grant → SalesMenu owner target readback → Asset target row | stage/release/claim 三次检查完整 target；前端 adapter 必须显式传 generated path args | no-capability/cross-store/cross-menu/cross-item/wrong usage/released reds |
| 复制边界 | IA manage 原文 | copy command 无可选复制 flags | owner 只从 current draft 复制 definition/schedule，new activation disabled | publication/log/inventory/manual/activation exact absence oracle |
| 发布冻结 | G-11/需求 §4.4 | current draft → immutable PUBLISHED version；publication readback | front reads latest published membership/resolved fields | catalog/draft mutation不改变 old publication |
| 库存维度 | 需求 §4.5 | Inventory set-read → `InventoryAvailabilityFact` | front list/detail原样独立呈现；menu DB 不存 | 无对象/缺货/低库存/负库存/unknown oracle |
| 人工维度 | 需求 §4.5 | menu current + append-only event → `ManualSaleStatusFact` | front status cell/modal；不触碰 inventory | sold-out reason + explicit restore + other channel unchanged |
| 操作记录 | IA log | owner event kind/result/code/actor facts | frontend presenter 生成简短文案；无详情 action | 21 rows cursor、failed typed command record |
| **集合形态** | IA Cursor/Detail 定义与可达性澄清 | contract cursor/pageSize/filter；cursor query identity | channel cards、menu selector、manager、candidate、三表各自 `useCursorStack` + visible `CursorPagination`；无 auto-drain/total/slice | 21 channel/menu/candidate/item/log acceptance/browser；cross-query cursor rejected |
| **授权执行点** | IA 页面 STORE scope + admin action | auth manifest operation requirement | edge selected STORE equality；owner `OWNER_RECHECK_SALES_MENU` 在 receipt/CAS 前 | no-capability/cross-store negative and no-write |
| **缓存失效** | IA navigation/refresh | RTK generated tag policy | command success invalidates exact menu/draft/front/log tags；scope/mode reset cursor | focused query-call assertions |
| **错误映射** | §5.4 closed set | error disposition catalog + `ContractProblemAdvice` registry | frontend typed presenter；原 reason 保留 | every code contract/HTTP/UI map static test |
| **日志与脱敏** | AGENTS observability | HTTP completion/owner phase only opaque refs/count/code | acceptance/L2 join；operation record只存业务字段 | forbidden-token scan + managed artifact inspection |

## 8 · 业务规则 → owner 判定点

本批 owner 规则编号为 `SM-01` 至 `SM-38`，连续无空号；UI-01..UI-31 的呈现/动作另由 §11.3 L2/静态映射覆盖，不能拿 UI 检查替代 owner 规则。

| 规则编号 | owner 判定点 |
| --- | --- |
| SM-01 | `SalesMenuScopePolicy.requireStoreOwnedMenu`：workspace/store/menu 三者一致，只有 STORE 拥有 menu |
| SM-02 | `BusinessChannelOwnerApi.requireSalesMenuChannel`：targetNodeType=STORE、targetRef=storeRef、accessKind=INTERNAL、orderKind∈{DINE_IN,TAKEAWAY} |
| SM-03 | list/activation 不设 unique enabled channel；同 channel 任意多 menu 可 enabled |
| SM-04 | selection 仅 query/menu ref，不存“current/effective menu” |
| SM-05 | activation 是 `(salesMenuRef,channelRef)` relation，publish/rename/schedule 不改 activation |
| SM-06 | schedule 只写 current DRAFT；published schedule 只在 publish clone 时生成 |
| SM-07 | 每 collection 恰一 current DRAFT；PUBLISHED version append-only |
| SM-08 | publish 从同事务锁定的 current DRAFT 生成 immutable PUBLISHED version；旧 published 永不 update/delete |
| SM-09 | add 每个 occurrence 新建 stable SalesItemRef；相同 catalogItemRef 不去重 |
| SM-10 | update/delete/move 不接受 catalogItemRef 重绑定；删除只删 draft membership |
| SM-11 | SalesSection 与 CatalogCategory 无关系；无“全部/未分区”虚拟 section 行 |
| SM-12 | section/item display order 由 owner 邻接 swap；首尾返回 canMove，boundary command typed reject |
| SM-13 | SKU_SELECTION 至少一项且每项 SKU 属原 catalog item；Catalog 新增 SKU 不自动加入任何 version |
| SM-14 | SKU_SELECTION 每个 selected SKU listedPriceCents 必填且 public listedPrice 缺省 |
| SM-15 | DIRECT/COMPOSITE/WEIGHTED public listedPriceCents 必填；商品默认价只读对照，不由 menu 改写 |
| SM-16 | displayNameOverride/image mode 属菜单；INHERIT 在发布时 resolve 并冻结，CUSTOM 必须 asset claim 通过 |
| SM-17 | 图片数量与大小逐字复用商品图片规则；stage/release/claim 必须匹配 server-judged workspace/store/menu/item target 与 STORE grant，上传中/失败/未 claim 阻断 item 保存/发布 |
| SM-18 | 约束仅 minItemQuantity/quantityStep positive integer；WEIGHTED 两者必须为空 |
| SM-19 | copy 只复制 current draft sections/items/order/bindings/overrides/prices/constraints/media/schedule |
| SM-20 | copy 不复制 published versions/publications、operation records、inventory facts、manual status/history、source activation；新 activation disabled |
| SM-21 | archive 不删除 versions/publications/history/active assets；archived aggregate 不再编辑、发布或启停 |
| SM-22 | store disabled 只阻断 publish；draft create/edit/copy/save 不阻断 |
| SM-23 | business channel disabled 只阻断 publish；menu activation disabled 不阻断 publish或编辑 |
| SM-24 | project/external/其他 order kind 必须 typed reject，不能静默过滤为“没有菜单” |
| SM-25 | publish preflight 与 publish 使用同一 validator；publish 在锁内重新验证，不能信任旧 preview |
| SM-26 | published normalized version rows就是持久化 EffectiveSalesView；front read 不现场拼 Catalog 定义 |
| SM-27 | publish success 文案事实仅为本系统生成前台菜单；owner 不持有 terminal ACK/POS visibility |
| SM-28 | Inventory target 不存在 → NOT_APPLICABLE，永不阻断 |
| SM-29 | OUT_OF_STOCK → AUTO_UNAVAILABLE；LOW_STOCK → AVAILABLE |
| SM-30 | negative quantity 且 allowNegative=true → AVAILABLE；false → AUTO_UNAVAILABLE |
| SM-31 | Inventory read unavailable/unknown → UNKNOWN 且不阻断，不转换为人工状态 |
| SM-32 | manual sold-out target 是 `(stable SalesItemRef,channelRef)`，原因 non-blank；不做 catalog item级人工沽清 |
| SM-33 | restore 是独立 append event，current state 回 NORMAL；退款/库存恢复/重新发布均不得自动 restore |
| SM-34 | front read必须同时返回 inventoryAvailability 与 manualSaleStatus，禁止 merged available/saleable boolean |
| SM-35 | channel/selector/manager/candidate/draft/front/log 七类 Cursor identity 与页栈分离；page size=20；scope/channel/menu/version/section/mode/filter/query 属适用 identity；必须显式分页且禁止 auto-drain |
| SM-36 | 操作记录只持时间、kind/target、result/failureCode、actor；不持终端诊断链或 raw payload |
| SM-37 | 删除非空 section typed reject，不隐式删除或搬移 sales items |
| SM-38 | failed operation record 仅记录通过 scope/capability 后的已知 menu business rejection；auth/transport/unknown internal failure只进诊断日志 |

`recordRejectedOperation` 不是失败 command 的补偿或重放：它必须在原 command transaction 已回滚后，由 edge 以原 request context 发起新的 owner transaction，再次确认实际 menu scope 和 capability，只保存 closed-set `failureCode` 与普通 actor/target facts。记录失败不能覆盖原业务错误，也不能把未知异常正文写入业务表。

### 8.1 发布 blocker closed set

`SalesMenuPublicationValidator` 输出结构化 `violations[]`，其 `kind` 闭集为：

- `STORE_DISABLED`、`CHANNEL_DISABLED`、`CHANNEL_INELIGIBLE`；
- `CATALOG_ITEM_INVALID`、`SKU_SELECTION_EMPTY`、`SKU_INVALID`；
- `LISTED_PRICE_MISSING`、`ORDERING_CONSTRAINT_INVALID`；
- `DISPLAY_ASSET_PENDING_OR_INVALID`、`SCHEDULE_INVALID`。

这里不把 menu activation disabled、零分区、零销售项或空分区作为 blocker：启停不影响编辑和发布，且当前批准需求没有禁止发布空菜单。发布空定义会生成可解释的空前台菜单，不得由实施 agent 私自补“至少一项”规则。

## 9 · owner API 与消费者清单

### 9.1 新 `sales-menu` public API

| owner 方法 | 谁调用（精确路径） |
| --- | --- |
| `SalesMenuOwnerApi.listMenus/readMenu` | `.../app/edge/operations/salesmenu/OperationsSalesMenuController` |
| `SalesMenuOwnerApi.listDraftSections/listDraftItems/readDraftItem` | 同 controller 的 draft GET handlers |
| `SalesMenuOwnerApi.listPublishedSections/listPublishedItems/readPublishedItem` | 同 controller 的 published GET handlers |
| `SalesMenuOwnerApi.listItemCandidates/publicationPreview/listOperationRecords` | 同 controller 的 candidate/preview/log GET handlers |
| `SalesMenuOwnerApi.create/copy/rename/archive/setActivation/updateSchedule` | 同 controller 的 menu command handlers |
| `SalesMenuOwnerApi.createSection/renameSection/deleteSection/moveSection` | 同 controller 的 section command handlers |
| `SalesMenuOwnerApi.addItems/updateItem/deleteItem/moveItem` | 同 controller 的 item command handlers |
| `SalesMenuOwnerApi.requireSalesMenuItemAssetTarget(mode, ...)` | `OperationsSalesMenuAssetController` 的 stage/release handlers 与 `updateItem` claim coordinator；mode闭集=`STAGE|CLAIM|RELEASE_STAGED`，返回 server-owned target judgment，不向 HTTP response 暴露 grant/contextVersion |
| `SalesMenuOwnerApi.publish` | 同 controller publication handler |
| `SalesMenuOwnerApi.setManualSoldOut/restoreManualSale` | 同 controller manual status handlers |
| `SalesMenuOwnerApi.recordRejectedOperation` | `SalesMenuCommandFailureRecorder`，仅 catch 已知、已授权 owner Problem 后调用 |

实现路径固定为：

- module：`apps/backend/catering-business-server/modules/sales-menu`；
- package：`com.catering.v2s.salesmenu.{api,application,domain,infrastructure}`；
- edge：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu`；
- Spring composition 只在 app 层装配；module 不 import controller/wire/generated classes。

### 9.2 既有 owner 需要新增的精确任务 API

| owner 方法 | 谁调用（精确路径） |
| --- | --- |
| `CatalogOwnerApi.readSalesMenuCandidatePage` | `SalesMenuOwnerService.listItemCandidates`；返回商品/分类/shape/默认价/默认图和 SKU摘要，不返回 screen copy |
| `CatalogOwnerApi.readSalesMenuItemFacts(Set<ItemRef>)` | draft list/detail、item save、publish validator；一次 set read，不逐行 detail |
| `InventoryOwnerApi.readSalesMenuAvailability(Set<InventoryTargetRef>)` | published list/detail；一次 set read，返回 target existence/state/quantity policy facts |
| `BusinessChannelOwnerApi.listSalesMenuEligibleChannels` | 既有 `OperationsBusinessChannelController.storeChannels` 在 `usage=SALES_MENU` 时调用；必须使用共享 `OpaqueCollectionCursor` + keyset，不复用当前无业务上界的 `LIMIT 101` 假分页 |
| `BusinessChannelOwnerApi.requireSalesMenuChannel` | create/activation/publish/manual status 和 menu scope recheck |
| `OrganizationOwnerApi.requireSalesMenuStore` | 所有 command actual target recheck；publish额外取得 store status/timezone |
| `SalesMenuAssetCommandApi.stageSalesMenuItemImage/releaseStagedSalesMenuItemImage/claimSalesMenuItemImages` | `OperationsSalesMenuAssetController` 与 item save；每次都收 `SalesMenuAssetTargetReadback`，stage/release 另收 STORE `OperationsOwnerScopeGrant` + contextVersion；以 Catalog Asset 的 storage/lifecycle 为机制先例但不继承 catalog usage/capability/target |
| `SalesMenuAssetReadApi.readSalesMenuItemImages(Set<AssetRef>)` | draft/published item read；只返安全 public ref/metadata |

不得新增“以后可能用”的反向 consumer API；本表之外的方法为零调用者，当场删除。

### 9.3 module dependency / app wiring

- `settings.gradle.kts` include `:apps:backend:catering-business-server:modules:sales-menu`；
- app `build.gradle.kts` implementation 新 module；sales-menu module 依赖 foundation、execution-context、audit-contract value API、catalog/inventory/business-channel/organization/asset 的 public API projects；
- `contracts/policy/module-dependency-registry.json` 登记 `sales-menu` ownerSchema=`sales_menu`，并逐条登记 7 个 TASK_READ/COMMAND/VALUE_API edge；
- `BackendModuleBoundariesArchunitSelector` 证明依赖单向、无 cross-schema JDBC string；
- terminal-data-server 仍为空占位，不增加 dependency/runtime。

## 9a · 实施前全链同步变更清单

| 变更事实 | 契约 / 唯一生成源 / 生成物 | 后端 owner / edge / migration | 前端 model / surface / state | focused / 静态 / HTTP / L2 测试 | fixture / seed 唯一来源 / executor | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 门店菜单页面/能力 | admin-catalog → generated catalog/auth | page guard、auth requirement、owner recheck | pageRegistry + feature page | auth/static/acceptance/L2 entry | owner-command role/capability fixture | 同步修改；generated 派生 |
| 31 条受影响 operations（30新增+1既有修改） | edge catalog + sales-menu/business-channel schemas → OpenAPI/wire/RTK/handler/budget | controller/mapper/owner methods | generated API + tag policy consumption | generator/compile/acceptance/network exact-set | acceptance/L2/seed requests只用 generated identity | 同步修改；生成物派生 |
| draft/published/version | schemas | sales_menu tables/service/publication | three modes/read model | owner/frozen acceptance/L2 | sales-menu fixtures/seed | 同步修改 |
| activation + schedule + multi-menu | schemas | activation/version schedule/policy | selector/manage/schedule drawer | multi-enabled/copy/browser | L2/seed two menus/times | 同步修改 |
| section/item ordering | schemas + cursor | order columns/swap locks | row menus + authoritative refresh | boundary/cross-page acceptance/L2 | 21-item fixture/seed | 同步修改 |
| shape/spec/price | tagged schemas | Catalog set-read/validator/version rows | shape presenter/item editor/detail | all-shapes HTTP/browser | Catalog source refs + menu definition | 同步修改；Catalog facts只读 |
| ordering constraints JSON | explicit schema properties | JSON parser/validator/storage | conditional fields/detail | known/unknown/weighted tests | menu fixture/seed | 同步修改 |
| display image | schema + target-bound asset usage | SalesMenu target judgment + Asset target table/API/claim + version media | shared image behavior adapter 显式传 generated store/menu/item args | asset owner/HTTP/L2 capability、cross-target、failure retry | independent asset fixture/seed | 同步修改；Catalog image不复制 |
| inventory availability | schema | Inventory set-read + mapper；menu migration N/A | published table/detail read-only | state matrix acceptance/L2 | inventory fixture/seed existing owner | 同步修改；menu DB N/A（反例：只派生） |
| manual sale status | schema | current/event tables + commands | front status modal/detail | set/restore/isolation HTTP/L2 | menu fixture/seed | 同步修改 |
| operation records | schema | operation_record + rejection recorder | operation mode/pagination | success/failure/cursor | 21 records via real commands | 同步修改 |
| browser L2 suite | sales-menu blueprint/P1 → generated profile/binding | shared runner bootstrap/readback | sales-menu.spec/testIds | runner self-test + managed L2 | TEST fixture，仅 L2 | 同步修改；不使用 DEV seed |
| DEV seed | seed profile/plan source | owner HTTP only | N/A（反例：页面只消费生产 API） | seed static + later managed readback | sales-menu domain plan/executor + parent | 同步修改 |

### 9b · 变更定位锚点

实施不得使用本文写作时行号；以下锚点在当前文件内唯一命中，写前用 `rg -n -F` 再确认恰一处：

| 文件 | 唯一锚点 |
| --- | --- |
| `settings.gradle.kts` | `include(":apps:backend:catering-business-server:modules:business-channel")` |
| app `build.gradle.kts` | `implementation(project(":apps:backend:catering-business-server:modules:business-channel"))` |
| `contracts/catalog/admin-catalog.json` | `"key": "PG-CATALOG-STORE-ITEMS"` |
| `scripts/generate/edge-codegen.mjs` | `const canonicalOperationCount = 180;`（实施后该复制住址应消失） |
| frontend `pageRegistry.tsx` | `routeSegment: 'catalog/store-items'` |
| `OperationsApi.ts` | `operationsApi = createApi` |
| `r5-complete-seed-executor.mjs` | `export const COMPLETE_SEED_STAGE_IDS` |
| `scripts/test/browser-l2-runtime.mjs` | `Usage: browser-l2-runtime.mjs` |
| `BackendAcceptanceScenarioCatalog.java` | `BusinessChannelAcceptanceScenarios.class` |
| `BackendAcceptanceScenarioCatalog.java` | `AssetAcceptanceScenarios.class` |

## 10 · 数据模型与迁移

### 10.1 owner relational model

新增一条 forward-only migration `V20260901_*__sales_menu_owner.sql`（实施时先按当前目录确认时间戳无冲突），创建 `sales_menu` schema；不修改旧 owner 表，不建立跨 schema FK。

| table | 核心事实 / constraint / index |
| --- | --- |
| `sales_collection` | menu identity：workspace_uuid/group key/store_ref/name/archived_at/current_draft_version_ref/latest_published_version_ref/version；store/workspace/name active index |
| `sales_collection_activation` | collection_ref + channel_ref unique pair、status ENABLED/DISABLED、version；不设 channel 唯一，允许多菜单同时 enabled |
| `sales_collection_version` | version_ref、collection_ref、kind DRAFT/PUBLISHED、revision、schedule JSON fields、source_draft_version/version；partial unique “每 collection 一条 DRAFT”；PUBLISHED append-only |
| `sales_section` | stable section_ref + collection_ref；identity 不随发布改变 |
| `sales_version_section` | version_ref + section_ref + name + display_order；unique deferrable `(version_ref,display_order)` |
| `sales_item` | stable sales_item_ref + collection_ref + catalog_item_ref；不可 update catalog_item_ref |
| `sales_version_item` | version_ref/item_ref/section_ref/display_order、display override、resolved published name/code/shape、public listed price、constraints JSON、media mode、version；unique deferrable per section order |
| `sales_version_item_sku` | version_ref/item_ref/sku_ref/listed_price_cents/resolved sku code/name/default price/display_order；published row frozen |
| `sales_version_item_media` | version_ref/item_ref/asset_ref/display_order；published media frozen，asset owner保有文件事实 |
| `sales_publication` | publication_ref/collection_ref/published_version_ref/source_draft_revision/actor/occurred_at；只 append，不存 terminal state |
| `sales_manual_status_current` | sales_item_ref + channel_ref unique、state、reason、changedAt/actor/version |
| `sales_manual_status_event` | append sold-out/restore event、reason snapshot、actor、occurredAt |
| `sales_operation_record` | record_ref/workspace/store/channel/menu/operation_kind/result/failure_code/actor/occurredAt/idempotency key；倒序 cursor index；无 raw request/message |
| `sales_command_receipt` | workspace_uuid + operation_id + idempotency_key unique、request_hash、status/readback JSON、createdAt；沿用 receipt replay 先例 |

Asset owner 同一 forward-only migration（或按 owner 拆成相邻 migration，但必须同一 CP 原子交付）新增 `platform_asset.sales_menu_asset_target`：`asset_ref` 为本 schema FK 到 `staged_asset`，并保存 workspace/group/store/menu/item target 与 createdAt；对 `(workspace_uuid,store_ref,sales_menu_ref,sales_item_ref,asset_ref)` 建精确查找索引。不得给 store/menu/item 建跨 schema FK，也不得把 target JSON 塞进 bindGrant、receipt 或日志。

外部 opaque ref 只存 UUID/业务 key，不建跨 schema FK；本 schema 内 collection/version/section/item/publication 使用 FK。所有版本、activation、manual current 和 command 聚合 command 均带 CAS version。

`EffectiveSalesView` 是对 latest immutable PUBLISHED normalized rows 的业务读模型名称，不新增第二套 materialized table，也不复制 Catalog/Inventory owner 行。冻结定义来自 PUBLISHED rows；当前库存和人工状态只在 published list/detail 的任务读中按集合叠加为两个独立对象。

### 10.2 发布事务

`publish` 的单一 REQUIRED transaction 顺序固定如下：

1. owner recheck workspace/store/menu/channel/capability，锁 `sales_collection` 与 current DRAFT；
2. receipt 同 key read/replay 或 request-hash conflict；
3. 重新调用 Organization/BusinessChannel/Catalog/Asset 的批量 judgment，使用锁内 draft 全集做 validator；
4. 计算下一 publication revision，插入 PUBLISHED version；集合式复制 section/item/SKU/media，并填充 resolved catalog facts；
5. 插入 `sales_publication`，更新 `latest_published_version_ref`，**不替换或克隆 current DRAFT，也不修改 activation**；此刻 draft revision 与 publication source revision 相同，后续任一 draft command 才使 `draftDirty=true`；
6. 同事务插 success operation record/receipt/audit value；
7. commit 后返回 publicationRef/revision/change counts/准确 success fact。

PUBLISHED rows在 repository 层没有 update/delete 方法；数据库用 trigger 拦截 published version child update/delete，作为漏写 service guard 时仍会红的保护。trigger 不实现业务流程，只保护 immutable fact。

### 10.3 排序与 cursor

- section 和 item 都以 `display_order BIGINT + opaque UUID tie-breaker` 排序；
- move 锁 current DRAFT 和目标/相邻两行，defer order unique constraint，用单个 CASE update 交换位置；
- append 在同一 draft lock 下取末位置；删除不全表重排，order 空洞合法；
- Cursor 使用共享 `OpaqueCollectionCursor`，query identity 包括 operationId/workspace/store/channel/menu/version/section/mode/filter/pageSize；
- 操作记录用 `(occurred_at DESC, record_ref DESC)` keyset；菜单项用 `(display_order ASC, sales_item_ref ASC)`；
- `canMoveUp/canMoveDown` 由 set query/window 或邻接 existence 计算，不能只按当前页 index 判断。

### 10.4 旧行回填与回滚

| 迁移 | 加/改什么 | 旧行回填 | 唯一事实理由 | 可否回滚 |
| --- | --- | --- | --- | --- |
| sales-menu owner | 全新 schema/tables/index/trigger | N/A，无旧 sales-menu 行 | 当前生产源码/迁移均不存在该 owner，不能从 Catalog/Channel 反推菜单 | forward-only；migration 事务失败自动回滚，本批不提供 down migration |
| platform asset usage | 允许 `SALES_MENU_ITEM_IMAGE` usage/claim type（若现有 schema 有 CHECK 同 migration扩闭集） | N/A，旧资产 usage 不变 | menu custom image 是新 owner usage，不能伪装成 CATALOG_ITEM_IMAGE | forward-only；旧行字节不变 |
| platform asset menu target | 新增 `platform_asset.sales_menu_asset_target` 与索引，stage 时同事务写 target，release/claim 锁后精确读取 | N/A，旧 catalog/logo 资产无该行且不回填 | 只有新 sales-menu image 需要 menu-item actual target；不能从 workspace/usage 猜 target | forward-only；无兼容 fallback，migration 失败整体回滚 |

## 10b · seed 数据

### 10b.1 受影响的 seed 全集

| seed 文件 | 本批为什么受影响 | 处置 |
| --- | --- | --- |
| `scripts/dev/profiles/r5-full.json` | 当前完整 profile 只有 owner-command/catalog-inventory，缺 menu 的 channel prerequisite 和 sales-menu stage | 把 stage exact order 改为 owner-command → external-collaboration-business-channel → catalog-inventory → sales-menu |
| `scripts/dev/r5-complete-seed-executor.mjs` | 当前 `COMPLETE_SEED_STAGE_IDS` 只有两项，且 catalog validator 以 `const catalog = stages[1]` 绑定位置 | 接入两个缺失 child；先按 exact order 验证，再建立 `stageById` 并让四个 owner-specific validator 按稳定 stage id 取证；保持同 managedDevRunId、phase/heartbeat、business/cleanup/firstFailure 汇总，禁止保留任何 `stages[n]` 业务假设 |
| `scripts/dev/r5-complete-seed-executor.test.mjs` | 断言旧两阶段 denominator/readback，未证 stage-specific validator 绑定 | 同步四阶段顺序、缺 stage、换位、同数量错 report shape、run mismatch、business/cleanup failure red tests；catalog readback必须只消费 `catalog-inventory` stage |
| `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` | 当前只有 STORE INTERNAL DINE_IN **模板**；真实 channel 实例均为 EXTERNAL TAKEAWAY/GROUP_BUY，没有任何 INTERNAL DINE_IN/TAKEAWAY channel | 保留为本 owner 唯一 plan；新增彼此独立的 INTERNAL DINE_IN 与 INTERNAL TAKEAWAY template/channel 实例及 enabled/disabled分支，同时保留现有 EXTERNAL TAKEAWAY 与 project/其他形态作为 negative；不能搬进 sales-menu plan，不能把 EXTERNAL TAKEAWAY 改名冒充 INTERNAL |
| `scripts/dev/external-collaboration-business-channel-seed-executor.mjs` | 当前明确不做 HTTP/runtime，不能作为完整 seed 前置 | 实现真实 generated HTTP command + owner readback + 独立 manifest/report/cleanup；不得直接 DB |
| `scripts/dev/catalog-inventory-seed-plan.mjs` / profile | sales-menu 引用其商品/SKU/库存事实；现有合法形态不应被 menu seed 复制 | 只补确实缺失的 menu 形态/库存边界 owner facts；保持 catalog/inventory 唯一住址 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` / tests | 若上行新增 owner facts，executor/readback 和 static denominator 必须同步 | 只处理 catalog/inventory，不写 menu |
| `scripts/dev/profiles/sales-menu.json` | 新 domain canonical seed input | 新建；只声明 menu refs 到前置 owner facts和 menu 自有定义/动作 |
| `scripts/dev/sales-menu-seed-plan.mjs` | 新 domain plan | 新建；校验引用、状态分支、分页 over-boundary 和 copy exclusions |
| `scripts/dev/sales-menu-seed-executor.mjs` | 新 owner HTTP materializer | 新建；只走 generated operations，逐项 owner readback，独立 business/cleanup/report |
| `scripts/dev/sales-menu-seed-executor.test.mjs` | plan/executor 静态防漂移 | 新建；红测 stage/ref/state/分页/复制边界/report/cleanup |
| `scripts/test/test-health-entry-runner.mjs` | 新增 Node static tests 需进入显式测试列表 | 登记三份新增/修改 seed tests |

### 10b.2 新功能与旧功能调整

| 类型 | 设计 |
| --- | --- |
| 新功能上线 | 新建两份门店内部渠道、同入口至少两份同时 enabled menu、全天/每日时段、draft/published diff、copy 后 disabled；多真实 section；同一 section 21 items；同商品重复项；五类中文 shape；SKU 逐项价；INHERIT/CUSTOM 图片；两个约束键与 weighted N/A；两个状态维度；21 records |
| 旧功能调整 | 现有 collaboration/business-channel plan 在保留 EXTERNAL TAKEAWAY 的同时新增真实 INTERNAL DINE_IN/TAKEAWAY channel实例，executor 从“静态报告”升级为真实 owner HTTP stage并进入 r5-full；Catalog/Inventory 只补缺失的真实 owner facts，不改变已有合法 item/SKU/stock 语义；父编排退休两阶段数组与 `stages[1]` 位置假设，改按stage id绑定四个owner validator |

### 10b.3 状态分支与边界值

- channel：真实 eligible enabled INTERNAL DINE_IN、真实 eligible enabled INTERNAL TAKEAWAY、eligible disabled；现有 EXTERNAL TAKEAWAY、project-level与其他order kind保持negative；静态validator必须分别证明 INTERNAL/EXTERNAL不混用；
- menu：无发布空菜单、published+draft dirty、published+draft equal、archived、activation enabled/disabled、同 channel 两份 enabled；
- definition：0/1/多 section、21 item page、duplicate catalog item、每个 shape、SKU subset、custom image 1 主 + 附图；
- availability：no target、normal、low、out-of-stock、negative allowed、negative disallowed；`UNKNOWN` 是运行失败事实，不可伪造成 seed 行，标 `N/A_WITH_REASON` 并由 acceptance/L2 可控故障边界证明；
- manual：NORMAL、MANUAL_SOLD_OUT+reason、RESTORE history；
- record：SUCCESS/FAILED 且总数 >20。

### 10b.4 执行与授权边界

本节只设计。真实运行只能在 backend HTTP + frontend L2 已闭合后，另获 Dexter reset/seed 动态授权，经：

```bash
R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full
```

执行前后按当前 managed DEV manifest 身份和资源规则判定；start/restart 绝不隐式 seed。Seed business 与每个 child/parent cleanup 分别报告，任何 cleanup 非 PASS 不得说完成。

## 11 · 验收场景设计

### 11.1 backend-acceptance（Testcontainers）

菜单聚合场景新增 owner 文件
`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`，并由 `BackendAcceptanceScenarioCatalog` 显式登记 domain group。修改既有 BusinessChannel HTTP 与新增 Asset HTTP 的 owner 语义分别落在既有 `BusinessChannelAcceptanceScenarios.java`、`AssetAcceptanceScenarios.java`；不能把 owner 验收集中塞入 SalesMenu 文件。场景按业务价值组合多个真实 operation，不为 31 条 route 生成 31 个壳。

| scenario id（能力命名） | owner 文件 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| `sales-menu.store-scope-and-channel-eligibility` | SalesMenuAcceptanceScenarios | store role with/without capability；same workspace second store/project | GET channels + create menu attempts | generated GET/POST real HTTP | 只返本店 INTERNAL DINE_IN/TAKEAWAY；project/external typed reject；no-capability 无 menu/receipt/log |
| `sales-menu.collection-lifecycle-and-multi-activation` | 同上 | authorized store actor | one channel, 21 menus（其中两份用于 multi-active） | create/rename/setActivation/updateSchedule/archive；menu Cursor 两页 + menu detail GET | 两 menu 可同时 enabled；停用仍可 edit/publish；schedule draft readback；第21份可选/可管理；跨 query cursor reject；archive历史保留 |
| `sales-menu.copy-current-draft-boundary` | 同上 | source menu actor | dirty draft + publication + manual event + operation rows + enabled activation | copy HTTP then all relevant reads | only definition/schedule copied；new disabled；publication/log/inventory/manual/source activation absent；新 ref 独立 |
| `sales-menu.ordered-sections-and-items` | 同上 | authorized actor | 3 sections；21 eligible candidates；one section 21 duplicate-capable items | candidate Cursor 两页；create/rename/move/delete section；add/move/delete items；draft sections/items/detail GET | 第21候选可加入；global order/readback correct across page；boundary typed reject；nonempty delete no change；duplicate item refs distinct |
| `sales-menu.shape-specific-sale-definition` | 同上 | authorized actor | direct/SKU/weighted/composite/service items + SKUs/default prices | add/update/read detail for every shape | SKU only per-SKU listed prices/no public price；weighted no piece constraints；others public cents；catalog binding unchanged |
| `sales-menu.display-media-owner-transaction` | 同上 | authorized/no-capability actors | valid target plus cross-store/menu/item targets, staged/released/wrong-usage assets | path-targeted stage/release/update item with valid/invalid target/grant | no-capability、cross-target、wrong usage、released/version conflict reject；valid claim + draft CAS atomic；no menu/asset partial write；published image frozen |
| `sales-menu.publish-frozen-effective-view` | 同上 | authorized actor | valid draft + catalog facts | preview/publish/front reads；then mutate draft/catalog | published section/item/name/spec/price/schedule unchanged；new publish changes latest only；publication says no terminal ACK |
| `sales-menu.publish-blockers` | 同上 | authorized actor | disabled store, disabled channel, disabled activation, malformed drafts | preview/publish | store/channel disabled block；activation disabled does not；each violation structured；failed publish no version/publication |
| `sales-menu.inventory-availability-matrix` | 同上 | read-authorized actor | published items mapped to no target/normal/low/OOS/negative allowed/disallowed plus controlled Inventory unknown | front page/detail reads | exact independent inventory facts；no target/low/allowed/unknown do not block；no menu rows rewritten |
| `sales-menu.manual-sale-status-and-restore` | 同上 | authorized actor | published stable item on two eligible channels | sold-out with/without reason、restore、republish | reason required；only target channel changes；restore event preserved；republish/inventory change does not auto-restore |
| `sales-menu.operation-record-cursor` | 同上 | read/write actor | >20 authorized success/rejected menu operations | operation record pages + typed failed command | no duplicate/omission；SUCCESS/FAILED/business failureCode/actor facts；无诊断字段/raw payload |
| `sales-menu.command-idempotency-and-cas` | 同上 | authorized actor | menu/draft versions | repeat content-key commands；same intent additive；new intent additive；stale version | exact replay/new creation/conflict outcomes；owner facts和records不重复 |
| `sales-menu.generated-route-contract` | 同上 | representative reads/commands | minimum valid menu aggregate | exercise every operation not already touched via generated constants | 31 operation identities all reach correct handler/face; every response has business identity，不以2xx替代 oracle |
| `business-channel.sales-menu-eligible-cursor` | BusinessChannelAcceptanceScenarios | STORE actor；same workspace second store；project/external channels | 21 eligible + ineligible channels | 修改后的既有 channels GET，`usage=SALES_MENU`，两页 cursor 与串 scope cursor | 仅本店 INTERNAL DINE_IN/TAKEAWAY；20+1 无重无漏；跨 query/store cursor typed reject；不再存在 LIMIT 101 假上界 |
| `asset.sales-menu-image-lifecycle` | AssetAcceptanceScenarios | target STORE authorized/no-capability actors | same target、cross-store/menu/item、wrong usage、released、claimed、published-bound assets | path-targeted stage/release-STAGED real HTTP；claim 经菜单保存触发；asset target/lifecycle owner readback | no capability rejects stage；cross-target/wrong usage/already released or claimed rejects release；valid stage/release returns authoritative target-bound readback；published-bound ACTIVE 不因草稿替换或归档释放；无跨 owner partial write |

每行四要素均非空。每条写负向同时断言 owner readback、receipt、publication/manual/log 的适用“不写”事实。`DB_OPERATIONS` 仅信息性；独立 run-level generated operation budget verifier在全量后测真实新分母，不能在设计里猜预算，也不能用预算削弱 owner复核/事务/幂等/audit/readback。

#### 11.1a operationId → acceptance / L2 覆盖合同

本矩阵是 §5 的 31 条受影响 operation 与业务场景、用户 Journey 之间的可证伪分母，不是新的 scenario registry：

- `set(本矩阵.operationId) == set(§5 operationId)`，每个 operationId 恰一行；
- 每行至少一个业务 acceptance；`sales-menu.generated-route-contract` 只负责 handler/face/业务 identity 的结构兜底，不能单独代替 command 的业务 oracle；
- 用户可触发或可见的 operation 至少映射一个 L2 case；真正不适用时必须写精确 `L2_NA_WITH_REASON`，本批 31 条均有 L2；
- acceptance/L2 引用必须分别存在于 §11.1/§11.3，L2 blueprint 的对应 action 必须声明该 generated operation 与 required/forbidden/background network；
- 实施后的 focused/full run 必须从实际 production HTTP completion events 回读 `scenarioId/caseId/actionId → operationId`，逐行证明请求确实发生；矩阵存在、场景计数或 HTTP 2xx 都不能代替该动态证据。此项不新增 provider、按 route 生成的壳场景、固定全仓 scenario 总数或旧自动 exact-set 控制面。

| 覆盖行 | operationId | 业务 acceptance（主要语义 owner） | 直接 oracle 义务 | L2 case |
| --- | --- | --- | --- | --- |
| OP-01 | `getOperationsStoreBusinessChannels` | `business-channel.sales-menu-eligible-cursor`；`sales-menu.store-scope-and-channel-eligibility` | STORE + INTERNAL + DINE_IN/TAKEAWAY、20+1、跨 scope cursor 拒绝 | `sales-menu-entry-and-channels`；`sales-menu-auth-and-scope-isolation` |
| OP-02 | `getOperationsSalesMenus` | `sales-menu.collection-lifecycle-and-multi-activation` | menu Cursor 20+1、多 enabled activation、不返回唯一当前菜单 | `sales-menu-menu-management-and-multi-active` |
| OP-03 | `getOperationsSalesMenu` | `sales-menu.collection-lifecycle-and-multi-activation`；`sales-menu.copy-current-draft-boundary` | detail 身份、时段、activation 与 copy 前后读回精确 | `sales-menu-menu-management-and-multi-active`；`sales-menu-copy-boundary` |
| OP-04 | `getOperationsSalesMenuDraftSections` | `sales-menu.ordered-sections-and-items` | 完整有序 section aggregate 与 command 后权威顺序 | `sales-menu-section-actions`；`sales-menu-draft-order-and-pagination` |
| OP-05 | `getOperationsSalesMenuDraftItems` | `sales-menu.ordered-sections-and-items` | item Cursor 20+1、跨页移动后无重无漏 | `sales-menu-draft-order-and-pagination` |
| OP-06 | `getOperationsSalesMenuDraftItem` | `sales-menu.shape-specific-sale-definition`；`sales-menu.display-media-owner-transaction` | shape-specific price/constraint/media 详情与绑定不变 | `sales-menu-edit-direct-item-and-media`；`sales-menu-edit-sku-prices`；`sales-menu-edit-weighted-item` |
| OP-07 | `getOperationsSalesMenuPublishedSections` | `sales-menu.publish-frozen-effective-view` | published section 顺序与旧 publication 冻结 | `sales-menu-publish-and-front-structure` |
| OP-08 | `getOperationsSalesMenuPublishedItems` | `sales-menu.publish-frozen-effective-view`；`sales-menu.inventory-availability-matrix`；`sales-menu.manual-sale-status-and-restore` | published item Cursor、冻结定义、库存/人工两对象独立 | `sales-menu-front-status-and-pagination` |
| OP-09 | `getOperationsSalesMenuPublishedItem` | `sales-menu.inventory-availability-matrix`；`sales-menu.manual-sale-status-and-restore` | 只读详情、两状态原因与恢复边界准确 | `sales-menu-front-status-and-pagination`；`sales-menu-manual-sold-out-and-restore` |
| OP-10 | `getOperationsSalesMenuItemCandidates` | `sales-menu.ordered-sections-and-items`；`sales-menu.shape-specific-sale-definition` | 21 candidates、完整分类关系、重复商品仍可选 | `sales-menu-add-candidates` |
| OP-11 | `getOperationsSalesMenuPublicationPreview` | `sales-menu.publish-frozen-effective-view`；`sales-menu.publish-blockers` | blocker 结构化且 activation disabled 不阻断 | `sales-menu-publish-and-front-structure`；`sales-menu-publish-blockers` |
| OP-12 | `getOperationsSalesMenuOperationRecords` | `sales-menu.operation-record-cursor` | 20+1、SUCCESS/FAILED 业务事实、无诊断/raw payload | `sales-menu-operation-records` |
| OP-13 | `createOperationsSalesMenu` | `sales-menu.store-scope-and-channel-eligibility`；`sales-menu.collection-lifecycle-and-multi-activation`；`sales-menu.command-idempotency-and-cas` | eligible target、无 capability 不写、additive intent 幂等 | `sales-menu-menu-management-and-multi-active`；`sales-menu-auth-and-scope-isolation` |
| OP-14 | `copyOperationsSalesMenu` | `sales-menu.copy-current-draft-boundary`；`sales-menu.command-idempotency-and-cas` | 只复制 current draft 定义+时段；副本 disabled；excluded set 全缺席 | `sales-menu-copy-boundary` |
| OP-15 | `renameOperationsSalesMenu` | `sales-menu.collection-lifecycle-and-multi-activation`；`sales-menu.command-idempotency-and-cas` | 名称权威读回、重放不重复记录 | `sales-menu-menu-management-and-multi-active` |
| OP-16 | `archiveOperationsSalesMenu` | `sales-menu.collection-lifecycle-and-multi-activation` | 历史保留、管理集合与详情状态一致 | `sales-menu-menu-management-and-multi-active` |
| OP-17 | `setOperationsSalesMenuActivation` | `sales-menu.collection-lifecycle-and-multi-activation`；`sales-menu.publish-blockers` | 多菜单不互斥；activation disabled 不阻断编辑/发布 | `sales-menu-menu-management-and-multi-active`；`sales-menu-publish-blockers` |
| OP-18 | `updateOperationsSalesMenuSchedule` | `sales-menu.collection-lifecycle-and-multi-activation`；`sales-menu.copy-current-draft-boundary` | 时段权威读回且 copy 精确复制 | `sales-menu-menu-management-and-multi-active`；`sales-menu-copy-boundary` |
| OP-19 | `createOperationsSalesMenuSection` | `sales-menu.ordered-sections-and-items`；`sales-menu.command-idempotency-and-cas` | 新 section 有稳定 ref、顺序与 intent 幂等 | `sales-menu-section-actions` |
| OP-20 | `renameOperationsSalesMenuSection` | `sales-menu.ordered-sections-and-items` | 名称与顺序 readback 精确 | `sales-menu-section-actions` |
| OP-21 | `deleteOperationsSalesMenuSection` | `sales-menu.ordered-sections-and-items` | 非空/边界拒绝时 section/items/order 均不变 | `sales-menu-section-actions`；`sales-menu-failure-recovery-and-focus` |
| OP-22 | `moveOperationsSalesMenuSection` | `sales-menu.ordered-sections-and-items` | 仅上/下；first/last 拒绝；全序权威读回 | `sales-menu-section-actions`；`sales-menu-failure-recovery-and-focus` |
| OP-23 | `addOperationsSalesMenuItems` | `sales-menu.ordered-sections-and-items`；`sales-menu.shape-specific-sale-definition`；`sales-menu.command-idempotency-and-cas` | 同商品可形成不同 SalesItem refs；shape 初始销售定义正确 | `sales-menu-add-candidates` |
| OP-24 | `updateOperationsSalesMenuItem` | `sales-menu.shape-specific-sale-definition`；`sales-menu.display-media-owner-transaction`；`sales-menu.command-idempotency-and-cas` | whole-save、SKU 逐价/weighted 边界、asset claim 原子、CAS/重放 | `sales-menu-edit-direct-item-and-media`；`sales-menu-edit-sku-prices`；`sales-menu-edit-weighted-item`；`sales-menu-failure-recovery-and-focus` |
| OP-25 | `deleteOperationsSalesMenuItem` | `sales-menu.ordered-sections-and-items` | 删除后全序无洞；失败时 item/asset/order 不变 | `sales-menu-edit-direct-item-and-media`；`sales-menu-draft-order-and-pagination` |
| OP-26 | `moveOperationsSalesMenuItem` | `sales-menu.ordered-sections-and-items` | 跨页上/下以 owner 全序为准，无乐观本地真相 | `sales-menu-draft-order-and-pagination`；`sales-menu-failure-recovery-and-focus` |
| OP-27 | `stageOperationsSalesMenuAsset` | `sales-menu.display-media-owner-transaction`；`asset.sales-menu-image-lifecycle` | STORE grant + URL actual target；跨 store/menu/item/usage 拒绝无写 | `sales-menu-edit-direct-item-and-media`；`sales-menu-failure-recovery-and-focus` |
| OP-28 | `releaseOperationsSalesMenuStagedAsset` | `sales-menu.display-media-owner-transaction`；`asset.sales-menu-image-lifecycle` | 仅精确 STAGED target 可释放；claimed/published-bound 不释放 | `sales-menu-edit-direct-item-and-media`；`sales-menu-failure-recovery-and-focus` |
| OP-29 | `publishOperationsSalesMenu` | `sales-menu.publish-frozen-effective-view`；`sales-menu.publish-blockers`；`sales-menu.command-idempotency-and-cas` | 新 immutable publication；失败无 version/publication；不声称终端 ACK | `sales-menu-publish-and-front-structure`；`sales-menu-publish-blockers`；`sales-menu-failure-recovery-and-focus` |
| OP-30 | `setOperationsSalesMenuItemSoldOut` | `sales-menu.manual-sale-status-and-restore`；`sales-menu.command-idempotency-and-cas` | 原因必填、只影响目标 channel、inventory 独立 | `sales-menu-manual-sold-out-and-restore` |
| OP-31 | `restoreOperationsSalesMenuItemSale` | `sales-menu.manual-sale-status-and-restore`；`sales-menu.command-idempotency-and-cas` | 二次确认、恢复事件保留、inventory/republish 不自动恢复 | `sales-menu-manual-sold-out-and-restore` |

后续动态验证顺序：

```bash
scripts/test/backend-acceptance --operation sales-menu.store-scope-and-channel-eligibility
# 逐场景 focused，全部通过后：
scripts/test/backend-acceptance --operation all
scripts/verify
```

每次均需动态授权、受管 Testcontainers 资源预检、首败、business/cleanup 分账；当前设计轮不执行。

### 11.2 frontend focused/static 分母

新增 `apps/frontend/operations-admin/src/features/sales-menu/`，最小文件职责如下：

| 路径/符号 | 职责 |
| --- | --- |
| `model/salesMenuTypes.ts` | 只做 generated wire 到 UI business model 的窄映射；不复制服务端 cache |
| `model/useSalesMenuReadModel.ts` | scope/channel/menu/mode/section/query identity；channel、selector、manager、candidate、draft/front/log 七套互不共享 cursor stack；`currentData/isFetching`，精确 tag invalidation |
| `model/useSalesMenuCommands.ts` | content/intent idempotency、generated RTK mutations、typed error pass-through、authoritative refresh |
| `model/salesMenuPresentation.ts` | enum → 中文 shape/status/operation text；后端不返回整句 UI copy |
| `ui/SalesMenuPage.tsx` | 唯一页面 composition；不持服务器事实镜像 |
| `ui/SalesMenuWorkbench.tsx` | channel cards/modes/menu selector/section+item workspace；cards 与 selector 分别放置共享顺序分页 |
| `ui/SalesMenuDraftTable.tsx` / `SalesMenuPublishedTable.tsx` / `SalesMenuOperationTable.tsx` | 三张固定列 Cursor table |
| `ui/SalesMenuItemEditorDrawer.tsx` | shape-adaptive whole-save；标题区删除/关闭 |
| `ui/SalesMenuItemDetailDrawer.tsx` | Descriptions/只读表格/图片/状态，不渲染 disabled Form |
| `ui/SalesMenuCandidateDrawer.tsx` | 完整 Catalog category tree + server query + duplicate candidates + 独立顺序分页 |
| `ui/SalesMenuManagerDrawer.tsx` / `SalesMenuScheduleDrawer.tsx` / `SalesMenuPublishDrawer.tsx` | manager 独立 menu query/cursor 与行下分页；menu lifecycle、启停、时段、预检/发布 |
| `ui/SalesMenuSectionMenu.tsx` / `SalesMenuManualStatusModal.tsx` | 分区行菜单；前台状态 explicit radio/restore confirm |
| `salesMenuTestIds.ts` | 用户可交互控件唯一 testId source；L2 locator binding只导入，不散写字符串 |

图片复用采用“抽出纯 UI 行为、保留业务 adapter”的最小形态：从 `CatalogItemBasicEditor.tsx` 的 `CatalogAssetEditor` 提取 foundation `AdminImageCollectionEditor`（有序卡片、上传状态、重试、设主、移动、删除、键盘/焦点），Catalog adapter 保留原文案/testId/generated upload；SalesMenu adapter 的每次 stage/release 必须从当前 generated endpoint args 显式传 `groupWorkspaceKey/storeRef/salesMenuRef/salesItemRef` 与对应 version，不能只读 ambient page state。不得让 sales-menu import catalog feature，也不得改变 Catalog 现有用户行为；Catalog focused/L2 locator 兼容性同组验证。

focused/static test 至少覆盖：

- IA UI-01..UI-31 每项恰有一个最低可证伪档位映射；
- channel/selector/manager/candidate/三张表的七套 cursor identity、固定 pageSize20、显式控件 placement 与 reset key exact；21st 可达且无 auto-drain/client slice；
- 三张表列 exact order、无禁列/重复操作；
- `currentData/isFetching`、无服务器事实 `useState` 镜像、失败保留 form、成功权威 refresh；
- first/last move disabled 来自 owner canMove，非当前页 index；
- dirty close、overlay shell lock、focus return、keyboard-operable name/action；
- generated route only；raw `/api/`、raw `data-testid`（允许的 AntD label adapter 除外）和 client slice 搜索为零；
- Catalog image adapter behavior 不回归。

### 11.3 浏览器 L2 exact-set

#### 唯一来源和同一 runner 扩展

| 事实 | 唯一源/派生 |
| --- | --- |
| cases、actions、oracle、fixture ref、network | `contracts/policy/sales-menu-l2-case-blueprint.json` 手写唯一源 |
| P1 | `scripts/generate/sales-menu-p1.mjs`；生成并自检，不改 catalog P1 的业务分母 |
| generated | `sales-menu-l2-scenarios.json`、`sales-menu-l2-locator-bindings.json`、`sales-menu-l2-activation-candidate.json`、`sales-menu-l2-execution.json`、`sales-menu-l2-timing-budget.json` |
| TEST fixture | `contracts/policy/sales-menu-l2-fixture.json` 描述；`scripts/test/sales-menu-l2-fixture.mjs` 校验；runner 只用真实 owner/API 物化/readback |
| spec | `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts` 只消费 generated profile，不手写 case id 列表 |
| runner | 保留 `scripts/test/browser-l2`/`browser-l2-runtime.mjs` 唯一入口；增加显式 `--suite sales-menu` 与窄 `salesMenuSuite` adapter；共用 lifecycle/secret/join/progress/cleanup，不建第二 runner/registry |

L2 case exact-set 固定为以下 16 条；31 条 UI 检查映射到 case，但“UI 数=case 数”不是规则：

| caseId | 覆盖 UI | 用户动作与业务 oracle |
| --- | --- | --- |
| `sales-menu-entry-and-channels` | 01,20 | 全局 STORE context 进入页面；无第二门店控件；21 eligible channels 以20+1显式分页到达；选择 menu 不改变 activation；换页不自动换 channel |
| `sales-menu-section-actions` | 02,03,04 | 分区行名称+紧邻数量+末尾菜单；真实上/下/改名/删除；owner order readback/focus return |
| `sales-menu-add-candidates` | 05,12,13,14 | 完整分类树/空分类；21 candidates 以20+1显式分页到达；第21个可加入；同商品重复勾选并形成不同 refs；shape 可见 |
| `sales-menu-edit-direct-item-and-media` | 07,09,10,21,22,23 | 名称进入编辑；无库存/沽清；direct price/约束；custom image upload/reorder/retry；标题删除确认 |
| `sales-menu-edit-sku-prices` | 10,27,28 | 逐 SKU 选择/菜单价；无公共挂牌价；readback 精确 |
| `sales-menu-edit-weighted-item` | 08,28 | 公共单位价；不显示/不提交按份约束 |
| `sales-menu-draft-order-and-pagination` | 11,31 | 21 rows 两页；行末只有上/下；跨页 move 后 owner 全序无重无漏；scope reset page1 |
| `sales-menu-publish-and-front-structure` | 15,16,17,29,30 | preview/publish；front 无操作/查看列；名称详情是真只读；old publication frozen；准确 success copy |
| `sales-menu-front-status-and-pagination` | 06,19,31 | 两维状态分列；21 rows 分页；状态 cell 打开 modal，不能恢复 inventory |
| `sales-menu-manual-sold-out-and-restore` | 19 | 选择沽清+原因；other channel unchanged；restore 二次确认；history/readback |
| `sales-menu-menu-management-and-multi-active` | 20,24,26 | 21 menus 在 selector 与 manager 各自20+1分页可达；两 menu 同时 enabled；停用后仍 edit/publish；schedule drawer启停只读；销售端提示 copy |
| `sales-menu-copy-boundary` | 25 | copy 自动选副本；definition/schedule相同；new disabled；publication/log/manual/inventory/source activation absent |
| `sales-menu-publish-blockers` | 24,26 | disabled store/channel阻断；activation disabled不阻断；失败原因保留且 owner facts不变 |
| `sales-menu-operation-records` | 18,31 | 普通四列表；21 rows Cursor；无详情/诊断入口；success/failed facts准确 |
| `sales-menu-failure-recovery-and-focus` | 02,05,09,19,23,30 | save/sort/upload/publish failure保持输入/权威顺序；关闭归还焦点；dirty close保护；未声明network=0 |
| `sales-menu-auth-and-scope-isolation` | 01,24 | 无 capability/foreign store/project channel从真实 UI被拒；无 owner write/leak；shell scope lock |

每个 action 声明 testId、generated operation、required/forbidden/background network、owner readback 和失败不变事实；runner 产出 case/action/request/completion/DB-section join。readiness/finalize/run/cleanup、secret 0600、repository byte binding、per-case progress 与四项 cleanup 完全沿用项目 L2 标准。当前轮不生成 active readiness、不执行浏览器。

### 11.4 红夹具

| 红夹具 | 出现即缺陷 | 证伪点 |
| --- | --- | --- |
| same item 被 add 去重 | 违反 independent SalesItem | 两次 add 后 ref count 必须 +2 |
| published row 随 draft/catalog 改变 | 违反冻结 | old publication hash/read fields不变 |
| second enabled menu 自动停用 first | 违反多菜单 | activation 两行均 ENABLED |
| inventory+manual 合并成 boolean | 信息丢失 | contract/static 禁止 merged field；两对象必备 |
| cross-query cursor 可用 | 数据串范围 | owner decode typed reject |
| 第21个 channel/menu/candidate 不可达或后台自动抽干 | Cursor 与“全部”表面脱节 | 三类集合都必须通过显式20+1控件到达，network oracle 禁止连续自动取尽 |
| 图片只按 workspace/usage 授权 | actual-target 丢失 | 无 capability 与 cross-store/menu/item stage/release/claim 均拒绝且 asset target/lifecycle不变 |
| copy 带入任何 excluded relation | 复制越界 | exact absence set |
| L2 spec 手写 case/path/testId | 第二事实源 | P1/spec self-test红 |
| seed child business PASS cleanup FAIL 被父判 PASS | 安全边界破坏 | parent validator红 |

## 12 · 未决项处置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| 终端获取/ACK/TDP | 后置 | publication 只产出后台前台菜单事实；操作记录准确说明边界 | terminal-data-server runtime、投递状态、诊断面板 |
| 销售端多菜单选择算法 | 明确属于销售端 | 返回全部 enabled published menus + schedule | menu owner 计算“当前唯一菜单”、合并器 |
| 入口形态动作能力 | 后置 | INTERNAL DINE_IN/TAKEAWAY 同一菜单结构 | POS/QR/KIOSK 独立动作枚举 |
| 商品级人工沽清 | 明确不做 | 批量对各 SalesItem 操作 | CatalogItem manual status |
| 整单/桌台约束 | 后置 | 两个 item quantity keys | minimum spend/service charge等字段 |
| Inventory UNKNOWN 的可控注入 | 需要测试实现设计时基于现有 failure boundary 验证 | acceptance/L2 通过 owner read failure seam 证明 non-blocking | seed 假造 UNKNOWN 持久化状态、生产测试专用 API |
| 空菜单/空分区发布 | 当前批准需求未禁止 | 允许生成可解释的空前台菜单 | 实施期私加“至少一分区/一销售项” blocker |

## 13 · 停机条件

出现以下任一情形，实施 agent 必须停止该点、完成只读影响核查并单条向 Dexter 求裁，不得用 fallback/兼容层自行决定：

1. 需求/IA/本详设对同一用户事实出现不同字节，无法通过保持 IA 原文消解；
2. 真实 Catalog shape/price/unit 事实不能表达 §5.3 任一已裁形态；
3. BusinessChannel owner 无法证明 STORE INTERNAL DINE_IN/TAKEAWAY actual target，或需要新 binding 层；
4. Asset owner 的不可变 publication 图片需要释放策略而当前 active asset 生命周期无唯一安全答案；
5. 实施发现新的商品形态、约束语义或发布阻断条件，而当前 source 无法裁决；
6. Inventory UNKNOWN 只有生产故障才能构造且无既有安全 seam，禁止为测试新增生产 API；
7. 实际生成 operation denominator、DB budget、L2 case source 或 §11.1a 覆盖矩阵与本文数字/成员不一致；数字是待验证输入，以当前唯一 source 为准，先修设计/来源再继续；
8. 动态 Testcontainers/L2/DEV/seed/managed stop-start 需要授权而当前没有；不得把静态结果升级为动态 PASS；
9. reviewer finding 涉及产品/Journey取舍而 source 无法裁决；标 `DEXTER_DECISION`，不得过度设计。

## 13b · 实施节奏 · 三维对账

每个 CP 开始前逐点重开：需求对应条目、IA/交互对应 UI、六维 recall 全部命中、本 CP owner source/生成器/测试。完成 focused proof 后用同一组原文逐项回读，并由 fresh 独立子 agent 检查以下 11 个维度：行为、形态、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效。

| 时点 | 必须输出 | 继续条件 |
| --- | --- | --- |
| CP-00..CP-06 各自结束 | 需求/详设IA/项目记忆三维逐条 `MATCHED|OPEN`，并附 owning source/focused proof | OPEN=0 后才进入下一 CP；这不是整批 verdict |
| 全部 CP 完成、整体测试前 | 重新对全批逐条三维对账，不复用阶段结论 | 跨 CP 同一事实仍一字一致、OPEN=0 |
| 整体测试后 | fresh `REVIEW_TARGET=IMPLEMENTATION` 对抗 review，最多两轮 | 按 review governance 独立 verdict + 作者逐 finding intake |

测试只能证明已写 oracle，不替代三维对账。任何本应在开发阶段发现的 IA/owner/状态偏移不得留到 Testcontainers 或 L2 才处理。

## 14 · 交付前自查与防再犯

### 14.1 详设自查

| 检查 | 结果/判据 |
| --- | --- |
| §3 行完整 | 固定 17 行均已填写，N/A 均有反例 |
| §3 ④ 全集 | operation/read/cache/overlay/seed/L2 均为 finite list |
| §7 机制行 | collection/auth/cache/error/log 全部跨层展开 |
| 详设 ↔ IA | UI copy/动作/位置/限制保持 IA 原文；技术层只补 owner/contract/proof |
| seed 全集 | 当前完整父、business-channel、catalog-inventory、新 sales-menu plan/executor/tests 均列出 |
| 计数 | 31 operations、19 commands、38 owner rules、15 本批 acceptance scenarios、16 L2 cases、31 行 operation coverage；提交 review 前按各节边界重新数表行；不得把 15 写成全仓 scenario 固定上限 |
| operation 覆盖 | §5 operationId 与 §11.1a 覆盖行 exact equality；每行 acceptance 非空，L2 非空或有 `L2_NA_WITH_REASON`；引用的 scenario/case 都存在；动态完成仍须 actual completion events 逐行读回 |
| 证据档位 | 本轮只有设计/静态源码证据；无 Testcontainers/L2/seed runtime PASS 声称 |

### 14.2 已识别问题族的最小预防

| 失败模式 | 根因层 | 有限适用范围 | 反例边界 | 最小可复用解 | 唯一预防去向 |
| --- | --- | --- | --- | --- | --- |
| 菜单字段落 Catalog | owner 边界混淆 | menu-owned入口/版本/展示/价/分区 | Catalog item本体事实 | sales-menu module boundary + cross-schema ArchUnit | backend module boundary test |
| copy 顺手复制全部 relation | aggregate/relationship 未分离 | menu copy operation | 普通同 owner value copy | exact include/exclude oracle | `copy-current-draft-boundary` acceptance |
| 多列表共享 cursor/cache | query identity 不完整 | 三张表及候选/menu/channel Cursor | Detail aggregate | identity finite denominator + resetKey test | frontend read-model focused test |
| 两状态合并成“可售” | read model压平 | published item list/detail | 销售端可自行组合 | contract 两对象必备、merged field禁止 | contract schema static test |
| disabled form冒充详情/重复动作 | UI 任务未按模式分离 | front detail/table/action | 真正编辑 drawer | 独立 detail component + exact column/action test | UI-29/30 focused test |
| generated operation 计数复制 | denominator 多住址 | edge-codegen operation count | 独立业务预算裁决 | source denominator 驱动 generator | edge-codegen self-test |
| sales-menu 直接 import CatalogAssetEditor | feature 反向耦合 | 共用图片行为 | Catalog独有业务文案/API | foundation presentational primitive + 两个 adapters | foundation/Catalog/SalesMenu focused tests |
| Seed 只有静态 plan却被完整父遗漏 | 执行分母与声明分离 | r5-full所有 child stages | 单域内部 dry-run | parent exact stage/readback/cleanup test | r5-complete-seed-executor.test.mjs |
| Seed 按数组位置绑定 owner validator | stage分母与owner readback身份耦合 | r5-full多owner child stages | 仅一个不可变stage的单域runner | exact order后按stage id建立map，owner validator只读对应id | r5-complete-seed-executor.test.mjs 的换位/同数量错shape红测 |
| 把 INTERNAL 模板误当真实渠道 | template/instance与accessKind混淆 | business-channel前置数据和菜单seed | 只测试模板候选的场景 | business-channel owner plan显式生成INTERNAL channel实例并与EXTERNAL负例并存 | business-channel seed plan/executor tests + sales-menu seed readback |
| 场景数量齐全却漏跑 operation | 只保留数量/样例，没有成员到业务 oracle 的覆盖关系 | 本批 31 条受影响 HTTP operations、15 个业务场景与16个 L2 cases | 纯内部 helper、非 HTTP synthetic data | 31 行 operation→acceptance/L2 合同 + actual completion event 回读；业务场景仍按闭环组织 | 详设 §11.1a、SM-05/SM-08/SM-12 closure review；不新增旧 provider/exact-set 控制面 |
