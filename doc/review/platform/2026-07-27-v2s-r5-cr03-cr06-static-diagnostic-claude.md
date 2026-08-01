---
title: R5 CR03–CR06 静态全面诊断（Claude）
status: DIAGNOSTIC_ONLY_NO_VERDICT
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
reviewTarget: CR03_CR06_CURRENT_SOURCE_STATIC_DIAGNOSTIC
verdict: NOT_ISSUED
scope: 对照 2026-07-27 诊断件的闭合状态 + 简单性/健壮性/高效性/目录结构/架构五维诊断
authorizationBoundary: 只读静态诊断；本件不做 GO/NO-GO，不授权 CR07、DEV、seed、reset、远端或任何动态验证
---

# R5 CR03–CR06 静态全面诊断

## 0. 本件性质

**不做 GO/NO-GO 判断**（Dexter 指定）。只给：问题、位置、严重性、合理方案。

五路独立子 agent 并行扫描 + 作者对全部 M 级与冲突项亲验。本仓零写入（本文件除外），
变异实验在 scratchpad 仓库拷贝上做、用后即弃。**未做任何动态验证**——未启动 DEV、未跑 seed、
未连数据库、未启远端容器。因此凡涉及"运行时会发生什么"的结论均为**从代码结构推导的推论**，
已逐条标注。

## 1. 先说进展：这一轮的架构方向是对的

| 指标 | 上一份诊断 | 现在 |
| --- | --- | --- |
| generated wire 的 `Map<String,Object>` | 41/146 文件 | **0** |
| feature 消费 generated typed client | **0** | 全覆盖（feature 层 URL 字面量 **0**、`fetch` **0**，eslint `no-restricted-syntax` 兜底） |
| operations 编辑写路径 | **0 条** | PATCH 6 + PUT 1；前端 10 个 update/replace/invalidate/revoke/cancel 全接线 |
| operations feature 目录 | 1 个通用 registry | **15 个独立 feature** |
| 状态切换字段名正确率 | **0/9** | **9/9**（全部发 `targetStatus`） |
| pro-components / theme / zhCN locale | 全无 | 17 处 / 4 文件 / 两 app 均有 |
| admin catalog 生成链 | 不存在 | `contracts/catalog/admin-catalog.json` → 前端 `generatedAdminCatalog.ts` + 后端 `WorkspaceAuthorizationCatalog.java`，**同源同标注** |
| 跨 owner 未声明直读 | 5 条 | **0**（6/6 已声明） |
| `context.externalSubject()` 残留 | 3 处 | **0** |
| 最后管理员并发保护 | 仅行锁 | advisory lock + 行锁 + count |
| `items_json` JSONB / 旧表 | 未做 | 已迁移，旧表已 DROP，DROP 前有 typed precondition |
| 25 pageDesignKey 类型闭合 | 无 | 两份 `pageRegistry` 均 `satisfies Record<...PageDesignKey, ...>` 编译期穷举 |
| 8 张 legacy `*_audit` 表 | 零 writer 但未 DROP | 已 DROP，前置 typed precondition 齐备 |

上一份诊断里判为"完全缺失"的四项——平台改密、运营改密、门店档案、五个 `HOME-*`——**现在都建起来了**
（前三项有真实 typed endpoint 调用；`HOME-*` 无 client 调用是 manifest 明写的
`CARRY_ROUTE_BOOTSTRAP_ONLY` 策略，符合规格）。那份诊断写于 CR05/CR06 实施之前，
描述的是当时状态，**不是误报，是已闭合**。

架构方向的关键变化：`OperationsTransport.ts` 现在是「契约生成 `createOperationsAdminClient` +
`FaceOperationContracts`(operationId → {request,response})」，feature 调
`operationsClient.<operationId>(...)`；原来那个通用 `request(path, init)` 逃生舱**降级为内部传输原语
`wire`**，不再被 feature 直接使用。这是正确的形状，不是换皮。

## 2. Dexter 已裁决事项（本件按此写，不再列为待议）

| # | 事项 | 裁决 |
| --- | --- | --- |
| 1 | Problem 文案 | **跟 v2 一模一样的形式**（两份集中模块，见 §6.1） |
| 2 | RTK 架构 | **改成真 `build.query` + tag 体系**，不做最小改 |
| 3 | `InvitationsPage.tsx` | **删除**；连带 5 个 platform-face invitation operation **从 106 分母退役** |
| 4 | 通则 | **所有历史垃圾代码必须删除**（清单见 §7） |
| 5 | 两个集团空间页 | **跟 v2 一致，是两页**：一页管理所有集团空间；一页是**某个集团空间的数据总览，必须选中后才显示** |
| 6 | ProTable | **跟 v2 一致**（v2 实测 13 关 3 开，不是一刀切） |
| 7 | Drawer | **mask 可点击关闭**，但编辑抽屉必须有**统一 dirty guard** |
| 8 | 五个 `HOME-*` | **跟 v2 一样**做真内容，不留占位壳 |
| 9 | `database-operation-budget` 当前红 | **门对代码错**，修代码不改门；并入效率整改 |
| 10 | 切换器 | 按 v1/v2 形状补：右上角常驻任职切换器（不整页接管）、左下角数据范围切换器 |

## 3. M 级：功能性阻断（2 条，均已亲验）

### M-A1 ｜`ck_invitation_status` 闭集与代码实际写入不符，公开邀请全链在真实库上跑不通

