# R5 外部协作与经营渠道 · implementation 收口复核

- 日期:2026-08-19 · 评审:Claude · 会话:续接(非 fresh,已声明)
- 范围:静态验收(Dexter 本轮裁定「仅做静态验收即可」)
- 结论:**NO-GO** · **M=2 · S=2 · N=1**(含补充轮)
- ⚠️ M-1 是**跨节点读越权**,不是文档瑕疵。修复面局限在一个 edge 控制器 + 一条验收场景。

---

## 0 · 这批工作到底解决什么,解决了没有

**要解决的两个结构性错位**:① 外部系统/provider/binding 三层焊死在经营渠道上,未来团购、权益、订单同步会复制同构三层;② 经营渠道需要项目自建四维模板承载多实例,且只在外部绑定有效时生效。

**结构性目标:解决了。** 亲验依据(全部现开源码):

- `collaboration` → `businesschannel` import **0 条**;反向 7 条且全部是 `CollaborationBindingReadApi`/`CollaborationCatalogReadApi`/`CollaborationReadback` 只读 API —— 依赖单向成立,无 Gradle 环;
- 跨域写全部落在 `ExternalCollaborationBusinessChannelCoordinator`,六个方法均带 `@Transactional(propagation = Propagation.REQUIRED)`,由 edge 依次调两个 owner command(第 43/62/80/105/115/133 行)—— 与 blueprint「跨 owner 写只能由 operation policy 列出有限 owner command」一致;
- 三种认证态在 `CollaborationBindingPolicy` 一处判定:`EXTERNAL_GRANT` 创建 `externalOwnerId` 可空且落 `PENDING_AUTHORIZATION`(第 31–41 行)、`INTERNAL_MAPPING` 必填(第 45–49 行)、`NO_MAPPING` 禁止(第 51–56 行);**编辑在服务端 403 拒绝**(第 64–66 行 `BINDING_EDIT_NOT_ALLOWED`),不是只删前端入口;
- 迁移 `V20260819_230000_000__collaboration_owner.sql` 第 53 行显式注释不建 `external_owner_id` 唯一约束,与 E-25「同店两渠道」一致。

**方案合理性(三问)**:问题对 —— 与记录 001 口述一致;方案优 —— 两 owner + edge 编排,比"扩旧结构"和"巨型 integration 模块"都更能承载后续消费者,取舍在详设 §0.2 有登记;代价配 —— 两个新模块换掉未来三层复制,当前阶段值。**无过度工程。**

## 1 · 符合项目记忆 / 设计文档 / 设计规范

| 对象 | 亲验结论 |
|---|---|
| 冻结字面量六项 | `GROUP_BUY` 51 · `TAKEAWAY` 104 · `INVENTORY_SYNC` 8 · `TAKEAWAY_DELIVERY` 11 · `LOCAL_ONLY` 27 · `COMMERCIAL_GROUP` 108;旧名 `GROUP_BUYING`/`SELF_SERVICE` **全零**,`TAKEOUT` 唯一命中在无关既有文件 `contracts/policy/catalog-inventory-fixture-catalog.json:699`(中文标签,非本批) ✅ |
| E-33 | 后端全域 `PLANNED` 仅出现在 `CheckedInCollaborationCatalogSource.java:26` 的合法状态集合,**零门槛用法**;另有 `collaboration.planned-profile-enablement`、`business-channel.planned-provider-candidate` 两条专场景 ✅ |
| 六项 C 保持 DEXTER_DECISION | `channel_code` 无唯一索引 · 无 `UNBINDING`/`FAILED` 枚举 · 无多态 node 抽象 · `external_owner_id` 无唯一约束 —— **四项反向搜索全空** ✅ |
| platform-admin 无 capability | `external-collaboration.paths.json`:`capabilityKey` 0 · `x-required-capability` 0 · `x-required-platform-authorization` 5 ✅ |
| single `x-consumer-faces` | platform 面仅 `platform-admin`、operations 面仅 `operations-admin`,多 face 声明 **0** ✅ |
| G-UI-01 时间字段全链 | 迁移 002(加列→按 `created_at` 回填→置 NOT NULL,注释说明为何 `created_at` 是唯一可恢复事实)→ owner 仅在删除/授权回调/撤销三处写(第 727/778/815 行)→ **普通 update 第 685 行不碰该列** → 契约 → `OwnerBindingView` → mapper → P5 展示。**七段齐,语义正确** ✅ |
| P6 认证态门控 | `canEdit` 排除 `EXTERNAL_GRANT`(第 42–43 行)+ 提交前拦截(第 104 行);`externalOwnerId` 输入仅 `INTERNAL_MAPPING`(第 233 行) ✅ |
| foundation 复用 | 15 个文件 import foundation,实际使用 `usePageQuery`/`useDetailDrawer`/`useDrawerFormLifecycle`/`useOverlayLock`/`adminDrawerSurfaceProps`/`adminWideDrawerSurfaceProps`/`NameCodeText`/`testId`/`useSubmissionLifecycle` —— 真复用,非挂名 ✅ |
| 退役机制 | 无 provider 壳 / 共享 SPI / scenario registry / 自动分母;两个新 domain 文件在 `BackendAcceptanceScenarioCatalog:18-19` 显式登记 ✅ |
| 验收分母 | 九个 `*Scenarios.java` 合计 **58** = 44 + 14,低于上限 80 ✅ |
| seed 三族 | 五类节点全覆盖;`POS`/`QR`/`KIOSK`/`DINE_IN` 与 `TAKEAWAY`/`GROUP_BUY` 均在 ✅ |
| **IA 第 181 行「读按 role node scope」** | ❌ **未实现,见 M-1** |

