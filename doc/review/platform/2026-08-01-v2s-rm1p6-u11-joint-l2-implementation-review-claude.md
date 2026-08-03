---
title: RM1 P6-3 U11 joint local L2 implementation 收口复审（Claude）
reviewTarget: IMPLEMENTATION
scope: U11 当前实现、19-file 本机 Spring Boot + 双本机 Web + Playwright over isolated remote non-production middleware 的 L2 与 package evidence
verdict: NO-GO
findings: M=2 / S=3 / N=5
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖 U11 当前实现与本次 L2/package evidence；不授权 UAT、DEV seed/reset、Roadmap 状态变更、第三轮 adversarial review 或仓库控制操作
createdAt: 2026-08-01
---

# U11 joint local L2 收口复审

## 0. 结论

**NO-GO**，`M=2 / S=3 / N=5`。

**先说清楚：这次工作是真的，而且是本项目迄今产出最高的一次验证。** 见 `§1`。
两条 `M` 都**不是**"没做"，而是 round-2 的 `S2-R2` 修复**只补了被点名的那一例，没补那一类**，
并且修复本身在另外两个消费点**越界**了。它们都落在同一个根因上，同一处最小改动可以一起收掉。

我不改写 round-2 的历史 `NO_GO`，也没有发起第三轮 adversarial review；以下是我从冻结输入、
owner 源码、当前字节与 fresh 复跑独立推导的结果。

## 1. 这项工作解决了什么真问题（Dexter 指令）

**问题是真的，方案方向也对。** 在 U11 之前，两个 App 从未在真实浏览器里对着真实数据库跑过。
静态门、收据、hash 分母全绿，但没有一个字节证明用户能登录进去把事做完。

U11 是第一次把「本机 Spring Boot + 两个本机 Vite App + Playwright + 隔离远端 PostgreSQL/对象存储」
接成一条真链路。**它当场逼出了七个真实生产缺陷**（amendment `§3.1`–`§3.7`），每一个都是
5.6M 治理工件从未发现、也不可能发现的那一类：

| # | 缺陷 | 性质 |
| --- | --- | --- |
| 3.1 | 生成的 edge DTO 用 Jackson 2 `JsonNode`，与 Spring Boot 4 的 Jackson 3 转换器不兼容 | 全部 object 字段的 wire 传输 |
| 3.2 | `store-contract` 未声明 `jackson-datatype-jsr310`，含 `LocalDate` 的 receipt 无法序列化 | 幂等终态回读 |
| 3.3 | `pageAdministrators` 的 `? IS NULL OR ...` 无显式 SQL 类型，PostgreSQL 拒绝缺省筛选 | 管理员列表默认路径 |
| 3.4 | 两个 App 的生成客户端都没设 `Content-Type`，RTK 发 `text/plain`，Spring 拒绝所有 JSON 登录 | **两个后台都登不进去** |
| 3.5 | `WorkspaceAdministrationService.list` 同一类空值绑定 | 集团空间选择器与管理页 |
| 3.6 | 共享选择器命中隐藏虚拟列表项；登录并发被 advisory lock 串行化 | 测试面 + 并发形状 |
| 3.7 | 扩展字段页入口 | 测试流程 |

`§3.4` 一条就说明问题：**在这次 L2 之前，两个后台谁都登不进去，而所有静态门是绿的。**
这正好印证了 harness trim 的方向：真缺陷在语义与运行时，不在记账。这一点我确认，且不应被下面的 findings 冲淡。

**但方案的形状有一个结构性盲区**，两条 `M` 恰好都落在里面，round-2 抓到的那个缺陷也落在里面：

- 19 个 spec，**每个都从全新会话开始**；三个用到数据范围的 spec（`store-management`/`contract-management`/`store-profile`）
  各自独立开浏览器上下文，互不影响。
- **18/19 用 `page.goto` 深链进页**（实测：platform 侧 8 个 spec `menuclick=0`），
  只有 `authentication` 走真实入口。

也就是说，这套 L2 证明的是「**每个页面从干净会话单独打开时可用**」，
不是「**一个真实用户在页面之间走动时可用**」。跨页残留状态、菜单/路由守卫、page-access 生效
这三类事实，19 个 spec 一条都覆盖不到——而 `M1`/`M2` 正是跨页残留状态。

**这不是凑 GO。** 工作实、缺陷真、边界表述克制。但「五个 platform write 闭环」与
「`S2-R2` CONFIRMED_AND_REPAIRED」这两句结论，比证据实际支撑的要强。