**位置**：`db/migration/V20260727_020000_000__named_status_and_organization_name_constraints.sql:48`

| | 值 |
| --- | --- |
| CHECK 允许（5） | `PENDING` `CONSENTED` `COMPLETED` `CANCELLED` `EXPIRED` |
| 代码真写入 `workspace_iam.invitation`（8） | `PENDING` `ACCEPT_INTENT_RECORDED` `MOBILE_VERIFIED` `CREDENTIAL_READY` `COMPLETING` `COMPLETED` `CANCELLED` `REISSUED` |

**5 个值会被 CHECK 拒绝**：`ACCEPT_INTENT_RECORDED`(`WorkspaceInvitationService.java:272`)、
`MOBILE_VERIFIED`(`:311`)、`CREDENTIAL_READY`(`:323`)、`COMPLETING`(`:399`)、`REISSUED`(`:226`)。
反向：`CONSENTED` 与 `EXPIRED` 在闭集里但代码从不写入——闭集是照旧语义写的。

**严重性**：阻断。接受意向 → 验手机 → 建凭据 → 完成，每一步都 `check_violation`；管理端重发同样。
邀请链是 seed 建任职的主路径，直接影响 Dexter 已裁决的 seed 量级目标。

**为什么静态全绿**：约束加于 2026-07-27 16:07，而 `libraries/backend/workspace-iam/build/test-results/`
mtime 为 **07-26 06:23**——约束加入后没有任何 owner 模块测试被重跑。绿灯是约束加入前的陈旧字节。

**方案**：以 `WorkspaceInvitationService` 为唯一分母补齐闭集。**不得反过来改代码迁就 migration**
（那会动已上线的状态语义）。同轮补一条 focused test，并把「加约束类 migration 必须重跑对应 owner 测试」
写成纪律——这是本轮暴露的过程缺口，不是个案。

### M-A2 ｜门店启停仍是死路，跨 CR03–CR06 四个包未修

**位置**：`libraries/backend/organization/.../BusinessEntityService.java:127`

`transitionEntityStatus` 首行 `String type = entityType(entityType);`，而 `:32` 的
`ENTITY_TYPES = Set.of("BRAND","TENANT","HEAD_COMPANY")` 不含 `STORE`，`:348` 不在集合内即抛
`OrganizationValidationException`。同文件 `:281`/`:288` 早已用
`"STORE".equals(entityType) ? "STORE" : entityType(entityType)`，`table()` 也支持 `STORE`
——**只有状态切换这一条路径漏改**。调用方 `OperationsStoreManagementController.java:55` 明确传 `"STORE"`。

**严重性**：阻断。运营端点门店启停必然失败。

**方案**：`:127` 改为与 `:281` 同一表达式（一行）。不建议把 `STORE` 塞进 `ENTITY_TYPES`——会连带
改变若干只针对三类实体的语义。**必须同时补 focused test 并证明修复前为红**：这条路径的特征恰是
"前后端都写了、从没端到端跑通一次"，它从第一份诊断报到现在跨了四个包。

## 4. M 级：门与证据体系（3 条，均已亲验）

### M-B1 ｜self-test 的自我豁免没有被删除，换到了更隐蔽的位置

**位置**：`tools/verify-gates/cli.mjs:446-460` 的 `prepareSelfTestClean()`

CR00 声称删除的 `cli.mjs:282` 的 `if (action !== "frontend")` 确实删了。但新增函数**在自测前改写被测的
生产源码**，制造一个能通过的干净基线：

- `logging`：把硬编码密钥 `"test-workspace-rate-limit-secret"` 替换成 `System.getenv(...)`
- `budget`：把 `FOR UPDATE` 替换成 `FORUPDATE`
- `affected-l2`：**直接把 18 个不存在的 L2 spec 文件建出来**

实测：

```
logging-boundaries            → R4_GATE=FAIL   (敏感字面量)
logging-boundaries --self-test → R4_LOGGING_SELF_TEST=PASS
```

**严重性**：最高。这比原来的豁免更严重——原来是"跳过某个 action"，现在是"编辑代码制造通过的基线"，
使自测**在结构上永远不可能反映生产真相**。而 self-test 正是整个 red-first 协议的执行载体。

**方案**：删除 `prepareSelfTestClean()`。正确形态是 **baseline 必须是未经改写的当前树，
baseline 不绿即整体 FAIL**——这样 `logging-boundaries` 与 `affected-l2` 当下的真红会立刻暴露，
而不是被自测洗白。`tools/code-layout/cli.mjs:174,185,195` 的 `mkdtempSync()` 空目录基线同理换成仓库拷贝
（空目录做基线时，任何"必须存在"类断言都无法被红变异证伪）。

### M-B2 ｜`standards-coverage` 仍识别不出被引用门被替换为 `exit 0`

**位置**：`scripts/check/standards-coverage`

作者复现了第一份诊断里做过的同一个变异：把 `scripts/check/security-boundaries` 整体替换为
`#!/usr/bin/env bash\nexit 0`，`standards-coverage --phase R5` 依然输出 `PASS / RULES=150`。

**严重性**：高。矩阵引用 15 个门但从不执行它们。现成反例：矩阵引用的 `logging-boundaries`
当下是真红，矩阵照绿。CR00 声称已修，**实测未修**。

