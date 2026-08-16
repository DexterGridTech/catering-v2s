# 20 倍业务量的健壮底座 · 需求分析

| | |
|---|---|
| **提出** | Dexter,2026-08-16 |
| **交付上限** | 三个批次 |
| **阶段前提** | 无业务数据;每次 reset + seed。**迁移不可逆、数据回填、向后兼容读均不构成本轮约束** |
| **证据** | 七路独立评估 + 三路对抗审查,数字均为实测 |
| **详细台账** | `doc/review/platform/2026-08-16-v2s-scalable-foundation-evidence-ledger-claude.md` |

---

# 一 · 目标

> **底座 = 让「再加 20 倍业务功能」的单位成本不随功能数增长。**

解的是**功能量**,不是访问量。

## G1 · 公共能力统一提供

横切关注点由一处提供,不由各 owner / 各 feature 自实现。

**达成判据**

**判据一(斜率) · 本轮 `DEFERRED_BY_APPROVED_SCOPE`,不是达成也不是失败**
下一个新增 owner 模块内,`INSERT INTO .*command_receipt` 与 `pg_advisory` 命中数为 0。

它要求存在一个能容纳多种 scope-key 形态的共享 receipt 实现 —— 那正是 `P-1`,而 `P-1` 已裁定推迟
(租户键形态未定,现在做出来是「一个实现 + 多路策略」)。`P-2` 只修四个现存 owner 的首用并发,
**不产生这个前向能力**。
⇒ **三批次全通过也不得宣称此判据已关闭**;验收表上标 `DEFERRED_BY_APPROVED_SCOPE`,
不得改判据文字掩盖。要关闭它,须由 Dexter 另行把 `P-1` / `D-1` / `D-2` 拉回范围。

**判据二(常数因子) · 本轮唯一要交付的可测判据**
新增一条业务命令的手改处**从 15 降到 ≤ 10**(`P-7`)。

⚠️ **2026-08-17 更正:原写「< 10」不可达。** 亲验 `backend-performance-m1-command-execution-bindings.mjs` 第 53 行 `emitInventoryMutation(row, requestType, adapterType, field)` **本来就是参数化 emitter**,第 63、67 行的 increase / adjust 只是三行委托 ⇒ 「引入参数化 emitter」是伪动作,真实残留手改是第 273 行的 `emitters` 注册。**真实下限是 10,不是 9。**

⚠️ **起点数以逐条列举为准,不是 12。** 本文件原写「12 手改」是转述,从未独立列举;详设 §4.1 **逐行列出 15 个**并给出每行的 owning path 与保留理由。**可列举者胜过可转述者 ⇒ 起点取 15。** 若实施时逐条复核得出第三个数,以复核为准并同步回本文件。

⚠️ **这条判据只证明常数因子,不证明斜率。** 10 处手改 × n 条命令仍是 O(n);
15→10 是削减不是拉平。本文件此前把它当作「不随功能数增长」的证明是**判据写错**,已更正。
⇒ 验收表述固定为「单位成本 **15 → 10**,**斜率未改变**」,斜率归 `P-1` / `P-6` 所在的未来轮次。

⛔ 原「不得出现与既有 feature md5 相同的文件」已作废 —— 改个空格即绕过,也抓不到内联重复块。

**失败判据** —— 落地后新增一条业务命令仍需手改 **≥ 12** 处 ⇒ **判据二选错了抽象层**
(⛔ 该失败判据**只管判据二**;判据一因已 `DEFERRED`,不参与本轮成败)

**本轮诚实结论的固定措辞** —— 三批次全通过时只能说
**「本轮批准范围 GO」**,不得说「20 倍底座已建成」或「G1 已完整关闭」。

## G2 · 检测真能拦住

一键跑、开发完必跑、违反必红。

**每道门三件套,缺一不算**
1. 判据是**一句机械可判定的不变量**。违规物本身就是某段文本时用禁止句;**精确集合相等、配对断言、确值约束、编译器穷尽性同样是合法形态**,不得为了凑成禁止句把它们改写成易绕过的反向正则
2. **红夹具** —— 人为制造一次违反,确认真的变红
3. **负控制** —— 声明一条它**预期抓不到**的变异

第 3 条必需:红夹具只证明"接线通了",不证明"守对了命题"。

## 两个目标有先后

G2 有一部分必须等 G1 —— 尺寸门是典型:文件超长时门变红,但代码得有地方搬。

- **现在能做**:接线类(`spotlessCheck`、修坏正则、`/actuator/health`)、去掉测试豁免
- **必须等 G1**:尺寸门

## 范围边界

| 项 | 判定 |
|---|---|
| **访问量横向扩展** | **代码面已就位** —— 进程内无可变共享状态、无缓存需预热、无后台任务重复执行、会话在 DB、20 处锁全部 `pg_advisory_xact_lock`(事务级,不泄漏到池化连接)、资产走 MinIO。加节点不需改代码、不需粘性会话。<br>**部署面缺两项**:① `/actuator/health` 缺失 ⇒ 负载均衡无法判断节点可用性(**收回本轮**)② 连接池未配置 —— 真实上限是「池大小 ÷ 持有时长」,而**持有时长是代码形状** |
| **浏览器 L2 重建** | **暂缓**(Dexter 裁定)。旧 L2 建在错误的前后端逻辑上,会把错的行为固化成"通过" |
| **构建与验证循环** | **本轮不做**(Dexter 裁定)。已测清:verify warm ~22 分钟,20 倍时 8–16 小时;快通道 2.4 分钟 → 45–50 分钟。**瓶颈是 SMB 挂载(读延迟 42.6 倍)与 `--rerun-tasks`(506/506 次零缓存复用),不是门** —— 砍最弱三道门只省 4% |
| **生产化运维基建** | CI 平台、备份演练、密钥轮换、OTel/Prometheus/告警 → `HANDOFF.md` |

---

# 二 · 现状问题

## 2.1 公共能力缺位

**P-1 · 回执与锁在三个 owner 里被内联手写。**
仓内已有既定形态:每个 owner 一个专用 `*CommandReceiptService`,共 **8 个 / 918 行**。
**catalog · inventory · fulfillment-production 绕过了它**,把回执 SQL 内联进 owner service。
8 个类里 **6 个用 advisory lock**,`BusinessEntity` 用 `ON CONFLICT` 不用锁,**`Extension` 两样都没有**。
⇒ 病灶是**「有形态而三家没跟」**,不是「无处安放」。**把 8 个合成 1 个,拦不住第 4 个 owner 再内联写一遍。**

