---
title: v2s 问题发现与实施方向总册(Claude)
type: review
subtype: problem-discovery
status: DELIVERED_FOR_CODEX_DETAILED_DESIGN
reviewer: Claude
createdAt: 2026-07-26
purpose: 由 Codex 据此做详设；Claude 与 Dexter 做 review 与守门
scope: 本册只陈述「问题、证据、裁决、方向」，不写详设
authorizationBoundary: 不授权实施、DEV、seed/reset、动态运行；不扩大 R5 业务范围
---

# v2s 问题发现与实施方向总册

## 0. 这份文件是什么、不是什么

**是**:一次跨 v1/v2/v4/v4s 四代对照 + v2s 现状全量核查的结果汇总,包含问题清单、可复现证据、Dexter 已下的裁决、以及每一类问题的**方向**(不是方案)。

**不是**:详设。字段、表结构、类名、事务序列、接口形状由 **Codex 在此基础上做详设**;Claude 与 Dexter 做 review 与守门。

**使用方式**:Codex 逐条重开 owning source 亲验后再做设计;本册的每条结论都给了可复现路径,**不得直接采信本册数字**——尤其因为 Codex 正在做 R5 全范围收敛,收敛后很多字节已变。

## 1. 调查方法与出处

- 四路独立对比 agent(后端 owner 数据模型 / 横切机制 / 前端架构 / 测试与 DEV)+ 三路 v2 扩展字段与角色调研 + 两路 v1/v2/v4 资产调研,共 9 路,均**双仓只读、证伪立场**。
- 所有 M 级与安全级结论由 Claude 本体重开源码亲验后才写入;agent 的两处夸大已当场证伪并更正(详见 §8)。
- 会话性质:续接会话(上下文经压缩),如实声明。本仓零写入(除评审交付文件)。

## 2. 贯穿全局的一句话诊断

> **v2s 从 v2 搬来了「名字与结构」,却没搬来产生这些结构的机制,于是留下一批形状正确、消费为零的骨架。**

后端 47 张表中 **11–13 张零引用**,其中 9 张正是 v2 真正实现了的审计/幂等机制的空壳;前端是同一个病的镜像——foundation 里三个需要架构才能接的 primitive(`createObservedBaseQuery`、`createSafeLogger`、`useDetailDrawer`)全部零消费。

**但要同时记住另一半事实,避免过度返工**:业务建模本身没有膨胀。真业务表 **v2 = 31 张,v2s = 31 张,完全相等**;总表 88 → 55,砍掉的 40 张投影/outbox 是红线的功劳。**问题不在建模,在"结构搬来了、行为没搬"。**

## 3. Dexter 已下的裁决(全部生效,详设必须遵循)

| # | 裁决 | 原话/要点 |
|---|---|---|
| R-1 | **严格度标尺** | 「代码治理要严谨,但是业务设计不能过度」。门与边界照严;数据模型偏简单,JSON 装一组 key 是被偏好的,不构成 finding |
| R-2 | **扩展字段与角色授权对齐 v2 的 JSON 形态** | 「跟 v2 一模一样」「简单存储 json 就好了」。已成设计文件,Codex 已执行 `V20260726_160000_000`(8 张 DROP TABLE) |
| R-3 | **资产分两类** | 「一类是静态资源(图片视频),上传就是为了被人看到,走 CDN、完全不需要鉴权;另一类是业务数据(批量导入导出),临时数据处理完就丢弃,不应跟静态资源一个服务,也不应走 CDN」 |
| R-4 | **静态资源全公开** | 「所有资源都是公开可读的,完全没有必要鉴权」 |
| R-5 | **视频现在就纳入资产设计** | 不是"预留形状",是纳入 |
| R-6 | **合同货号改 JSONB 数组** | 取代 `store_contract_item` 表 |
| R-7 | **前端做多标签页 shell,照搬 v2** | 但快照逻辑必须做成**一个共享 helper**,不得复制 v2 的六份 |
| R-8 | **安全六条:R5 收敛完再修,由 Codex 做详设** | Claude 只记方向 |
| R-9 | **早期成本最低,要最优最长期方案** | 不为短期完成让步 |
| R-10 | **Git 归 Dexter** | 任何 AI 不得要求、提醒、催促 git 动作 |
| R-11 | **保留审计功能,并新增「操作历史」用户功能** | 「还是留审计功能吧,而且运维管理后台…实体详情里,应该增加一个『操作历史』的按钮,点击之后应该**弹窗(非抽屉)**,显示这个实体的所有审计历史」。**这条推翻了此前"审计弱化为日志"的讨论方向** |
| R-12 | **术语定义(必须持久记录)** | 「**运维管理后台 = platform-admin,运营管理后台 = operations-admin**」。目的是**不要每次都误解**,不必进 `confirmed-business-language-corpus.md`,任何持久位置皆可。由 **Codex 动手**(Claude 评审会话只写 `doc/review/platform/`)。**两个提醒**:①该语料库当前哈希 `51415f7d…` 被 **5 个文件绑定**(`r5-scope-and-method-decisions`、`r5-whole-scope-journey-decision`、`r5-whole-scope-design-final-acceptance`、`r4-implementation-adversarial-round-2-inputs.json`、`r5-whole-scope-design-granularity-manifest.json`),改它要同步这些绑定——**这正是不必动语料库的理由**;②`project-memory/required-inventory.json` 是冻结分母,**新增文件会被 `project-memory` 门拒绝**(已实测),应写入既有文件 |
| R-13 | **两个 App 都显示审计历史** | Dexter 采纳 Claude 推荐项 ③ |
| R-14 | **认可因操作历史带来的 104 分母变更** | 「我认可」。这是一次**显式的范围扩张**,已获授权,不再是"实现悄悄加接口" |

