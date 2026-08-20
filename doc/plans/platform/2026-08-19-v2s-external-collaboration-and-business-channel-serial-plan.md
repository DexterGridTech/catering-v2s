SERIAL_PLAN_KIND=ONE_BATCH_INTERNAL_SERIAL_CP

# 外部协作与经营渠道一批串行实施计划

> 状态：`ACTIVE_IMPLEMENTATION_AUTHORIZED`
>
> 本文件是同一批次的一条串行实施路径，不是把 Journey、模块、文件、App 或单项 gate 拆成独立交付。Dexter 已于 2026-08-19 授权本批实施：`R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_AUTHORIZED=true`。仍不授权 seed 执行、reset、DEV、L2、UAT、外部联调或 Git 操作。

## 1. 目标、输入与结束条件

### 1.1 业务目标

在一个业务 deployable、一个 PostgreSQL、多 owner schema 的边界内，建立可审计的外部协作配置与经营渠道管理能力：

- `platform-admin` 管理外部系统、provider profile、workspace enablement、owner binding 及其非渠道 binding；
- `operations-admin` 管理项目/门店模板与渠道，写能力只有“项目渠道编辑”和“门店渠道编辑”；
- 外部授权、节点归属、四维渠道语义和停用/解绑状态有明确 owner 与 typed problem；
- `catalogStatus=PLANNED` 只代表目录信息，不阻断 enablement，也不阻断运营侧候选；
- 渠道配置不提前实现订单同步、菜单协作数据、适配器进程、外部联调、权益结算或库存同步。

### 1.2 唯一输入与设计输出

唯一业务输入是：

- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`
- `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md`

本计划与下列设计文件共同构成一批设计输入：

- `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`
- `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`

设计期结束条件：三份设计文档、一份串行计划、独立盲审 verdict、作者逐条 intake 和 Claude review brief 均已形成；不把设计完成描述为 implementation GO。

## 2. 总体串行边界

```text
Journey/UI admission
  -> contract descriptor and owner model
  -> collaboration owner persistence/API
  -> business-channel owner persistence/API
  -> edge policy + capability + OpenAPI
  -> code generation and wire
  -> platform-admin UI
  -> operations-admin UI
  -> seed composition design
  -> backend acceptance scenarios
  -> static / focused / full verification
  -> managed DEV/L2/UAT only after separate authority
```

每个 CP 必须在前一个 CP 的 source/readback/verification 条件满足后开始。任何 CP 的 business PASS 与 cleanup PASS 必须分开记录；动态环境不允许以延长 timeout、轮询或魔法等待替代诊断。

## 3. CP-00：设计冻结与 admission

**Owner**：Codex 设计会话；产品/Journey 裁决由 Dexter 保留。

**读取**：两份原始规格、两份 Journey、UI interaction、IA、implementation-facing design、当前平台 blueprint、frontend foundation rule、independent review governance。

**进入条件**：

- 两个 Journey 的 actor、owner、entry、forbidden UI、E-33 已在设计中可追溯；
- 每个 IA screen 已填九维度；
- UI interaction 的 visual review 仍为 `UNSET` 时，不得宣称 UI admission 已完成；
- 五项未决 C 只在其落到具体契约/DB 约束时阻断，不得被提前写成已定需求；C-03 已按规格收口。

**动作**：

1. 对每个实际变更点逐项重开原始 BR/E/C、命中的 project-memory、owning source 与复用 foundation；
2. 完成对应 focused proof 后，用同一组原文回读源码与证据；
3. 将所有未决项写成 `[未定]`、依赖点和停止条件，不建立第二状态源。

**失败条件与处理**：

- 若发现 UI 线框没有对应批准 Journey：停止该 surface，重新做 Journey/interaction intake；
- 若发现文档把 `PLANNED` 当启用门槛：直接退回设计，不进入契约；
- 若发现 C 项只影响算法而未影响 IA：保留依赖，不扩大为准入门；
- Dexter 已裁定按文字版 IA/interaction 实施；不得再把另行视觉 review 作为本批 UI 实施准入门。

**验证**：文档静态交叉检查、BR/OP/C/U key 对照、IA 九维度字段检查、独立盲审。

## 4. CP-01：契约 descriptor 与 collaboration 领域模型

**Owner**：`collaboration`；跨域调用由 edge policy 负责。

**目标路径（获授权后才创建/修改）**：

- `apps/backend/catering-business-server/modules/collaboration/`
- `apps/backend/catering-business-server/modules/collaboration/src/main/resources/db/migration/`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/`
- `apps/backend/catering-business-server/modules/collaboration/src/test/java/`