**P-2 · 并发首用同一幂等键 → 用户拿到 500(现存缺陷)。**

| | 行为 | 用户看到 | 数据 |
|---|---|---|---|
| inventory · production | 裸 INSERT,无锁无 `ON CONFLICT` | **500**(`DuplicateKeyException` 无 handler) | 只发生一次(第二个事务回滚) |
| catalog | `ON CONFLICT DO NOTHING` | 成功 | **可能发生两次** —— 第二个事务照样提交业务写 |
| **6 个服务在用的** | 先拿 advisory lock 再 `replay()` | **成功,拿到第一次的结果** | **只发生一次** |

`replay()` 对可能不存在的行做 `SELECT … FOR UPDATE` —— 0 行时不加锁,两个事务同时穿过。
`ContractProblemAdvice` 25 个 handler,**无 `DataIntegrityViolationException`、无兜底**。
触发路径:用户点保存 → 超时 → 再点一次。**第三行才是幂等键存在的意义。**

**P-3 · 跨 owner 锁常量手工复制。** 三个命名空间在 catalog 与 inventory 各写一遍,
注释写着 `Must stay byte-for-byte compatible` —— **唯一强制力就是这句注释**。

**P-4 · 前端缺形状层。** foundation 提供机制(生命周期、幂等键、overlay lock、`adminListState`、`useDetailDrawer`),
**不提供形状**:ProTable 页面骨架、Drawer 表单骨架、扩展字段渲染器。
扩展字段渲染 **7 份局部拷贝,2 组两两 md5 相同**。正确实现已写出(`OrganizationExtensionFields.tsx`),只是位置在 feature 私有目录。

**P-5 · 尺寸零刹车。** `CatalogOwnerService` **7435 行 / 258 方法 / 29 个 `@Transactional`**;`CatalogItemDrawer.tsx` **5174 行**。
`code-layout` 无尺寸判据,8 条 ArchUnit 全是依赖方向,`eslint.config.mjs` 无 `max-lines`。
**唯一刹车是评审注意力,而它不随业务量扩展。**

**P-6 · 跨 owner 协作是位置化 hub。** `CatalogInventoryCoordinator` 1713 行,合并机制是每 owner 一组具名字段不是列表。owner #4 = 改 5 个签名。

**P-7 · 每条命令一个手写环节。** 新增一条命令要动 **3 新建 / 15 手改 / ~20 重生成**(原写 12 是转述;15 由详设 §4.1 逐行列举,取可列举者)。
**markdown 当权威源共四处**(2026-08-17 DESIGN review 亲验,此前只写了第一处):<br>① `scripts/generate/catalog-inventory-p1.mjs` 第 97 行 `readFileSync` 设计 markdown 正则解析出 operation 行;<br>② 同文件第 1359 行再 `readFileSync` **另一份 IA markdown**,第 1361 行 `iaIds.length !== 89` 即抛;<br>③ 同文件第 1713、1715 行把**两份 markdown 的 sha256** 作为 `designSha256` / `designReviewIntakeSha256` 烧进 manifest,**且有三个活消费者**:`tools/catalog-inventory-p2/cli.mjs` 第 42-43 行做哈希相等、`tools/catalog-inventory-p1/cli.mjs` 第 476 行 `P1_DESIGN_BYTE_COVERAGE_SOURCE_HASH`、哈希已固化在 `contracts/policy/catalog-inventory-design-byte-coverage.json` 第 8 行;<br>④ `tools/catalog-inventory-p1/cli.mjs` 第 671-673 行读 IA markdown 并以固定 `89` 判 exact set。<br>⇒ **③ 是最隐蔽的一条**:改设计 markdown 一个字符,`catalog-inventory-p2` 校验即红,这就是「markdown 是真相」的定义;任何「只改 Markdown 不改变生成输出」的负控制在 ③ 存在时都过不了。<br>另一处要在 `backend-performance` 生成器手写 emitter;该 emitter 在 `backend-performance-m1-command-execution-bindings.mjs` 里**每条命令手写一个**(该文件现有 31 个 `emit*`)。<br>(前一版写的「69 个」复算不出,已更正为可复现的 31)

**P-8 · 生成器冻结计数。** `edge-codegen.mjs:243` 的 `operationsNodes.length !== 20` —— 加第 21 页则生成器拒绝运行,
前后端全链路生成物无法再生。同族另有 6 处。

## 2.2 检测缺位

**E-1 · 规范目前主要是纸面的。** 变异实验实测,8 条声称有门的规则里:
**3 条完全无门**(造跨模块同名包 / 再写一个 `wireUuid` 或手机号正则 → 全绿)·
**1 条假门**(React key 那条正则漏了收尾 `}`,对真实违规恒 false)·
**1 条没接线**(`spotlessCheck` 在 verify 里命中 0)· **1 条守错命题** · **1 条本机跑不起来**(无 gradle wrapper)·
**1 条部分有效**(prettier:长字符串 165 / 长正则 137 / 长注释 283 全部逃逸)。

**E-2 · 存在性断言占绝对多数。**

| | 禁止性 | 存在性 |
|---|---|---|
| `verify-gates/cli.mjs`(真门) | 34 | 7 |
| `tests/architecture/*.mjs` | 49 | **169** |

**完全倒置。** 218 处 `assert.match` 对源码文本做正则 —— **改个变量名它红,逻辑写错它绿**。
⚠️ **不能归零** —— `default-list-page-size` 是配对使用,归零存在性那半只剩「不是 20」,`useState(50)` 就过。

**E-3 · 28 条真业务闭环默认关闭。** IAM 8 / ORG 5 / CONTRACT 3 / ASSET 2 / CATALOG 10,
完整走 invitation → login → 建合同 → CAS 编辑 → 作废 → 历史回读,真 HTTP + 真容器。**全仓质量最高的资产。**
`@EnabledIfEnvironmentVariable` 默认关闭,`verify.mjs` 里命中数 **0**。

**E-4 · 不写测试没有代价。** `test:unit` 两个 App 都带 `--exclude "**/*.spec.ts"`;
`affected-l2` 是**选择门不是执行门**;全仓无 Playwright 执行调用。
⇒ **新增一个 feature 写零个测试,`scripts/verify` 全绿。**

**E-5 · 规范可达性依赖单侧 hook。** 两份规范已注册进 `project-memory` 且路由可命中,但读到要三跳且该 hook 只有 Codex 侧有;
`AGENTS.md` / `PLATFORM-BLUEPRINT.md` / `HANDOFF.md` **零引用**。