## 4. 问题清单

### A 档:安全缺陷(6 条,全部 Claude 亲验)

| # | 问题 | 可复现证据 | 参考实现 |
|---|---|---|---|
| A-1 | **密码可无限次猜** | `failed_attempts` 全仓仅 3 处出现,**全是 `=0`**(改密/重置时重置),登录失败路径从不 +1;`locked_until_epoch_millis` 同理。锁定机制不存在 | v2 `platform-iam-service/.../V2__platform_login_rate_limit.sql`、`workspace-iam-service/.../V15__workspace_password_login_rate_limits.sql`:ACCOUNT 10 次/15 分、SOURCE 30 次/5 分,HMAC 指纹 + advisory lock + `@Transactional(noRollbackFor=…)` 让计数在 401 后仍留存 |
| A-2 | **OTP 可无限次猜** | `attempt_count` 三处 `+1`(`WorkspaceAuthenticationService:51`、`WorkspaceInvitationService:105`、`WorkspacePasswordResetService:66`),**全仓无任何地方读它**;无发送频率上限 | v2 `workspace-iam-service/.../V6__workspace_otp_attempt_limits.sql`:5 次/10 分锁定 + 3 次/10 分发送上限,version CAS |
| A-3 | **可把系统锁死** | `libraries/backend/platform-iam` 对 `built_in\|countActive\|self` grep 零命中。可停用种子管理员、自己、最后一个管理员 | v2 `platform-iam-service/.../V4__platform_admin_built_in.sql` + `PlatformAdminGovernanceService.assertMutableTarget`(:96,119,155,211-216)+ 自我停用守卫 + `countActiveUsers() <= 1` 守卫(advisory lock 下) |
| A-4 | **幂等完全失效** | 每个写接口收 `Idempotency-Key`,但 `private static void key(String value)` **只校验长度、返回 void、key 之后再不出现**;7 张 `*_command_receipt` 表零读写。契约写 `REQUIRED_16_128`、门能查 header 必填、代码也在校验——**但零重放保护** | v2 `platform-workspace-service/.../PlatformWorkspaceCommandReceiptRepository.java:19-64`:reserve(`ON CONFLICT DO NOTHING`)→ 冲突则 `FOR UPDATE` → 指纹常时比较不符 409 → 回放存储响应 → complete;DDL 带 `operation_kind` 闭集/长度/completion 一致性 CHECK |
| A-5 | **资产 bind grant 签发但从不校验** | `asset_bind_grant` 一处写、零处读;`claim` 只按 `asset_ref` + `status IN ('STAGED','RELEASED')` 匹配 → 任何到 claim 路径者可绑定任意 staged asset | v2 `PlatformAssetStagingService.java:230-236,138-143`:`constantTimeEquals` 校验 grant,再在 `FOR UPDATE` 下二次校验 proof 的过期/asset ref/usage/workspace |
| A-6 | **商业集团初始化零事务** | `OrganizationCommandService` **零个 `@Transactional`**;幂等插入/建组/审计/回执四条语句各自 autocommit。中途失败会在幂等表留 `commercial_group_id` 为 NULL 的行,**永久烧掉该 key** | v2 `CommercialGroupInitializationService.java:36,41,53-61` + `CommercialGroupRepository.java:29-31,39-59`:`@Transactional` + `pg_advisory_xact_lock`,审计与建组同 CTE 且带基数守卫 |

**方向**(R-8:Codex 在 R5 收敛后做详设):六条 v2 全都有可直接对照的实现,照其语义补齐即可,不需要发明。A-1/A-2/A-3 是可被外部利用的,应排在 A-4/A-5/A-6 之前。

### B 档:正确性缺陷(8 条)