**方案**：对每个被引用门跑一次已知红夹具调用，任一门不能被打红即整体红。
**必须先证明它能拒绝 `exit 0` 桩再算数**——这正是它上一次没做到的事。

### M-B3 ｜`affected-l2` 门当前是红的，且其分母与仓库布局脱节

**位置**：`contracts/policy/affected-l2-registry.json`

```
R4_GATE=FAIL
REASON=R5_AFFECTED_L2_TARGET_MISSING:apps/frontend/operations-admin/src/tests/l2/authentication.spec.ts
```

作者独立重算：registry 的 30 条 `paths` 中 **12 条指向不存在的目录**，全是 v2 旧命名
（`platform-admin-governance/`、`workspace-overview/`、`organization-overview/`、`contract-overview/`、
`role-management/`、`workspace-account-management/`、`extension-field-management/`、
`organization-hierarchy/`、`business-entity-management/`、`user-management/`、
`app/session/`、`OperationsAdminSeed.tsx`），而 v2s 实际是 `platform-administration/`、
`workspace-administration/`、`workspace-iam/`、`organization-contract-overview/` 等。

声明的 23 个 L2 target 中 **18 个文件不存在**；两个 app 的 `package.json` `test` 仍只跑
`src/tests/architecture/*.test.mjs`，**无 `test:l2` 脚本**。

**严重性**：高。即使 L2 spec 全部补齐，这 12 个 surface 的改动也永远不会被 affected 选中。
而 CR06 exit 写着 `status: PASS` + `fullComplianceScan: PASS`。

**方案**：`paths` 改成 v2s 现行目录（纯文本替换）；L2 target 要么建文件要么从 registry 删除声明
——**registry 声明不存在的 target 是"声明即完成"的典型假绿**，两条路都行但不能维持现状。

## 5. M 级：安全与健壮性（6 条）

### M-C1 ｜原始邀请令牌明文持久化进 receipt，并被无 scope、无状态过滤的查询无限期复活

**位置**：`WorkspaceInvitationService.java:107`（readback 带原始令牌）→
`WorkspaceIamCommandReceiptService.java:47`（整个 readback 序列化进 `response_json`）→
`WorkspaceInvitationService.java:455-465`（反向从 receipt 捞回）→ `:157-159` 拼成 `invitationPageUrl`

三个问题叠加：
1. **一次性凭据被明文持久化**，且代码是**依赖**这份明文工作的，不是意外泄漏
2. `WHERE response_json->>'id'=?` **无 workspace / group_workspace_key 谓词**——靠 UUID 不可猜，不是靠授权
3. **无状态/过期过滤**：`CANCELLED`/`EXPIRED`/`COMPLETED` 的邀请一样能把当初的活令牌重新渲染成可点链接

**对比双标**：`platform_asset` 明确不存 `bindGrant`（`PlatformAssetService.java:82`），且有 DB 级
`ck_asset_receipt_response_no_bind_grant`（`V20260727_010000:147`）兜底。同一原则在 workspace_iam 侧反着做。

**方案**（最小 → 完整）：`create` 的 receipt 序列化前置空 `rawInvitationToken`（用不含该字段的 receipt DTO），
给 `workspace_command_receipt` 加对齐的 CHECK；管理端链接只在**创建命令的同一响应**里给出一次。
若产品要求"管理员可随时重新取链接"，应走已存在的 `reissue`(`:219`) 重新签发，**而不是复活旧令牌**。
**需 Dexter 一句裁决**：管理员是否需要在创建后重新获取同一条邀请链接（Journey 语义，决定选哪条）。

### M-C2 ｜授权拒绝返回裸 500，且 19 个已声明异常无 Problem 映射

**位置**：`OperationsWorkspaceMembershipController.java:51`、
`OperationsWorkspaceInvitationCandidateController.java:39` 的 `AccessDeniedException`；
全仓唯一 `@RestControllerAdvice` 在 `edge/problem/ContractProblemAdvice.java:35`，两者均未被覆盖。

未映射清单含**乐观锁冲突这条主路径**：`PlatformAdminVersionConflictException`（在 `apps/backend` 全目录零出现）、
`LoginNameConflictException`、`InvalidAdministratorInputException`、`AssetClaimRejectedException`、
`AssetIdempotencyConflictException`、`InvitationStateException`、`OtpInvalidException`、5 个 `*ReceiptCorruptException` 等。

**触发**（推论，未运行验证）：两名平台管理员同时编辑同一账号 → 500；创建重名登录名 → 500；
密码少于 8 位 → 500；任何角色越权访问五张会员页 → 500。

**严重性**：高。非 `application/problem+json`、无 errorCode、无 correlationId；前端折叠成 `NETWORK_ERROR`。
Spring 默认错误页还可能泄漏内部信息。

**方案**：advice 补 403 分组与一个 `@ExceptionHandler(Exception.class)` typed 兜底。
**兜底必须有**，否则每加一个 owner 异常就多一个裸 500。同类：`OrganizationHierarchyService.java:63-66`
的 INSERT 无 `DuplicateKeyException` 捕获（同仓其余 7 处都有），组织节点重复编码 → 裸 500 且泄漏约束名。

### M-C3 ｜`extension` 与 `platform_asset` 的幂等在并发下不成立（两路交叉印证）

**位置**：`ExtensionCommandReceiptService.java:26`、`PlatformAssetService.java:62`
——`SELECT ... WHERE idempotency_key=? FOR UPDATE`