## 2.3 数据模型

**D-1 · 租户列不统一,catalog 系无租户列。** 活表 **72 张**。
`workspace_uuid + group_workspace_key` 26 张 · `data_node_ref + brand_ref` 9 张 · `group_workspace_key` 单列 3 张 ·
**`data_node_ref` 单列 3 张**(`catalog` / `inventory` / `fulfillment_production` 三张 `command_receipt`,唯一键是 `(data_node_ref, idempotency_key)`;上一版分类漏了这 3 张,合计只有 69) · `scope_key` 1 张 · **无 30 张**(其中 11 张是 `platform_iam.*` 平台全局表,本就不该有 ⇒ **真实需归位约 19 张**)。
**`data_node_ref + brand_ref` 那套不是分歧,是刻意的 owner 边界** —— 只出现在三个最新 schema,是 fork 不是 scatter。它的代价是**跨 owner 查询与通用工具要处理两套词汇**,不是命名乱。

⚠️ catalog / inventory / fulfillment-production **没有租户列** —— 租户身份靠 `data_node_ref`(**无外键的不透明引用**)跨 owner 解析。

**D-2 · 回执表 12 张 5 种形态。** PK 分别是:单 `idempotency_key` · `(workspace_uuid, key)` ·
`(group_workspace_key, key)` · `(scope_key, key)` · `receipt_ref UUID` + UNIQUE `(data_node_ref, key)`。

**D-3 · 跨租户连接结构上不被阻止。** catalog P3 的 FK **全是单列**;`catalog_item_category` 无租户列;
`CatalogItemCategoryFacts` 的 SELECT/DELETE/INSERT 只按 `item_ref`,**零租户谓词**。
⇒ **A 租户的 item 能连到 B 租户的 category,DB 不拦。**
**正确模式已存在** —— `V20260816_010000_000:198` 给 `dictionary_entry` 加了 scope 复合 FK,**只是没跟到关系表**。
⚠️ 门自己也漏:`cli.mjs:571` 硬编码 7 个 schema,**不含 catalog / inventory / fulfillment_production**。

**D-4 · 无迁移模板,约束半数匿名。** 命名 CHECK 81 vs **匿名 49**;命名 UNIQUE 28 vs **匿名 24**;索引前缀三种。
**代价已付两次** —— 三个迁移不得不 `DROP CONSTRAINT <Postgres 自动名>`,其中一个**恰好 63 字符(被标识符上限截断)**,
为钉住它专门写了一个 Testcontainers 类回放 ~50 个迁移查 `pg_constraint`。

**D-5 · 三处真实缺索引。** `organization.store.brand_id` / `.tenant_id` **未索引**,
而**同一条谓词列表里**的 `.project_id` / `.head_company_id` 有索引(4 个里 2 个);
`contract.store_contract.tenant_id` 未索引;`workspace_iam.role_assignment.role_id` 未索引。

**D-6 · 历史死表仍在迁移文本里。** 8 张 legacy `*_audit` 表已被 `DROP`,但**建表 → 迁数据 → 删表三个文件都还在**,
新 owner 的作者会读到 `CREATE` 语句照抄。

## 2.4 可观测性

**O-1 · 业务层零日志。** 后台 `src/main` + 全部 14 个 `modules/*` 里 `LoggerFactory.getLogger` **只有 4 处**:
请求行 · 异常 advice · 一条 asset WARN · dev CLI。catalog / inventory / organization / workspace-iam / store-contract / extension **各 0 个**。

**O-2 · 请求日志缺租户,而租户身份就在手边。**
有 correlationId / requestId / operationId / routeTemplate / owner / outcome / duration / status / errorCode;
缺**租户**(`owner` 是代码模块归属不是租户)· **实体** · **节点身份**;且 `outcome=FAILED` **也记在 INFO**。
⚠️ `WorkspaceExecutionContext` 同一个对象上已有 `workspaceUuid()` / `accountId()` / `correlationId()`,
每个已认证命令铸一次、27 个 operation 类在消费。**不需要打通管道,只需要写下来。**

**O-3 · 约 22/25 个异常 handler 一行不写。** 写日志的 3 个各缺一半:一个有完整栈**无 correlationId**,一个有 correlationId **无栈** —— **两行拼不起来**。
其余接住异常后一行不写,包括 **`ownerResultUnknown` —— 返回 HTTP 500,零日志输出**。

**O-4 · 前端错误上报是空壳,生产下完全不出网。**
`recordRenderError(_error)` 形参下划线**声明即丢弃**,`errorInfo` 连形参都没有;载荷是**编译期常量**;
`FrontendLogEvent` 无 message / stack / componentStack / componentName 任一字段。
出网条件全断:仓内**无任何 `.env*`**、`scripts/`+`tools/` **零处**设 sink URL、`enabled: import.meta.env.DEV` ⇒ 生产 console 短路、`snapshot()` 零非测试调用。
**且全域无 `window.onerror` / `unhandledrejection`** —— 事件处理器与 async 回调里抛的错**连计数都没有**。

**O-5 · 指标是测试仪表。** `HttpRequestMetricsInterceptor` 生产下彻底空转;
`DatabaseOperationTracker` 生产不激活 ⇒ 请求日志里两个 DB 字段**硬编码为 0**。
`actuator` / `micrometer` / `opentelemetry` / `prometheus` **全仓命中 0**。

**O-6 · 用户手上没有可引用的凭据。** `correlationId` 解析出来后**从未渲染给用户**。
⇒ **「用户报告 → 定位」这条链两端同时断。**

**验收判据** —— 取一个失败的已认证命令,**仅凭日志、不查库、不问报障人**,说出
(a) 租户 (b) 操作人 (c) 操作 (d) 节点 (e) 抛出点栈帧。**今天:类型化失败 0/5。**

## 2.5 过度设计

模式是**先建能力,再找消费者;找不到消费者,就建一个校验器来证明它存在**。