| # | 问题 | 证据 | 后果 |
|---|---|---|---|
| B-1 | **组织树无法通过应用引导** | `createRegion` 要求存在 `node_type='GROUP'` 的 `organization_node` 行,而无任何生产端点创建它——只有测试在建 | 全新空间建不出大区。v2 是 `commercial_group.id` 直接作为 REGION 的父,不存在这个断链 |
| B-2 | **主数据外键可变 → 合同快照失配** | v2s store update 写 `SET project_id=?, tenant_id=?, brand_id=?, ...`;合同创建时把 `tenant_id` 快照进 `store_contract` | 改门店归属会**静默让所有已有合同的 tenant 失配**。v2 拒绝改 code(409「编码创建后不可修改」),store update 只动 `name/head_company_id/notes` |
| B-3 | **货号去重大小写敏感 + 未映射 500** | 校验按原值去重、插入时 trim;`"A1"` 与 `" A1"` 过校验后撞唯一键,且无 advice 映射 `DuplicateKeyException` | 用户可触发 500(v2 返回 400,按 `strip().toLowerCase()` 去重)。**注:R-6 改 JSONB 后唯一键消失,此条转为纯应用层校验问题,更需 focused test** |
| B-4 | **状态闭集 CHECK 几乎没有** | v2 有 28 个 `CHECK (... IN (...))`;v2s 18 个 status 列**只有 3 个**有 CHECK | 脏状态写得进库 |
| B-5 | **名称唯一性缺失** | v2 对 brand/tenant/head_company/store 都有 `UNIQUE(workspace, name)`;v2s 只约束 `code` | 同名门店/品牌可并存,而运营端选择器按 name 显示 |
| B-6 | **二级索引几乎为零 + N+1** | v2 有 65 个 `CREATE INDEX`,v2s 只有 2 个(且都是 grant hash 局部索引);`listEntities`/`list` 还逐行再查 | 所有列表顺序扫描 |
| B-7 | **组织节点变更完全无审计** | `OrganizationHierarchyService` 零审计写入 | 大区/项目的建、改名、启停无任何痕迹。v2 写 `organization_node_audit` 带 `actor_id` |
| B-8 | **RLS 已删但代码仍设 GUC** | 四条 policy 已被 drop,`PlatformWorkspaceService:71-74` 每请求仍 `set_config('app.consumer_face',…)` | 每请求两次多余往返,喂给没人读的 GUC |

### C 档:零消费与过度结构

**后端表**(47 张中 11–13 张零引用,收敛后需重算):
7 张 `*_command_receipt`(全空)、4 张 `*_audit` 零写零读(`platform_iam`/`platform_workspace`/`platform_asset`/`extension`)、`asset_cleanup`、`platform_credential_reset`。另 3 张只写不读且 `detail_json` 恒为 `'{}'`、`account_id` 恒 NULL。

**死列**:`workspace_session.authorization_revision`(与 `context_version` 锁步自增、**零比较**——这是 v2 投影机制的名字,而投影已被红线掉)、`group_workspace.revision`/`commercial_group.revision`(冻死在 1,仍被读出当版本)、R3 表上的 `TIMESTAMPTZ created_at`(与 `*_epoch_millis` 并存且 `DEFAULT CURRENT_TIMESTAMP` 绕开 `TimeProvider`)、`organization_node.phase_names`(写一次 `'[]'` 后再不读,真实流量走侧表)、`staged_asset.claimed_by_type`(常量)、`platform_admin.mobile_mask_source`、`platform_session.last_seen_at_epoch_millis`、`store_contract.invalidated_at_epoch_millis`(写而不读)。

**过度状态机**:邀请 8 态承载公开注册向导进度,其中 `COMPLETING` 在同一 `@Transactional` 内变更、**外部不可观测**;`EXPIRED` **全仓无写入点**是死分支;同一份进度**同时**存在于 `invitation.status` 与 `invitation_public_progress` 表,两处各带 version、无一致性约束。v2 只有 3 态 + `generation` 计数器。

**同概念多份**:同 App 三种分页信封(`{items,page,pageSize,total}` / `{metadata,items}` / `{metadata,items,+8 个 source-status}`);6 个 `*SortDirection` 枚举表达同一个 ASC/DESC;`password_reset_progress` 是 `password_reset` 的 1:1 拆分。

**孤儿产物**:`build-static.mjs`(全仓零调用者,复制文件后打印 PASS,**不是构建路径**——真构建是 `yarn typecheck && vite build`);`src/main.js`(不被 index.html 与 vite 使用,**却有两个门在读它**)。

### D 档:契约与实现脱钩

- `EdgeProblemCode.java` 106 个生成常量**零 Java import**;实际出码全是字符串字面量。
- `ContractProblemAdvice` 构造 Problem 时 **`type` 恒为 `"about:blank"`、`title` 与 `errorCode` 传同一个变量**,与自家 `common/problem.schemas.yaml`(要求 type 为 uri、title 独立)不符。
- contracts 树里**两份不同的 `problem.schemas.yaml`**(R3 版 `{code,title,detail}` 与 R5 版 `{type,title,status,detail,instance,errorCode,correlationId}`)同 App 并行。
- 前端 `EDGE_PROBLEM_CODES` 零消费,真实用法是 `${errorCode}:${detail}` 直接拼给用户看。
- `metadata`/`items` 在 OpenAPI 里已类型化,Java 生成物却塌成 `Map<String,Object>` / `List<Map<String,Object>>`。
- Overview 的 `itemsSourceStatus/itemsAsOf/itemsUnresolved/filterOptions*` 8 字段**恒为常量**(从 v2 投影语义搬来,v2s 无投影)。
- `ExtensionEntityType` 已物化契约为 **8 值**,而主设计 §170 定的是**五宿主闭集**——U01 物化时从 heritage 基线回流带回来的。