Postgres 的 `FOR UPDATE` 只锁**返回的行**；首次使用时该行不存在，两个并发事务都拿不到锁、
都执行 `command.get()`（真实业务写）、都 INSERT，后者撞主键 → `DuplicateKeyException` 未映射 → 裸 500，
客户端收到 500 还会重试。asset 侧还可能已产生对象存储写入。

**同仓其余 6 个 receipt service 全部用 `pg_advisory_xact_lock(hashtext(key))`**
（`WorkspaceIamCommandReceiptService.java:29`、`WorkspaceCommandReceiptService.java:30`、
`OrganizationHierarchyCommandReceiptService.java:32`、`BusinessEntityCommandReceiptService.java:37`、
`PlatformCommandReceiptService.java:24`、`ContractCommandReceiptService.java:21`）。
**这两处是偏离既有正确写法，不是没想到。**

**方案**：各加一行 advisory lock，与其余 6 处完全一致。这同时消解 Dexter 已裁决的
`database-operation-budget` 红（门对代码错）。

### M-C4 ｜内容寻址对象的回滚删除会删掉另一个成功请求正在用的对象

**位置**：`PlatformAssetService.java:74`（`objectKey` 完全由内容 SHA-256 决定）与 `:83-88`（失败时 `objects.delete`）

**交错**（推论）：两个 workspace 上传同一张图 → 同一 `objectKey`。A 成功提交并被 `staged_asset` 引用；
B 因任意 `RuntimeException`（含 M-C3 的重复键）走 `:84` 删除 → **A 的资产指向已被删除的对象**。

**方案**：回滚只在"本次确实新建了对象"时删除（先 `exists` 判定），或改用 per-assetRef 对象键。

### M-C5 ｜MinIO 上传全程占用数据库连接，且客户端无超时

**位置**：`PlatformAssetService.java:55-56` 方法整体 `@Transactional`；`:58` 读完整上传流 + `ImageIO.read`(`:166`)；
`:79` `objects.put(...)` 是网络调用。`MinioAssetObjectStorage.java:31` 建 client 时**无任何超时配置**。
更进一步：`requireActivePublicReference` 的 `objects.exists()`(`:121`) 发生在 `@Transactional(readOnly=true)` 的
**ResultSetExtractor 内部、游标未关闭时**。

`application.yaml` 无任何 `spring.datasource.hikari.*` → HikariCP 默认池 10 连接、无 statement timeout。

**推论**：10 个并发上传（图片上限 5 MB，`MAX_VIDEO_BYTES` 为 512 MB）即耗尽连接池，整个后端 API 停摆。

**方案**：内容落盘/校验/`objects.put` 移出事务，事务只覆盖 DB 写；给 MinioClient 设连接与读写超时。
HikariCP 池与超时配置按仓内标尺属生产化欠账，进 `HANDOFF.md`。

### M-C6 ｜前端 401 处理完全不存在

**位置**：两个 app + foundation 全量 grep `401|unauthorized|SESSION_EXPIRED|resetApiState|AbortController`
**零命中**；`observedBaseQuery.ts:59` 只记日志并原样返回 error。

**触发**：8 小时会话过期（`PlatformAuthenticationService.java:27`）、管理员被停用触发 `:179` 会话撤销、
密码修改触发 `:128` 全量撤销。

**后果**：用户停在当前页，每个操作弹通用错误，不跳登录、不清缓存。登出也不清 RTK store
（`OperationsApp.tsx:99`、`PlatformApp.tsx:42` 只清本地 `useState`）。

**方案**：在 `createObservedBaseQuery` 统一拦 401 → 清会话 + 跳登录。**一处改动覆盖两个 app。**
与 Dexter 已裁决的 tag 化一并做（`resetApiState` 是同一套机制）。

## 6. M 级：UI、交互与 v2 吸收（4 条）

### M-D1 ｜286 个错误码全部塌缩成一句固定中文（Dexter 已裁决照 v2）

**位置**：`OperationsTransport.ts:104` / `PlatformTransport.ts:80`，唯一分支
`detail: '请求未完成，请根据错误码检查后重试。'`

错误码总量：operations-edge 139 + platform-edge 110 + public-edge 37 = **286**，无一进入映射。

塌缩还不均匀：platform 侧 **9 处连 errorCode 都不显示**（`WorkspaceScope.tsx:22`、`RolesPage.tsx:87`、
`AccountsPage.tsx:78`、`ExtensionsPage.tsx:96`、`AdministratorsPage.tsx:108`、
`WorkspaceAdministrationPage.tsx:73`、`PlatformReadPage.tsx:59`、`InvitationsPage.tsx:62`、
`WorkspaceManagementPage.tsx:85`），而 `PlatformLoginPage.tsx:15`、`PlatformPasswordChangeDrawer.tsx:51`
又拼了 errorCode——**同一个 app 内两种做法**。局部 `issue()`/`failureMessage()` 有 **10 份副本**，
`${errorCode}：${detail}` 拼接 **20 处 / 20 文件**。`correlationId` 已在 `OperationsTransport.ts:106`
解析出来，除登录页外从不展示；platform 侧的 `ApiProblem` 干脆丢掉了 `correlationId` 与 `status`。

**Dexter 裁决：跟 v2 一模一样的形式。** v2 实测两份模块共 381 行：