| 位置 | 事实 |
|---|---|
| `descriptorRenderer` | 声明 **16 种控件**,真实 manifest 只用 **4 种**,实际渲染 **3 种**。⚠️ **其中 3 种不是闲置是建坏了(亲验)**:`upload` 用 `beforeUpload={() => false}` **阻止上传且不调 onChange**,用户选了文件什么都不会发生;`editableTable` 是**只读 Table**,名字承诺可编辑;`detailTable` 与它**逐字相同**。**闲置可留,坏的留着是陷阱** —— 按名字选用不会有任何报错。;4 个 `DomainControlKind` 用 slots **交回调用方** —— 而它们正是把 `CatalogItemDrawer` 撑到 5174 行的东西 |
| `assertDescriptorSlotBindingSet` | **0 生产调用**;要求 required 与 provided **完全相等** ⇒ 多传一个用不上的 slot 也抛错,**比它想防的问题更难** |
| `useDrawerFormLifecycle` 诊断链 | `onDiagnosticEvent` **消费者 0**,而 **27 个 Drawer 传 `diagnosticOperationId`**;每次打开铸 UUID、组装完整 event、可选链短路丢弃。**死代码里最贵的一种:27 个地方在为它付维护税** |
| `OperationsScopeContext` | 整个 Redux slice + 接线 + 类型,只服务一个 `useSelector`,**而唯一读者已通过 prop 拿到同一个值** |
| `contextScopedQueryArgs`(platform 侧) | 4 处全是构造对象**只为把刚传进去的字段读回来**,且被源码正则焊死 |
| `inventoryManagementModel.ts` | `shouldRequestInventoryDiagnostics(x)` 直接 `return x` 却有专门单测;`jsonBody<T>` 恒等函数;`matchesStockView` **全仓无调用** |
| `ProductionTagOwnerService` | 每个命令实现**两遍**,JSON 那套 **226 行零生产调用**,代码自己标注 `legacy … remains isolated` |

### X 组的处置判据:删设计 · 删用法 · 还是补全接线

**「过度设计」不等于「删」。** 判据是:**这个需求是真的吗?**

| 情况 | 处置 |
|---|---|
| 需求是想象的 | **删设计** |
| 需求是真的,但**已有另一套机制在服务它** | **删这个,走那套**(需求的去向必须写明) |
| 需求是真的,而**这就是唯一的机制** | **补全接线** |

逐项归类:

| 项 | 处置 | 需求去哪了 |
|---|---|---|
| `contracts/registry/generated/operation-handler-bindings/java/**` | **生成了、被门校验、从不编译**(亲验:0 处 import) —— 归 X 组「删设计」 |
| `descriptorRenderer` **9 种**未用控件 · `assertDescriptorSlotBindingSet` · `closedSessionKey` / `handleOpenChange` · `OperationsScopeContext` · `matchesStockView` | **删设计** | 无需求 |
| `contextScopedQueryArgs` 在 platform 的 4 处 | **删用法,留函数** —— 改用 `groupWorkspaceKey` 直取;**同时删掉 `commercial-group-boundary.test.mjs` 里把这个恒等调用焊死的源码断言**(它本身是 E-2 的实例) | **Dexter 裁定**:platform 与 operations 的**用户体系与数据上下文不同**,platform 只切换集团空间。该函数存在的意义是携带 `expectedContextVersion` 等 **operations 才有的会话维度**(实测 operations 31 处、platform **0 处**)。**不是 platform 没用好,是它的上下文模型里根本没有这些字段** ⇒ 天然退化成恒等 |
| `refreshSignal` 的 operations 发布线 | **删那条线,留原语** | platform 有 1 个真实订阅者 |
| `ProductionTagOwnerService` JSON 双实现 | **删实现,但先迁覆盖** | ⚠️ **消费者是测试,断言的是真实业务规则** —— 须先确认 typed 路径有等价断言 |
| `useDrawerFormLifecycle` 诊断链(含 27 个 Drawer 的 `diagnosticOperationId`) | **删这个** | ⚠️ **需求是真的**(前端可观测性 = O-4),但 foundation 已有 `safeLogger` + `observedBaseQuery` 且两个 App 真实接入。**接通诊断链等于同时跑两套** ⇒ 需求走 O-4 处置 |

⚠️ **唯一真正「该补全」的不在本组**:`descriptorRenderer` 的 4 个 `DomainControlKind`
用 slots 把实现**交回调用方**,而它们正是把 `CatalogItemDrawer` 撑到 5174 行的东西。
需求是真的、机制也只有这一套 ⇒ **归 P-4(前端形状层),不归本组。**

**这条最值得记**:过度设计常与一个真实的未满足需求并存,
而修法是**用已经有消费者的那套去服务它**,不是复活从没有过消费者的那套。

## 2.6 散落的裸 string

**归位标准**:单侧单模块 → 本地常量;**单侧跨模块 → 共享模块常量**;**跨前后台 → 契约 + 生成物**。
判据不是"谁在用",是**"谁必须达成一致"**。

**仓内正例**:`operationsProblemFeedback.ts` 用生成的 `EDGE_PROBLEM_CODES` 做 `Record<EdgeProblemCode, ProblemFeedback>` —— **漏一个 code 就是编译错误**。

**S-1 · 三类必须契约化**

| 类 | 规模 | 问题 |
|---|---|---|
| **字典 kind** | ~317 处跨 5 层 | 前端有**两份重复 union**,**且都不含新增的 `ORDER_OPTION_VALUE`**;`dictionary_kind` 列**无枚举 CHECK**。真正必须一致的是 **owner 校验器 ↔ seed 脚本 2 个点** —— seed 首败的两端 |
| **后台 problem code** | 381 处 7 个码 | **消费侧是生成闭集且穷尽校验,生产侧零常量**。后台写错一个码 ⇒ 前端回落 `RESULT_UNKNOWN` ⇒ **具体指引被静默降级**,任何一层都不报错。生成物**已存在**,缺的是一个枚举类型和消费者 |
| **testId** | **161 个跨源码/spec 边界的 id** | 组件里改名不会让 spec 编译失败,**只会变成选择器超时**。其余 505 处单侧单文件,不必动 |

**S-2 · 已经分叉的三处**
- **`DISABLED` 的中文**:`WorkspaceUserPage.tsx:70`/`:361` 是「禁用」,全仓其余 30+ 处是「停用」。**同一个后端枚举,两个中文词**
- **商品编码正则**:无长度上限 vs 2–64,四种提示语 ⇒ 1 字符编码在一个抽屉过、在另一个挂
- **锁常量**:仅 2 处,改一处**无报错、无测试失败、无门失败**,只是并发下静默丢失互斥

**S-3 · 明确不契约化** —— `operationId`(已做对:148 处引用生成常量)· 前端 capability key ·
`R5_*` 门失败标记 · **~1000 个单次使用的中文页面文案** · **SQL 表名**(拼错立刻抛 `relation does not exist`)·
`group_workspace_key=?` 243 处(风险是**漏掉**谓词不是拼错,常量抓不到遗漏)。