## 2. 我独立复核到的事实（不采信自报数字）

| 项 | 结果 |
| --- | --- |
| `terminal-report.json` sha256 | `b098e561…c45a23` **复算一致** |
| `currentSourceHashes` 44 条 | **44/44 与当前字节一致**，0 漂移，0 缺失 |
| `platform_playwright.log` | 真实 Playwright 输出，**9 passed (53.4s)**，逐条列出 9 个 spec |
| `operations_playwright.log` | **10 passed (1.3m)**，逐条列出 10 个 spec |
| 19 spec 集合 | 与 `affected-l2-registry.json` 的 `phaseBusinessL2Obligations` 两组 tests **exact-set 相等**（9+10） |
| `changedPaths` | 193 条，无重复；gate 与 receipt delta **双向 exact-set** 通过（`CHANGED=193`） |
| `PACKAGE_EXIT` | `PASS`（见 `N5` 的复现条件） |
| business / cleanup 分离 | **真分离**：`r5-joint-remote-l2.mjs:251-252` 与 `:268` 各自独立判定；74 次历史 run 中同时存在 `business=FAIL/cleanup=PASS` 与 `business=FAIL/cleanup=FAIL`，说明二者可独立取值 |
| 静态门 fresh 复跑 | `CAPABILITY_INVARIANTS=PASS`、`R5_FRONTEND_ARCHITECTURE=PASS`、`R5_SECURITY_BOUNDARIES=PASS`、`R5_OPENAPI_CONTRACTS=PASS`、`R5_EDGE_CODEGEN_CHECK=PASS`、`CODE_LAYOUT=PASS`、`STANDARDS_COVERAGE=PASS`、`R5_AFFECTED_L2=PASS` |
| 静态是否冒充动态 | **否**。`business`/`cleanup` 只由受管 run 写入；`validateRequiredDynamicEvidence` 强制 `entry.result==='PASS' && entry.cleanup==='PASS'` 且逐条复算 source/log hash |
| Redux 内部断言 | **零**。19 个 spec 无 `store.getState()`/`useSelector`；本复审也不要求 |
| ST-11 authority-ledger | 见 `N2`：**当前仍 FAIL**；U11 全部文档**没有**任何一处声称它已关闭 ✓ |

**会话出处**：fresh v2s-rooted。需披露一点：run 记录的 checkout 是
`/Users/dexter/Documents/workspace/idea/catering-v2s`，该路径在我的会话里不存在（我看到的是
`/Volumes/idea/catering-v2s`，本机为 Parallels 环境）。**因此我不是靠路径、而是靠 44/44 字节 hash
确认这份证据绑定的就是本树。** 74 次 run 全部记录同一路径，非本次异常。

## 3. M1 ｜stale data-scope 只补了 HEAD_COMPANY 一例，`集团用户管理` 仍然坏

**owning source**：`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java:50-61`

**可复现的用户场景**（L2 fixture 里那个 `serviceNodeType: 'GROUP'` 的 `L2集团运营管理员` 就能走到）：

1. 登录，选角色 → `WorkspaceAuthenticationService:105` 把 `visible_data_node_id` 置 `NULL`。
2. 打开 `门店管理`（`PG-ORG-STORE-MANAGE`，`requiredDataNodeType=STORE`），选一个门店
   → `WorkspaceAuthenticationService:119` 把 `visible_data_node_id` **持久化**为该门店 id。
3. 打开 `集团用户管理`（`PG-IAM-GROUP-USERS`，`requiredDataNodeType=NONE`）。
   前端按 `WorkspaceUserPage.tsx:109` **不发** `scopeRef`。
4. 服务端 `resolveTaskScope(session, "GROUP", null)`：
   - `:50` `effectiveScopeRef = session.visibleDataNodeId()` → **拿到那个门店 id**；
   - `:51` 新分支只判 `"HEAD_COMPANY".equals(expectedTargetType)` → 不进；
   - `:57` server-owned 兜底只在 `effectiveScopeRef == null` 时生效 → 不进；
   - `:61` `requireTaskPath(..., "GROUP", storeId)` → **`TaskPathNotFoundException`**。
5. 页面报错、表格为空。**用户无法自行恢复**：NONE 页不渲染数据范围选择器，
   而 `visible_data_node_id` 只在切换任职（`selectContext`）时被清空。