## M-1 · operations 侧六个读接口有五个无节点授权,F-02 是点状止血

**位置**:`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`

| # | 读接口 | 行 | 节点授权 |
|---|---|---|---|
| 1 | `/business-channel-templates?projectRef=` | 95 | ❌ 仅 `requireWorkspaceRead` |
| 2 | `/business-channel-template-candidates` | 113 | ✅ `requireStoreProjectPair`(第 122 行) |
| 3 | `/projects/{projectRef}/business-channels` | 132 | ❌ 经 `channels()` 第 420–436 行,仅 `requireWorkspaceRead` |
| 4 | `/stores/{storeRef}/business-channels` | 142 | ❌ 同上 |
| 5 | `/business-channels/{channelRef}` | 152 | ❌ 仅 `requireWorkspaceRead` |
| 6 | `.../{channelRef}/owner-binding` | 160 | ❌ 仅 `requireWorkspaceRead` |

`requireStoreProjectPair` 全文件出现 2 次 = 1 定义 + **1 调用点**。

**为什么这五个确实无保护(逐层排除,非推断)**:
- `OperationsSessionResolver.requireWorkspaceRead`(第 96–107 行)只校验"已认证 + `groupWorkspaceKey` 与会话一致",**不含任何节点判定**;
- owner 侧 `BusinessChannelOwnerService.requireScope`(第 1137–1140 行)只做 `workspaceUuid` 非空与 `groupWorkspaceKey` 长度校验,**不是授权**;`pageChannels`/`readChannel` 按传入 nodeRef 直查;
- edge 三个 Interceptor(`RequestCompletionDiagnostic`/`PublicSecurityDiagnostic`/`HttpRequestMetrics`)节点 scope 命中均为 **0**,无全局兜底。

**具体反例(与 F-02 同一攻击向量)**:运营用户角色 scope = 门店 A(项目 P1),把 URL 门店段改为门店 B(项目 P2)。前端 `OperationsApp.tsx:218` 是 `routeMatch?.scopeRef ?? scopeRefForPage(selected)` —— **URL 优先于会话推导**,故 `queryContext.scopeRef` 变为 B。此时同一页面上:
- 候选接口 → `requireStoreProjectPair` 第 446 行 `resolveSelectedProjectScope` 抛 `TaskScopeDeniedException`,**被拒** ✅
- `/stores/B/business-channels` → **返回门店 B 全部渠道** ❌
- `/business-channels/{B 的 channelRef}` → **返回渠道详情** ❌
- `.../owner-binding` → **返回绑定详情,含 `externalOwnerId`、授权状态、`boundAt`/`statusChangedAt`** ❌

⇒ 同一伪造 URL 下,"可选门店模板"面板报读取失败,而下方渠道列表正常列出门店 B 的渠道 —— **同页自相矛盾**,也是该缺陷最容易被用户先撞见的形态。

**影响面**:同集团空间内任一已认证运营用户可读取任意项目/门店的渠道与绑定事实,含外部平台店铺标识。