- `operationsProblemFeedback.ts`（133 行）：`OperationsMutationContext`（18 个操作上下文联合类型）、
  `revisionConflictCodes`（7 码集合）、`feedbackForOperationsFailure(failure, context)` 按
  `PlatformVersionConflict` / 依赖不可用 / 权限不足 / 校验失败**四段分级**产出
  `{title, level:'warning'|'error', message, correlationId}`；版本冲突 → warning +
  **「资料版本已变化，请刷新后重试。」**（可执行动作，不是"请检查"）
- `platformProblemFeedback.ts`（248 行）：`PlatformFeedback` 是**三态判别联合**
  `{kind:'alert'}` / `{kind:'field', field:'accountName'|'password'}` / `{kind:'restricted'}`；
  字段级错误直接路由到表单字段；`retryAfterSeconds` 从 429 响应取出并插值；
  `platformReadResultStatus()` 给只读页四态降级

**四件事缺一不可**：每 app 一份集中模块；按操作上下文取标题；按错误类别分级 + 给可执行建议；
字段级错误路由到字段。配套：v2 还有可展开的 `errorCode / correlationId / status / operation` 四行诊断。

### M-D2 ｜platform 有 6 个页面需要选中集团空间，但没有全局选中态

**v2 的做法**：`workspaceRequirement` 是 **catalog 的一等字段**——8 个 platform 页中
**6 个 `REQUIRED`**、2 个 `GLOBAL_OR_OPTIONAL`。选中态在 Redux
（`state.platformWorkspaceContext.workspaceKey`），`PlatformShell.tsx` 用它做四件事：
`:47` **未选时 REQUIRED 菜单项置灰**；`:113` **阻止导航**；`:71-75` 空间切换时 dispatch
`workspaceContextChanged` 做**缓存扇出失效**；`:79-84` 给页面注入 workspace 上下文。
每个 REQUIRED 页未选时渲染 `<Result status="info" title="请先选择集团空间" .../>`。

**v2s 现状**：`WorkspaceScope.tsx` 是**页面局部组件**——自己 `useState` 存选中 key、
自己 `listPlatformGroupWorkspaces({}, {})` 拉**全量无分页**列表，被 **5 个页面各包一层**
（Roles / Accounts / Invitations / Extensions / PlatformRead）。

四处错：
1. **选中态不跨页保持**——切页就要重选
2. **每切一次页面重发一次全量拉取**——5 份，无分页上限
3. **菜单不置灰、不拦导航**——`PlatformApp.tsx` 里 `disabled` 只用在头部按钮
4. **切换空间无缓存扇出**

而 `contracts/catalog/admin-catalog.json` 里 **`workspaceRequirement` 出现 0 次**——不是前端漏接，
是**语义源缺字段**。

**方案与顺序**：catalog 补 `workspaceRequirement` → 选中态提到 store → Shell 接菜单置灰与导航拦截 →
tag 化并接 `workspaceContextChanged` 扇出。**catalog 那一步必须先做**，否则前端又要手写一份
"哪些页需要选空间"的第二语义源。

**这条使 Dexter 的 tag 化裁决更划算**：`workspaceContextChanged` 扇出、`WorkspaceScope` 重复拉取、
写后重拉，三件事会被同一套 tag 机制一次解决。

### M-D3 ｜两个集团空间页的写能力装反了

| 页 | 冻结 `focusedEvidence` 要求 | 实际实现 |
| --- | --- | --- |
| `PLATFORM-WORKSPACES`（集团空间管理） | `workspace-list-create-detail-**edit-status**-logo-commercial-group` | create / initializeCommercialGroup / stageAsset / list ——**无 edit、无 status** |
| `PLATFORM-WORKSPACE-OVERVIEW`（集团空间总览） | `workspace-overview-owner-task-read-**no-projection**`（明写只读） | **transitionStatus / updateDisplay** ——两个写操作都在这 |

**冻结契约要求的和实现完全对调。** 按 Dexter 裁决（总览 = 某个集团空间的数据总览、必须选中后才显示），
它**根本不该有写能力**——`no-projection` 就是这个意思。

**方案**（三件事，不是一件）：`edit`/`status` 搬回管理页；总览页改成 v2 形状（选中制 + 未选空态 +
只读该空间概览，**去掉全量列表**）；Card 标题与 catalog 对齐（当前写死"集团空间管理"，
与 catalog 的"集团空间总览"冲突且与另一页撞名）。

### M-D4 ｜运营 shell 的两个切换器形态缺失

| | v1 | v2 | v2s 现状 |
| --- | --- | --- | --- |
| **右上角** | `actionsRender` 挂 `MembershipSwitcher` + `avatarProps` 头像下拉 | shell 内常驻 role Select | **一个"切换任职"文字按钮** |
| **左下角** | `menuFooterRender` 挂 `DataNodeSwitcherPort` | 级联 Cascader（REGION/PROJECT/STORE 深度） | **空的** |

v1 的 `DataNodeSwitcherPort` 带六个能力，v2s 一个都没有：`workScopeMode`、`selectorPolicies`、
`visibleLevels`（按当前任职决定哪几层可见）、`dirtyGuard`、`storageScopeKey`（按页面记忆）、`depthTestId`。

三条具体缺口：
1. **左下角切换器不存在**——v1/v2 都放侧栏底部常驻，v2s 塞在 header 且是 Drawer
2. **数据范围无层级概念**——`ContextSelector.tsx:19` 拉整个集团空间的 `/hierarchy` 再按
   `status === 'ENABLED'` 过滤，**不按当前任职可见范围过滤**；用户能看到无权选的节点，选了才被服务端拒绝