**这与 round-2 报的是同一个缺陷，只是页面换了一个。** round-2 的 `requiredRepair` 写的是
"the scope is not an input for a NONE page"——那是一条**类**的判断，修复却只写成了
`"GROUP".equals(assignment) && "HEAD_COMPANY".equals(expectedTargetType)` 这一个**实例**。

**受影响面**（全部 `requiredDataNodeType != NONE` 的页面都可作为第 2 步的触发源）：
`PG-ORG-STORE-MANAGE`(STORE)、`PG-CONTRACT-STORE-MANAGE`(PROJECT)、`PG-IAM-REGION-USERS`(REGION)、
`PG-IAM-PROJECT-USERS`(PROJECT)、`PG-IAM-STORE-USERS`(STORE)、`PG-STORE-PROFILE`(STORE)。
同一页的 `邀请` tab 更早失败：`WorkspaceInvitationPanel.tsx:84` 把 `queryContext.scopeRef`
**原样透传**，没有 `WorkspaceUserPage.tsx:109` 那层省略，所以它把陈旧门店 id 显式发给
`/group/invitations`。

**最小根因修复**（不是更大的方案）：把「NONE 页不接受 client scope」做成**类判断**而不是逐例分支。
`resolveTaskScope` 已经拿到 `expectedTargetType`；只需在取 `session.visibleDataNodeId()` 之前，
先判断该 `expectedTargetType` 对应页面的 `requiredDataNodeType` 是否为 `NONE`
（`WorkspaceAuthorizationCatalog` 已有 `PageAccessCatalogEntry.requiredDataNodeType`，是生成投影，无需新真相源）——
是则一律走 server-owned assignment，不读 session scope。这样 `GROUP`、`HEAD_COMPANY`
以及将来任何 NONE 页都自动正确，且**仍然 fail-closed**（authority 依旧来自 `requireActiveScope`）。

**是否需要 Dexter 产品裁决**：否。

## 4. M2 ｜修复本身越界：GROUP 型 TaskPath 被交给 HEAD_COMPANY 固定目标的写入端

**owning source**：`WorkspaceUserService.java:51-56` 返回的是
`requireTaskPath(..., "GROUP", assignment.serviceNodeId())`，即 `targetType="GROUP"`。

`pageForOperations` 对此**做了**特判（`:141` `groupHeadCompanyAggregate`），所以用户列表是对的。
但同一个 `resolveTaskScope` 还有另外两个消费点，它们**没有**特判：

**(a) `总公司用户管理 → 邀请` tab 永远是空的，而且不报错。**

`WorkspaceInvitationService.managementPageForOperations` 把 `scope.targetId()` 当固定目标传下去，
`invitationPageSql` 生成：

```sql
EXISTS (SELECT 1 FROM workspace_iam.invitation_assignment_intent intent
        WHERE intent.invitation_id=i.id
          AND intent.service_node_type='HEAD_COMPANY'
          AND intent.service_node_id=<groupId>)
```

`service_node_type='HEAD_COMPANY'` 与 `service_node_id=<groupId>` 是**不可能同时成立**的一对。
GROUP 运营管理员看到的总公司邀请列表恒为 0 行——**静默给出错误答案，比报错更糟**。

**(b) `总公司用户管理 → 发出邀请` 必然失败。**

`OperationsWorkspaceInvitationController.java:60`：

```java
var target = user.resolveTaskScope(session, expectedTargetType, optionalUuid(body.scopeRef()));
List<...AssignmentIntent> intents = intents(body.roleIds(), target.targetType(), target.targetId());
```

这里 `resolveTaskScope` 的返回值不是「读取范围」，而是**被写入的任职目标**。
`WorkspaceInvitationCreateDrawer.tsx:134` 把用户在抽屉里选中的总公司作为 `scopeRef` 发出
（`BC-IAM-HEAD-COMPANY-INVITE` 的 `scopeApplicability` 正是 `HEAD_COMPANY_TARGET`），
新分支把它**丢弃**，`intents` 变成 `(role, "GROUP", groupId)`。随后必然二选一失败：

- `requireUserManagementAction(..., "GROUP", groupId, INVITE)` 要的是 `BC-IAM-GROUP-INVITE`
  而不是操作者实际持有的 `BC-IAM-HEAD-COMPANY-INVITE` → `AuthorizationDeniedException`；