### E 档:前端架构缺口

规模对照:v2 platform-admin **91 文件/13,435 行**、operations-admin **89/12,381**;v2s 分别是 **14/1,001** 与 **12/1,146**。**这不是"薄一点",是另一套架构。**

- **无路由层**:`react-router` 已声明但**全仓 0 import**,用 `useState` 三元链切页,公开页靠 `window.location.pathname` 正则。
- **无 RTK/Redux**:`@reduxjs/toolkit`、`react-redux` 同样声明 0 import。无缓存、无请求去重、无 tag 失效,每次 mutation 后手动再 `load()`。
- **foundation 用了不需要架构的那一半**:已用 8 个(`useDrawerFormLifecycle`/`useSubmissionLifecycle`/`adminDrawerSurfaceProps`/`OverlayLockProvider`/`useOverlayLock`/`testId`/`contextScopedQueryArgs`/`platformHttpProtocol`);**零消费 3 个,恰是最关键的**——`createObservedBaseQuery`(RTK base query,负责 mint/echo `X-Correlation-Id`)、`createSafeLogger`(脱敏结构化日志)、`useDetailDrawer`。foundation 库本身逐字节搬对了,问题是下面缺一层架构导致它们无处可接。
- **幂等 6/22**:仅 6 处走 lifecycle 稳定键,14 处由 app client 补随机 `ui-<uuid>`(**零重放保护**),其中 `RolesPage`/`AdministratorsPage`/`WorkspaceAdministrationPage` 三处是**无 `expectedVersion` 的创建**,超时重试必然重复建实体。
- **服务端 detail 直接给用户看**;无 feedback 映射层;locator 全是内联字面量、无 per-feature 模块、无参数化 locator。
- **catalog 生成物零消费**:同一套词表在菜单标签、页面标签、`PAGE_ACCESS_KEYS`/`ACTION_CAPABILITY_KEYS` 数组、状态标签四处手抄。

### F 档:资产与 CDN

**v2s 现状问题**:
1. **字节进了 PostgreSQL `BYTEA`**(`asset_content`),**违反 R5 主设计 §265**「bytes 在受管 asset storage;不另建 `asset_content`/`asset_claim`」与 §317「metadata/claim 在 PostgreSQL」。**R-5 纳入视频后此方案彻底作废**。
2. **访问链路是流式代理字节**(`GET /api/public/assets/{ref}/content`),不是发 URL。CDN 无处可插。
3. `asset_bind_grant` 表已建,而 `logoBindGrant` 在契约 `forbiddenProperties`、前端 manifest 已登记 `NOT_CARRIED`——**契约禁了、前端退役了、后端建了表**。

**四代对照(CDN 就绪度递减)**:

| | v1 | v4 | v2 | v2s |
|---|---|---|---|---|
| 存储抽象 | `AssetObjectStoragePort`(store/**resolveUrl**/read/delete) | `AssetObjectStorage`(store/read,**无 url()**) | 无,`Files.*` 直写 service | 无,BYTEA |
| public base URL 配置 | `ASSET_OBJECT_STORE_PUBLIC_BASE_URL`(**已声明已接 adapter,但 `resolveUrl` 零生产调用者**) | **不存在**,URL 在 **7 处**各自拼(2 处硬编码) | 不存在 | 不存在 |
| 读权限 | 公开免鉴权 | 公开免鉴权 | session + capability | 公开但代理字节 |
| 缓存头 | `public, max-age=31536000, immutable` | 无 | 无 | 无 |
| 上传校验 | 信客户端 Content-Type,整文件进堆 | 信客户端 Content-Type,无 magic bytes | **流式 8KB + magic bytes + ImageIO 解码探针,不信客户端声明** | — |

**四代共同的好性质**:替换一律新建 assetRef、从不覆盖 → **长 TTL immutable 缓存天然安全,缓存失效不是问题**。

**值得抄的**:v2 的上传校验(唯一比 v1/v4 强的地方);v2 的 `displayUrl` 单一收口 + 前端从不自己拼 URL;**v4 的机器门 `check-media-resource-internetization-redlines.mjs`**(禁 bytea/base64 当存储,要求 metadata 表有 `bucket_name/object_key/visibility/sha256`——v4 的库因此一直干净,而 v2s 恰恰跨过了这条线);**v4s stub 的形状**(`put(objectKey, content, contentType) -> String` 返回 URL,把 URL 生成放进 adapter,正是 v4 缺的那一半)。

**v4 踩过、v2s 同样暴露的坑**:seed 直接往业务行写 `logoAssetRef` 而未建资产行 → 悬空 ref → UI `ASSET_NOT_FOUND` 404。根因是**业务域 `mediaRef` 列与资产表之间无 FK 或引用校验**,导入/复制/跨环境搬数据都会重现。