---

# 三 · 方案

## 3.1 已裁定

| # | 裁定 |
|---|---|
| 冻结计数 | **直接删,不替换** —— 编译器已覆盖(非 Partial 的 `satisfies Record<>`) |
| 抽象边界 | 目的地已存在且被广泛使用 ⇒ **现在就抽**;要新造且只有 1–2 个调用点 ⇒ 不抽 |
| 裸 string | 单侧→常量;单侧跨模块→共享模块常量;跨前后台→契约 |
| 租户可追溯 | **只补 scope 复合 FK** —— 不加冗余 workspace 列,不加跨 owner 外键,保持 owner 不透明 |
| 两种 lock 空间 | 各 owner **不需要互斥** ⇒ 现状无害,只统一写法 |
| SQL 表名 | **不常量化** |
| 死表 | **legacy audit 相关语句整体退役**(无业务数据,无需迁移步骤)。⛔ **是删语句不是删文件** —— 那三个文件装着两个 `CREATE SCHEMA` 与全仓 FK 的根表,**删文件整库消失**。具名清单见 §3.2 D-6 |
| L2 / 构建循环 | 本轮不做 |

## 3.2 处置

### 写处置的三条硬规则(2026-08-16 对抗审查后加)

一轮针对"照字面执行会怎样"的审查,在原处置表里找出 **4 条会造成不可逆破坏**、**5 条会做出看起来完成实则错误的东西**。
成因统一:**写了结果没写动作**。所以:

1. **动作必须具名到语句 / 文件 / 行号 / 签名。**「摘掉」「统一」「删」「接线」都是二义的。
   反例:「三个迁移文件整体摘掉」—— 那三个文件装着两个 `CREATE SCHEMA` 和全仓 FK 的根表,**照做整库消失**。
2. **必须写明目的地是否存在。** 反例:「锁常量提为共享常量」—— foundation 无 JDBC,**推导式根本进不去**。
3. **必须写明隐藏消费者。** 反例:「删 md5 相同的拷贝」—— 那 7 份是内联块,统一后 DOM 属性会变,**L2 选择器直接受影响**。


**⛔ 每一项必须写到"删哪一条语句 / 改哪一个签名 / 目的地是哪个模块"。**
只写结果不写动作的条目,实施者会做出看起来完成实则破坏的东西 —— 本表已按此重写。