- 若两者都持有，则 `WorkspaceInvitationService.create` 的
  `if (!role.serviceNodeType().equals(intent.serviceNodeType())) throw new InvitationValidationException();`
  必然命中——因为角色候选被 `candidatesForOperations` 的 ROLE 分支按
  `expectedTargetType.equals(role.serviceNodeType())` 过滤成 `HEAD_COMPANY` 型，与 intent 的 `GROUP` 不符。

UI 一路把用户带到「选总公司 → 选角色 → 发出邀请」，最后一步失败。
**全仓没有任何测试覆盖总公司邀请创建**（`grep` 仅命中生成客户端与 UI 源文件，无 test）。

> **归因说明**：我只能验证**当前字节**是坏的。`apps/` 全目录未纳入 git，我读不到修复前的字节。
> round-2 finding 对旧条件的描述（"only ... when the effective scope is null or equals the group id"）
> 表明旧代码在 `scopeRef` 为选中总公司时会走正确分支，据此这**很可能**是本次修复引入的回归——
> 这一句是**推论**，不是仓内事实。

**最小根因修复**：把 `resolveTaskScope` 的两种用途拆开。读取路径按 `M1` 的类判断处理；
**命令目标**路径（`OperationsWorkspaceInvitationController:60`）改用一个显式的目标解析——
要求 `scopeRef` 非空、类型等于端点固定的 `expectedTargetType`、并对 assignment 做
`isScopeAllowed` 校验后返回该目标本身。`managementPageForOperations` 同样需要
`pageForOperations:141` 那种 family 聚合语义，而不是把 `groupId` 当 `HEAD_COMPANY` id 用。

**是否需要 Dexter 产品裁决**：否。（若你希望 GROUP 运营管理员**不应**直接发总公司邀请，
那才是产品裁决——但 `contracts/catalog/admin-catalog.json` 当前把
`BC-IAM-HEAD-COMPANY-INVITE.grantableRoleNodeTypes` 写作 `["GROUP","HEAD_COMPANY"]`，按现契约是允许的。）

## 5. S1 ｜`S2-R2` 的收口证据**一次都没有执行过**

author-resolution 第 17 行把 `S2-R2` 记为 `CONFIRMED_AND_REPAIRED`，证据是
"`WorkspaceUserTaskScopeTest` proves a stale prior scope cannot redirect the approved aggregate"
＋ "fresh operations user-management L2"。两半都不成立：

- `WorkspaceUserTaskScopeTest` 是 `@Testcontainers` 测试。本包自己在
  amendment `:97` 写明：**"This package still does not claim … the unavailable Docker-backed
  workspace-iam runtime test."**；author-resolution `:30` 记录的也只有 **`compileTestJava` PASS**（编译）。
  **一个没有运行过的测试不证明任何行为。**
- `user-management.spec.ts:43-53` 确实断言了
  `searchParams.has('scopeRef') === false`、`scopeRef` 为 null、`total > 0`——
  但它是**从全新登录直接跳转**过去的，此时 `visible_data_node_id` 本来就是 `NULL`。
  round-2 明确要求 "a managed L2 path that **first selects a scope-required page**, then opens
  HEAD_COMPANY users"，这一步**没有实现**。该断言在修复前后都会通过，**没有红控制**。

本包对边界的表述是诚实的（amendment `:97` 主动披露了 Docker 不可用），
**问题出在 resolution 表格里引用它当证据时没有重复这个限定**。
`M1`/`M2` 之所以能出厂，直接原因就是这里：没有任何**执行过**的东西能挡住它们。

**最小修复**：补一个 L2 case——同一会话内先在 `门店管理` 选一个门店，再打开
`集团用户管理` 与 `总公司用户管理`（含 `邀请` tab），断言 200 与非空。
这一条同时是 `M1`、`M2(a)` 的红控制。**不需要新基建**，是现有 spec 里加十几行。

## 6. S2 ｜本次新增的四个 `destroyOnHidden` 红控制**不在任何门里**

四处详情 Drawer 的生命周期修复**本身是对的**，我逐项确认：

- `WorkspaceDetailDrawer.tsx` / `RoleDetailDrawer.tsx` / `AdministratorDetailDrawer.tsx` /
  `WorkspaceAccountDetailDrawer.tsx` 四个文件 `destroyOnHidden` 计数**均为 0**；