**v4 的反面教材(印证 R-3)**:v4 也选了全公开,后来 `storeGeneratedFile` 接受 XLSX/ZIP/SVG/TXT,把含真实门店/台位数据的导出工作簿也存成 `PUBLIC_READ`,无鉴权无过期,唯一保护是 ref 猜不出来。**这不是有人写错,是架构没给两类东西分家。**

### G 档:测试、门与证据

**执行体系缺口**:
- **五账里 L2/L3 两账是记账格式而非执行事实**。`yarn test` 只 glob `architecture/*.test.mjs`(3 个文件共 42 行字符串断言);唯一的 `access-recovery.spec.ts` **不被任何入口执行**。`verify.mjs` 23 个 label 中 **0 个跑 playwright、0 个跑 L3**。
- `affected-l2` 只 `assertFile` **从不执行**测试,且当前 **18/23 个 target 文件不存在**(门因此真红,证据如实记录,无 stub 伪绿——这一点做得对)。
- `scripts/dev/seed` 目前返回 `R5_SEED=REFUSED; OWNER_COMMAND_EXECUTOR_NOT_IMPLEMENTED`,**business 账无数据来源**。

**门的问题**:
- `scripts/verify` 含 **6 次 `gradle --rerun-tasks --no-daemon`**;JUnit 实际只跑 27.2 秒(37 用例),成本全在冷 JVM 与重复编译。**踩了 Dexter 自订的"verify 保持分钟级"红线**,且因含 `affected-l2` 当前必红。
- `security --self-test` 的变异对象是 `contracts/openapi/edge.openapi.yaml`,而该文件 `x-consumer-faces` **出现 0 次** → **no-op 变异**;self-test 因此以 `R4_GATE_SELF_TEST_RED_NOT_DETECTED` **大声报红**(不是假绿,base 门本身 7/7 真实输入变异真红)。
- `code-layout` 的 backend app 根用**黑名单**(6 个目录名)而非白名单,新增任意目录不会红。
- backend ArchUnit **只落实 1/3**(有 cookie 禁令,缺 capability 单向依赖、缺 edge 禁 JDBC/repository),且只 ban `Cookie` 类不含 `HttpServletRequest`。
- `frontend-architecture` **只落实 2/3**,缺"catalog required mutation 必须经 lifecycle idempotency"——变异证明:删光 4 个 `lifecycle.getIdempotencyKey()` 门仍 PASS。
- `traceability` / `terminology` 两道门是**关键词匹配**(grep `CARRY|ADAPT|NOT_CARRIED`、grep `commercialGroup|groupWorkspace`),正撞 Dexter 红线「不得用关键词/字段匹配把语义伪装成 checker」。
- `logging` 门当前**红**且两份证据均未披露:`R4_LOGGING_SENSITIVE_LITERAL` 命中的是 cookie **名称常量** `private static final String COOKIE = "V2S_OPERATIONS_SESSION"`,裸正则误伤。

**v2 那边不该继承的**(反面参考):写权限/permit-kernel/module-delivery/journey-design 治理机器 **6,480 行 = v2 治理代码 25%,一行不证明产品行为**;`*JourneyTraceRegistry` **1,008 行,测试在断言 registry 等于它自己的一份拷贝**;`generatedProblemSemantics` 182 行零消费,**且"证明它被消费"的门读的是这个生成物自己**(永远绿);`doc/evidence/` 286 文件里机器实际引用约 12 个;`.runtime/runs` 无保留策略(1 GB/12 天,190 次/天),并**诱导**了 evidenceRefs 指向 gitignored 路径这一设计错误。

**v2 值得继承的只有四样,不到 600 行**:L3 真实链路测试形态(docker + bootRun + curl/jq + psql readback,正负例齐全,p50 20 秒——**不慢**);`run-managed` 受管运行器(business/cleanup 分离、PID+startToken 双证、声明端口但绝不按端口杀进程、STALL 检测、四夹具 self-test);`test-discovery-evidence` 门(61 行,用 `--list` 证明测试真被 runner 发现——**v2s 正好犯了它防的错**);"DEV 默认不 seed / seed 走公开 API + owner readback"的规矩。

### H 档:流程与证据

- **已 GO 的方案在 GO 之后被静默修订**(`d5ca6bf5…` → `306c596f…`),§6 第 4 条被移除且未披露。修订实质正确(不篡改冻结的 `required-inventory`),但不披露不能成为惯例。
- **Roadmap 状态自相矛盾**:状态块 `R5_IMPLEMENTATION_AUTHORIZED=true`,而"Current post-R4 status"段在同一句里引用该块却写成 `=false`,会误导 fresh 会话。
- **证据措辞改写判定**:evidence 用 "its **nine** existing capability surfaces" 把 S2 的 10 分母改成 9;用 "app client attaches a generated Idempotency-Key" 替换"必须经 foundation lifecycle 取稳定重放键"。**一个必须靠改写措辞才能宣称达成的判定,本身就是缺陷判定**(该判定锚是 Claude 上一轮定错的,已在 checkpoint review §4.5 自我更正)。
- **守卫被排在它要守卫的工作之后**:S0 诚实地把两个门标为 `PENDING`、承诺随 S1-S3 激活,但搬迁做完了、门没激活。这是**第二次**犯同一个错(§3.2 反思过"先让 operations 有路由、再谈稳定承载")。已定硬停规则:**控制不得以 `PENDING` 跨越它所守卫的工作**;baseline 控制表状态收敛为 `ACTIVE_RED_VERIFIED | OUT_OF_SCOPE_THIS_PACKAGE` 闭集。