**动作顺序**：

1. 先从 checked-in capability descriptor 读取 `externalSystem`、`providerProfile`、`businessScope`、`attributeDictionary`、`attributeValues`、`bindableNodeTypes` 与两级 `catalogStatus`；
2. 校验一平台一 `external_system`、provider scope 是 system capability 子集、descriptor 的 `fieldKey/label/helpText/controlKind/optionSourceRef` 完整且 attribute value 的 key 命中字典；
3. 再落 `external_system`、`provider_profile`、workspace `enablement_state`、`owner_binding` 的 owner schema 与 CAS/version；
4. 使用 `EXTERNAL_GRANT`、`INTERNAL_MAPPING`、`NO_MAPPING` 三种 authentication kind 形成显式三态；
5. `authorizationRef` 与 token 只作为 opaque reference/治理信号，不进入 response、日志或 UI；
6. `catalogStatus=PLANNED` 不进入 enablement 或候选的硬拒绝条件。

**不在本 CP 决定**：

- C-02 的 `nodeRef` discriminator/type pair 最终形态；
- C-03 已按规格收口为集团空间内唯一，实施时需落 owner 判重与数据库并发兜底；
- C-04 的 `UNBINDING`/failed revoke 状态；
- C-08 的规则判断模型；
- C-09 的成本量化；
- U-02 的外部平台单方面解除授权处理。

其余未决项若需要进入具体 column、unique index、state transition 或 public problem，立即停止对应 CP，保留 `[未定]` 并单条向 Dexter 求裁；不得以默认值、兼容列或隐式规则绕过。C-03 不得恢复为未决。

**失败条件**：owner 事实由 edge 或另一个模块直接写、binding 编辑绕过 authentication kind、scope 校验落在 UI、或敏感值出现在 response/log。

**验证**：模块编译/类型检查、migration 静态检查、owner API focused tests、错误问题与日志脱敏测试；无 runtime seed。

## 5. CP-02：business-channel owner 模型与业务状态

**Owner**：`business-channel`；只读读取 `collaboration` 的公开查询，不直接写 collaboration schema。

**目标路径（获授权后才创建/修改）**：