3. **切换器无 dirtyGuard**——v1 连切换器都接了（表单填一半时切范围会先确认）

另：`RoleAssignmentSelector.tsx` 只有 13 行且在 `OperationsApp.tsx:104` 是**整页接管**
（`if (entry && (!session || switchingRole)) return <RoleAssignmentSelector .../>`），
切任职时当前页被整个替换，切完回到哪里没有保证。v1/v2 都是 shell 内就地切换，页面上下文不丢。

**v4 形态本轮 `UNVERIFIED`**（umi + plugin-layout，与 v1/v2 不同源），已另派专项对照，结论后补。

## 7. M 级：效率（4 条）

> Dexter 已裁决：必须整改后台效率。以下按"收益/成本"排序。

### M-E1 ｜热点外键零索引（最便宜、收益最大）

全库仅 **9 条 `CREATE INDEX`**，其中 6 条是 `audit_event`（这批列序精确匹配查询，**做得对**），
其余 3 条是 grant / rate-limit。**业务热点外键一条都没有**（Postgres 外键列不自动建索引）：

| 表 | 谓词 | 出处 |
| --- | --- | --- |
| `workspace_iam.role_assignment` | `account_id=?` | `WorkspaceMembershipService.java:51` |
| `workspace_iam.role_assignment` | `(service_node_type, service_node_id)` | `:42,:43` |
| `contract.store_contract` | `store_id=?` | `ContractTaskReadService.java:33,35,64` |
| `organization.store` | `project_id=?` | `:56,:57` |
| `organization.store` | `head_company_id=?` | `BusinessEntityService.java:235` |
| `workspace_iam.password_reset` | `account_id=?` | `WorkspaceMembershipService.java:53` |
| `platform_iam.platform_session` | `platform_admin_id=?`（相关子查询） | `PlatformAuthenticationService.java:286` |

**方案**：一个 additive migration 补 7 条索引。分钟级、零风险。

### M-E2 ｜门店列表是 O(N²)：单次 page-1 请求可产生数万条 SQL

链路（逐个亲验）：
- `OrganizationOverviewTaskReadService.java:20-21` `page()` 先 `items(...)` 拉**全量**再 `subList`
  内存切片——**不是服务端分页**
- `:27-29` `detail()` **同样调 `items(...)` 拉全量**再 Java 过滤找一条
- `OperationsStoreManagementController.java` 的私有 `store(...)` 对**页内每一行**调 `overview.detail(...)`
- `:54-59` `storeItems` 每行调 `nodePath(project.id())`；`:64-72` `nodePath` 逐层父节点单查
- `ContractTaskReadService.java:33,35` `derivedStoreStatus` 每行 2 条 COUNT

**量级**：pageSize=20 时约 `61N + 81` 条 SQL；N=500 → **约 30,600 条**。

**方案**：`overview.page` 改真分页（LIMIT/OFFSET）；`store()` 不再逐行重取 detail
（列表查询已 JOIN 出 project/brand/tenant/head）；`derivedStoreStatus` 改按 store_id 分组的批量查询。

### M-E3 ｜角色读取把 JSON 解析外包给数据库，每行 3 次往返，且每个已认证请求都会触发

`WorkspaceRoleService.java:93-96`：`require()` 查完角色行后，为 `page_access_keys` 与 `capability_keys`
各发一条 `SELECT jsonb_array_elements_text(CAST(? AS JSONB))`——参数是**刚从同一行读出的字符串**，
纯粹为解析 JSON 多打两次 DB。`:88` `list()` 是 `SELECT id` 后逐行 `require()` → **1 + 3N**。

**放大**：`WorkspaceAuthenticationService.java:121` 的 `session()` 每次调 `roles.require(...)`，
而 `session()` 在**每个已认证请求**上都跑（`OperationsSessionResolver.java:29`）。
写请求还会因 `requireActor`(`:41-43`) 整体再来一遍——同一请求内解析两次会话。

**方案**：用 Jackson 在 Java 侧解析（0 次额外往返）；`list()` 单条批量映射；
`session()` 结果在请求作用域内缓存一次。

### M-E4 ｜Drawer 打开期间的无限请求循环

`useDrawerFormLifecycle.ts:196-210` 返回的是**每次 render 新建的对象字面量**（无 `useMemo`）。
三处把整个 `lifecycle` 放进 effect deps 且在 effect 内发请求：`StoreManagementPage.tsx:154-161`、
`ContractManagementPage.tsx:194-201`、`HeadCompanyManagementPage.tsx:208-215`。

**交错**：effect 发请求 → `setCandidates(data)` → render → `lifecycle` 新身份 → effect 重跑 →
`setCandidates(undefined)` → render → 再发请求。**只要抽屉开着就持续打接口**，
且 `form.setFieldsValue` 反复覆盖用户正在输入的内容。

**方案**：foundation 里 `useMemo` 稳定返回值——**一处修复覆盖全部调用点**。

**其余效率项**（S 级，摘要）：会员列表 `2 + P×(4+A)` 含 60 次递归 CTE；合同总览无分页上限（1+N，N 无界）；
平台管理员列表伪分页 + 每行 2 个相关子查询；`OrganizationStructurePage` 拉整棵树且 `pagination={false}`；
`WorkspaceScope` 被 5 条路由各自重发；单包 1.9 MB 无 `manualChunks`、无 `React.lazy`。