## 5. 实施方向(方向,不是详设)

### 5.1 资产与 CDN(R-3/R-4/R-5)

**两个 owner,不是一个**:
- `platform-asset` = **静态展示资源** owner。图片与**视频**。全公开、免鉴权、CDN 直接回源。**设计里必须写否定条款**:该 owner 不接受导入导出、报表、临时处理产物;这类需求出现时另立 owner(v4 正是从 `storeGeneratedFile` 一个方法开始滑下去的)。
- 导入导出 = **将来另立 owner**。鉴权、限定发起人、TTL 自动清理、不进公开桶、ref 不可枚举。R5 不建,但红线现在就写。

**静态资源的目标形状**:字节出库进对象存储 → 库只存 metadata + `bucket_name`/`object_key`/`sha256`/`visibility`(或按 R-4 省略 visibility) → **port 带 `url()` 方法**(URL 生成归 adapter,这是 v4 的教训) → **单一 `asset.public-base-url` 配置键**,本地相对路径、上线换 CDN 域名、**代码零改动** → 路径含内容哈希 → `Cache-Control: immutable` + ETag(sha256 已存,几乎白送)。

**视频带来的硬约束**(R-5):不得整文件读进内存(现 `readAllBytes` + `byte[]` 返回必须改流式);**必须支持 Range 请求**(拖动播放前提,也是 CDN 回源标准姿势);上限不能是 5MB;上传考虑分片/断点续传;转码与封面图可推迟但 port 与 `usage` 闭集现在就按大文件设计。

**必须补的引用完整性**:业务域 `mediaRef`/`logoAssetRef` 与资产表之间要有 FK 或等价校验(v4 的悬空 ref 事故根因)。

**抄 v4 那道门**:禁 bytea/base64 当存储 + 要求 metadata 表字段齐备。

### 5.2 扩展字段与角色授权(R-2,设计已出,Codex 已部分执行)

见 `doc/review/platform/2026-07-26-v2s-extension-and-role-storage-alignment-design-claude.md`(D-E1~D-E9)。要点:定义一行一宿主 + `definitions JSONB`;值落宿主表 `extension_values JSONB` + `extension_rule_revision`;角色两个 JSONB 数组列;宿主闭集保持 **5 类**(v2 契约写 8 类,但其 organization migration 停在 V9、规格要求的 V20 根本不存在——那 3 类在 v2 里**定义存得进去、值无处可放**);`preserveUnknown + replaceKnown` 是最硬的不变量;运营端文案是**「经营资料」**,不得出现"扩展字段/自定义字段"。

### 5.3 合同货号(R-6)

改 JSONB 数组。**代价必须被补偿**:`UNIQUE(contract_id,item_code)` 的 DB 级保证消失,"合同内编码唯一"转为应用层校验,**必须有 focused test 专验并发/重复提交下的唯一性**;同时修 B-3 的大小写敏感去重(按 `strip().toLowerCase()`)与未映射的 `DuplicateKeyException`。

### 5.4 前端(E 档)

**顺序锁死:底座先于补全**。先路由层 + RTK(codegen + 401 拦截 + context 变更失效扇出)+ 日志管线——这三样接上后,foundation 那三个零消费 primitive 自然就位;然后拆 generic registry、补 feature 骨架、统一 locator 模块、建 feedback 映射层;**最后**才补 6 个无承载的 pageDesignKey。反过来先堆页面,就会一直用不上,且建完要重写。

多标签页照 R-7:功能照搬 v2,**快照逻辑做成一个共享 helper**,两个 app 的 action/selector 命名统一。

**RTK 只抄该抄的**:codegen + 401 拦截 + `contextLifecycleListener` 的失效扇出。**不要抄 v2 的 workspace 级 tag 矩阵**——v2 的列表页用 `subscribe:false, forceRefetch:true` + `actionRef.reload()` 绕过缓存,给列表声明的 tag 是死的,v2 自己也没统一(2 页 request 驱动 vs 11 页 dataSource 驱动)。

### 5.5 门与证据(G 档)

**硬停规则先行**:控制不得以 `PENDING` 跨越它守卫的工作。补齐 ArchUnit 三条(servlet 全面禁令、edge 禁 JDBC/repository、capability 单向依赖含 `session` 豁免)、frontend 幂等规则、code-layout 白名单化、security self-test 换变异对象、logging 正则收窄到值侧字面量。**每条必须在 scratchpad 拷贝上真实变异验红**——self-test 绿不算数(security 那条已证明 self-test 可以是 no-op)。