- 四个父页面（`WorkspaceManagementPage.tsx:35-67`、`RolesPage.tsx:31-77`、
  `AdministratorsPage.tsx:35-64`、`AccountsPage.tsx:27-102`）用的是同一套
  `pendingActionRef` + `openPendingActionAfterDetailClosed` 延迟交接，绑定在 `afterOpenChange` 上——
  这确实需要 surface 在关闭动效期间保持挂载，所以移除 `destroyOnHidden` 是**根因级**修复；
- **无任何 sleep / 人为延时 / 并存 overlay**，与 resolution 的说法一致 ✓。

但 resolution 第 22 行说 "focused source tests reject `destroyOnHidden`"——**这四个测试永远不会运行**：

```
tools/verify-gates/verify.mjs:17  ['U08-platform-ui-test', 'yarn', ['--cwd','apps/frontend/platform-admin','test']]
apps/frontend/platform-admin/package.json  "test": "node --test src/tests/architecture/*.test.mjs"
```

实跑 `yarn --cwd apps/frontend/platform-admin test` → **`tests 7 / pass 7`**，
只来自 `src/tests/architecture/` 下 4 个 `.test.mjs`。
而 platform-admin 有 **36 个 `*.test.tsx`**（含这四个红控制）、operations-admin 有 **20 个**，
它们 `import ... from 'vitest'`，但两个 App **都没有 vitest 配置或脚本**
（只有 `libraries/frontend/admin-ui-foundation` 有）。`yarn build` 也不跑测试。

**后果**：明天任何人把 `destroyOnHidden` 加回那四个 Drawer，`scripts/verify` 依然全绿。
这是典型的假绿——控制存在、从不执行。

> 顺带一个事实（**不属于 U11 的账**，但请知悉）：这 36 个 `.test.tsx` 就是 P6-2 / U06 交付的
> 36 个 focused consumer proof。我当时复核了它们**存在且 1:1 绑定**，那部分仍然成立；
> 但「它们从未被任何标准脚本执行」是我上一轮没有验到的，现在补上。

**最小修复**：给两个 App 各加一行 vitest 脚本，并让 `package.json` 的 `test` 同时跑
`node --test` 与 `vitest run src`。零新基建，分钟级。
（顺带：红控制用 `not.toContain('destroyOnHidden')` 字符串匹配，Ant Design 的旧别名
`destroyOnClose` 可以绕过——修的时候一并把两个名字都断言掉。）

## 7. S3 ｜五个 platform write spec 的写入**证明不了持久化**

> **自我更正（详见 `§10`）**：本节初稿标题写的是「整套 19-spec 里没有一次写入证明了持久化」，
> **过宽，已收窄。** 反例就在同一交付单元内：
> `operations-admin/src/tests/l2/store-management.spec.ts:45-69` 真做了
> `停用 → 恢复启用` 的状态变更，断言 owner 回读的 `{status:'DISABLED'}` / `{status:'ENABLED'}`
> 与翻转后的按钮文案。**这套 spec 里本来就存在会红的写入形状**，
> 缺口只在下面这五个 platform write spec 与恢复流程。

五个 platform write spec 的链路形状是齐的（请求方法/路径/body/`Idempotency-Key` 断言、
响应断言、渲染态断言），owner 侧的回读也确实是真正的**写后重查**，不是请求回声
（`WorkspaceAdministrationService.java:118→121` `UPDATE` 后 `require(key)`；
`PlatformAuthenticationService.java:344→346` `UPDATE` 后 `requireAdministrator(id)`）。
**缺口在于写入的值就是刚刚读出来的值**：

| spec | 提交的 body | 断言的回读 |
| --- | --- | --- |
| `platform-admin-management.spec.ts:14-29` | `{userName: currentUserName, mobile: currentMobile}` | `readback.userName === currentUserName` |
| `workspace-management.spec.ts:16-33` | `{name: currentName, operationsTitle: currentOperationsTitle, notes: currentNotes, logoIntent:'KEEP'}` | `readback` 匹配同样的值 |
| `role-management.spec.ts:13-32` | `{name: currentName, description: currentDescription}` | `readback.name === currentName` |
| `workspace-account-management.spec.ts:22-30` | credential-reset | `expect(['SET','RESET_PENDING']).toContain(...)`（两值皆收）+ 回读 `id`/`loginName`（不变量） |
| `extension-field-management.spec.ts:17-24` | 编辑器里原样的 `definitions` | 只比**长度** |