| 问题 | 处置(具名到语句) | 检测形态 |
|---|---|---|
| **P-2** | **一次覆盖四个 owning source**(catalog / inventory / fulfillment-production / extension),不做「改两个留两个」。<br>**统一语义:业务写之前取得唯一执行权。** 实现允许两种,不强制一种 —— advisory lock,或 `BusinessEntity` 已在用的 insert-as-claim;**不需要 DDL**。<br>⛔ **不复制 catalog 的 `PROPAGATION_REQUIRES_NEW` 部分提交语义** —— 那是批量转状态特有的,inventory/production 既没有也不需要。<br>⚠️ **上一版两处事实错**:① 写成「inventory 全无锁」,实际第 3735 / 3750 / 3765 行**已有 3 处 advisory 锁**;② 未锁入口数(9 / 6)是转述,未独立复算,与 Codex 复算值(8 / 5 / catalog 7)不符。**详设第一步就是逐入口把分母钉死**,不得沿用任一方的数。<br>⚠️ `Extension` 在 `ExtensionCommandReceiptService` 第 77 行捕获 `DuplicateKeyException` 后于**同一 PG 事务内续查** —— PG 语句报错后事务即 abort,无 SAVEPOINT 则后续查询必失败。它必须进分母 | 只能 review |
| **P-1** | **推迟** —— 见 §3.4 | 只能 review |
| **P-3** | ⚠️ **目的地不存在,方案未定。** `foundation` 无 JDBC ⇒ **只有 int 常量能进,推导式进不去**;常量搬走后一侧把 `>>> 32` 改成 `>>> 16` **编译器不会报**。<br>**三条候选路,详设阶段选一条并说明**:① 给 foundation 加 spring-jdbc(与 P-1 同一决策)② 放 inventory —— `catalog/build.gradle.kts` **已依赖 inventory**,方向可行 ③ 只提常量不提推导式 + 补一条断言两侧算出同一 key 的测试。<br>⚠️ 任何模块边变动要同步 `contracts/policy/module-dependency-registry.json` | **不是**编译器已覆盖 —— 见左 |
| **P-4** | ⚠️ **那 7 份是 drawer 文件里的内联块不是文件**,"删拷贝"无对象。真实动作是**把内联块换成 import**。<br>⚠️ `OrganizationExtensionFields.tsx` **进不了 foundation** —— 它 7 个 import 里 4 个是 App-local(`app/api/*`、`app/routing/model`),还导出一个直接打 operations 端点的 hook。**能上提的只有纯 antd 控件 switch**,且要对 `ExtensionDefinition`(每 App 各自生成)做泛型参数化。<br>⚠️ **三处 testId 约定不同**(字面量 / `testId()` 展开 / 完全没有)⇒ 统一后 DOM 属性会变,**L2 选择器直接受影响** —— 这是隐藏消费者。<br>⚠️ 同目录 `OrganizationExtensionFields.test.ts` 相对导入,移动即断 | ⛔ **原提的门作废** —— 取 basename 查重实测**结果为空**,今天就空转,且对内联拷贝零命中 |
| **P-5** | 尺寸门 —— **必须先定阈值并给出红名单** | 可门化(排 B3) |
| **P-6** | **本轮不动** —— 第 4 个 owner 才痛,现在做是为想象需求付费 | 只能 review |
| **P-7** | **Dexter 2026-08-17 裁定拉进 B2** —— 它是唯一成本随业务量线性增长的一条,而 20 倍底座正是要压这个斜率(⚠️ 本轮只压常数因子,斜率见 G1 判据二);且它与卡住 `P-1` 的租户键裁决**无依赖**。<br>**交付判据是可测的**:新增一条业务命令的手改处从 **12 降到 < 10**。<br>**详设必须先逐条列出那 12 处**,再说明哪几处消失、为什么消失。已知两处最该先动:① `catalog-inventory-p1.mjs` 第 97 行把 markdown 当权威源 —— 权威源应是契约 JSON,不是设计文档;② 新增命令要手写 emitter —— 判断 31 个 `emit*` 里有多少是同形态可参数化的。<br>⛔ 不借机做「大一统命令框架」;⛔ 不为降数字而把手改藏进生成器输入 | **可门化**:一条新增命令的手改处计数 |
| **P-8** | ⚠️ **不能整条 `if` 删。** `edge-codegen.mjs:243` 那个 `if` 里第三个子条件是**划分不变量**(每个 node 非 ROLE_HOME 即 BUSINESS),必须留;只删 `platformNodes.length !== 8` / `roleHomes.length !== 5` / `operationsNodes.length !== 20` 三个计数比较。<br>⚠️ **同族 8 处不是 6 处**(`:184 :198 :229 :231 :232 :243 :281 :283`),其中 **`:229` 是集合相等、`:281` 是唯一性 —— 这两条留**。<br>⚠️ **「编译器已覆盖」只对生成出的 TS 成立,覆盖不到 JSON manifest 输入** | 逐条判定,不是整体删 |
| **E-1** | ⚠️ **补 gradle wrapper 不够** —— `verify.mjs:26,32` **硬编码字符串 `"gradle"`**,`r5-remote-testcontainers.mjs:78` 执行 `command -v gradle` 并推导 GRADLE_HOME。**wrapper 是脚本,不提供 GRADLE_HOME**。<br>必须同时改这两处的 gradle 解析方式,否则做完仍是"跑不起来" | 可门化 + 红夹具 + 负控制 |
| **E-2** | ⚠️ **计数更正:218 = 存在性 169 + 禁止性 49**,不是"218 处存在性"。<br>⚠️ **"配对就保留"是错的判据** —— `default-list-page-size.test.mjs` 里 `match(/useState\(10\)/)` + `doesNotMatch(/useState\(20\)/)` 是配对,但 `useState(50)` 照过。**判据应为"这一对合起来能不能钉死取值"**,同文件里 `doesNotMatch(/pageSize:\s*(?!10\b)\d+/)` 才是强的那种。<br>⇒ 三分:**能钉死的保留 · 钉不死的重写 · 纯文本形状的删** | 可门化 |
| **E-3** | ⚠️ **现状即目标** —— `scripts/test/backend-acceptance --operation <X>` 已存在可跑,`@EnabledIfEnvironmentVariable` 已实现"不默认进 verify",AGENTS.md 与 HANDOFF.md 均已登记。**本项无需动作**,仅在文档中确认。<br>⛔ 原写"可门化"矛盾 —— 不进 verify 的门不会跑 | **无动作** |
| **E-4** | **本轮做不成,登记欠账**。两条路都不通:① 去掉 --exclude 会让 vitest 收进 Playwright spec,必然报 Playwright Test did not expect test(),**写测试也修不好**;② 改配 include **收到的还是同样那 4 / 11 个文件**,.test.mjs 与 .spec.ts 同样落出,**等于什么都没做**。<br>唯一能真正产生代价的机制是**执行 L2**,而范围边界已裁定 L2 暂缓 ⇒ **这个问题在 L2 暂缓期间无解**,写进 HANDOFF.md,不在批次里挂零效果的活 | **本轮无动作** |
| **E-5** | `AGENTS.md` / `HANDOFF.md` 补规范引用 | 只能 review |
| **D-1 / D-2** | 随 P-1 推迟 | — |
| **D-3** | catalog 关系表补 scope 复合 FK(模式已在 `dictionary_entry` 上) | **可门化**:带租户的表禁止单列 FK |
| **D-4** | 定模板迁移;约束一律命名 | **可门化**:禁止匿名 CHECK/UNIQUE |
| **D-5** | 补 3 条索引 | 只能 review |
| **D-6** | 绝不能删文件。**逐文件具名清单(行号已按文件实际长度亲验:V25 79 行 / V26 169 行 / V27 217 行)**:<br>**V20260725_170000_000** 删第 31 行起的 CREATE TABLE organization.commercial_group_audit 整块,**并删第 69-73 行的 ENABLE / FORCE ROW LEVEL SECURITY 与 CREATE POLICY platform_admin_commercial_group_audit_access**<br>**V20260726_090000_000** 删第 12 行的 policy 名单项、把第 14 行 policy_count 4 改成 3;删第 72-74 行的 DISABLE / NO FORCE / DROP POLICY;删第 102、150、152、154、160、166、169 行七条 CREATE TABLE<br>**V20260727_010000_000** 删第 190-208 行的 legacy 空表守卫(它 FOREACH 遍历八张表逐个 EXECUTE SELECT count(*),**不删则删掉 CREATE 后必报 relation does not exist** —— 前两版都漏了这一条),**并删**第 210-217 行的八条 DROP TABLE<br>**保留第 149-188 行**(第 149-174 行前置校验 + 第 176-186 行 INSERT + 第 188 行 DELETE):那是在 platform_workspace.audit_event 与 organization.audit_event **两张活表之间**搬 COMMERCIAL_GROUP_INITIALIZED,与八张死表无关。<br>⚠️ 上一版把这段的行号误安在 V26 上,V26 只有 169 行、根本没有这些行 | **可门化**:reset + 全量回放 + seed 通过 |
| **O-1** | 不是「到处补业务日志」—— 业务层 0 logger,零散补只会制造**没有 join key 的噪声**。本条**由 O-2 承接**:把租户与操作人写进那条**已经在打**的请求行。**本项无独立动作** | 见 O-2 |
| **O-2** | 日志 `Fields` record 加租户/节点;`FAILED` 改 ERROR。<br>⚠️ **只加 record 字段与 `addKeyValue` 会悄悄无效**(亲验):`Slf4jSecurityDiagnosticRecorder` 有 **31 处 `addKeyValue`**,但**仓内无 logback 配置、`application.yaml` 里 `%kvp` 命中 0** ⇒ Spring Boot 默认 console pattern **不输出结构化字段**。现有字段能被看见,**只因为 `render()` / `renderCompletion()` 又把它们拼回了消息串**。<br>⇒ **必须同时改 `render()`**,否则实施者会看到字段进了 record、`addKeyValue` 也调了,**而日志里什么都没有,且无任何报错** | 编译器覆盖 record 字段,**不覆盖是否真的出现在日志里** ⇒ 需一条断言渲染输出含该字段的测试 |
| **O-3** | **定案:走 HandlerExceptionResolver。** EdgeWebConfiguration 已 implements WebMvcConfigurer,在 extendHandlerExceptionResolvers 里前插一个**只记日志、return null 继续链路**的 resolver ⇒ **零调用点改动、零响应形状变化,已处理与未处理异常一并覆盖**。<br>**已划掉的两条**:① 给 problem() 加 Throwable 形参 —— 要改 25 个调用点,正是排除「handler 必须调用 logger」门的同一理由;② 加 @ExceptionHandler(Throwable.class) 兜底 —— **会造成回归**:ContractProblemAdvice 对框架异常零覆盖,而 ExceptionHandlerExceptionResolver 排在 DefaultHandlerExceptionResolver **之前**,加兜底会把今天由 Spring 兜出的 400/404/405/406 抢走,**整条 edge 的状态码语义变形**;@Order 救不了。<br>**另一条看似现成实则不行**:RequestCompletionDiagnosticInterceptor.afterCompletion 已拿到 Exception,但 DispatcherServlet 在异常被 resolver 处理后是以 **null** 调它 ⇒ 只承载未被 advice 接住的异常,**正好不覆盖要解决的那 25 条** | **编译器不覆盖** —— 需一条断言日志含 cause 的测试 |
| **O-3 补** | ⚠️ 前置 resolver 在 Advice 定出最终 status 之前就记日志 ⇒ **若一律按 ERROR,会把预期的业务 4xx 和真实 5xx 混在一起**。须复用统一异常分类:类型化 4xx 用 WARN/INFO,未知或 5xx 才用 ERROR;⛔ 不得复制第二套 Advice 映射 | 同上 |
| **O-4** | `FrontendLogEvent` 加必填字段;由 foundation 提供**一个统一 bridge 同时接 `error`、`unhandledrejection` 与 ErrorBoundary 的真实 `Error`/`componentStack`**(⚠️ 现状问题里点名了 `unhandledrejection`,上一版处置只补了 `window.onerror`,漏了异步半边) | 编译器已覆盖(必填字段) |
| **O-5** | `/actuator/health` 收回本轮;OTel/告警归 HANDOFF | — |
| **O-6** | 错误提示带 correlationId —— **它是"用户报告 → 定位"链的用户端半边,与 O-2/O-3 同批,不得漏排** | 只能 review |
| **X 组** | ⚠️ **不用 `knip`** —— 仓内未装(引入新依赖),且**7 项里 6 项它做不了**(它只看 export 有无消费者,看不到"某处调用无意义"、看不到数组字面量、看不到已接线但无订阅者)。**而 §3.5 已因 barrel 击穿朴素计数排除过同类门。**<br>**逐项人工处置,按 §2.5 四档判据**;唯一 `knip` 能做的是 `matchesStockView` 一项,不值得为它引依赖。<br>⚠️ 删 `closedSessionKey` 要连带处理 `useDrawerFormLifecycle` 里的 `setClosedSessionKey` 副作用(**27 个 Drawer 的一次 re-render**) | 逐项 review |
| **S-1** | problem code 生成 enum · 字典 kind 统一 2 个点 · testId 只做 161 个跨界 id | 编译器已覆盖(spec import 后改名即编译失败) |
| **S-3** | **明确不契约化** —— `operationId`(已做对)· 前端 capability key · `R5_*` 门失败标记 · 约 1000 个单次中文文案 · SQL 表名 · `group_workspace_key=?`(风险是漏掉不是拼错)。**本项无动作,列出是为了证明判过而非忘了** | — |
| **S-1 补** | ⚠️ **capability key 的生成器漏了一半**(亲验):`admin-catalog.json` 里除 `BC-*` 外还有 3 个 `EDIT_*` key,而生成器**只为 `BC-*` 出 Java 常量** ⇒ `EDIT_*` 停留在裸字面量,`"EDIT_STORE_CATALOG"` 实测 **17 处**。而前端那道 `R5_FRONTEND_CAPABILITY_LITERAL` 门的正则是 `["']BC-[A-Z0-9-]+["']` —— **格式上就匹配不到 `EDIT_*`,且只管前端**。<br>⇒ 让生成器**对 `admin-catalog.json` 里所有 key 出常量**,不分格式 | 可门化(扩正则覆盖两种格式) |
| **S-2** | ⚠️ **必须先定统一目标,原文没写**。<br>**DISABLED**:「禁用」2 处 vs 「停用」**60 处** ⇒ 往「停用」统一。⛔ 检测形态原写 `Record<Enum,string>` **不对症** —— 它只防漏 key,防不了同一 key 填两个不同的词。<br>**编码正则**:4 个站点分属**四个不同业务字段**,只有中间两条(同为"商品编码")是真分叉;**权威在后台** —— `CatalogOwnerService:4510` 是 `[A-Z0-9][A-Z0-9_-]{1,63}`,前端往它统一,否则放行的编码后台会 422 | 只能 review |