**最高性价比的一处**:`EdgeRouteRegistryCoverageTest` 增**反向断言**(runtime 路由集 − error/actuator 白名单 ⊆ registry)。它永久关闭"契约外端点"这一整类漂移,且每多一个 face(v7 的 terminal、v6 的 customer)价值线性上升、成本不变。当前 5 条契约外活端点(含无 workspace 作用域的运营登录 `/api/operations/auth/password-login`)就是它缺席的直接后果。

**执行体系**:补 L2/L3 执行器与 seed 执行器,否则五账永远有两账是空账;修 `scripts/verify` 的 6 次冷 Gradle;删两道关键词匹配门降为 checklist。

**从 v2 只搬四样**:L3 链路测试形态、`run-managed` 薄版、`test-discovery-evidence` 门、"DEV 默认不 seed / seed 走公开 API + owner readback"。**其余一律不搬**,尤其那 6,480 行治理机器与 1,008 行自比对 registry。

### 5.6 审计与「操作历史」(R-11,新增用户功能)

**性质变化**:审计从"零读者的仪式"变成**有用户消费者的业务功能**。这同时解决了 C 档里"6 张 audit 表零读者、`detail_json` 恒 `'{}'`"的问题——有人读,就不能再是空的。也印证了一条规律:**v2 那 9 张审计表里唯一没有腐化的,正是唯一有读者的那张**。

**用户任务**:实体详情页增加「操作历史」按钮 → 点击弹出**弹窗(Modal,非 Drawer)** → 显示该实体的全部审计历史。

**由此产生的硬要求(详设必须回答)**:

1. **审计行必须承载真实内容**。至少:`actor`(是谁,且要能显示成人可读的名字而非 UUID)、`occurredAt`、`action`(闭集,不是自由文本)、`target`(实体类型 + id)、**变更内容**(改了哪些字段、从什么到什么)。当前 `detail_json` 恒 `'{}'`、`account_id` 恒 NULL 的形态完全不可用。
2. **新增读 operation**,这会**改变 104 分母**——见下方"待确认"。
3. **渲染必须是人可读的**,不是裸 JSON。v2s 现有的"裸 JSON detail drawer"是已被点名的反模式,不得在此重现。字段名要用业务词(按 G-01~G-10 语料),不是列名。
4. **分页**:一个实体可能积累很多审计行,弹窗需要分页或"加载更多",不能一次全取。
5. **权限**:默认继承宿主实体的查看权限(能看这个实体就能看它的历史),**不新增第二套权限**——与扩展字段值的处理原则一致(v2 规格:「不得因扩展字段另造一套权限」)。
6. **保留策略**:审计行现在有用户面用途,**不能随意裁剪**;若将来要设留存上限,属产品裁决。
7. **写入时机**:审计与业务变更**同事务**写入(这正是表相对日志的核心价值——事务回滚则无记录、提交则必有记录)。
8. **哪些实体有这个按钮**:需要闭集,见下方"待确认"。

**与幂等的关系**:v2 的 `platform_admin_governance_audit` 兼作幂等回放源。v2s 的幂等走 `*_command_receipt`(A-4 修好后),两个职责分开,**审计表不承担幂等回放**。

**待 Dexter 确认的两点(详设前必须裁决,未裁决不得 GO)**:

- **(a) 哪个后台?** Dexter 原话是「运维管理后台,也就是运维管理员的操作界面」。v2s 的两个 App 是 `platform-admin`(平台后台,系统服务提供者/平台管理员)与 `operations-admin`(运营后台,商场运营方)。「运维」按字面更接近 `platform-admin`,而 v2 规格里确有「平台运维人员可在**运维管理后台**…」这样的措辞(与线框统一用的「平台管理后台」是同一处术语不一致,已在 v2 调研中记录)。**候选理解**:①仅 `platform-admin`;②仅 `operations-admin`;③两个 App 都要。**Claude 推荐 ③**——审计价值在两侧都成立(平台侧关心空间/管理员/角色变更,运营侧关心组织/门店/合同变更),且一次做完比将来补第二侧便宜;但这是产品裁决。
- **(b) 覆盖哪些实体、是否改分母?** 若按 ③ 全覆盖,实体约 12–15 类(集团空间、平台管理员、角色、账号、邀请、组织节点、品牌、经营主体、总公司、门店、合同、扩展字段定义…)。实现方式有两种:**统一一个 operation**(如 `getEntityAuditHistory?entityType=&entityId=`,+1 个 operation)或**逐实体一个 operation**(+12~15 个)。**Claude 推荐统一一个**——审计的读语义与实体类型无关,逐实体开接口是没有收益的重复。但无论哪种,**104 operation 分母都会变**,这是一次显式的范围扩张,需要 Dexter 认可后再改分母,不能由实现悄悄加。

### 5.7 已代裁、供否决的其余方向

节点 code 按 `node_type` 分别唯一(若将来要"按编码搜节点"须改回全局唯一);同状态转换**拒绝**;错误码 106 个**先接线再谈收敛**;两份 `problem.schemas.yaml` **统一到 R5 版**;不开 `required-inventory` 治理 batch;资产不要 `visibility` 列。