**为什么是 M 而不是 S**:
① IA 第 181 行明写「读按 role node scope」、第 209 行「页面可读角色按四类」—— 这是**本批设计文档的显式要求**,不是我的发明;
② 本仓已有标准形态:`OperationsContractController` 列表读用 `scopedProject(session)`(第 325–327 行,项目从会话取、URL 不参与),详情读用 `requireScopedView`/`requireScopedTaskView`(第 337–352 行,先读对象再 `resolveSelectedProjectScope(session, view.project().id())`);`OperationsStoreProfileController:75` 用 `requireStore(session)`。**新控制器两种形态都没用上**;
③ `resolveSelectedProjectScope`(`WorkspaceUserService.java:129–144`)比对的是会话 `scopeContext` 的选择而非 URL,第 137–138 行不等即 `TaskScopeDeniedException` —— 该机制现成可用,不需新建;
④ 本 cycle 的 F-02 已经认定过这一族判定必须存在,修复只覆盖了六分之一 —— 违反仓内「任何新发现先做同根扫描,不得点状止血」。

**验收判据(可证伪)**:对 STORE 上下文伪造门店、对 PROJECT 上下文伪造项目,六个读接口**全部**返回授权拒绝;任一接口仍返回他节点数据即判失败。并补一条 acceptance 场景断言跨节点读被拒 —— 现有 14 条中 `denial/denied/ACCESS/forbidden/crossStore` 关键词命中为 **0**,该行为无任何测试覆盖。

**是否需 Dexter 裁决**:**否**。IA 已定读侧语义,仓内已有标准实现形态,属既有批准边界内的修复。

**适用条件与反例**:结论基于静态源码逐层排除。若存在我未发现的 Spring Security 方法级注解或 `WebSecurityConfig` 路径级规则对这几条 route 施加节点判定,本条降为 N —— 请指出该配置的 owning source。我已排除 edge 三个 Interceptor 与 owner 层两处。

## N-1 · `collaboration.catalog-readback` 把可演进的业务事实写成断言常量

`CollaborationAcceptanceScenarios.java:65` 断言 `assertEquals("PLANNED", meituan.path("catalogStatus")...)`。美团从 `PLANNED` 变 `AVAILABLE` 是正常业务演进,届时该场景会因非缺陷原因转红。E-33 的语义本身已由 `collaboration.planned-profile-enablement` 与 `business-channel.planned-provider-candidate` 两条专场景覆盖,此处只需断言"读回值与 checked-in catalog 一致"而非固定字面量。不阻断本批。

## 2 · 证据档位(如实登记,依 Dexter「仅做静态验收」不作为阻断)

| 门 | 本轮结果 |
|---|---|
| `scripts/check/openapi-contracts` | **fresh PASS**(exit 0,`R5_OPENAPI_CONTRACTS=PASS`) |
| `scripts/check/contract-face` | **fresh PASS**(exit 0,`R5_CONTRACT=PASS; STATE=POST_GATE_0`) |
| `scripts/check/operation-handler-bindings` | **UNVERIFIED_REQUIRES_EVIDENCE** —— 本机无 Java runtime,exit 1 的原因是环境而非缺陷,我无法亲验该门 |
| 动态 acceptance | **本批零运行**。时序对账:最新 run `r5-tc-1787057770120-44319` 结束于 08-18 21:57,分母 `discovered=44`,本批场景命中 **0**;本批源码 mtime 为 08-19 03:58–07:20,**全部晚于该 run**。Codex 自述「无动态证据」经核**属实** |

⇒ 14 条验收场景当前是**纯源码资产**,其业务断言未经任何执行验证。本 GO/NO-GO 不含对它们的运行结论。

## 3 · 授权边界

本结论仅用于 R5 外部协作与经营渠道 implementation 的静态收口复核。未运行任何 HTTP、真实数据库、Testcontainers、DEV、seed/reset、browser L2、UAT 或外部联调。不改变六项 C 的 `DEXTER_DECISION`,不授权任何未明确批准的产品范围或动态环境动作,不把静态结论升级为运行、数据或发布结论,不授权任何 Git 动作。

---

# 补充轮 · 记忆/规范符合性 · 造轮子 · 自成体系

Dexter 专项指示。判定一律以**仓内既有对照组**为准,不引入外部标准。

## 一、先说没造轮子的部分(逐项排除,应予肯定)