五处都断言 `version`/`revision` **`> 0`**，而不是 **`> body.expectedVersion`**。
`PlatformAuthenticationService.java:344` 是
`UPDATE ... version=version+1 ... WHERE id=? AND version=?`——**版本必然自增**，
所以 `> expectedVersion` 是一条现成、廉价、真正会红的断言，而 `> 0` 恒真。

**具体失效场景**：mapper 或 controller 丢字段（本仓已经真实发生过两次——
`OperationsContractController` 丢 assignment/dataNode、`WorkspaceRoleService` 的 generic update），
owner 会照样返回 200、照样自增版本、回读照样等于旧值＝当前值，**五个 spec 全绿**。

同一形状也出现在恢复流程：`r5-joint-remote-l2-fixture.mjs:180` 生成的
`recoveryPassword` 既用于 `:186` 建号，又在 `:283` 作为「新密码」发给
`access-recovery.spec.ts`——**改成了同一个值**，且流程结束在登录页、不回登验证。

**结论**：`N1` 的收口在**形式**上成立，在**效果**上不成立。
amendment `§5.2` 要求的链路是 `control -> request -> readback -> rendered state`，
字面确实做到了；但这条链**不可能失败**。这不是"没做"，是这条 bar 本身太低。

**最小修复（每个 spec 一到两行）**：把某个非标识字段改成 run 内唯一的新值再提交，
断言 owner 回读与渲染态都是**新值**；或至少断言 `readback.version === body.expectedVersion + 1`。
恢复流程末尾用新密码登一次。

## 8. N

**N1 ｜远端资产回收没有回读，且容器缺失时静默跳过**

`scripts/test/r5-joint-remote-l2.mjs:189` 的 `removed: true` 是**字面量**，不是回读结果。
`databasePresentBeforeCleanup` / `rolePresentBeforeCleanup` 是**删除前**的 `SELECT EXISTS`。
数据库与角色因为 `set -euo pipefail` + `ON_ERROR_STOP=1`，DROP 失败会让整段非零退出，
证据强度可以接受；**但 MinIO 前缀清理包在 `if docker inspect catering-v2s-r5-minio ...` 里**——
容器不可 inspect 时整段跳过，脚本照样打印 `REMOTE_NAMESPACE_REMOVED=PASS`，
报告照样 `cleanup=PASS` + `removed=true`，资产可能被留下。
**最小修复**：删除后各补一次 `SELECT EXISTS` 与 `mc ls` 回读并断言为空；
MinIO 不可用时显式 FAIL 或显式记 `SKIPPED`，不要静默算 PASS。

**N2 ｜`P1_AUTHORITY_SOURCE_LEDGER` 当前仍 FAIL，而 U11 的 exit 不再登记该欠账**

我实跑：`P1_AUTHORITY_SOURCE_LEDGER=FAIL`，`REASON=P1_LEDGER_ROW_INVALID:ST-11`。
原因是 `contracts/policy/frontend-asset-carryover-manifest.json` 当前
`32fd89d3…`，而 ledger 的 `ST-8`/`ST-11` 两行仍声明 U05 对齐时的 `8d53e1ed…`。
该文件 mtime `Jul 31 10:54`，**早于** U11 首次 run（`Jul 31 18:25`）——
**属于继承欠账，不是 U11 造成的**（两条 consumerTrace 的 expectedPaths 我都逐条核过，exact-set 相符）。

**U11 没有任何一处声称它已关闭 ✓**（我逐文件 grep 确认）。但 `U04` 的 exit 曾显式登记
`{"id":"P1-ST-11-AUTHORITY-LEDGER","status":"OPEN_SUCCESSOR_PACKAGE", … "this U04 PASS does not imply ledger PASS"}`，
`U05` 也有 `knownExitDebts`；**U11 的 exit 与 delivery manifest 完全没有欠账字段**。
读 U11 的人不会知道 P1 ledger 是红的。**最小修复**：exit 补一条继承欠账即可。

**N3 ｜两处分母记录与实际交付不一致**

- `doc/review/platform/rm1p6-u11-joint-remote-l2-delivery-manifest.json:11`
  的 `approvedAssertions` 仍写 `EXACT_21_SPEC_DENOMINATOR`，实际交付是 **19**（9+10），
  与 `affected-l2-registry.json` 和 terminal report 一致。