## 3.3 三个批次(逐条编号,可对账)

**完整性不变式**:§2 共 **28 条问题** → §3.2 全部有处置 → **三批次 + 明确不做/推迟 = 28**,一条不漏一条不重。

### B1 · 修缺陷 · 删死物 · 接线(10 条)

| 条 | 动作 |
|---|---|
| **P-2** | 一次覆盖 catalog / inventory / fulfillment-production / extension 四个 owning source;语义=业务写之前取得唯一执行权(advisory lock 或 insert-as-claim 皆可);**第一步先逐入口把分母钉死**,不沿用任何一方的转述数。⛔ 不补 `ON CONFLICT`,⛔ 不复制 `REQUIRES_NEW` |
| **P-8** | 只删三个计数比较,留划分不变量;同族 8 处逐条判定,`:229` 集合相等与 `:281` 唯一性保留 |
| **D-6** | 按 §3.2 的**具名语句清单**删 legacy audit 的建表 / RLS / policy / DROP,**同时把 `V20260726_090000_000:6-16` 的 policy 计数守卫 4 改 3**;⛔ 不删文件,⛔ 不动 `:176-188` 的活表数据搬迁 |
| **X 组** | 逐项人工处置(不用 knip)。三处收窄:① **generated handler bindings 不是只删 Java 文件** —— 生成器、registry/index、校验器要同批处理,否则留下半层契约;② **descriptor `upload` 对应的资产上传需求是真的**,坏的是这套 generic descriptor 实现 ⇒ 需求由现有资产机制承接,再**从契约声明源向下删**;③ `ProductionTagOwnerService` 的**测试是隐藏消费者**,删 JSON 双实现前必须先确认 typed 路径有等价断言 |
| **S-2** | DISABLED 往「停用」统一;编码正则往后台 `[A-Z0-9][A-Z0-9_-]{1,63}` 统一 |
| **E-1** | 修 React key 那条坏正则;**gradle 解析改造**(`verify.mjs:26,32` + `r5-remote-testcontainers.mjs:78`)后再接 `spotlessCheck` |
| **E-2** | 218 条三分:能钉死的保留 · 钉不死的重写 · 纯文本形状的删 |
| **E-3** | **确认现状即目标,无动作** |
| **E-5** | `AGENTS.md` / `HANDOFF.md` 补规范引用 |
| **O-5** | 补 `/actuator/health` |