| 疑点 | 亲验结论 |
|---|---|
| 两个新 `*CommandReceiptService` | **仓内惯例**:全仓 9 个模块各有一个(organization 独占 3 个),照做正确 |
| 后端游标编解码 | **正确复用** foundation 的 `OpaqueCollectionCursor`(两模块均 import 并调用 `encode`/`decode`/`InvalidCursor`),与 catalog、fulfillment-production 同形态 |
| owner 持久化 raw `jdbc.` | 与 Catalog(88)/Inventory(45)同形态;全仓**无**共享持久化基类可绕开 |
| audit 契约 | 复用 `AuditActor`/`AuditChange`/`AuditChangePolicy`(全仓 37/25 文件共用) |
| P6 节点候选 | **复用** `usePlatformOrganizationCandidates`,未重造 |
| 脏表单锁 | 未直接引 `useDirtyFormLock`,但 `useDrawerFormLifecycle` 内部已 import 它 —— **等于已用,不算漏** |
| `isCurrentQueryIdentity` 未用 | 全仓除 foundation 自测外**无人使用**,不构成偏离 |
| `contextScopedQueryArgs` / `expectedContextVersion` 未用 | operations 契约 **9 个有、11 个无**(catalog、inventory 也无),本批无之**不构成偏离** |
| `operationsClient` 直连 | 是受管生成层 `createOperationsAdminClient`,路径未手写 |
| G-05B 编码列 | `channelCode` 独立成列(`BusinessChannelList.tsx:147`) |
| Java 行宽 120 字节 | 本批 **0 处超标**(唯一超标行在既有文件 `PlatformOrganizationOverviewController.java:127`) |

## M-2 · 集合形态回归:声明 `Page`,实建「抽干全部游标页 + 客户端过滤分页」

**位置(两个 App 同病)**
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx:55,56-63,64,137`
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx:51,55,81,116`
- 两侧 `application/queries.ts`(operations 5 处、platform 1 处 `collectCursorPages`)

**三层互相矛盾(全部现开源文)**
1. **详设 §5.2** 第 274/282/285/286 行将四条列表声明为 `collection: Page`;**IA-O3** 第 177 行要求「名称/编码搜索;查询/重置;分页」;
2. **契约**逐条 dump 确认只有 `cursor` + `pageSize`,**四条列表零搜索参数**;
3. **前端** `collectCursorPages` 抽干全部游标页 → `items.filter(...)` 客户端过滤 → `filtered.slice(...)` 客户端切片 → `total: filtered.length`。

**命中规范原文**:`project-memory/practices/collection-boundary-modes.md` 第 40–43 行「❌ 内存分页……✅ **过滤、计数、排序、分页全部在 SQL 侧完成**」;第 69 行判别式「长到 1000 条时会发生什么」—— 本实现答案是**每次进页面、每次刷新连打 40 次 HTTP**(1000÷25)。

**对照组坐实是偏离而非惯例**
- 既有真 Page 列表 `ContractManagementPage.tsx:344` 用 **`total: list.currentData?.metadata.total`**(服务端计数);
- 本批 `queries.ts:29` **已从服务端收到 `total`**,UI 层弃之不用改取 `filtered.length`;
- `collectCursorPages` 宿主是 `libraries/frontend/admin-ui-foundation/src/list/useCursorCandidates.ts` —— **候选下拉**辅助;本批之前全仓仅 `catalogFieldRuntime.ts:147` 用于选项加载,本批一次性用到 **6 处主管理列表**;
- foundation 另有 `CursorPagination`/`useCursorStack`(游标集合专用控件)与 `normalizePage`/`normalizePageSize`,本批**均未使用**,改为手写 `slice`。

**影响面**:小数据量下功能正确(抽干后过滤不漏),规模增长时线性放大往返;IA 要求的搜索永远到不了服务端。**这是上一批 17 个 CP 刚清干净的 `pageSlice` 反模式换到浏览器侧复发。**

**最小验收判据**:任选一条列表造出超过单页的数据后 —— 单次进页面只发**一次**列表请求;`total` 取自服务端响应;搜索词进入请求参数。三者任一不成立即失败。

**Dexter 已裁定(2026-08-19,记录 014)**,按集合口径分开落位:

| # | 集合 | 口径 | 裁定形态 |
|---|---|---|---|
| ① | O3 项目渠道 | 单个项目自己的渠道 | **Bounded** |
| ② | O5 门店渠道 | 单个门店自己的渠道 | **Bounded** |
| ③ | O1 模板 | 单个项目维护的模板 | **Bounded** |
| ④ | **P4 绑定** | **整个集团空间**内该 provider 的全部绑定(≈门店数×渠道数) | **Page:标准搜索框 + 分页,服务端** |