- `contracts/policy/affected-l2-registry.json` 的 `RM1P6-U03` 行仍为
  `implementationState: "PENDING_FUTURE_UNIT"`，`requirement` 还写着
  "This is a future obligation only and **does not authorize P6-3 implementation now**"——
  而本包正是拿这十个 spec 当 P6-3 的 business 证据。该文件就在 `changedPaths` 里。
  该字段是有作用的：`tools/verify-gates/cli.mjs:560` 会在
  「全部为 `PENDING_FUTURE_UNIT` 且无变更」时**跳过**这十个 spec。

**N4 ｜同一条「撤销任职」在两个 App 里是两种交互**

platform 侧 `WorkspaceAccountDetailDrawer` 已按 Dexter 的「表格不出现操作列」边界改成
`rowSelection={{type:'radio'}}` + 单个 `workspace-account-revoke-selected-assignment` 按钮，
其 focused 测试还显式 `not.toMatch(/title:\s*['"]操作['"]/)`；
operations 侧 `WorkspaceUserDetailDrawer.tsx:67` 仍是每行一个 `撤销任职` danger 按钮。
两者都在本交付单元内，没有记录取舍理由。
（我核过：两个 App 的**非测试**源码里都不存在 `title: '操作'` 列，所以这不是列违规，
是同一命令的两种形状。）
同样地，两个 App 的「详情关闭 → 独立动作」也是两套机制：platform 用 `afterOpenChange` 延迟交接，
operations 用 `closeThen` 同步捕获后立即调用（因此 operations 的六个详情 Drawer 保留
`destroyOnHidden` **不是**同一个缺陷——这一点我特意验过，避免误报）。

**N5 ｜`PACKAGE_EXIT=PASS` 在后续独立会话中不可直接复现**

我在本仓直接跑 `validate-package-exit` 得到
`FAIL / PROBLEM_FAMILY_DISCOVERY_REQUIRED:576cfab6a00f`。
原因不是交付内容：`.runtime/compliance-control/problem-intakes/` 下有三个**晚于** package-exit
（`Aug 1 06:18`）产生的 prompt intake（`10:53`、`11:03`、`11:08`），来自并行运行的 Codex 会话。
我在 scratchpad 用符号链接镜像本仓、只排除这三个晚于 exit 的 intake 后重跑，得到：

```
PACKAGE_EXIT=PASS
PACKAGE_ID=RM1P6-JOINT-REMOTE-L2-U11
CHANGED=193   PROBLEM_INTAKES=38   PROBLEM_FAMILIES=11
```

**所以交付时的 `PASS` 是真的**，只是这道门对并发会话不稳定。记录在案，供后续评审者少走弯路。

## 9. 处置

- `M1`、`M2` 同根同源，**一处最小改动一起收**：把「NONE 页不接受 client scope」做成
  基于 `requiredDataNodeType` 的类判断，并把 `resolveTaskScope` 的「读取范围」与
  「命令目标」两种用途拆开。二者均在既有批准边界内，**不需要 Dexter 产品裁决**。
- `S1` 的 L2 补充与 `M1`/`M2` 是同一件事的红控制，**建议同批完成**。
- `S2`（两个 App 的 vitest 未接线）、`S3`（写入改为真实变更）、`N1`–`N4` 均可由 Codex 自主处置。
- `N5` 无需处置。
- **已复核为真、不得回退**：44/44 currentSourceHashes、9/9 与 10/10 的真实 Playwright 输出、
  19-spec 与 registry 的 exact-set、193 条 changedPaths 双向 exact-set、
  business/cleanup 的独立判定、八道静态门 fresh PASS、
  四个详情 Drawer 的 `destroyOnHidden` 移除与 `pendingAction` 延迟交接、
  以及 amendment `§3.1`–`§3.7` 七个真实生产缺陷的根因修复。
- **本复审不授权**：UAT、DEV seed/reset、Roadmap 状态变更、第三轮 adversarial review 或仓库控制操作。
  我也未改写 round-2 的历史 `NO_GO` 结论。

---

## 10. 复审期间的字节漂移（必须披露）

**本包在我复审过程中一直被并行会话写入。** 我的测量取自 `11:00–11:45`，本节补测于 `12:30`。

| 文件 | mtime | 与本文哪条 finding 相关 |
| --- | --- | --- |
| `WorkspaceUserService.java` | `12:14:50` | `M1` / `M2` |
| `OperationsWorkspaceInvitationController.java` | `12:15:13` | `M2(b)` |
| `WorkspaceInvitationService.java` | `12:24:03` | `M2(a)` |
| 两个 App 的 `package.json` | `12:18:21` | `S2` |
| 五个 platform write spec + 两个 operations spec | `12:16` 前后 | `S3` |
| `scripts/test/r5-joint-remote-l2.mjs` | `12:26:30` | `N1` |
| `delivery-manifest.json` | `12:16:37` | `N3` |
| `package-exit.json` | `12:16:53` | — |