## 8. S 级（摘要，按维度）

**安全**：密码重置的 `requireMobile` 在限流**之前**（持券方可无限猜手机号且不计数）；
登录 OTP 缺 SOURCE 维度限流且账号不存在时零记账（可匿名枚举 workspace 内手机号）；
OTP 限流 subject 用 `reset.id()` 而非 `account.id()`（每次重新发起即清零）；
生产 OTP 响应体返回 `testCode`（`OperationsCatalogAuthenticationController.java:36` 等 3 处；
前端不回显且有静态断言，但**没有任何门禁住服务端不返回**）；
宿主 detail 读在授权之前构成存在性 oracle（404/403 差异可探测实体存在）。

**健壮性**：8 个平台列表页 `loading={!result}` 失败后**永久转圈**；换页失败同时丢上一页数据、
卡 loading、页码不回滚；十余处裸 promise + `setState` **无 generation guard**（迟到响应覆盖新结果）；
**全仓无 React Error Boundary**；登出请求失败则会话永远清不掉；
`WorkspaceMembershipService.java:52` 用 `mobile_normalized` 关联邀请历史而非 `account_id`（改绑后错位）。

**证据**：CR05/CR06 **无任何 compile/typecheck/test receipt**（CR03/CR04 都有；作者代跑：
两 app `tsc --noEmit` 退出 0、8 个 arch test 全绿——**不是坏了，是没记账**）；
CR05/CR06 声明 `ACTIVE_RED_VERIFIED` 但**无红变异产物**（cr02/cr03/cr04 都有）；
`actualChangedPaths` 不是从工作树导出（`2026-07-24-v2s-execution-roadmap.md` 磁盘 hash 与 CR04 记账不符
且 CR05/CR06 未再记）——**这直接削弱 set equality 的意义：两个数组相等，但可能同时漏了同一批文件**；
21/22 surface 零 L2 证据；`cr06-static-surface-and-page-key-closure.json` 名为 closure，
实际只绑定 49 个运行时文件中的 22 个（Tenant/HeadCompany/InvitationPanel/两个 AuditModal 都在外面）。

**简单性**：`audit-history` Modal 两份 76% 相同、`PasswordChangeDrawer` 两份 80% 相同
（`fieldLabels` 词表已分叉，交集仅 6 个 key）；写后刷新**三种做法并存**（直调 `load()` / 计数器 /
无 `useCallback` 的空依赖 effect）；`contextScopedQueryArgs` 三个生产调用点**全是恒等调用**
（多数 feature 绕过该抽象直接读字段）；`queryContext` 在 Shell render body 里每次重建（未 `useMemo`），
`StoreProfilePage` 因此每次 Shell 重渲染都重复发两个请求。

**UI**：`loading={!x}` 残 **18 处**（其中 9 处是列表 Table）；`pagination={false}` 残 5；
`window.alert` 残 1（`PublicInvitationEntry.tsx:29`）；**动态扩展字段仍未通电**——`extensionValues: {}`
硬编码 5 处，定义已拉取、版本已回传，只差按 definition 渲染表单并回收值；
`RolesPage.tsx:41` 创建角色时能力硬编码空数组，必须创建后再编辑一次才能授权（两步走）；
platform 侧只有 2 个文件接 `useDrawerFormLifecycle`，`RolesPage.tsx:110` 编辑 Drawer 直接
`setEditing(undefined)` **丢弃填写内容**。

**门**：`database-boundaries` 的 `bytea/base64/object_key/bucket_name` 控制**仍不存在**
（向 migration 追加 `ADD COLUMN blob_data bytea` 后仍 PASS）；`security-boundaries` 只校验 resolver
类名在**文件**里出现（把 `sessions.requireWorkspace(...)` 换成 `null` 仍 PASS），
且 `expected.length !== 106` 是**新的硬编码分母**；无 `gradlew`、无 `gradle/wrapper/`；
`verify.mjs:26` 仍硬编码 `unix:///Users/dexter/.colima/...`（本机为 `dextery`）
且从不引用 `scripts/test/r5-remote-testcontainers.mjs`；cleanup 只在全绿后执行、首败即被跳过。

## 9. 死代码清单（Dexter 通则：所有历史垃圾必须删除）

| 项 | 位置 | 说明 |
| --- | --- | --- |
| `InvitationsPage.tsx` | `platform-admin/src/features/workspace-iam/ui/` | 90 行，全仓零引用；**已裁决删除**，连带 5 个 operation 从 106 退役 |
| `src/main.js` ×2 | 两个 app | R3 遗留原生 JS，`index.html` 指向 `main.tsx`；**且被 gate 反向锁死**（删掉门会红） |
| `static-boundary.test.mjs` | operations-admin | 断言分母里 1/3 是上述死文件 |
| `scripts/build-static.mjs` ×2 | 两个 app | 全仓零调用者，仍在拷贝 `main.js` |
| 旧 `WorkspaceRoleCatalog` | `libraries/backend/workspace-iam/build/tmp/` | 编译残留；src 里已改名为 `WorkspaceAuthorizationCatalog` |
| `proLayoutNavTheme` | `platformAdminTheme.ts:7` | 全仓零消费者 |
| `platformHttpProtocol` | foundation `index.ts:12` 导出 | 两 app 零消费（v2 也零消费），可从公共 API 收回 |
| 仓库根空目录 | `components/`、`paths/` 共 13 个 | codegen 用错 cwd 的残留，未入库 |
| `src/app/api/client/` | platform-admin | 空目录，却正是 frontend 门为"唯一传输层"开的豁免口 |