### B2 · 契约化与可观测 + 降新增命令成本(10 行,`S-1` 与 B3 共享 ⇒ 去重 9 条)

| 条 | 动作 |
|---|---|
| **P-3** | 三条候选路选一条并说明(foundation 加 JDBC / 放 inventory / 只提常量 + 补一致性测试) |
| **D-3** | catalog 关系表补 scope 复合 FK |
| **D-4** | 定模板迁移;约束一律命名 |
| **D-5** | 补 3 条索引 |
| **O-2** | 日志 `Fields` 加租户/节点;`FAILED` 改 ERROR |
| **O-3** | 走 `extendHandlerExceptionResolvers` 前插只记日志的 resolver(定案见 §3.2);⛔ 不加 `@ExceptionHandler(Throwable.class)`,会抢走 Spring 的 400/404/405/406 |
| **O-4** | `FrontendLogEvent` 加必填字段;由 foundation 提供**一个统一 bridge 同时接 `error`、`unhandledrejection` 与 ErrorBoundary 的真实 `Error`/`componentStack`**(⚠️ 现状问题里点名了 `unhandledrejection`,上一版处置只补了 `window.onerror`,漏了异步半边) |
| **O-6** | 错误提示带 correlationId(**与 O-2/O-3 同批 —— 它是同一条链的用户端半边**) |
| **S-1** | problem code enum · 字典 kind 两点统一 |
| **P-7** | **先逐条列出那 12 处手改**,再降到 < 10。权威源从 markdown 挪回契约 JSON;emitter 同形态者参数化 |

### B3 · 前端形状与收尾(3 条)

| 条 | 动作 |
|---|---|
| **P-4** | 只上提纯 antd 控件 switch 并泛型参数化;三处 testId 约定统一(**L2 选择器会变,须同步**) |
| **S-1**(前端半) | 161 个跨界 testId 常量化 |
| **P-5** | 尺寸门 —— 先定阈值并给出红名单 |

### 明确不做 / 推迟(6 条)

`P-1`(推迟至租户键定案)· `P-6`(第 4 个 owner 才痛)· `D-1` · `D-2`(随 P-1)· `S-3`(明确不契约化)· **`E-4`**(两条路都零效果,L2 暂缓期间无解 ⇒ 登记 `HANDOFF.md`)

### 对账

**10 + 10 + 3 + 6 = 29** —— 其中 `S-1` 横跨 B2/B3 计两次,去重后 **28 条,与 §2 一致**。

### 批内顺序(2026-08-17 定)

1. **先定 `P-2` 的完整分母与统一语义**,再动手 —— 语义是「业务写之前取得唯一执行权」,advisory lock 与 `BusinessEntity` 已在用的 insert-as-claim 都合法,不强制复制 catalog 的 `REQUIRES_NEW`
2. **`D-6` 按逐文件清单改完先跑一次全量回放**,再进后续
3. **`E-2` 先形成逐条 disposition 并落替代证明,再删 X 组代码与旧断言** —— 否则会开出大面积返工窗口
4. **B3 先做 `P-4` 冻结最终 testId 值,再做 161 个常量化** —— 常量化本身不得改变选择器值;若 `P-4` 必须改值,只要求源码与 spec 静态同步,本轮不要求跑浏览器 L2

## 3.4 P-1 为什么推迟

租户列**不统一命名**是已定裁决。DB 侧保留多种 scope-key 形态,
而统一的回执 helper 必须对这些形状**参数化** ⇒ 那不是「唯一实现」,是「一个实现 + 多路策略」。

⇒ **正确顺序**:B1 先修 P-2 本身;回执统一推迟到租户键形态定下之后。
与 D 组结论一致 —— 模板的头两列取决于租户键先定。

## 3.5 已排除

| 方案 | 理由 |
|---|---|
| 冻结计数改成"集合自洽"判据 | 编译器已覆盖;新判据无实例支撑 |
| 加冗余 `workspace_uuid` 列 / 跨 owner 外键 | 打破 owner 不透明原则 |
| SQL 表名常量化 | 拼错立刻抛 `relation does not exist` |
| 上 OpenTelemetry / Prometheus | **没有租户维度就加 tracing,只会得到更多匿名 span** |
| 新建单元层 DOM 环境 | 仓内已有 19 个 Playwright spec |
| 到处补业务日志 | 业务层 0 logger,零散补只会制造**没有 join key 的噪声** |
| 「消费侧禁止字面量」门 | 会误伤 1722 条中文文案 |
| 「每个 export 必须有消费者」门 | foundation `index.ts` 24 条 barrel re-export 会击穿朴素计数 |
| 重复度门 | 结构相似不等于拷贝,**每写一个新 CRUD feature 就会红** |
| 「handler 必须调用 logger」门 | 会强制 25 处各写一遍 —— **正面违反 G1** |
| 「日志字段必须含租户」门 | 字段是 record,编译器已覆盖 |
| 「禁形参下划线丢弃」门 | eslint 刻意配置了 `argsIgnorePattern: '^_'`,199 处误伤修 1 处 |
| **用 `knip` 清理零消费者导出** | 仓内未装(**引入新依赖**,与 CLAUDE.md「先用已有依赖」冲突);且 **7 项里 6 项它做不了** —— 它只看 export 有无消费者,看不到「某处调用无意义」「已接线但无订阅者」「数组字面量」。**而 §3.5 已因 barrel 击穿朴素计数排除过同类门,它换个名字又进来了** ⇒ 改为逐项人工处置 |
| **给 `problem()` 加日志「一次覆盖 25 个 handler」** | 两个重载**都没有 `Throwable` 参数**,签名上办不到;要加形参就得改 25 个调用点 —— **正是排除「handler 必须调用 logger」门的同一个理由** |
| **删 legacy audit 的三个迁移文件** | 那三个文件装着两个 `CREATE SCHEMA` 与全仓 FK 的根表 ⇒ **删文件整库消失** ⇒ 改为删具名语句 |