- `apps/backend/catering-business-server/modules/business-channel/`
- `apps/backend/catering-business-server/modules/business-channel/src/main/resources/db/migration/`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/`
- `apps/backend/catering-business-server/modules/business-channel/src/test/java/`

**动作顺序**：

1. 建立模板与渠道的 owner facts：用户录入且不可变的 templateCode/channelCode、四维模板语义、project/store operator kind、channel status、bindingRef；
2. 读取 `collaboration` provider/binding candidate，不把 `bindableNodeTypes` 当 runtime authorization；
3. 同一模板允许多个 channel instance；templateCode 按项目唯一，channelCode 按集团空间唯一；不添加“同项目同模板最多一条”；
4. `DINE_IN` 只能 `INTERNAL`，且 `dineInForm` 只能 POS/QR/KIOSK；`TAKEAWAY`/`GROUP_BUY` 不接受 dine-in form；
5. disabled object 保留可读/置灰语义；模板/渠道不物理删除；binding logical delete 使外部 channel 回落 DRAFT、内部 channel 保持/恢复 EFFECTIVE，且 `bindingRef=null`；
6. 外部系统或模板停用的级联原因与 MANUAL 原因分开保留；恢复算法遇到 C-01 依赖时不提前宣称最终语义。

**失败条件**：business-channel 直接调用 collaboration command、把外部 owner id 做错误的全局唯一约束、以门店 disabled 阻断规格允许的创建、或仅删除前端入口而没有 owner command 拒绝。

**验证**：owner command focused tests、编码缺失/重复/并发唯一约束负例、同模板多实例、内部创建即 `EFFECTIVE`、外部 pending/effective 状态、双来源停用与 MANUAL red fixture；不启动外部适配器。

## 6. CP-03：edge policy、权限与跨 owner 事务

**Owner**：edge operation policy；事实仍由两个 owner command 持有。

**动作顺序**：

1. 在 `contracts/openapi/edge.openapi.json` 与 path shard 先定义 edge operation 和 typed problem；
2. 在 `contracts/registry/operation-handler-bindings.json` 登记 operation/handler/consumer face；
3. 每条 route 只声明一个真实 `x-consumer-faces`，能力字典按 platform 与 operations 拆成两个 face-specific operation；
4. 需要双 owner 写入的 operation 由 edge policy 在同一 `REQUIRED` 事务中依次调用公开 owner command；
5. platform-admin 复核 workspace/target/session；operations-admin 额外复核 project/store target 与两个 approved write capability；operations-admin 的 binding operation 只能嵌在已定位的 business channel context 中，不暴露独立 owner-binding collection 或非渠道 binding 管理；
6. read 不赋 capability，但不等于跳过 owner/session recheck；
7. 业务问题保持稳定：scope、node type、order kind、dine-in、provider enablement、binding effective、authorization、edit/delete、immutable、adapter revoke、CAS。

**跨域事务矩阵**：

| edge intent | collaboration command | business-channel command | 事务 |
| --- | --- | --- | --- |
| platform binding create/update/delete | required | 无 | 一个 owner command |
| operations channel create/update | read candidate/effective binding | required | 同一 `REQUIRED` |
| binding logical delete with channel fallback | required delete | required type-aware fallback（EXTERNAL→DRAFT，INTERNAL→EFFECTIVE） | 同一 `REQUIRED` |
| external/template disable cascade | required status transition | required cascade transition | 同一 `REQUIRED` |
| detail/list/candidate read | read query | read query | 无跨域写 |

**失败条件**：route 同时标两个 consumer face、read edge 推导写权限、跨 schema 直接 SQL 写、跨域写不在同一 REQUIRED 事务、operations-admin 出现非渠道 binding 写入口、或 platform-admin 出现 capability 授权入口。

**验证**：OpenAPI lint/parse、operation registry consistency、handler binding generation check、typed problem contract tests、事务边界 focused tests。

## 7. CP-04：生成链与后端/前端 wire

**Owner**：契约生成链；源头是 OpenAPI/registry，生成物不是手写源。

**严格顺序**：

1. 修改 `contracts/openapi/edge.openapi.json` 及其 path/schema source；
2. 运行 `scripts/generate/edge-codegen.mjs` 生成 Java edge types/handlers 所需输出；
3. 运行 `scripts/generate/operation-handler-bindings.mjs` 更新 registry 绑定生成物；
4. 运行既有 frontend generator，生成 `platform-edge.ts/.rtk.ts` 与 operations 对应客户端；
5. 将生成结果接入 app 的 `baseApi`/store，不在 generated 文件上手改；
6. 对每个 operation 做 source → generated Java → generated TypeScript → UI caller 的 readback。

**失败条件**：generated 与 source drift、OpenAPI `$ref` 只在一层能解析、生成器改写不稳定、operation id 使用 journey/process 名称、或 frontend 通过未公开私有 API 绕过 generated client。

**验证**：生成前后 hash/readback、Java 编译、TypeScript typecheck、OpenAPI dereference/lint、operation registry check；不启动 DEV/L2。

## 8. CP-05：platform-admin UI

**Owner**：`apps/frontend/platform-admin`；共享行为必须来自 `libraries/frontend/admin-ui-foundation`。

**实现顺序**：

1. 先复核 `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md` 的 P1–P6 与 visual review 结果；未完成 visual review 不进入 UI implementation；
2. 盘点并显式搬运 all-v2 对应页面/静态摹本（如存在）；无 counterpart 时记录 `NO_V2_COUNTERPART`，不从 heritage runtime/build fallback；
3. P4 接入服务端 `usePageQuery`（`queryText/page/pageSize` 与 `metadata.total`）；O1/O3/O5 使用 ProTable 关闭 search/pagination，表头排序转换为白名单 `sortKey/sortDirection` 后重新执行对应 owner read，不做前端过滤或展示切片；store-template/provider candidates 保留 `useCursorCandidates`/`collectCursorPages` 内部协议，门店可选模板的排序与 cursor identity 一并传递且不向用户展示分页；同时接入 `useDetailDrawer`、`adminDrawerSurfaceProps`/wide props、`formatNameCode`、`testId` 等已有 foundation primitive；
4. 保留 platform-admin 独立 shell/router/store/session/context/theme；不合并 operations-admin；
5. P1–P6 只显示管理任务所需字段；不显示 token、凭证、authorizationRef、schema/contract/permission 实现术语；停用对象仍读得到且置灰；
6. binding create/update/delete 的 frontend 状态必须由 HTTP readback 驱动，不能本地先改成 effective；platform-admin 只对非外部授权档案显示新建/编辑，`EXTERNAL_GRANT` 不提供新建、编辑或手工“授权完成”按钮；运营渠道授权流程保留 pending/callback；
7. 对 loading/error/empty/partial cascade/version conflict 做 interaction-level tests，使用稳定 test id。

**失败条件**：通过隐藏 disabled row 代替状态、把节点 UUID 直接作为用户标签、用页码代替 cursor candidate protocol、重复实现 foundation overlay/Drawer lock，或出现 operations capability 控件。

**验证**：focused component tests、frontend typecheck/lint、受管 browser L2（仅在单独授权且 API 闭环后）；business 与 cleanup 分开。

## 9. CP-06：operations-admin UI

**Owner**：`apps/frontend/operations-admin`；共享行为必须来自 foundation，业务 shell/route/store/theme 保持独立。

**实现顺序**：

1. 复核 O1–O5 的 Journey 与 visual review；project/store 两种 capability 表达必须与操作目标一致；
2. 使用既有 `useOrganizationCandidates`/cursor candidate 语义；O1/O3/O5 的用户可见结果表使用 ProTable 且关闭 search/pagination，表头排序只通过白名单 `sortKey/sortDirection` 触发 owner read，不做本地展示切片或向服务端伪造 Page；门店模板候选仍由 `collectCursorPages` 内部累加，并把排序纳入每次 candidate read，不在操作员界面展示实现层 cursor；
3. 模板与渠道采用四维字段：accessKind、operatorKind、orderKind、dineInForm；到店规则与 provider effective 状态在服务端复核；
4. project channel edit 与 store channel edit 是唯一写能力；读页面不显示 capability 选择器；
5. PLANNED provider 在 workspace enablement 已开时可以进入候选；UI 不添加“catalog must be READY”过滤；
6. 禁用模板/渠道保留可读、置灰且不可编辑；不提供模板/渠道删除入口；binding logical delete 的接入类型回落取自服务端 readback；历史内部无停用原因 DRAFT 由一次性 migration repair 提升为 EFFECTIVE；
7. 重新读取同一 query identity 的 list/detail，避免 mutation 后 stale candidate/selection。

**失败条件**：以 catalogStatus 过滤掉 PLANNED、用 store disabled 做额外拒绝、展示非渠道 binding 管理、增加订单同步/菜单协作入口、或将两个 admin 的 session/context/theme 合并。

**验证**：focused UI tests、typecheck/lint、浏览器 L2（授权后）；每个 write capability 至少一条成功与一条拒绝场景。

## 10. CP-07：seed composition 设计（不执行）

**Owner**：受管 seed 入口；当前只设计 fixture，不启动任何 runner。

**设计内容**：

- 后续新增本域计划与 executor：`scripts/dev/external-collaboration-business-channel-seed-plan.mjs`、`scripts/dev/external-collaboration-business-channel-seed-executor.mjs`，沿用 `catalog-inventory-seed-plan.mjs`/executor 的结构：revision、seedDatasets、ownerScopes、entities、relations、依赖顺序、planDigest、stage manifest/report 与 `STATIC_PLAN_ONLY`；本批实现脚本但不执行 seed；
- 契约目录/能力字典作为该本域计划的只读输入引用（`contracts/collaboration/external-platform-catalog.json`），不写入 `catalog-inventory-seed-plan.mjs`，也不由 seed 写入契约态数据；`catalogStatus=PLANNED` 不变成启用门槛；
- fixture 必须覆盖五类可绑定节点：`COMMERCIAL_GROUP`、`REGION`、`PROJECT`、`HEAD_COMPANY`、`STORE`；
- fixture 必须包含万象城海底捞形态：一个门店、三条渠道、三条绑定，其中两条 `TAKEAWAY`、一条 `GROUP_BUY`；并包含内部 `DINE_IN` 的 `POS`、`QR`、`KIOSK` 各一条；
- 保留并补齐既有覆盖：PLANNED 可启用、未启用 provider 不进候选、运营渠道授权创建 `EXTERNAL_GRANT` 后 pending/callback、platform 创建 `EXTERNAL_GRANT` 明确拒绝、INTERNAL_MAPPING、NO_MAPPING、两种 externalOwnerId 多实例、双停用来源 + MANUAL、外部 binding 删除回落 DRAFT/内部 binding 删除保持 EFFECTIVE、历史内部 DRAFT repair、DINE_IN 组合问题；
- 生成/校验报告沿用 `scripts/test/seed-report.mjs`，business 与 cleanup 分开；
- 本域必须接入既有 `scripts/dev/r5-complete-seed-executor.mjs` 的父 manifest/report，stage 集合固定为 `[owner-command, external-collaboration-business-channel, catalog-inventory]`，顺序为 owner-command → 本域 executor → catalog-inventory；child stage 继承父 `managedDevRunId`，父 runner 汇总 business/cleanup/first failure；不得旁路 `scripts/dev/seed --profile r5-full`。`start/restart` 不隐式 seed，reset/seed 仍是独立、显式、破坏性动作；

**禁止**：当前任务执行 reset/seed/start、直接 SQL 写业务事实、在 API acceptance 中复用 seed 数据、记录 token/OTP/cookie/Authorization/raw payload、使用未知进程/端口猜测 cleanup。

**验证**：仅做 source/schema/read-only plan review；任何动态执行须另获 Dexter 授权并按 managed runtime 入口运行。

## 11. CP-08：backend acceptance 场景

**Owner file**：

- 契约目录校验：CP-01 contract validator（不属于 HTTP acceptance domain）；
- 协作场景：新增 `CollaborationAcceptanceScenarios.java`；
- 经营渠道场景：新增 `BusinessChannelAcceptanceScenarios.java`；

两个新增 domain 文件登记到当前 `BackendAcceptanceScenarioCatalog`；这是当前显式 domain group 的正常扩展，不新增 provider shell、共享 SPI、退役的通用 scenario registry 或自动分母。生产 owner 仍分别是 collaboration 与 business-channel；实现时测试场景必须按此 domain group 落位，不能把经营渠道场景回塞到 collaboration 文件。

**新增 16 条能力命名场景**（其中 `collaboration.binding-page-searches-node-name` 是本轮 P4 修复补充的 focused regression，`business-channel.cross-node-read-authorization` 是 M-1 selected-store scope 的 focused regression）：

```text
collaboration.catalog-readback
collaboration.planned-profile-enablement
collaboration.bindable-node-candidates
collaboration.platform-external-grant-create-rejected
collaboration.internal-and-no-mapping
collaboration.provider-binding-edit-policy
business-channel.same-store-two-owner-ids
collaboration.logical-delete-retains-row
collaboration.adapter-unbind-required
collaboration.binding-page-searches-node-name
business-channel.cascade-and-draft
business-channel.planned-provider-candidate
business-channel.double-source-and-manual-stop
business-channel.store-template-scope
business-channel.disabled-store-create
business-channel.cross-node-read-authorization
```

每条场景必须有非空 `identity`、`fixture`、`request`、`businessOracle`；实际 HTTP、真实 fixture、非 `response.ok` 的业务断言、`CONTRACT`/`BUSINESS`/`CLEANUP` 分离；DB operation 只能作人工观察。当前 source count 是 44，新增 16 条后预计 60，仍低于硬上限 80。

**顺序**：先 focused operation，再 all；API 闭环后才允许进入 UI L2；API runner、seed、L2 使用不同 runId/manifest/report，不共享 session/database/asset/report。

## 12. CP-09：静态、focused、full 与动态退出顺序

### 12.1 静态闭环

按 source → generated → consumer 顺序完成：

1. OpenAPI/schema/registry parse 与 dereference；
2. backend owner compile/typecheck；
3. frontend generated client typecheck；
4. operation-handler binding consistency；
5. acceptance source count、scenario owner file 与业务断言审阅；
6. focused tests；
7. full module/backend acceptance tests。

静态门只能说明机械事实，不能替代 fresh 业务对抗审查或 Claude review。

### 12.2 动态闭环（另行授权后）

- DEV/L2 只能在本机启动 Spring Boot、两个 admin 和 Playwright，经受管 tunnel 访问远端非生产中间件；
- UAT 如需远端运行，必须是单独明确授权，不能把 DEV/L2 证据冒充 UAT；
- 每个 run 启动前按 manifest 做 PID/start token/host/boot id/start ticks/RSS 预检；
- first failure 保留日志并完成边界诊断，第二次同 signal 前不得盲重试；
- business PASS 与 cleanup PASS 分开，cleanup 非 PASS 不得收口。

### 12.3 退出条件

只有以下证据全部满足，才可向 Dexter 请求 implementation authorization 的下一步：

- 两个 Journey 与 UI visual review 已明确 admission；
- implementation-facing 设计通过独立设计 review 与 Claude review；
- 本批涉及的 C-03 contract/DB 事项已裁定；其余五项 C 仍保留未决态；
- owner API、edge transaction、generated byte flow、双后台 UI、acceptance 场景和日志边界有对应 proof；
- 动态证据若被授权执行，则 business 与 cleanup 均 PASS；
- 没有将旧 compliance-control、196 provider inventory、package exit 或历史 `CURRENT_*` 重新引入。

## 13. 硬停止清单

在下列任一情况出现时停止当前 CP，先读日志/源码/原文并说明根因，不用 workaround 继续：

- 新 API 无明确 owner command 或跨 owner 写不在同一 REQUIRED 事务；
- `x-consumer-faces` 与实际 route/前端调用不一致；
- `PLANNED` 被错误当成 enablement/candidate gate；
- C-01/C-02/C-04/C-08/C-09 被实现为隐含 contract/DB 约束；C-03 已收口，必须按集团空间唯一实现且不得回退为未决；
- UI 不来自批准 Journey，或把 forbidden boundary 做成可操作入口；
- token、authorizationRef、OTP、cookie、Authorization、原始 IP/手机号/登录名进入日志/response/UI；
- acceptance 通过 provider 壳、共享 SPI、自动分母或入口类堆断言扩张；
- 生成物被手改，或 generation source → generated → consumer 无法回读；
- 动态 runner 缺少结构化日志、run-scoped manifest、受控 process identity 或 cleanup 证据。

## 14. 设计期交接

本计划完成后先进行 `REVIEW_TARGET=DESIGN` 的 fresh 独立盲审，最多两轮；作者只在 reviewer verdict 之后逐条重开 source、证据和反例并形成 intake。随后将以下内容以仓根相对路径交给 Claude：Journey、UI interaction、IA、implementation-facing design、serial plan、independent review verdict/intake、原始规格与适用 decisions。

Claude review 只验证设计，不授予 implementation、runtime、seed、reset、DEV、L2、UAT 或 Git 权限。任何产品歧义与五项未决 C 的具体裁决仍由 Dexter 决定；C-03 按已收口规则执行。