## 10. 一个教科书级的假绿，值得单独记

`cr06-write-capability-closure-problem-family.json` 定义的问题族原文是
「**a frozen write operation can exist while users have no approved UI path that invokes it**」
——它就是为了防"写能力不可达"而建。它的 `searchQueries` 含 `createWorkspaceInvitation`，
`searchedSurfaces` 第 13 项正是 `InvitationsPage.tsx`。

结果：**grep 命中调用文本就判定"已消费"**，而那个文件全仓零引用、页面不可达。
守门器精确地落进了它自己命名的陷阱——因为它验的是"代码里有没有这个字符串"，
不是"用户有没有路径走到它"。

**方案**：不要新建"可达性 checker"这种基建。一条
`assert.match(pageRegistry源码, /InvitationsPage/)` 级别的静态断言即可——
把"被 pageRegistry 或 App 引用"作为 targetPath 的必要条件，纯机械、可红变异。

## 11. 作者错误披露

本轮作者出现四次错误，三次被对方或子 agent 纠正：

1. **「27 个 feature 文件仍手写 `/api/`」是误报**——grep 匹配到的是 import 路径
   （`from '../../../app/api/OperationsTransport'`）。实测 feature 层 URL 字面量 **0**、`fetch` **0**，
   且 eslint 主动禁止。据此得出的「typed client 与手写路径并存」结论**不成立，已收回**。
2. **`approvedAssertions` 报 27，实为 26**（此前 cycle）。
3. **project-memory assertion 报 62，实为 71 occurrences / 69 unique**（此前 cycle）——
   只数了正文 `- \`NAME\`` 形态，漏掉四个只在 frontmatter 声明的文件。
4. **上一份诊断的「四项完全缺失」现已闭合**——那份写于 CR05/CR06 之前，是时点问题不是误报，
   但本件必须如实记功。

**失效模式一致**：作者对"这条断言对不对"可靠，对"这个集合是不是全的"不可靠。
四次错误全部属于**分母/集合完备性**，不是证据核验。因此本件所有分母类结论
（286 错误码、9 条索引、61N+81、18 个缺失 L2、12 条脱节 path、49 vs 22）
均已用独立脚本重算，且建议由 Codex 用机械枚举独立复算一遍再采信。

## 12. 建议的修复顺序

按依赖与"收益/成本"排序，不是优先级清单：

```
1. 功能阻断（各一行/一处，立即可修）
   ck_invitation_status 闭集 · 门店启停 STORE 特判
   → 各补一条 focused test 并证明修复前为红

2. 门的真实化（在此之前任何"门全绿"都不该作为证据）
   删 prepareSelfTestClean · standards-coverage 能拒绝 exit 0 桩
   · affected-l2 path 对齐 v2s 布局 · code-layout self-test 改仓库拷贝

3. 安全（与 1/2 无依赖，可并行）
   邀请令牌不入 receipt · Problem advice 兜底 + 403 分组
   · extension/asset 换 advisory lock · 401 统一拦截
   · 重置限流前置 · 登录 OTP 补 SOURCE 维度

4. 效率（分钟级到小时级，收益最大）
   补 7 条索引 · useDrawerFormLifecycle 加 useMemo（一处修三处循环）
   · 门店列表去 O(N²) · 角色 JSON 改 Java 侧解析

5. 语义源与架构（Dexter 已裁决，顺序不可颠倒）
   catalog 补 workspaceRequirement → 选中态提到 store → Shell 菜单置灰/导航拦截
   → RTK 改 build.query + tag（同时解决 workspaceContextChanged 扇出、
     WorkspaceScope 重复拉取、写后重拉、401 resetApiState 四件事）

6. UI 与 v2 吸收
   Problem 文案照 v2 两份模块 · 两个集团空间页写能力归位 + 总览改选中制
   · 切换器按 v1/v2 补（右上角常驻 + 左下角层级 + dirtyGuard + 按页记忆）
   · maskClosable 放开 + 统一 dirty guard · ProTable 按 surface 定（v2 是 13 关 3 开）
   · 扩展字段通电 · 五个 HOME 照 v2 补

7. 死代码清除（§9 全表）

8. 证据补记
   CR05/CR06 补 compile/typecheck receipt 与红变异产物
   · actualChangedPaths 改为工作树差集导出
   · L2 target 要么建要么从 registry 删
```

## 13. 授权边界

本件为静态只读诊断，**不做 GO/NO-GO**。不授权 CR07、DEV、seed、reset、远端运行、
Testcontainers 或任何动态验证；不授权修改业务源码、契约、migration、测试或脚本。

**`UNVERIFIED` 项**：所有"运行时会发生什么"的结论均为代码结构推论（并发交错、连接池耗尽、
索引走不走、无限循环触发条件）——本轮未做任何动态验证，一次真实 DEV 启动加上已裁决的 55 条 seed
数据即可证实或证伪其中大部分；v4 shell 形态对照专项进行中；
`EdgeRequestContext` 的 `sourceAddress` 取值来源未核（影响登录串行化判断）；
全端点服务端能力校验是否齐备未逐一核对。