**这些改动的方向与本文建议一致**，我在 `12:30` 复读当前字节确认：

- `M1` **已不复现**：`WorkspaceUserService.java:51-61` 改成了类判断
  `requiredDataNodeType(expectedTargetType)`；`"NONE"` 时根本不再读 `session.visibleDataNodeId()`
  （`:62` 只对 scope-required 页生效）。GROUP 页走 `:59-60` 用 server-owned assignment。
- `M2(a)` **已修**：`managementPageForOperations` 增加
  `boolean aggregate = "GROUP".equals(scope.targetType()) && "HEAD_COMPANY".equals(expectedTargetType)`，
  聚合时传 `null` 而不是把 `groupId` 当 `HEAD_COMPANY` id。
- `M2(b)` **已修**：`OperationsWorkspaceInvitationController.java:60` 由
  `resolveTaskScope(...)` 改为 `resolveCommandTarget(...)`，即本文建议的「读取范围 / 命令目标」拆分。
- `S2` **已修**：两个 `package.json` 的 `test` 变为
  `node --test src/tests/architecture/*.test.mjs && vitest run src --exclude "**/*.mjs" --exclude "**/*.spec.ts"`。
- `S3` **已修**（以 `platform-admin-management.spec.ts` 为例）：现在
  `updatedUserName = \`${currentUserName} · L2 ${Date.now()}\`` → `fill(updatedUserName)`，
  断言 `readback.userName === updatedUserName` **且 `readback.version === body.expectedVersion + 1`**，
  渲染态也断言新值。
- `N1` **已修**：runner 增加删除后 `mc ls` 与 `pg_database`/`pg_roles` 回读并断言，
  MinIO 容器不可用改为硬失败。
- `N3` 前半 **已修**：manifest 已改为 `EXACT_19_SPEC_DENOMINATOR`。

**但这使当前包处于比复审开始时更不可交付的状态**，我在 `12:30` 实测：

```
currentSourceHashes: 44 条 → DRIFTED 10 条
  scripts/test/r5-joint-remote-l2.mjs
  platform-admin/src/tests/l2/{workspace-management,platform-admin-management,role-management,
                               workspace-account-management,extension-field-management}.spec.ts
  operations-admin/src/tests/l2/{access-recovery,user-management}.spec.ts
  workspace-iam/.../WorkspaceUserService.java
  workspace-iam/.../WorkspaceUserTaskScopeTest.java

PACKAGE_EXIT=FAIL   REASON=RM1_DELIVERY_MANIFEST_HASH_DRIFT
```

`delivery-manifest.json` 被改（`12:16:37`）却没有同步更新
`package-input.json:7` 的 `deliveryManifestSha256`（仍为 `6b819669…`，实际已是 `fbc059d7…`），
`cli.mjs:356` 因此在进入 changedPaths 校验之前就抛出。

**结论有三点：**

1. **本文 `§0` 的 `NO-GO` 与 `M`/`S`/`N` 全部绑定到 `11:00–11:45` 的字节状态**，
   该状态已被 `12:14–12:26` 的写入取代。上面列出的修复方向是对的，我据当前字节复读确认了它们存在。
2. **我没有、也无法认定这些修复是正确的。** 没有任何一次 L2 在修复后的字节上跑过；
   `business=PASS` / `cleanup=PASS` 绑定的是 `06:09` 那次 run，
   而它所声明的 44 条 source hash 现在有 10 条不符——**动态证据与源码已经脱钩**。
3. **这恰好是 `S1` 指出的同一个失效模式又发生了一次**：修复在没有任何**执行过**的证据下落地。
   `S1` 因此不但没有被这轮修复消解，反而被再次印证。

**下一步的正确顺序**（不需要新基建）：先停止写入并冻结字节 → 重新生成 `package-input.json`
的 manifest 绑定与 `package-exit.json` 的 `changedPaths` → 在冻结字节上**重跑一次完整 19-spec L2**
（含 `S1` 要求的跨页 scope 用例）→ 用那次 run 重新绑定 `currentSourceHashes` → 再送评审。
在此之前，本包**不存在**可被复核的一致状态。