⇒ **①②③**:详设 §5.2 改标 `Bounded`;按 charter §1-J 的 Bounded 义务补三件 —— **写出上界来源**、**断言 exact set**、**不拿当前行数当上界**;契约撤掉 `cursor`/`pageSize`(Bounded 不分页),前端撤掉 `collectCursorPages` 抽干循环改单次读取,此后客户端过滤/切片**合法**。
⇒ **④**:维持 `Page` 且必须**真做** —— 契约补搜索参数与分页参数,过滤/计数/分页落 SQL,`total` 取服务端完整匹配 count(当前 `queries.ts` 已收到该值,UI 层恢复使用即可)。此项与 IA 第 105–106 行原文一致。

**不再需要 Dexter 裁决**;剩余为既有边界内的实现工作。

## S-1 · 明明有 foundation 能力却自写一套:刷新与旧响应守卫

**(a) 刷新信号** —— `business-channel` feature 手写 7 处 `refreshToken` 计数器(`StoreBusinessChannelPage.tsx:19,93,106`、`BusinessChannelList.tsx:32,87` 等)。

foundation 有 `createRefreshSignal`/`useRefreshVersion`,且 **`OperationsApi.ts:33` 已经实例化了 App 级 `operationsRefreshSignal`** —— 本批 **0 处使用**。

逐 feature 实测(两个 App 共 11 个 feature):

| App | feature | 手写 token | RTK 失效/refetch |
|---|---|---|---|
| operations | **business-channel(本批)** | **7** | **0** |
| operations | catalog-management | 0 | 13 |
| operations | inventory-management | 0 | 8 |
| operations | contract-management | 0 | 3 |
| operations | audit-history / store-profile / workspace-user | 0 | 2 / 2 / 1 |
| platform | **external-collaboration(本批另一半)** | **0** | **3** |
| platform | workspace-administration / workspace-iam / audit-history | 0 | 4 / 3 / 2 |

⇒ 11 个 feature 中 **10 个**走 RTK 失效,唯一例外是本批 operations 侧;**同一批的 platform 侧却合规** —— 批内形态不统一。

**(b) 旧响应守卫** —— 手写 `let active = true` 共 4 处,**全仓这 4 处全部属于本批**(`OwnerBindingList.tsx:64`、`OwnerBindingDetailDrawer.tsx:70`、`BusinessChannelList.tsx:67`、`StoreBusinessChannelPage.tsx:24`)。其余 feature 因走 RTK 查询生命周期而天然不需要。

**违反的规范**:IA 第 84 行「P1 树节点、P3 provider 状态和 O2 candidate query **精确失效**」、第 112 行「按**精确 cache/query identity 刷新**」。计数器 bump 是整表重取,不是精确失效。另见 `project-memory/practices/cache-invalidation-granularity.md`。生成的 RTK 端点层**确实已包含本批全部 operation**(逐名确认),其文件头注释写明用途正是「method 与 path 冻结在此,而不是在页面里手写」。

**最小验收判据**:任一写操作成功后只有受影响的 query identity 重取,无关列表不重取;`let active` 守卫归零。**是否需 Dexter 裁决:否。**

## S-2 · owner Problem 处理器复制进 3 个控制器,而非登记全局 advice

**位置**:`OperationsBusinessChannelController.java:521,531` · `PlatformExternalCollaborationController.java`(×2)· `OperationsExternalCollaborationController.java`(×1)—— 2 个 Problem 类型共 **5 个雷同方法体**。

**仓内既有标准**:`app/edge/problem/ContractProblemAdvice.java` 是全局 `@RestControllerAdvice`,已登记 asset、catalog、business-entity、organization、workspace、IAM 等**所有其它模块**的 owner 异常;其它 operations 控制器自带 `@ExceptionHandler` 数为 **0**。本批的 handler **正在调用** `ContractProblemAdvice.problem(...)` 这个共享构造器,却不把类型登记进该 advice(全局文件内 `Collaboration`/`BusinessChannel` 命中为 0)。

**失败模式**:今后任何新控制器调用这两个 owner command,若忘记复制这 5 个方法,owner 抛出的 typed Problem 就不被映射 —— 用户看到 500 而非 `BINDING_NOT_EFFECTIVE` 等业务错误。这是「忘了就退化」的结构,不是「错了会报警」的结构。

**最小验收判据**:两个 Problem 类型在全局 advice 登记一次;删除三处本地 handler 后 typed problem 仍按原 code/status 返回。**是否需 Dexter 裁决:否。**

## 补充轮证据边界

四条均基于**静态源码 + 仓内对照组**。M-2 的往返次数是按 `collectCursorPages` 语义与 `pageSize=25` 推算的**结构性结论**,未做运行时测量,不主张具体耗时。S-1 表格为逐 feature grep 实测计数。