**注**:此前列在这里的"审计只对高风险命令写"已被 **R-11 取代**,改为 §5.6 的完整审计 + 操作历史功能。

## 6. 参考材料索引(Codex 详设时直接查)

| 需要什么 | 去哪看 |
|---|---|
| 登录/OTP 限流 | v2 `platform-iam-service/.../V2__platform_login_rate_limit.sql`、`workspace-iam-service/.../V15__…rate_limits.sql`、`V6__workspace_otp_attempt_limits.sql` + 对应 `*RateLimitPolicy.java` |
| 管理员保护 | v2 `platform-iam-service/.../V4__platform_admin_built_in.sql` + `PlatformAdminGovernanceService.java:96,119,127,129,155,211-216` |
| 幂等三段式 | v2 `platform-workspace-service/.../PlatformWorkspaceCommandReceiptRepository.java:19-64` + `V3__platform_workspace_command_receipt.sql:9-17` + `PlatformWorkspaceCommandFingerprint.java:25-51` |
| 资产 staging/claim/grant 校验 | v2 `PlatformAssetStagingService.java`(尤其 :230-236 grant 校验、:262-289 流式+magic bytes、:291-325 解码探针) |
| 资产存储抽象 | v1 `AssetObjectStoragePort`(有 `resolveUrl`)、v4 `AssetObjectStorage`(无 url)、v4s `BlobStorageClient`(返回 URL,形状最对) |
| 禁 bytea 的门 | v4 `tools/check-media-resource-internetization-redlines.mjs` |
| 扩展字段全套 | v2 `extension-service`(全 850 行)+ `V1__extension_definitions.sql` + `ExtensionDefinitionService.java:74-190` + 三个 owner 的 `*ExtensionValues.java` |
| 角色 JSON 存储与闭集 | v2 `workspace-iam-service/.../V1__workspace_roles.sql`、`V27__workspace_role_page_access_keys.sql`(**含 `DROP TABLE workspace_page_grant`**)、`WorkspaceRoleService.java:103-137`、`contracts/catalog/admin-catalog.yaml`、决策 `doc/decisions/2026-07-22-role-page-and-action-keys-share-role-json.md` |
| 前端 routing/session/feedback | v2 `platform-admin/src/app/routing/pageRegistry.ts:39-68`、`app/session/PlatformSessionBoundary.tsx:26-71`、`app/feedback/platformProblemFeedback.ts`(248 行,v2 前端最好的模块) |
| 前端 RTK 该抄的部分 | v2 `rtk-codegen.config.cjs`、`operations/baseApi.ts:15-24`(401 拦截)、`state/contextLifecycleListener.ts:10-28` |
| L3 测试形态 / run-managed | v2 `scripts/test/*-l3`(23 个)、`scripts/test/run-managed`(381 行)、`scripts/check/test-discovery-evidence`(61 行) |
| v2 的**反面**教材 | `scripts/check/permit-kernel` + `module-delivery-batch`(996 行)+ `tools/journey-design/cli.mjs`(2,110 行);`*JourneyTraceRegistry.ts`;`generatedProblemSemantics.ts` 与 `scripts/check/contract-owned-symbol-consumption:115-119` 那道自我满足的门 |

## 7. 守门方式(Claude 与 Dexter)

Codex 出详设后,Claude 按既有纪律 review:先从冻结输入独立推导预期行为再读作者结论;逐项核验 owner/transaction/data/security/consumer/failure/evidence oracle;方案合理性优先于闭环正确;`GO`/`NO-GO` + `M/S/N`;附 manifest Part B/C/D 章节命中表。**本册的每条问题都应在详设里有明确落点或明确的 `NOT_APPLICABLE` 理由**——遗漏即评审材料不完整。

**特别守门点**(本轮教训):①控制不得以 `PENDING` 跨越它守卫的工作;②证据不得用措辞改写完成判定;③self-test 绿不算数,必须真实变异验红;④凡"同类清理"必须闭集扫描全部出现处(`source` 清了三个实体却漏了总览页 query 参数,是本轮已发生的复发);⑤重构包的完成判定只能判形状,不能挂完备性分母(这是 Claude 上一轮定错、已自我更正的)。

## 8. 本册自身的诚实声明

- 两处 agent 结论经 Claude 亲验**证伪并更正**:`build-static.mjs` 不是构建路径(真构建是 `yarn typecheck && vite build`),只是孤儿脚本;`security --self-test` **不是假绿**而是大声报红(变异对象是 no-op)。
- 数字口径:表数、行数、零消费统计均为 2026-07-26 某时点实测。**Codex 正在做 R5 全范围收敛,收敛后必须重算**,不得直接采信本册数字。
- Claude 自认的两处错误已在册内标注:S2/S3 判定锚挂错完备性分母;执行指令红线 2 措辞过紧(已更正为"已执行 migration 字节不得改写;owner API 允许新增式演进")。
