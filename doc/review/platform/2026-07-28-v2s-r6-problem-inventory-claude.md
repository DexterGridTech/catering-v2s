---
title: v2s 下一轮整改问题清单（Claude）
status: PROBLEM_INVENTORY_PENDING_ROADMAP
createdAt: 2026-07-28
programId: V2S_W0_W4_EXECUTION
reviewTarget: CONSOLIDATED_PROBLEM_INVENTORY
purpose: 作为新 Roadmap 的唯一输入分母；Codex 据 Roadmap 产出详设，不得绕过本清单自行取舍
supersedesScopeOf: doc/review/platform/2026-07-27-v2s-r5-cr03-cr06-static-diagnostic-claude.md
authorizationBoundary: 只读诊断汇总；不授权实施、DEV、seed、reset、远端或任何动态验证
---

# v2s 下一轮整改问题清单

## 0. 本件性质与边界

本件把当前所有已确认问题合并成一份分母，供新 Roadmap 使用。**不做 GO/NO-GO**。

**证据强度分级**（每条问题都标注）：
- `亲验` — 作者本人打开源码/运行门确认
- `双验` — 两个独立子 agent 独立发现同一事实
- `推论` — 从代码结构推导，**本轮未做任何动态验证**（未启 DEV、未跑 seed、未连库、未启容器）

**分母完备性声明**：作者在本项目上有**五次分母类错误 + 一族时点漂移错误**（§14），
本件全部计数已按第一轮盲审逐条重算并更正。**仍建议 Codex 用机械枚举独立复算一遍再采信。**

已更正的分母：

| 项 | 原写 | 更正后 | 口径 |
| --- | --- | --- | --- |
| 错误码总数 | ~~286~~ | **106 distinct**（119 occurrence） | 三份 `EDGE_PROBLEM_CODES` 实测 49/52/18；`EdgeProblemCode.java` 枚举成员 = 106 |
| `CREATE INDEX` | ~~9~~ | **9 + 4 `CREATE UNIQUE INDEX`**（另有 PK/UNIQUE 隐式索引） | P-E1 建议的 7 条外键索引经逐条核对确实未被现有约束覆盖，结论不变 |
| 结构迁移改动面 | ~~46~~ / ~~60~~ | **两个口径分列**：`:libraries:backend` 冒号项目记法 **46 处**（settings 10 + app 9 + 各库 27）；`libraries/backend` 路径字符串 **15 处 / 6 文件**（`verify-gates/cli.mjs`×9、`BackendModuleBoundariesTest.java:91,92`、`module-dependency-registry/check.mjs:93`、`affected-l2-registry.json:7`、`r5-remote-testcontainers.mjs:65`、`edge-codegen.mjs:25`） | 原写 60 既混口径又算术不闭合；`scripts/README.md` 实为 0 命中 |
| 运行时前端文件 | ~~49~~ | **47**（排除 generated + tests） | closure 的 22 个 surface 对应 21 个不同 `targetPath` |
| 未映射异常 | ~~19~~ | **24**（盲审口径） | 另：`ContractProblemAdvice` 非唯一，`PlatformCommercialGroupController` 等带局部 handler |
| 当前红门 | ~~3~~ | **4** | 新增 `production-conformity`（`R5_FLYWAY_SINGLE_HISTORY_DRIFT`，硬编码 13 vs 磁盘 18） |
| operation 分母 | 106 | **104 = 36 platform + 57 operations + 11 public** | 实测 `edge-route-face-registry.json` 的 `faceCounts` = platform 39 / operations 56 / public 11 = 106。变更后：platform 39−5（R-5 退役 invitation）+2（P-N1 OTP）= **36**；operations 56−1（R-24 退役 `PUT`）+2（新增 `POST`/`DELETE`）= **57**；public 11 不变。**先前稿写 103 是作者错误——漏算了 R-24 使 operations 面净 +1**（Codex 三轮指出，已实测确认）。退役与新增都**依赖 ST-7 先完成**，否则门里硬编码的 106 会被打红且原因与退役无关 |

**"含 SQL 文件数"的措辞更正**：指**含 SQL 语句的 Java 文件数**；`libraries/backend/**` 下 `.sql` 文件为 **0**
（全部 Flyway 迁移在 `apps/backend/catering-business-server/src/main/resources/db/migration/`，18 个）。

## 0c. 测试契约标准（Dexter 2026-07-28：测试用例是详设标配，且必须有门约束）

**每个 delivery unit 必须在 manifest 声明 `testContract`，缺失即红。评审时测试契约不完整不得 GO。**

```json
"testContract": {
  "level": "FOCUSED | INTEGRATION | L2 | STATIC_GATE",
  "redFirst": true,
  "redAssertion": "修复前必须以此原因失败：<精确的具名 code 或断言文本>",
  "casePaths": ["..."],
  "negativeCases": ["..."]
}
```

**机械判据**（每条一行可说清，符合门的准入三问）：

| 判据 | 红码 |
| --- | --- |
| 缺 `testContract` | `TEST_CONTRACT_MISSING:<unitId>` |
| `redFirst` 非 true 且无 `TERMINAL_ONLY` 机械理由 | `RED_FIRST_NOT_DECLARED:<unitId>` |
| `redAssertion` 为空或无具名原因（"会失败""不通过"这类） | `RED_ASSERTION_NOT_NAMED:<unitId>` |
| `casePaths` 指向不存在的文件 | `TEST_CASE_PATH_MISSING:<path>` |
| package-exit 时声明的 case 未被 runner 发现 | `TEST_CASE_NOT_DISCOVERED:<path>` |

**四类红夹具**（缺一不算数）：删掉某 unit 的 `testContract`、把 `redFirst` 改 false、
写一个不存在的 `casePath`、伪造 `redAssertion` —— 各自精确红。

**挂载位置**：扩既有 `scripts/check/implementation-design-granularity`（它已在校验六类分母），
**不新建门类别**（T-1）。同步写入 `.agents/skills/cs-writing-plans/SKILL.md`
与 `cs-spec-to-plan/SKILL.md`，使详设生成时即带上。

**按问题类型的测试层级与红断言示例**：

| 问题类型 | level | 红断言应长什么样 |
| --- | --- | --- |
| 数据约束（如 P-B1 闭集） | `INTEGRATION` | 「修复前：插入 `ACCEPT_INTENT_RECORDED` 抛 `check_violation`」——必须是 DB 真实报错，不是 mock |
| 后端功能死路（P-B2） | `FOCUSED` | 「修复前：`transitionEntityStatus("STORE",…)` 抛 `OrganizationValidationException`」 |
| 授权（P-D0/P-D0c） | `FOCUSED` + `INTEGRATION` | 「修复前：无 `BC-ORG-STORE-CREATE` 的会话调建店端点返回 2xx」——**断言的是越权成功，不是失败** |
| 并发不变式（P-D3） | `INTEGRATION` | 「修复前：同 key 并发两请求都执行业务写，后者抛 `DuplicateKeyException`」 |
| 门（P-C1/P-C2） | `STATIC_GATE` | 「把被引用门替换为 `exit 0`，`standards-coverage` 仍 PASS」 |
| 效率（P-E1/P-E2） | `INTEGRATION` | 「修复前：单次 page-1 请求产生 ≥N 条 SQL」——**用计数器实测，不用 EXPLAIN 猜** |
| 前端交互（P-U*） | `L2` | 「修复前：定位器 X 不存在 / 点击后无请求发出」 |

**通用原则**：红断言必须描述**修复前的真实可观测行为**，不能写"应该会失败"。
一条不能在修复前变红的测试，证明不了修复有效。

## 1. Dexter 已裁决事项（约束，非待议）

新 Roadmap 与详设必须按此写。任何偏离都要显式标注并说明理由。

| # | 事项 | 裁决 | 出处 |
| --- | --- | --- | --- |
| R-1 | `libraries/backend/` 的存在 | **现在就改，不后置**。v2 有 libraries 是因为后端被拆成微服务；v2s 是单 app，唯一并列的是 TDP。想不出与 TDP 的真实共享能力，就**全部迁回 app**，并对 app 内部结构重新规划 | 2026-07-28 |
| R-2 | Roadmap 处置 | **停止关闭 CR00–CR08 那条 Roadmap，重新开一条** | 2026-07-28 |
| R-3 | Problem 文案 | **跟 v2 一模一样的形式**（两份集中模块，见 P-U1） | 2026-07-27 |
| R-4 | RTK 架构 | **改成真 `build.query` + tag 体系**，不做最小改 | 2026-07-27 |
| R-5 | `InvitationsPage.tsx` | **删除**；5 个 platform-face invitation operation **从 106 分母退役**。**归属 P6 独占**（Codex 二轮指出 P6/P7 双重归属，已改；P7 不得再列它） | 2026-07-27 |
| R-6 | 通则 | **所有历史垃圾代码必须删除** | 2026-07-27 |
| R-7 | 两个集团空间页 | **跟 v2 一致，是两页**：一页管理所有集团空间；一页是**某个集团空间的数据总览，必须选中后才显示** | 2026-07-27 |
| R-8 | ProTable | **跟 v2 一致**（v2 实测 13 关 3 开，不是一刀切） | 2026-07-27 |
| R-9 | Drawer | **mask 可点击关闭**，编辑抽屉必须有**统一 dirty guard** | 2026-07-27 |
| R-10 | 五个 `HOME-*` | **跟 v2 一样**做真内容，不留占位壳 | 2026-07-27 |
| R-11 | `database-operation-budget` 当前红 | **门对代码错**，修代码不改门；并入效率整改 | 2026-07-27 |
| R-12 | 切换器 | 按 v1/v2 形状：右上角常驻任职切换器（**不整页接管**）、左下角数据范围切换器 | 2026-07-27 |
| R-13 | 后端不感知 pageKey | 后端只回答授权事实（`dataNodeCandidates`），**前端 catalog 持 `requiredDataNodeType` 并按深度裁剪** —— 照 v2，**不抄 v4** | 2026-07-28 |
| R-14 | seed 量级 | 有列表的实体**至少能翻一页**。逐表阈值：品牌/租户/总公司各 ≥25，门店/合同各 ≥30，平台侧各 ≥55，`cg-boreal` 补完整分支，角色与账号补中文名，实体名不写测试用途。落点见 Roadmap RM1-P7 | 2026-07-27 |
| R-15 | 多任职 | 登录后出选择框 → 进 shell → shell 内常驻切换器；候选任职给业务可读名；零任职独立态 | 2026-07-27 |
| R-16 | 做一点验一点 | 验的是**代码是否满足项目记忆与设计文档**，纯静态，不需要 gradle/docker；不是"测试能不能跑" | 2026-07-27 |
| R-17 | 后端只判能力，不判页面 | **后端 Java 只判断 capability，不判断 pageKey**。理由（Dexter 原话）：「一个接口可能被不同页面调用，怎么能判断 pageKey」。授权输入固定为四项且**全部从数据库取**：session、能力、角色节点(任职)、数据节点。`pageAccessKeys` 后端**下发但不消费**（它是 `workspace_role` 的配置事实，前端用它决定菜单可见性） | 2026-07-28 |
| R-18 | 审计授权 | **审计改为继承宿主实体的读授权**。entityType 已决定宿主，不需要 pageKey 这个中间层。这样既满足 R-17，又不丢授权维度（审计本就无独立 action capability） | 2026-07-28 |
| R-19 | 能力绑定来源 | **契约 operation 增 `x-required-capability`**，generator 产出到后端。能力是 operation 的固有属性，不是页面的。复用已有的 6 个 `x-` 扩展机制，不新建概念；前端仍从 catalog 的 page→capability 取「这页显示哪些按钮」，两者从同一 capability key 集合派生但各答各的问题 | 2026-07-28 |
| R-20 | 运营端接口授权模型 | **读校验范围、写校验范围+能力**。①服务器无状态（session 存库）；②运营端与运维端是两套独立体系，本条只约束运营端；③一用户可有多个业务角色，每角色 = 节点（集团/大区/项目/总公司/门店）+ 能力；④登录与切换角色时把当前角色（**角色节点 + 写 capability**）存入 session；⑤**任何请求（读与写）都校验所操作的数据节点是否在当前角色节点范围内**；**写操作再校验 `x-required-capability`**；⑥**必须有统一处理入口，不得每个业务各自处理** | 2026-07-28 |
| R-21 | ~~范围锚点声明 `x-scope-anchor`~~ | **已撤回**（Claude 提出、Dexter「太复杂了」，2026-07-28）。撤回理由：锚点声明是"范围在查完之后再过滤"这一形状的产物；改成**范围在查询构造时注入**后，锚点不再是需要单独声明的量。替代方案见 R-22 | 2026-07-28 |
| R-30 | 执行顺序：安全先于结构 | **P3 后端安全切片提前到 P1/P2 之前**。理由：技术上无前置关系；20 个业务写端点零能力校验的敞口不该等一次全仓搬迁；且搬迁是机械移动、先修后搬更省。包 ID 不变，只改次序 | 2026-07-28 |
| R-29 | P1 降为跨包 ledger | 原 P1 要求"出现次数=1"却把 ST-2/6/9/11 实作留给 P5/P6 → 假绿或永久阻塞。P1 产出**单一权威 ledger**（authority source + 可追溯消费者），实作归 P5/P6，P8 复核。**同时废除"出现次数=1"作为泛化机器门** | 2026-07-28 |
| R-28 | 历史证据债不由 RM1 修 | P-C4 三个子项标 `HISTORICAL_EVIDENCE_DEBT`。**P8 不可能补造历史 red proof**；它只验证 transfer manifest 对三个 canonical debtId 的 exact set，未来 RM(n+1) 的输入分母才必须包含该集合。不得宣称“已进 RM2 分母”或“RM2 已接收”。 | 2026-07-28 |
| R-27 | §3b 升级为可验收映射 | 七列：`issueId → delivery unit → owning paths → concrete action → red mutation → exit assertion → deferred reason`。后三列由 **Codex 详设填写**，填不出必须显式 `DEFERRED` 或 `NOT_APPLICABLE_WITH_REASON`。包名映射不等于可验收分母 | 2026-07-28 |
| R-26 | 缺失 L2 spec 的处置 | **标 `DEFERRED` + `deferredUntilPhase: "RM2"`**，不补、不删、不造空壳。到期未补门自动转红。**边界（Codex 指出）：可 defer 的只有既有 legacy L2；RM1 本轮改写出的新行为（P3/P3-D/P5/P6）必须在当包配测试契约，不得借 RM2 延后**。理由：RM1 的 P3-D/P5/P6 正要大改前端与交互，现在写的 L2 改完即作废；且依 R-25，"到期"有真实落点 | 2026-07-28 |
| R-25 | RM 是整改**系列**，不是一次性 | 「RM1 做完之后，如果不符合预期还会有 RM2、RM3 这样的整改轮次」。推论：①P8 分母 = **本轮变更面**，不做全仓复核（否则每轮成本失控）；②P8 必须输出「已闭合/显式欠账结转/本轮新发现」三张表供 Dexter 判定是否开 RM2；③欠账结转须**机械对账**（RM(n) 欠账表是 RM(n+1) 分母的强制子集）——这是 CR00–CR08 靠人工重述的直接教训；④`phaseOrder` 用小数插位（RM1=5.5 / RM2=5.6 …），不重编号 R6；⑤`RM` 系列须在 `roadmap-program-registry.json` 登记，避免重演 R6 撞名；⑥**RM 任何一轮都不覆盖 R6 的移交部分** | 2026-07-28 |
| R-24 | 品牌授权改单项增删 | **退役整集合替换 `PUT .../brand-authorizations`，改为 `POST`（单个添加）+ `DELETE .../{brandId}`（单个删除）**。抽屉内由多选表单改为已授权品牌**列表**（含授权时间、使用情况、逐行取消）。理由（Dexter 原话）：「对授权只能单个添加，单个删除」。四条业务缺陷见 R-22 展开。**副作用：delete-all-reinsert 消失，DB 外键随之零代价可加**。与 v2 差异登记为 `INTENTIONAL_DIVERGENCE_FROM_V2` | 2026-07-28 |
| R-23 | `Membership` 改名 | **全面改为 `User`**。理由（Dexter 原话）：「当前根本没有会员的业务」——`Membership`/会员一词必须留给将来真实的顾客会员业务。且契约层已有 **10 处**（5 pageDesignKey + 5 routeSegment）在说 `Users`，只有 service/controller/wire/feature 一层说 `Membership`，本身即 R-5 单一真相违反。**DB 零污染，无需 migration**。展开见下 | 2026-07-28 |
| R-22 | 范围模型：三层，互不重叠 | 见下方「R-22 展开」。**第一层授权范围**（矩阵 `nodeType × resourceType`，唯一安全边界，越界 403）；**第二层场景过滤**（candidate 端点可选查询参数，**无安全语义**，不传即全量，**永不产生 403**）；**第三层领域不变量**（对所有调用方生效的写入校验，与身份无关，违反 = 业务错误码）。**写入端的范围校验只查第一层** | 2026-07-28 |

### R-23 展开：`Membership` 全面改名为 `User`（Dexter 裁决，2026-07-28）

**裁决原文**：「当前根本没有会员的业务……趁现在把这个 Membership 一起指出明确改了」。

**这不是审美取舍，是向契约里已有的多数真相收敛**。同一个概念，契约层已经用 `User`：

- 5 个 pageDesignKey：`PgIamGroupUsers`、`PgIamRegionUsers`、`PgIamProjectUsers`、
  `PgIamHeadCompanyUsers`、`PgIamStoreUsers`
- 5 个 routeSegment：`access/group-users` … `access/store-users`

只有 service / controller / wire type / feature 目录这一层叫 `Membership`。
**10 处说 User、1 层说 Membership，是 R-5 单一真相的违反**，且 `Membership` 在餐饮语境里
会与将来真实的**会员（顾客忠诚度）业务**撞名——那才是这个词该留给的业务。

**数据库零污染（已亲验）**：全部 migration 里 `membership` 只出现 **1 次**，
且是 `V20260726_130000_000__workspace_assignment_audit_timestamps.sql:1` 的**注释**。
表名、列名一处没有。**故本次改名不需要任何 migration。**

**改动面（第三轮盲审重算，作者原数字不可复现）**：全仓 **55 文件 / 383 处**；
排除 `doc/` 后**代码侧 23 文件 / 202 处**。作者原写"36 / 292"任何口径都复现不出，已作废。
`doc/evidence`、`doc/plans` 的历史文件不追溯改写——**但 `doc/plans` 里有一个例外，见下 I2**。

**盲审指出的致命遗漏：搜索词错了。** `Membership` 之外还有 `Member` 系列，
同一个"会员"词根，用 `Membership` 做 grep **完全看不见**，不改就等于没达成改名的目的：

| 遗漏项 | 引用数 |
| --- | --- |
| `wire/WorkspaceMember.java` | 29 |
| `wire/WorkspaceMemberAssignmentsItem.java` | 10 |
| `wire/WorkspaceMemberInvitationHistoryItem.java` | 8 |
| `WorkspaceMembershipService.Member` record 与 `.member()` 方法 | — |

**另一处遗漏：HTTP URL 路径**（用户可见面，且与 `routeSegment: access/*-users` 不一致）：
`/api/operations/group-workspaces/{key}/membership`、`.../membership/accounts/{accountId}`、
`.../membership/assignments/{assignmentId}/revoke` → 应改为 `/users`、`/users/{accountId}`、
`/users/assignments/{id}/revoke`。



| 层 | 现 | 新 |
| --- | --- | --- |
| owner service | `WorkspaceMembershipService` | `WorkspaceUserTaskReadService`（5 个方法**全部** `@Transactional(readOnly=true)`，且仓内已有 `*TaskReadService` 约定 ×3） |
| operationId | `getOperationsWorkspaceMembership` | `getOperationsWorkspaceUsers` |
| operationId | `getOperationsWorkspaceMembershipAccount` | `getOperationsWorkspaceUser` |
| operationId | `revokeOperationsWorkspaceMembershipAssignment` | `revokeOperationsWorkspaceUserAssignment` |
| schema | `WorkspaceMembershipPage` | `WorkspaceUserPage` |
| schema | `WorkspaceMembershipRevokeRequest/Result` | `WorkspaceUserAssignmentRevokeRequest/Result` |
| 错误码 ×4 | `WORKSPACE_IAM_MEMBERSHIP_{PAGE_NOT_GRANTED,SCOPE_FORBIDDEN,SCOPE_REQUIRED,TARGET_INVALID}` | `WORKSPACE_IAM_USER_*` |
| controller | `OperationsWorkspaceMembershipController` | `OperationsWorkspaceUserController` |
| feature 目录 | `features/workspace-membership/` | `features/workspace-users/` |
| 组件 | `WorkspaceMembershipPage.tsx` | `WorkspaceUsersPage.tsx` |
| wire | `WorkspaceMember` | `WorkspaceUser` |
| wire | `WorkspaceMemberAssignmentsItem` | `WorkspaceUserAssignmentsItem` |
| wire | `WorkspaceMemberInvitationHistoryItem` | `WorkspaceUserInvitationHistoryItem` |
| 领域 | `.Member` record / `.member()` | `.WorkspaceUser` / `.user()` |
| URL | `/membership`、`/membership/accounts/{id}`、`/membership/assignments/{id}/revoke` | `/users`、`/users/{accountId}`、`/users/assignments/{id}/revoke` |

**`WorkspaceAccountService` 不改名**：它是 `workspace_iam.workspace_account` 表的 owner，与表名一致是对的。
`account` = 持久化身份行（platform-admin 的对象），`user` = 通过角色任职被管理的人（operations-admin 的任务）
——这是契约已有的、可辩护的分轴，**不是新的撞名**。真正的第三个词是 `Member`，见上。

**但"两者职责不重叠"是错的**（盲审更正）：`WorkspaceAccountService` **不是纯写侧**——
`:24 list(...)`、`:25 require(...)` 都是 `@Transactional(readOnly=true)` 的读。
且 `WorkspaceMembershipService.member()` 自己手写了一条读 `workspace_account` 的 SQL
（`WorkspaceAccountService.require()` 已经拥有的同一个读），然后抛**对方的**
`WorkspaceAccountService.AccountNotFoundException` 来掩盖这次绕过。
更远一层：`PlatformWorkspaceAccountController.java:44-46` 把
`WorkspaceMembershipService.Member` 映射成 `WorkspaceAccount` wire ——
**同一个领域读，喂出了两套 wire 词表**（platform 面叫 Account，operations 面叫 Member）。
这是一条独立的单一真相违反，归 RM1-P1，不因改名而自动消失。

**盲审发现的生成链缺口（I2，必须写进实施步骤）**：
四个 `WORKSPACE_IAM_MEMBERSHIP_*` 错误码的**生成权威不在 `contracts/`**，而在
`doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:10`。
故"先改 `contracts/openapi` → regenerate"这条链**覆盖不到错误码**，必须显式加上这个文件。
另 `contracts/policy/frontend-asset-carryover-manifest.json` 也是 codegen 输入
（`edge-codegen.mjs:140` 读），其中 `targetPath` 指向 `features/workspace-membership/...`、
`generatedSlice`/`focusedEvidence` 含 membership 串，改目录不同步会留悬空路径。

**另两条附带事实**：这 4 个错误码 (a) 声明在 **platform 面**的 paths 文件里
（`platform-admin/workspace-access.paths.yaml:765-768`），因而生成进 `platform-edge.ts`、
在 `operations-edge.ts` 里**一次都没有**；(b) 在 Java 侧**全是死码**，`EdgeProblemCode.java:87-90`
之外无任何抛出点。改名顺手，但"死码 + 挂错面"是独立 finding。

**顺序**：改名是**契约驱动**的——先改 `contracts/openapi/`，再 regenerate，
wire type 与前端 generated client 随之产出。**不得手改 generated 文件**（否则下次生成即回退）。

**顺带发现的 E-0 违反**：`WorkspaceAccountService.java:24` 的 `list()` 在 RowMapper 里调
`require(...)`，`require()` 自己发查询 —— 又一处 `1 + N`，与 P-E6/E7/E8 同形，一并计入 P4-B。

### R-22 展开：三层范围模型

**起因**（Dexter 提出的反例，2026-07-28）：项目管理员建门店，表单里必须选总公司；
总公司**不在项目的管理范围内**，但一定要能搜。若"范围"只有一种，这个场景无解。

**v4 的仓外事实**（已亲验，`catering-server-v4`）：
`ResourceVisibilityUseCases.buildContext(...)` 的 `case "PROJECT"` 分支——
层级维度收敛（`visibleProjects` 收敛到自身，`visibleRegions` 是其**父区域**、收敛为单元素）、`visibleStores` 收敛到本项目，
而 `visibleBrands / visibleTenants / visibleHeadCompanies` 三条一律
`listXForVisibility(groupWorkspaceId, null, "", 10_000)`，**即整个集团空间不收敛**。
盲审补充：这不是 PROJECT 独有——`COMMERCIAL_GROUP`、`REGION` 分支同样不收敛这三条，
**5 个 nodeType 里 3 个如此**，只有 `STORE` 与 `HEAD_COMPANY` 真正收敛。
策略表落在 `contracts/registry/iam-org-governance-manifest.json`
的 `resourceVisibilitySelectorMatrix`（5 nodeType × 6 resourceType，
声明值域含 `SELECTABLE/FIXED/HIDDEN/FORBIDDEN`，但**实际只用到前三个**——
`FORBIDDEN` 仅作代码侧未知类型的兜底，30 个格子里一个都没用），生成为
`GeneratedIamOrgGovernanceManifest.resourceSelectorPolicy(nodeType, resourceType)`。
写入校验 `requireStoreCreateVisibility(...)`（`:178-198`）**不是复用同一次** `buildContext`
——第三轮盲审更正：它在 `:182` **自己重新调一次** `buildContext`，且本身是 `@Transactional(readOnly=true)`、
与随后的 `createStore` 是**两个独立事务**，存在 TOCTOU 窗口。
**成立的是弱结论**：候选与写校验共用同一个**推导函数**与同一组输入，因此逻辑上一致；
**不成立的是**"同一次计算因而原子一致"。v2s 设计不得据后者立论。

**v4 的两点不可照抄**（同为亲验）：
1. `context(gw, currentNode, pageKey, usage)` 的方法体第一行即 `return buildContext(gw, currentNode);`
   —— `pageKey`、`usage` 在 4 个方法上**全是死参数**。故"照 v4"**不引入** pageKey 感知，与 R-13/R-17 无冲突。
2. `buildContext` 的重查询问题**存在但被作者夸大**（盲审更正）：最多 **4 条** `LIMIT 10_000`
   （COMMERCIAL_GROUP / REGION / PROJECT 三个分支各 4 条），**STORE 与 HEAD_COMPANY 两个分支 0 条**。
   两个口径打架属实且更刺眼：`OPTION_LIMIT = 200` 与 `10_000` **出现在同一个 `buildContext` 方法内**
   （`:298` 的 HEAD_COMPANY 分支用 200，其余用 10_000，对的是同一个 `visibleTenants` 字段）。
   v2s 取其形状，不取其实现；候选查询必须按需 + 搜索词下推。

**三层的归属与失败模式**：

| 层 | 由什么决定 | 有无安全语义 | 违反时 |
|---|---|---|---|
| ①授权范围（ceiling） | 矩阵 `nodeType × resourceType`，与场景无关 | **是，且是唯一的** | 403 |
| ②场景过滤 | candidate 端点的可选查询参数（如 `brandId`） | **无** | 不适用；参数不传即退回全量 |
| ③领域不变量 | 业务规则本身，对所有调用方（页面/seed/导入/未来 TDP）一致 | 无（与身份无关） | 业务错误码 |

**红线（最易被实现时糊在一起，必配红变异）**：
- **写入端的范围校验只查第一层**。第二层一旦参与授权判定，场景过滤就变成安全规则，
  后端又必须知道"这是哪个场景"，即回到 R-13/R-17 明令禁止的形状。
- **第二层永不返回 403**。
- 矩阵格子保持**无条件**的 `SELECTABLE/FIXED/HIDDEN/FORBIDDEN`，
  **不得出现"带条件的 SELECTABLE"**——业务收敛属于第二/三层，不上提到矩阵。

**v2s 现状（亲验）**：
- `organization.head_company_brand_authorization`（`head_company_id, brand_id` 复合主键）
  已存在于 `V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:126`，第三层的关系是现成的。
- `StoreCandidateTaskReadService.candidates(...)` 已踩在正确形状：候选查询只按
  `workspace_uuid + group_workspace_key` 过滤（**不按角色节点**），
  且签名已含 `brandId`、brands 查询写作 `(? IS NULL OR id=?)`
  —— 这正是第二层"参数化收敛、默认不限制"。
- **缺口（更正后的真实缺口，见下）**：`candidates` 的 `heads` 查询无对应过滤参数，
  `head_company_brand_authorization` 在**候选查询**中未被使用（第二层缺）；
  写入端**未复用第一层可见集合做范围校验**（第一层缺）。

**Dexter 已裁决（2026-07-28）**：「是的，这个是业务事实」——
即"门店的总公司必须已授权该门店的品牌"**是真业务不变量**，属第三层，对所有调用方生效。

**作者错误更正（本轮第 7 次同型错误）**：先前写"写入端无第三层不变量校验"是**错的**。
逐条打开源码复核，**第三层在 Java 侧三条写路径上已全部实现**：

| 写路径 | 位置 | 现状 |
| --- | --- | --- |
| 建店 | `BusinessEntityService.java:157` | `headCompanyId != null && (!enabled(...) \|\| !authorized(headCompanyId, brandId))` → 抛 `OrganizationValidationException` |
| 改店 | `:184` | 同上，同一表达式 |
| 改授权（反向） | `:209-210` | 先查 `SELECT DISTINCT brand_id FROM organization.store WHERE head_company_id=?`，若被移除的品牌仍被门店使用则拒绝 |
| 判定实现 | `:341` | `authorized(headCompanyId, brandId)` 查 `head_company_brand_authorization` |

**故第三层的真实缺口只有一条：它只在 Java 侧成立，DB 侧无约束。**
按 Dexter 对第三层的定义——「对所有调用方（页面/seed/导入/未来 TDP）一致」——
Java 侧校验覆盖不了直接 SQL 的 seed 与导入。

**已由 Dexter 裁决消解（2026-07-28）：品牌授权改为单项增删，批量替换退役。**

裁决原文：「这个授权，不应该一个表单提交批量吧……对授权只能单个添加，单个删除」。

**问题根源不是实现偷懒，是契约形状。** 契约层只有一个
`PUT .../head-companies/{id}/brand-authorizations`（`replaceOperationsOrganizationHeadCompanyBrandAuthorizations`），
语义是**整集合替换**；后端收到一个集合，就只能全删全插。前端
`HeadCompanyManagementPage.tsx:203-221` 的抽屉里是 `ProFormSelect mode="multiple"` + 「保存授权」。
（**注意**：抽屉本身**已经**独立于"修改总公司"表单，v2 `BusinessEntityManagementPage.tsx:530` 同形；
要改的是抽屉内部的交互，不是把它拆出来。）

**批量替换在业务上的四条缺陷（按严重性）**：

1. **把单项意图变成整表重写**。用户想的是"加一个品牌"/"取消一个品牌"，
   多选框逼他对整个集合做读-改-写。违反 UI 自问的"是否有更短、更自然的路径"。
2. **失败连累无关操作**。撤销有专属失败条件（品牌仍被门店使用）。
   用户若一次操作里既取消一个在用品牌、又新增两个，**整个提交失败、两个新增一并丢失**；
   且后端拿到的是集合差值，报错只能笼统说"某个品牌仍被使用"，无法点名。
3. **并发下无谓冲突**。`expectedVersion` 锁整个集合，两个管理员各加一个不同品牌必然有一个失败，
   而这两个操作本无关系。
4. **`authorized_at_epoch_millis` 今天在说谎**。全删全插把**所有**行的授权时间重置为 `now`。
   改单项后该字段第一次为真，并可上界面。

**目标形状**：抽屉内不是表单，是**已授权品牌列表**——每行显示品牌、授权时间、使用情况
（"N 个门店在用"）与「取消授权」（在用时禁用并提示具体门店）；上方「添加授权」为**单选**品牌搜索框。

**契约改动**：

```
退役  PUT    .../head-companies/{id}/brand-authorizations
新增  POST   .../head-companies/{id}/brand-authorizations              body {brandId}
新增  DELETE .../head-companies/{id}/brand-authorizations/{brandId}
```

**`expectedVersion` 的处置（作者建议，Dexter 未反对即按此实施）**：
授权按**子资源**处理——**不动 `head_company.version`**（现 `:215` 每次改授权都 +1），
**也不要 `expectedVersion`**。单行的加/删本身幂等可判定（重复添加 → 409 或幂等返回；
删不存在 → 404），无需版本号防丢失更新。授权行有自己的生命周期，不该寄生在总公司版本上。

**与 v2 的差异须显式登记**：v2 同样是多选批量替换。本项为 `INTENTIONAL_DIVERGENCE_FROM_V2`，
理由即上述四条；依 T-2（对齐能力与行为、不对齐实现形式）与 UI 自问（不得从现有接口反推用户任务）成立。
登记后 v2 对照复核不得将其判为漏抄。

### 由此消解的 DB 约束争议

全删全插消失后，`DELETE` 只删正在被撤销的那一行，而该行若被门店使用，反向守护先行拒绝。
**原 FK 与 delete-all-reinsert 的冲突不复存在**：

- **不需要**差分更新改造（没有全删全插了）
- **不需要** `DEFERRABLE INITIALLY DEFERRED`（那是为绕开全删全插才要的，代价是对所有写入方放松即时性）
- **外键可直接加，且语义干净**：

```sql
ALTER TABLE organization.store
  ADD CONSTRAINT fk_store_head_company_brand_authorized
  FOREIGN KEY (head_company_id, brand_id)
  REFERENCES organization.head_company_brand_authorization (head_company_id, brand_id);
```

可行性已核：被引用表主键正是 `(head_company_id, brand_id)`；`store.head_company_id` 可空、
`brand_id` 为 `NOT NULL`，默认 `MATCH SIMPLE` 在前者为 NULL 时跳过整个复合检查，
恰等价现有 Java 的 `!= null` 前置。

**作者结论：加。** 理由是它现在**零改造代价**——不必改实现来迁就，不必放松检查时机，
只是把一条已成立的业务规则写进 schema，顺带覆盖 seed 与将来的导入（即 Dexter 对第三层的定义）。

**仍必做**：补两条 focused test —— 盲审穷举确认 `:157`/`:184`/`:209-210` 三处手写条件
**目前没有任何测试指名它们**。(a) `createStore` 传未授权 (head, brand) → 必须抛
`OrganizationValidationException`；(b) 撤销在用品牌的反向守护触发。

**加 FK 前的前置动作**：先跑对账查询数已存在的违反行
（`SELECT count(*) FROM organization.store WHERE head_company_id IS NOT NULL AND NOT EXISTS(...)`），
不为 0 先报 Dexter，**不得自行清洗数据**。

**盲审另发现的两条（并入 P3）**：
- `authorized(...)`（`:341`）的 SQL **无 workspace/group 过滤**，`head_company_brand_authorization`
  表本身也没有 workspace 列。今天安全只因同一条件里另有两个 `enabled(..., workspaceUuid, ...)` 兜着；
  任何未来调用方若只调 `authorized()` 就是跨 workspace 洞。
- **候选列表与写入不变量不是同一条规则**：`StoreCandidateTaskReadService` 的 `heads` 返回全部启用总公司、
  不 join 授权表，用户选中后在提交时被 `:157` 拒绝。这是**今天就存在的 UI 缺陷**，
  比 FK 与否更用户可见（R-22 第二层缺口的具体后果）。


**R-18 与 R-20 的关系**：审计继承宿主实体的读授权，而读授权按 R-20 = **节点范围校验**。
故审计的实际判定是「宿主实体的所属节点是否在当前角色节点范围内」——审计无独立 capability，
也不需要，因为它是读。

**R-17 的边界（第二轮盲审指出，必须写死）**：R-17 禁止的是**客户端可控输入驱动授权**
（`@RequestParam pageDesignKey` 同时推「要什么能力」与「操作什么目标」）。
它**不禁止**服务端常量作为读授权维度——但按 R-18，审计那处改用宿主读授权，该场景一并消失。
Codex 不得把 R-17 泛化成"凡出现 pageKey 字样即删除"。

## 1b. 两份文档的仲裁规则（第二轮盲审指出缺失）

Roadmap 声明清单是唯一分母，清单声明 Roadmap 是执行权威——冲突时无据可依。**规则**：

- **事实与范围以本清单为准**（问题是否成立、分母是多少、证据在哪）
- **排期与顺序以 Roadmap 为准**（哪个包做、先后关系、exit 判据）
- **两者冲突时，先修清单再改 Roadmap**，不得反向；修订必须同时更新两份，不留单侧更正

## 2. 作者已确认的设计倾向（两轮自审的判据）

从多轮问答中提炼，用于自审时判断"这个方案是否符合 Dexter 的尺子"：

0. **单一真相，职责清晰** —— 一件事只在一处判断。不要这里判断、那里也判断。
   **这是最高优先级原则**：当它与其他倾向冲突时以它为准。它同时是本清单 §11 的组织依据
0b. **简单、高效、健壮；能少写一行代码绝不多写** —— 优先复用仓内已存在且已验红的件；
   新建组件前必须先证明"现有的不够用"。照 v2 指的是**能力形状一致，不是行数一致**：
   v2s 有 v2 没有的 typed `EdgeProblemCode`（106 个），同样的行为用表驱动写即可，不逐行照搬
1. **代码治理严谨，业务设计不过度** —— 门/边界/证据照严；数据模型偏简单（JSON 装一组 key 是被偏好的）
2. **v2 是同构参照系，v4 不是** —— v2 与 v2s 同构（单体、契约驱动、两个 admin app）；
   v4 是 umi + 微服务时代产物，只能作为"有没有 v2 没想到的能力"的补充来源，**不作架构形状参照**
3. **职责切分要干净** —— 后端答授权事实，前端答 UI 事实；不让任一方感知对方的概念
4. **共享区要有第二个消费者才建**，不预留
5. **不做投机性优化** —— 未被真实 query/EXPLAIN 证明的索引不加；DEV 量级不支撑生产猜测
6. **边界纯度优先于局部接线简度**（D-4 的裁决理由）
7. **分母完备性靠机械枚举，不靠人判断**
8. **历史垃圾必须删，不留"以后可能有用"**
9. **不接受"最后统一验证"** —— 过程中每写一部分就核一次
10. **门必须能被真实红变异打红**，`--self-test` 不得有任何自我豁免

## 3. 结构性问题（新增，R-1 所指）

### P-A1 ｜`libraries/backend/` 是 v2 微服务拆分的产物，在单 app 拓扑下名不副实 `亲验`

**事实**：
- `apps/backend/terminal-data-server/` 只有 `README.md` + `build.gradle.kts`（内容仅 `plugins { java }`，
  **零依赖、零 src**）。它从不消费 `libraries/backend/` 任何东西 → **当前消费者数量 = 1**
- `libraries/backend/` 下 10 个模块，7 个拥有 owner schema 与业务事实（含 SQL 文件数：
  workspace-iam **15**、organization **11**、contract 5、platform-workspace 5、platform-iam 4、
  extension 4、platform-asset 2），3 个含 SQL 为 0
- 那 3 个"真库"里：`platform-foundation` 只有 `TimeProvider`/`SystemTimeProvider`/一个 boundary 标记类
  （**3 个文件**）；`audit-contract` 是审计领域值类型；`platform-access` 是**本 app 的** edge 上下文校验
- 布局决策 `2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md:16,19` 的理由是
  「shared Gradle library area」+「**matching the all-v2 layout**」—— 依据是 Gradle 物理位置与 v2 惯性，
  **不是领域语义**
- `apps/backend/catering-business-server/.../app/` 下**只有 `bootstrap/`、`configuration/`、`edge/` 三层**
  —— 所有业务 owner 都在 app 外面

**严重性**：结构性。为一个 `TimeProvider` 维持了十模块的顶层共享区；新人打开 `libraries/` 会预期
无状态工具，看到的是 15 个文件在写 SQL。

**方案（Dexter 2026-07-28 已选方案 B）**：

> 作者原稿只给了一个方案（塌缩成单 Gradle 模块）且未构造替代，违反 `SOLUTION_REASONABLENESS_FIRST`。
> 第一轮盲审构造出方案 B 并证明其严格占优，Dexter 已选 B。**原方案 A 与由它派生的 P-A2、
> Java 包名裁决一并作废。**

| 方案 | 做法 | 判定 |
| --- | --- | --- |
| ~~A~~ | 迁回 app 且 Gradle **10 个**子项目塌缩为 1 | **作废**。ArchUnit 从零建门并验红、编译期强制降级为测试期发现，业务价值为零 |
| **B（已选）** | 保留 **10 个** Gradle 子项目，**只把目录搬进 `apps/backend/catering-business-server/modules/*`** | 满足 R-1 字面（物理迁回 app）；**Gradle 编译期强制零损失**；路径类改动与 A 相同 |
| C | 只迁 `platform-access`/`platform-foundation`/`audit-contract` 三个真库 | 成本约 1%，但不满足 R-1 的"全部迁回" |

**两处更正（作者错误，2026-07-28）**：

1. **数量**：先前写"9 个"是错的。9 是 `catering-business-server` 的**直接依赖数**；
   `audit-contract` 由各模块传递依赖、未被 app 直接依赖。
   `libraries/backend/` 下实为 **10 个**子项目，全仓 Gradle 子项目 **12** 个（2 app + 10 module）。
2. **"包名零改动"已撤回**。`module-dependency-registry.json` 的 `commandApiPackages`、
   ArchUnit 规则、6 个 `XxxBoundary.java` 标记类**全部按 package 判定**；
   目录改而 package 不改，会留下"目录说 A、package 说 B"的第二套真相（违反 R-5）。
   **改为 package 同步对齐**（98 个文件机械重命名 + 9 条 `commandApiPackages` 同步）。

方案 B 的目标形状（逐项映射表见 Roadmap RM1-P2-1，此处只给形状）：

```
apps/backend/catering-business-server/
├── src/main/java/com/catering/v2s/app/   bootstrap 2 / configuration 2 / edge 255（不变）
└── modules/                              ← 10 个 Gradle 子项目搬到这里
    ├── L0  foundation/  execution-context/  audit-model/
    ├── L1  extension/  asset/  platform-admin-iam/
    ├── L2  organization/
    ├── L3  store-contract/  workspace/
    └── L4  workspace-iam/
```

改名 3 处：`contract`→`store-contract`（与仓库根 `contracts/` 撞名）、
`audit-contract`→`audit-model`（8 个纯 record 不是契约）、
`platform-` 前缀一词两义拆开。理由与逐项表见 Roadmap RM1-P2-3。

`libraries/backend/` 消失；`libraries/frontend/admin-ui-foundation` **保留**（两个真实消费者）。
**共享区在出现第二个消费者时再建，不预留。**

**改动面**（第三轮盲审 + Codex 双方复算后的最终口径）：**61 处 / 15 文件**，分两个口径——
`*.gradle.kts` 的 `:libraries:backend` 冒号坐标 **46 处 / 9 文件**（Codex 独立复算一致）、
非 gradle 的 `libraries/backend` 路径串 **15 处 / 6 文件**
（`cli.mjs` 9、`BackendModuleBoundariesTest.java` 2、`affected-l2-registry.json` 1、
`edge-codegen.mjs` 1、`r5-remote-testcontainers.mjs` 1、`check.mjs` 1；
**`verify-gates/verify.mjs` 实为 0 命中**，先前稿写 ×2 是错的）（
+ `r5-remote-testcontainers.mjs` + `scripts/README.md`）、`code-layout`/`backend-boundaries` 的
allowlist、活文档；**历史 review/evidence 36 个文件不追溯改写**。

### P-A2 ｜（作废）owner 边界执行层降级风险

**原条目建立在方案 A 之上，方案 B 保留 Gradle 子项目，编译期强制不丢，本条不再成立。**

作者在 ST-10 里把"移除 Gradle 这一层"写成单一真相的收益，是**误用 Dexter 的原则**：
Gradle 是**编译期强制**（类不在 classpath 上就写不出来）、registry 是**对账分母**、包名是**标签**
——三者不是三处判断。此处一并更正。

方案 B 下仍需做的只有一条（**不是新建门**）：`tools/module-dependency-registry/check.mjs:80-111`
的 `SOURCE_TASK_READ_UNDECLARED` 目前只扫 `libraries/backend/<module>/src/main`，
**迁移后必须扩分母到新路径**，否则对账门会静默失去覆盖。

## 4. 功能性阻断（2 条，均 `亲验`）

### P-B1 ｜`ck_invitation_status` 闭集与代码实际写入不符，公开邀请全链跑不通

`db/migration/V20260727_020000_000__named_status_and_organization_name_constraints.sql:48`

| | 值 |
| --- | --- |
| CHECK 允许（5） | `PENDING` `CONSENTED` `COMPLETED` `CANCELLED` `EXPIRED` |
| 代码真写入（8） | `PENDING` `ACCEPT_INTENT_RECORDED` `MOBILE_VERIFIED` `CREDENTIAL_READY` `COMPLETING` `COMPLETED` `CANCELLED` `REISSUED` |

**5 个值会被拒绝**：`WorkspaceInvitationService.java:272,311,323,399,226`。
`CONSENTED`/`EXPIRED` 在闭集里但代码从不写入。

**为什么静态全绿**：约束加于 07-27 16:07，`libraries/backend/workspace-iam/build/test-results/`
mtime 为 **07-26 06:23** —— 约束加入后无任何 owner 模块测试重跑。

**方案**：以 `WorkspaceInvitationService` 为唯一分母补齐闭集；**不得反向改代码迁就 migration**。
同轮补 focused test。**纪律缺口**：加约束类 migration 必须重跑对应 owner 测试——这是过程问题，不是个案。

### P-B2 ｜门店启停仍是死路，跨 CR03–CR06 四个包未修

`BusinessEntityService.java:127` 首行 `entityType(entityType)`，而 `:32` 的 `ENTITY_TYPES` 不含 `STORE`，
`:348` 不在集合内即抛异常。同文件 `:281`/`:288` 早已用
`"STORE".equals(entityType) ? "STORE" : entityType(entityType)`，`table()` 也支持 `STORE`
——**只有状态切换这一条路径漏改**。调用方 `OperationsStoreManagementController.java:55` 明确传 `"STORE"`。

**方案**：`:127` 改为与 `:281` 同一表达式。**必须补 focused test 并证明修复前为红**——
这条路径的特征是"前后端都写了、从没端到端跑通一次"。

## 5. 门与证据体系（5 条）

### P-C1 ｜self-test 的自我豁免没被删除，换到更隐蔽的位置

`tools/verify-gates/cli.mjs:446-460` 的 `prepareSelfTestClean()` **在自测前改写被测的生产源码**：

- `logging`：把硬编码密钥替换成 `System.getenv(...)`
  （**注意**：该密钥位于**测试专用构造器** `WorkspaceLoginRateLimitService.java:21`；生产构造器 `:20` 已是 `@Value` + 空值抛 `IllegalStateException`。修法见 Roadmap RM1-P0 表）
- `budget`：把 `FOR UPDATE` 替换成 `FORUPDATE`
- `affected-l2`：**直接把 18 个不存在的 L2 spec 文件建出来**

实测：`logging-boundaries` → `FAIL`；`logging-boundaries --self-test` → `PASS`。

**严重性：最高。** 比原来的 `if (action !== "frontend")` 更严重——原来是跳过，现在是**编辑代码制造通过的基线**，
使自测在结构上永不可能反映生产真相。而 self-test 正是 red-first 协议的执行载体。

**方案**：删除该函数。**baseline 必须是未经改写的当前树，baseline 不绿即整体 FAIL**。
`tools/code-layout/cli.mjs:174,185,195` 的 `mkdtempSync()` 空目录基线同理换成仓库拷贝。

### P-C2 ｜`standards-coverage` 仍识别不出被引用门被替换为 `exit 0`

把 `scripts/check/security-boundaries` 整体替换为 `#!/usr/bin/env bash\nexit 0`，
`standards-coverage --phase R5` 依然 `PASS / RULES=150`。**这是第一份诊断做过的同一个变异，CR00 声称已修，实测未修。**

矩阵引用 **17** 个独立 `enforcement.ref` 但从不执行（先前稿写 15 是作者错误，Codex 复算并经本轮实测确认为 17）。现成反例：矩阵引用的 `logging-boundaries` 当下真红，矩阵照绿。

**方案**：对每个被引用门跑已知红夹具调用，任一门不能被打红即整体红。**必须先证明能拒绝 `exit 0` 桩。**

### P-C3 ｜`affected-l2` 当前红，且分母与仓库布局脱节

```
R4_GATE=FAIL
REASON=R5_AFFECTED_L2_TARGET_MISSING:.../l2/authentication.spec.ts
```

registry 30 条 `paths` 中 **12 条指向不存在的目录**（全是 v2 旧命名：`platform-admin-governance/`、
`workspace-overview/`、`organization-overview/`、`contract-overview/`、`role-management/`、
`workspace-account-management/`、`extension-field-management/`、`organization-hierarchy/`、
`business-entity-management/`、`user-management/`、`app/session/`、`OperationsAdminSeed.tsx`）。
声明 23 个 L2 target，**18 个文件不存在**；两 app `package.json` 无 `test:l2` 脚本。

**后果比"门红"更严重**：即使 L2 补齐，这 12 个 surface 的改动**永远不会被 affected 选中**。
而 CR06 exit 写着 `status: PASS` + `fullComplianceScan: PASS`。

**注**：本次结构重组（P-A1）会再次改变所有后端路径，**该 registry 必须在重组后重建**，
否则脱节会从 12 条扩大。

### P-C4 ｜历史证据债（三个 canonical debtId；**在 57 条分母内**）

> **Codex 四轮指出两处矛盾，已定（2026-07-28）**：
> ①P-C4 没有稳定 debtId，`exact set equality` 无从做起；
> ②P-C4 是否属于 57 条分母前后不一致。

**裁决：P-C4 留在 57 条分母内**，它是清单条目、必须被交代。
它的 `concrete action` 不是"修"，而是**产出 transfer manifest**；
它的 `exit assertion` 是下表三个 debtId 的 **exact set equality**。
这样 57 不变，也不需要在 57 之外另立并列分母。

| canonical debtId | 事实 | 为何 RM1 不修 |
| --- | --- | --- |
| `HED-1-CR05-CR06-COMPILE-TEST-RECEIPT` | CR05 / CR06 的 package-exit 无 compile / test receipt | 当时未跑；事后补造的不是证据 |
| `HED-2-ACTIVE-RED-VERIFIED-NO-MUTATION-ARTIFACT` | 标为 `ACTIVE_RED_VERIFIED` 的项无红变异产物 | 同上 |
| `HED-3-SURFACE-21-OF-22-ZERO-L2` | 22 个 surface 中 21 个零 L2 覆盖 | 与 R-26 的 18 个 `DEFERRED` spec 同源，行为尚未稳定 |

**这三个 ID 是权威拼写**，Roadmap 的 P8 与将来 RM2 的输入校验都引用它们，不得改写或另起别名。

### P-C4 的其余门与证据缺口 `双验`

- `database-boundaries` 的 `bytea/base64/object_key/bucket_name` 控制**仍不存在**
  （向 migration 追加 `ADD COLUMN blob_data bytea` 后仍 PASS）
- `security-boundaries` 只校验 resolver 类名在**文件**里出现（把 `sessions.requireWorkspace(...)`
  换成 `null` 仍 PASS）；且 `expected.length !== 106` 是**新的硬编码分母**
- CR05/CR06 **无任何 compile/typecheck/test receipt**（CR03/CR04 都有；实测两 app `tsc --noEmit`
  退出 0、8 个 arch test 全绿——**不是坏了，是没记账**）
- CR05/CR06 声明 `ACTIVE_RED_VERIFIED` 但**无红变异产物**
- `actualChangedPaths` 不是从工作树导出（`2026-07-24-v2s-execution-roadmap.md` 磁盘 hash 与 CR04 记账不符
  且 CR05/CR06 未再记）——**这削弱 set equality 的意义：两数组相等但可能同时漏同一批文件**
- 21/22 surface 零 L2；`cr06-static-surface-and-page-key-closure.json` 名为 closure，
  实际只绑定 47 个运行时文件中的 21 个不同 targetPath
- 无 `gradlew`、无 `gradle/wrapper/`；`verify.mjs:26` 硬编码 `unix:///Users/dexter/.colima/...`
  （本机 `dextery`），从不引用 `scripts/test/r5-remote-testcontainers.mjs`；cleanup 首败即被跳过

### P-C5 ｜一个教科书级假绿，值得单独记 `亲验`

`cr06-write-capability-closure-problem-family.json` 定义的问题族原文是
「a frozen write operation can exist while users have no approved UI path that invokes it」
——它就是为防"写能力不可达"而建。其 `searchQueries` 含 `createWorkspaceInvitation`，
`searchedSurfaces` 第 13 项正是 `InvitationsPage.tsx`。

结果：**grep 命中调用文本就判定"已消费"**，而该文件全仓零引用、页面不可达。
守门器精确落进它自己命名的陷阱。

**方案**：不新建"可达性 checker"。把"被 pageRegistry 或 App 引用"作为 targetPath 的必要条件，
一条静态断言即可，纯机械可红变异。

## 6. 安全

### P-D0 ｜20 个业务写端点零能力校验，任何有效工作区会话可越权写 `亲验` `最高`

> 第一轮盲审发现，作者原先误分类为 ST-12 并标 `UNVERIFIED`。**它是本仓最严重的已确认安全缺陷。**

实测（`@PostMapping|@PatchMapping|@PutMapping` 计数 vs `actionCapabilityKeys|pageAccessKeys|allow(` 命中）：

| controller | 写端点 | 能力校验命中 |
| --- | --- | --- |
| `OperationsBusinessEntityController` | 9 | **0** |
| `OperationsOrganizationHierarchyController` | 4 | **0** |
| `OperationsStoreManagementController` | 3 | **0** |
| `OperationsContractController` | 3 | **0** |
| `OperationsHeadCompanyAuthorizationController` | 1 | **0** |

**后果**：任何持有效工作区会话的账号，可越权建/改/停门店、组织节点、合同、品牌、
实际经营租户、总公司品牌授权。前端用 `ACTION_CAPABILITIES.*` 控按钮可见性（且有静态断言逐条守着），
**后端不校验** —— 前端的可见性控制被误当成了授权。

**修法（按 R-19）**。

> **第二轮盲审更正**：作者原先写「复用 `WorkspaceAuthorizationCatalog:135` 已存在的 `...ForTarget`」
> —— **这对 P-D0c 成立，对本条不成立**。实测 `userManagementActionBindings` 只有 **10 条**
> （5 个 `PG-IAM-*` × `INVITE`/`ROLE_REVOKE`），`UserManagementAction` 枚举只有两个值；
> 而 catalog 的 **34 个 action**（`BC-ORG-STORE-CREATE` 这类）**没有任何 target→capability 绑定**。
> 且既有绑定形状的第一个字段就是 `pageDesignKey`，用它等于把 pageKey 请回来。
> **P-D0 与 P-D0c 必须拆开做。**

正确形状，四个输入**全部来自数据库**：

```
1. session          token → workspace_session                        （已有）
2. 能力              session → role → capability_keys                 （已有）
3. 角色节点(任职)     role_assignment.service_node_type / service_node_id  （表里有）
4. 数据节点          workspace_session.visible_data_node_id            （表里有）

所需能力：operation 的 x-required-capability（R-19，契约声明、generator 产出）
判定：    session.actionCapabilityKeys().contains(required)   精确成员判定，禁止前缀匹配
```

**为什么不是更小的方案**（作者构造并否决的替代）：

| | 做法 | 否决理由 |
| --- | --- | --- |
| A | 扩 `userManagementActionBindings` 覆盖 34 个 action | 绑定形状第一字段就是 `pageDesignKey`；业务实体写操作也没有天然的 `targetOrganizationType` |
| B | 每个 controller 内联写死 capability key | 绑定住在 Java 里、契约不知道；前端还要从 catalog 另取一份 → **两份真相** |
| **C（R-19 已裁）** | 契约 operation 加 `x-required-capability` | 能力是 operation 的固有属性；复用已有 6 个 `x-` 扩展机制；**门可机械检查"每个写 operation 必须声明它"** |

**新增工作仅一处**：generator 多读一个字段并产出到 server 侧。它替代的是 20 个端点各自硬编码，
**净代码量是降的**。

**从 v2 抄一条约束**：v2 `WorkspaceBusinessAuthorizationService.java:58-60` 明写
「exact catalog membership owns actions; **a string prefix must never grant a new or differently scoped action**」
—— 能力判定必须是精确集合成员，禁止前缀匹配。

**不需 Dexter 裁决**。每个端点补一条 focused red test。

### P-D0c ｜授权用的"钥匙"由客户端自己挑：pageKey 同时决定所需能力与操作目标 `亲验` `最高`

> Dexter 2026-07-28 指出「一个接口可能被不同页面调用，怎么能判断 pageKey」后，作者据此复核发现。
> **性质比 P-D0 更重**：P-D0 是没锁门，这条是锁的钥匙由访客自己挑。

五个 `PG-IAM-*` 页面共用同一组端点，靠 **`@RequestParam String pageDesignKey`**（客户端可控）区分。
`OperationsWorkspaceMembershipController:47` 的 `allow(...)` 用这个不可信输入推导了**两件事**：

```java
targetType(pageKey)                  → userManagementTargetOrganizationType  「操作哪类节点」
requiredCapability(pageKey, action)  → capabilityKey                          「需要什么能力」
```

**两者同源于一个客户端输入，因此无法互相交叉验证。** 攻击面：客户端挑一个自己**有**能力的
pageKey，去操作另一类节点的目标——因为 `targetType` 也跟着那个 pageKey 走了。

**渗透面**（`亲验`）：
- 契约层：`contracts/openapi/paths/operations-admin/workspace-access.paths.yaml` 把
  `pageDesignKey` 作为**请求参数** —— UI 概念进了 wire 契约
- edge 层：4 个 controller 从请求里收它
- owner 层：`WorkspaceAuditAuthorizationService:128` 判 `requiredPageKey`

**修法**：目标类型改从**数据库里的实体**取（`assignmentId` → `role_assignment.service_node_type`），
再按目标推所需能力；全程不碰 pageKey。契约里删除 `pageDesignKey` 请求参数；
4 个 controller 与 owner 侧的 pageKey 判断一并删除。

**不需 Dexter 裁决**（R-17 已裁）。

### P-D0b ｜`platform_admin` 没有可用于认证的手机号列 `亲验`

`V20260726_090000_000:85-90` 建表只有 `mobile_mask_source VARCHAR(32)`（**可空、无唯一约束、无 normalized 形态**），
列名直说了用途：**掩码源**。`PlatformAuthenticationService.java:201` 写入的正是它。

而 wire 的 `PlatformAdminDetail` 有 `mobile`、`PlatformAdminCreateRequest` 要求 `mobile`、
controller 也在填 —— **契约要求的字段在库里没有对应的可认证形态**。

**这条是 P-N1（platform OTP 登录）的前置**：手机号要能定位账号，必须补
`mobile_normalized` + 唯一约束。**Dexter 已裁决保留 `mobile`**，理由由"跟 v2 一样"升级为
"它是 OTP 登录的定位键"。

### P-D1 ｜原始邀请令牌明文进 receipt，被无 scope、无状态过滤的查询无限期复活 `亲验`

`WorkspaceInvitationService.java:107`（readback 带原始令牌）→ `WorkspaceIamCommandReceiptService.java:47`
（整个 readback 序列化进 `response_json`）→ `WorkspaceInvitationService.java:455-465`（反向捞回）
→ `:157-159` 拼成 `invitationPageUrl`

三问题叠加：一次性凭据明文持久化且**代码依赖这份明文工作**；查询 `WHERE response_json->>'id'=?`
**无 workspace 谓词**；**无状态/过期过滤**——`CANCELLED`/`EXPIRED`/`COMPLETED` 的邀请一样能把当初的活令牌
重新渲染成可点链接。

**双标证据**：`platform_asset` 明确不存 `bindGrant`（`PlatformAssetService.java:82`）且有 DB CHECK
（`V20260727_010000:147`）兜底。同一原则在 workspace_iam 侧反着做。

**需 Dexter 裁决**：管理员是否需要在创建后重新获取同一条邀请链接（Journey 语义）。
若需要，应走已存在的 `reissue`(`:219`) 重新签发，**不是复活旧令牌**。

### P-D2 ｜授权拒绝返回裸 500，24 个已声明异常无 Problem 映射 `亲验`

`OperationsWorkspaceMembershipController.java:51`、`OperationsWorkspaceInvitationCandidateController.java:39`
的 `AccessDeniedException` 未被唯一的 `ContractProblemAdvice.java:35` 覆盖。

未映射清单含**乐观锁冲突主路径**：`PlatformAdminVersionConflictException`（`apps/backend` 全目录零出现）、
`LoginNameConflictException`、`AssetClaimRejectedException`、`AssetIdempotencyConflictException`、
`InvitationStateException`、`OtpInvalidException`、5 个 `*ReceiptCorruptException` 等。

**推论**：两管理员并发编辑同一账号 → 500；重名登录名 → 500；越权访问五张会员页 → 500。

**方案**：advice 补 403 分组 + 一个 typed 兜底 handler。**兜底必须有**，否则每加一个 owner 异常就多一个裸 500。
同类：`OrganizationHierarchyService.java:63-66` 无 `DuplicateKeyException` 捕获（同仓其余 7 处都有）。

### P-D3 ｜`extension` 与 `platform_asset` 幂等在并发下不成立 `双验`

`ExtensionCommandReceiptService.java:26`、`PlatformAssetService.java:62` 用
`SELECT ... WHERE idempotency_key=? FOR UPDATE` —— Postgres 对**不存在的行不加锁**。
同 key 并发首用时两事务都执行 `command.get()`，后者撞主键 → 未映射 → 裸 500 → 客户端重试。

**同仓其余 6 个 receipt service 全部用 `pg_advisory_xact_lock(hashtext(key))`**。
**这是偏离既有正确写法，不是没想到。** 修完此条，R-11 的 `database-operation-budget` 红自然消解。

### P-D4 ｜内容寻址对象的回滚删除会删掉他人正在用的对象 `推论`

`PlatformAssetService.java:74` `objectKey` 完全由内容 SHA-256 决定；`:83-88` 失败时 `objects.delete`。
两 workspace 上传同一张图 → 同一 objectKey；A 成功、B 失败回滚 → **A 的资产指向已删除对象**。

**方案**：回滚只在"本次确实新建了对象"时删除，或改用 per-assetRef 对象键。

### P-D5 ｜MinIO 上传全程占用 DB 连接，客户端无超时 `推论`

`PlatformAssetService.java:55-56` 整体 `@Transactional`；`:58` 读完整上传流 + `ImageIO.read`(`:166`)；
`:79` `objects.put(...)` 是网络调用。`MinioAssetObjectStorage.java:31` **无任何超时配置**。
`requireActivePublicReference` 的 `objects.exists()`(`:121`) 更在 ResultSetExtractor 内部、游标未关闭时。
`application.yaml` 无 `hikari.*` → 默认池 10 连接。

**推论**：10 个并发上传（图片 5MB、`MAX_VIDEO_BYTES` 512MB）即耗尽连接池。

**方案**：内容落盘/校验/`objects.put` 移出事务；MinioClient 设超时。HikariCP 配置进 `HANDOFF.md`。

### P-D6 ｜其余安全项 `双验`

- 密码重置的 `requireMobile` 在限流**之前**（持券方可无限猜手机号且不计数）
- 登录 OTP 缺 SOURCE 维度限流，且账号不存在时零记账（可匿名枚举 workspace 内手机号）
- OTP 限流 subject 用 `reset.id()` 而非 `account.id()`（每次重新发起即清零）
- 生产 OTP 响应体返回 `testCode`（**2 个 controller** `OperationsCatalogAuthenticationController`、
  `PublicWorkspacePasswordResetController`，**+ 3 个 generated wire record** `PublicInvitationOtpSendResponse`、
  `WorkspaceOtpSendResponse`、`WorkspacePasswordResetOtpSendResponse`；先前稿写"3 个 controller"是作者错误，
  Codex 指出并经本轮实测确认）；前端不回显且有静态断言，
  **但没有任何门禁住服务端不返回** —— 若 R5 阶段本就靠它跑 L2/seed，属 `HANDOFF.md` 欠账（上线前按 profile 关掉）
- 宿主 detail 读在授权之前，构成存在性 oracle（404/403 差异可探测实体存在）

## 7. 效率（7 条主，`亲验`；R-11 已裁决必须整改）

**共性根因**：这不是几个独立 bug，是**同一形状的反复出现**——
「外层查 id 列表 → 逐行调一个自己也发查询的方法」，那个方法多半是路径解析或 `require`。

> ### 第三轮盲审否证：红线 E-0 已作废，替换为运行时查询预算
>
> **原提案**：「`RowMapper`/`ResultSetExtractor` 的 lambda 体内不得出现 `jdbc.` 调用」。
> **盲审证明它抓不到自己要抓的东西**：全仓约 24 个真实站点里，字面含 `jdbc.` 的只有 **3 个**
> （`OrganizationHierarchyService:193`、`BusinessEntityService:271`、`WorkspaceRoleService:93`）——
> **提出这条红线所依据的 6 个发现，一个都抓不到**，因为它们全部经由具名辅助方法
> （`path()` / `nodePath()` / `require()` / `describePath()` / `describeEntityPath()` / `view()` /
> `requireEntity()`），callback 体内没有 `jdbc.` 字样。
> 另外两个洞：只点名两种 callback 类型，漏掉 `RowCallbackHandler`
> （全仓最重的无界站点 `OrganizationVisibilityService:78/:91` 正是这一类）；
> 对 stream/loop 形态的 N+1 结构性失明。
> 正则实现还会**误报** switch 箭头（`StoreCandidateTaskReadService:36-38` 的
> `case "GROUP", "REGION", "PROJECT" -> jdbc.query(...)` 不是 lambda）、
> **漏报**所有跨行参数列表。
>
> ### 替换方案 E-0'：运行时每读路径 SQL 计数预算
>
> 基础设施已存在：`OrganizationOwnerServiceTest.java:25-35` 已经在跑真实
> `PostgreSQLContainer` + Flyway + 手工构造的 `JdbcTemplate(new DriverManagerDataSource(...))`。
> 把那个 `DataSource` 包一层计数委托（约 40 行，零新依赖），对每条读路径在固定 fixture 规模下
> 断言 SQL 条数不超过签入的预算 JSON：
>
> ```
> assertQueryCount("membership.page", () -> users.page(ws, key, "STORE", null, 1, 20, 1L)) <= budget
> ```
>
> 三问全过：**纯机械**（比两个整数）、**可复现**、**有真红变异**（把 `path(...)` 塞回 mapper，计数必变）。
> 且它对间接调用、跨模块端口、`RowCallbackHandler`、stream 形态**一视同仁**，
> 因为它量的是实际行为而不是语法代理。
> **静态门不做**——盲审给出的静态版本需要维护一份"会发查询的方法"传递闭包 + allowlist，
> 收益不抵维护成本（违反 T-1 与效率红线）。

**与 RM1-P2 的关系**：这些 N+1 **不是模块拆分造成的**——`organization` 的 SQL 全在
`organization.` 一个 schema 内，O(N²) 是自己写出来的。P2 既不制造也不解决它们，两者独立。
反过来说：P2 实施中若出现"为了模块边界把一条 JOIN 拆成两次查询"，属实施跑偏——
registry 的 14 条 `TASK_READ` 边本来就允许跨 owner JOIN（rationale 原文即
"joins the owner facts for list and detail"），P2-5 判据 3 会拦住它。

### P-E1 ｜热点外键零索引（最便宜、收益最大）

全库仅 **9 条 `CREATE INDEX`**，6 条是 `audit_event`（这批列序精确匹配查询，**做得对**），
其余 3 条是 grant/rate-limit。业务热点外键**一条都没有**：
`role_assignment.account_id`、`role_assignment.(service_node_type, service_node_id)`、
`store_contract.store_id`、`store.project_id`、`store.head_company_id`、
`password_reset.account_id`、`platform_session.platform_admin_id`。

**方案**：一个 additive migration 补 7 条。分钟级、零风险。
**注**：按倾向 5，只补**已被真实查询证明必需**的这 7 条，不做投机性索引（D-6=B 已裁决）。

### P-E2 ｜门店列表 O(N²)，单次 page-1 请求可产生数万条 SQL

- `OrganizationOverviewTaskReadService.java:20-21` `page()` 先拉**全量**再 `subList` —— **不是服务端分页**
- `:27-29` `detail()` **同样拉全量**再 Java 过滤找一条
- `OperationsStoreManagementController` 的 `store(...)` 对**页内每一行**调 `overview.detail(...)`
- `:54-59` 每行调 `nodePath()`；`:64-72` 逐层父节点单查
- `ContractTaskReadService.java:33,35` 每行 2 条 COUNT

**量级**：pageSize=20 时约 `61N + 81`；N=500 → **约 30,600 条**。

### P-E3 ｜角色读取把 JSON 解析外包给数据库，每个已认证请求都触发

`WorkspaceRoleService.java:93-96` 为 `page_access_keys` 与 `capability_keys` 各发一条
`SELECT jsonb_array_elements_text(CAST(? AS JSONB))`，参数是**刚从同一行读出的字符串**。
`:88` `list()` → **1 + 3N**。放大：`session()` 每次调 `roles.require(...)`，
而 `session()` 在**每个已认证请求**上都跑；写请求因 `requireActor` 再来一遍。

**方案**：Jackson 在 Java 侧解析（0 次额外往返）；`list()` 单条批量映射；`session()` 请求作用域缓存。

### P-E4 ｜Drawer 打开期间无限请求循环

`useDrawerFormLifecycle.ts:196-210` 返回**每次 render 新建的对象字面量**（无 `useMemo`）。
三处把整个 `lifecycle` 放进 effect deps 且在 effect 内发请求
（`StoreManagementPage.tsx:154-161`、`ContractManagementPage.tsx:194-201`、`HeadCompanyManagementPage.tsx:208-215`）。
**抽屉开着就持续打接口**，且 `form.setFieldsValue` 反复覆盖用户输入。

**方案**：foundation 里 `useMemo` 稳定返回值 —— **一处修复覆盖全部调用点**。

### P-E6 ｜会员列表：RowMapper 内嵌套发查询（本轮 `亲验`，是全仓最重的一处）

调用链逐层已打开源码核对：

```
WorkspaceMembershipService.page(pageSize≤100)                    :39-46
  ├─ 1  ids   （DISTINCT + JOIN role_assignment，带 LIMIT/OFFSET）  :41
  ├─ 1  total （COUNT DISTINCT，同样的 JOIN 再跑一遍）              :42
  ├─ ≤2 scopeName = path(...)                                      :43
  └─ ids.stream().map(id -> member(...))        ← 每行一次          :44
       member(workspaceUuid, key, accountId)                       :48-54
         ├─ 1  account
         ├─ 1  assignments —— 其 RowMapper 内**逐行**调 path(...)   :51
         │      path() → describePath()  = 1 条递归 CTE             OrganizationHierarchyService:214
         │      path() → describeEntityPath("STORE") = 1 + 1 条     BusinessEntityService:256-264
         ├─ 1  invitationHistory
         └─ 1  credentialStatus
```

**量级（第三轮盲审独立重算，已采纳其公式）**：`2 + s + P×(4 + Σᵢcᵢ)`，
其中 `s ∈ {0,1,2}`（`scopeId == null` 时为 0 —— 这是最常见的"全部成员"调用），`cᵢ ∈ {1,2}` 每任职。
作者原写的 `4 + …` 把基数写高了；且原以为 `cᵢ=2` 只来自 STORE 分支，
盲审指出 **GROUP 分支也是 2**（`describeCommercialGroup` 内部另调 `requireEnabledWorkspace`，见 M12）。
最坏实测：P=100、A=3、STORE → **1002 条往返**。量级结论不变。

**两个独立缺陷，必须分别修**：

1. **RowMapper 内发新查询**（`:51` 的 `path(...)` 在 `assignments` 的 RowMapper 里）。
   这不只是慢——它在 `ResultSet` 未关闭时于同一连接上发起新查询，是隐患形状本身。
   **红线：任何 `RowMapper`/`ResultSetExtractor` 内不得再调用 `jdbc.*`。** 这条可机械检查。
2. **祖先路径遍历在本仓有三份实现，不是两份**（盲审更正）：
   `OrganizationOverviewTaskReadService.java:64-73`（`while` 循环逐层单查，慢）、
   `OrganizationHierarchyService.java:214`（递归 CTE，返回拼好的 `String`）、
   `OrganizationVisibilityService.java:127-136` `ancestorPath(...)`（递归 CTE，返回 `List<String>` 名称）。
   **三份实现同一次遍历**，且慢的那份仍在被调用——R-5 单一真相违反。
   注意**不能直接替换**：`nodePath` 返回 `List<Reference>(id, code, name)`，与另两份返回类型都不同；
   正解是写一份返回结构化行、且支持 `IN (...)` 批量的 CTE，替换全部三处。

**方案**：`member()` 改为按 `ids` 批量（4 条固定查询 `WHERE id IN (...)` + Java 侧分组）；
路径解析改为对 `IN (...)` 一次性求解的递归 CTE；删除 `nodePath()` 的循环版本，统一到 CTE 版本。
`page()` 从 `~1000` 降到 **≤6 条固定查询，与 P、A 无关**。

### P-E7 ｜「读一条 = 拉全类目」（本轮 `亲验`）

`OrganizationOverviewTaskReadService.java:26-28`：

```java
public Item detail(UUID workspaceUuid, String key, String category, UUID itemId) {
    return items(workspaceUuid, key, category).stream().filter(item -> item.id().equals(itemId)).findFirst()...
}
```

`items(...)` **无 `LIMIT`、无分页**，且三个分支的 RowMapper 内都逐行调 `nodePath()`
（`:32` HIERARCHY、`:57` STORE）。所以读**一条**详情 = 全类目行数 × 层级深度 条 SQL。
叠加 P-E2 里"页内每行调 `detail(...)`"，即为该处 O(N²) 的真正来源。

**盲审补充**：`page(...)`（`:20-23`）有**完全相同**的缺陷（`items(...)` 后在内存 `subList`），
即列表端点的分页也是假的——这比 `detail()` 更值得先修。
另更正：三个分类里 **BUSINESS_ENTITY（`:44-47`）不调 `nodePath`**，只有 HIERARCHY（`:33`）与 STORE（`:59`）调。

**方案**：`detail()` 改为按 `id` 直查（1 条 SQL）；`page()`/`items()` 改真服务端分页；
路径解析统一到批量 CTE 实现。

### P-E8 ｜候选列表逐行解析路径（本轮 `亲验`）

`OrganizationAssignmentCandidateService.java:40-59`：`REGION/PROJECT` 分支的 RowMapper 内逐行调
`nodes.describePath(...)`（1 条递归 CTE/行）；`HEAD_COMPANY/STORE` 分支逐行调
`entities.describeEntityPath(...)`（1–2 条/行）。外层查询**无 `LIMIT`**。
同形状另见 `WorkspaceInvitationService.java:418-419`。

**方案**：与 P-E6 共用同一个"批量路径解析"实现——这三处修完是**同一个函数**，不是三处各写一遍。

### P-E9 ｜N+1 完整清单（第三轮盲审穷举，作者原只找到 6 处 / 实为约 24 处）

作者原清单只覆盖约 1/4。以下为盲审用平衡括号提取 + 逐个 callee 解析产出的完整枚举，**已逐条开源码复核**。

**A 类：callback 体内发查询（与 P-E6/E7/E8 同形）— 作者漏 13 处**

| # | 位置 | 机制 | 是否有界 |
| --- | --- | --- | --- |
| M1 | `ContractTaskReadService.java:69` `overview` | mapper → `view(...)`（`:113`，1 SQL） | **无 LIMIT** |
| M2 | `ContractTaskReadService.java:64` `fixedStoreContracts` | mapper → `view(...)` | **无 LIMIT** |
| M3 | `ContractTaskReadService.java:94` `page` | mapper → `view(...)` | LIMIT ≤100 |
| M4 | `ContractTaskReadService.java:102` `platformOverview` | mapper → `platformItem(view(...))` | LIMIT ≤100 |
| M5 | `ContractCommandService.java:118` `list` | mapper → `require(...)`（`:109`） | **无 LIMIT** |
| M6 | `WorkspaceRoleService.java:88` `list` | mapper → `require(...)`，而 `require`（`:93`）内部再嵌 **两条** `jsonb_array_elements_text` 查询 → **3 SQL/角色** | **无 LIMIT** |
| M7 | `BusinessEntityService.java:289` `listEntities` | mapper → `requireEntity(...)` | **无 LIMIT** |
| M8 | `BusinessEntityService.java:233` `authorizedBrands` | mapper → `requireEntity("BRAND", ...)` | **无 LIMIT** |
| M9 | `BusinessEntityService.java:271` | `jdbc.query` 直接嵌在 `ResultSetExtractor` 内 | 单行 |
| M10 | `ExtensionDefinitionService.java:43` `listDefinitions` | mapper → `requireDefinition(...)` | 小 N |
| **M11** | **`OrganizationVisibilityService.java:78` 与 `:91`** | **`RowCallbackHandler`** lambda 内调 `isVisibleDataNodeAllowed(...)`（1–2 SQL）**与** `ancestorPath(...)`（1 SQL） | **无 LIMIT，两遍全扫** |
| M12 | `OrganizationCommandService.java:165` `describeCommercialGroup` | 内部再调 `requireEnabledWorkspace` → `WorkspaceAdministrationService:61` 多一条 SQL（P-E6 里 GROUP 分支 2× 的隐藏来源） | 每次调用 |
| M13 | `PlatformAssetService.java:118` | **对象存储网络 I/O 在 `ResultSetExtractor` 内**，全程占住 JDBC 连接 | 单行 |

**M11 是最重的一处**：无界、双全扫，且它是 `RowCallbackHandler` —— 原红线 E-0 连这个类型都没点名。

**B 类：不在 callback 里、纯 stream/loop 形态（任何静态 callback 门都抓不到）— 作者漏 5 处**

| # | 位置 | 机制 |
| --- | --- | --- |
| S1 | `WorkspaceAuthenticationService.java:172` `createSession` | `assignments.stream().filter(a -> enterable(...))` → 每任职 1 SQL，经 4 个不同 owner 端口 |
| **S2** | `WorkspaceAuthenticationService.java:130` | `.map(assignment -> candidate(row, assignment))` → `:187 roles.require`（**3 SQL**）+ `:196 nodeName(...)`（1–3 SQL）**每任职**，且这条路径在**每个已认证请求**上跑 |
| S3 | `WorkspaceInvitationService.java:118` `managementList` | 无 LIMIT 的 `list(...)` → 每邀请 2+ SQL，`:150` 再 `.map(intent -> path(...))` |
| S4 | `WorkspaceInvitationService.java:285` | `intents.stream().map(intent -> path(...))` |
| S5 | `WorkspaceMembershipService.java:27-35` `candidates` | 5 次无界 `listEnabled`（每次自身即 N+1）+ `roles.list`（自身 1+3N） |

**S2 是最高频的一处**（每个已认证请求），严重性不低于 P-E6。

**经检查确认干净、不构成 finding**：`StoreCandidateTaskReadService`、`OrganizationAuditHistoryService`
（`AuditChangeJson.read` 是纯 JSON 解析）、`JdbcGroupWorkspaceRepository.mapDetail:67`（纯 ResultSet 读）、
全部 `*CommandReceiptService`、`WorkspaceAuditAuthorizationService`、限流服务。

### P-E5 ｜其余效率项 `双验`

合同总览 1+N 且 N 无界；平台管理员列表伪分页 + 每行 2 个相关子查询；
`OrganizationStructurePage` 拉整棵树且 `pagination={false}`；`WorkspaceScope` 被 5 条路由各自重发全量拉取；
单包 1.9MB 无 `manualChunks`、无 `React.lazy`；**19 处写后整表重拉**（服务端已返回 readback）、
**8 处点行看详情又单独 GET 一次列表已有数据** —— 后两类由 R-4 的 tag 化一并解决。

## 8. 健壮性（`双验`）

> **条目号（第二轮盲审要求）**：本节原为无号散列，导致"每一条都有归属包"无法机械核对。
> 现补 `P-R1`…`P-R8`，归属包见每条行尾。

| # | 问题 | 证据 | 归属包 |
| --- | --- | --- | --- |
| P-R1 | **前端 401 处理完全不存在**：两 app + foundation 全量 grep `401\|resetApiState\|AbortController` 零命中。会话过期/账号停用/改密全量撤销后，用户停在当前页每个操作弹通用错误；登出也不清 RTK store | 全量 grep = 0 | RM1-P5 |
| P-R2 | **8 个平台列表页 `loading={!result}`**：失败与空结果都**永久转圈**（同仓 `StoreManagementPage` 有正确写法） | 8 处 | RM1-P5 |
| P-R3 | **换页失败同时丢上一页数据、卡 loading、页码不回滚** | `PlatformReadPage.tsx:36` 请求前 `setValue(undefined)` | RM1-P5 |
| P-R4 | **十余处裸 promise + setState 无 generation guard**：迟到响应覆盖新结果 | — | RM1-P5 |
| P-R5 | **全仓无 React Error Boundary** | 全量 grep = 0 | RM1-P5 |
| P-R6 | **登出请求失败则会话永远清不掉** | — | RM1-P5 |
| P-R7 | 邀请历史用 `mobile_normalized` 关联而非 `account_id`（**手机号改绑后错位到他人**） | `WorkspaceMembershipService.java:52`（改名后 `WorkspaceUserTaskReadService`） | RM1-P3 |
| P-R8 | 3 处在 `ResultSetExtractor` **内部**再发查询（游标未关闭） | `OrganizationHierarchyService.java:200` 等 | RM1-P4（红线 E-0 一并拒绝） |

## 9. UI、交互与 v2 吸收

### P-U1 ｜106 个错误码塌缩成一句固定中文（R-3 已裁决照 v2）`亲验`

`OperationsTransport.ts:104` / `PlatformTransport.ts:80` 唯一分支
`detail: '请求未完成，请根据错误码检查后重试。'`。错误码总量 **106 distinct**（119 occurrence，
三份 `EDGE_PROBLEM_CODES` 实测 49/52/18；先前稿的 139+110+37=286 是作者错误，见 §0 更正表），
**无一进入映射**。

塌缩还不均匀：platform 侧 **9 处连 errorCode 都不显示**，而 `PlatformLoginPage.tsx:15`、
`PlatformPasswordChangeDrawer.tsx:51` 又拼了 errorCode —— **同一 app 内两种做法**。
局部 `issue()` 有 **10 份副本**，`${errorCode}：${detail}` 拼接 **20 处 / 20 文件**。
`correlationId` 已解析但除登录页外从不展示；platform 侧 `ApiProblem` 干脆丢掉了 `correlationId` 与 `status`。

**v2 的形式**（381 行两份模块）：
- `operationsProblemFeedback.ts`（133 行）：`OperationsMutationContext`（18 个操作上下文）、
  `revisionConflictCodes`（7 码集合）、按**四段分级**（版本冲突/依赖不可用/权限不足/校验失败）产出
  `{title, level, message, correlationId}`；版本冲突 → warning + **「资料版本已变化，请刷新后重试。」**
- `platformProblemFeedback.ts`（248 行）：**三态判别联合** `{kind:'alert'}` / `{kind:'field', field}` /
  `{kind:'restricted'}`；字段级错误路由到表单字段；`retryAfterSeconds` 插值；只读页四态降级

**四件事缺一不可**：每 app 一份集中模块；按操作上下文取标题；按错误类别分级 + 给可执行建议；
字段级错误路由到字段。

### P-U2 ｜platform 有 6 个页面需选中集团空间，但无全局选中态 `亲验`

**v2**：`workspaceRequirement` 是 **catalog 一等字段**（8 页中 6 个 `REQUIRED`）。选中态在 Redux，
`PlatformShell.tsx` 用它做四件事：`:47` **未选时 REQUIRED 菜单项置灰**；`:113` **阻止导航**；
`:71-75` 切换时 dispatch `workspaceContextChanged` 做**缓存扇出失效**；`:79-84` 注入页面上下文。
每个 REQUIRED 页未选时渲染 `<Result status="info" title="请先选择集团空间" .../>`。

**v2s**：`WorkspaceScope.tsx` 是**页面局部组件**，自己 `useState` + 自己拉**全量无分页**列表，
被 **5 个页面各包一层**。四处错：选中态不跨页保持；每切页重发一次全量拉取；菜单不置灰不拦导航；
切换无缓存扇出。

**作者原写「catalog 里 `workspaceRequirement` 出现 0 次、语义源缺字段」——这是错的**（第二轮盲审）：
`platformPages` 是**位置元组** `[key, title, iconKey, workspaceRequirement]`，第 4 位就是它，
8 页中 6 个 `REQUIRED`；生成物 8 处具名字段；`pageRegistry.tsx:31-32` 已消费。
**catalog 不需要补字段**——真实缺口只是 **Shell 未消费**（菜单置灰、导航拦截、切换扇出）。
若照原稿去"补字段"，会触发 codegen 重跑与 `frontend-asset-carryover-manifest.json` 的 sha256 漂移，
做一次纯粹的无用功。

**顺序**：选中态提到 store → Shell 接菜单置灰与导航拦截 → tag 化并接扇出。**无 catalog 前置。**

### P-U3 ｜两个集团空间页的写能力装反了 `亲验`

| 页 | 冻结 `focusedEvidence` | 实际 |
| --- | --- | --- |
| `PLATFORM-WORKSPACES`（管理） | `...-**edit-status**-logo-...` | create/initializeCommercialGroup/stageAsset/list —— **无 edit、无 status** |
| `PLATFORM-WORKSPACE-OVERVIEW`（总览） | `...-**no-projection**`（明写只读） | **transitionStatus / updateDisplay** |

**冻结契约要求的和实现完全对调。** 按 R-7，总览**不该有写能力**。

**三件事**：`edit`/`status` 搬回管理页；总览改 v2 形状（选中制 + 未选空态 + 只读该空间概览，
**去掉全量列表**）；Card 标题与 catalog 对齐（当前写死"集团空间管理"，与 catalog 的"集团空间总览"
冲突且与另一页撞名）。

### P-U4 ｜运营 shell 两个切换器形态缺失（R-12 已裁决）`双验`

| | v1 | v2 | v4 | v2s |
| --- | --- | --- | --- | --- |
| 右上角 | `MembershipSwitcher` + 头像下拉 | 常驻 role Select | `CurrentNodeSwitcher` + 头像下拉 | **一个"切换任职"文字按钮** |
| 左下角 | `menuFooterRender` 挂 `DataNodeSwitcherPort` | 级联 Cascader | `menuFooterRender` 挂 Popover | **空的** |

**v1 与 v4 两代独立收敛到 `menuFooterRender`** —— 侧栏底部是"我在哪"的位置，
右上角是"我是谁"的位置，混在一起会让用户在语义不同的控件间误选。

三条缺口：左下角切换器不存在；数据范围**无层级概念**（`ContextSelector.tsx:19` 拉整个集团空间的
`/hierarchy` 再按 `status==='ENABLED'` 过滤，**不按任职可见范围过滤**）；切换器**无 dirtyGuard**。

另：`RoleAssignmentSelector.tsx` 只有 13 行且在 `OperationsApp.tsx:104` **整页接管**，
切任职时当前页被整个替换。v1/v2 都是 shell 内就地切换。

**按 R-13 的正确方案**（照 v2，不抄 v4）：
1. **后端**：`getOperationsWorkspaceSessionEntry` 响应加 `dataNodeCandidates`，按当前任职授权范围算好。
   **不接受 pageKey**。顺带比现在少一次 `/hierarchy` 请求
2. **前端 catalog**：给每个 operations pageDesignKey 补 `requiredDataNodeType`（`NONE`/`REGION`/`PROJECT`/`STORE`）
3. **前端 shell**：按深度裁剪候选（v2 `dataNodeCascadeOptions` 的做法），渲染成 Cascader

### P-U5 ｜其余 UI 缺口 `双验`

- **动态扩展字段仍未通电**：`extensionValues: {}` 硬编码 5 处，定义已拉取、版本已回传，
  只差按 definition 渲染表单并回收值。**这是"接了线没通电"的典型**
- 五个 `HOME-*` 是 23 行占位壳（自注释 "bootstrap only … without inventing a dashboard"）——
  R-10 已裁决照 v2 补真内容
- `loading={!x}` 残 **18 处**（9 处是列表 Table）；`pagination={false}` 残 5；`window.alert` 残 1
- `RolesPage.tsx:41` 创建角色时能力硬编码空数组，**必须创建后再编辑一次才能授权**（两步走）
- platform 侧只有 2 个文件接 `useDrawerFormLifecycle`，`RolesPage.tsx:110` 编辑 Drawer 直接
  `setEditing(undefined)` **丢弃填写内容** —— R-9 已裁决统一 dirty guard
- `maskClosable={false}` **17 处全部**，而 v2 是 `maskClosable: true` + `onClose: lifecycle.requestClose`
  （脏了弹确认、没脏直接关）—— R-9
- ProTable 17 处**一刀切 `search={false} options={false}`**，而 v2 是 13 关 3 开 —— R-8

## 10. 简单性、目录结构与架构 `双验`

> **条目号（第二轮盲审要求）**：同 §8，本节原为无号散列。现补 `P-Q1`…`P-Q9`。
> **更正**：先前稿说"不用 `P-S` 前缀是因为 `P-S3` 已被占用"——**这个理由是编造的**，
> 第三轮盲审查实 `P-S3` 在全仓只出现在那句声称它被占用的话本身，R-14 的 seed 阈值是散文、不含条目号。
> 编号已改为 `P-Q`，不再改回，但理由作废。这是作者错误第 8 次，且是**以"已核验"身份呈现的**。

| # | 问题 | 归属包 |
| --- | --- | --- |
| P-Q1 | `audit-history` Modal 两份 **76% 相同**、`PasswordChangeDrawer` 两份 **80% 相同**（`fieldLabels` 词表已分叉，交集仅 6 个 key） | RM1-P6 |
| P-Q2 | 写后刷新**三种做法并存**（直调 `load()` / 计数器 / 无 `useCallback` 的空依赖 effect） | RM1-P5 |
| P-Q3 | `contextScopedQueryArgs` 三个生产调用点**全是恒等调用**（多数 feature 绕过该抽象直接读字段） | RM1-P5 |
| P-Q4 | `queryContext` 在 Shell render body 每次重建（未 `useMemo`），`StoreProfilePage` 因此重复发两个请求 | RM1-P5 |
| P-Q5 | feature 内部只有 `ui/`，缺 `model/` 与 `automation/locators.ts`（testId 散落 63 个调用点） | RM1-P6 |
| P-Q6 | `business-page/model.ts` 是唯一无 `ui/` 的"feature"，被 `pageRegistry` 与 15 个 feature 依赖，**位置错**（应进 `app/routing/` 或 `app/state/`） | RM1-P2 |
| P-Q7 | barrel 约定只在 `audit-history` 一个 feature 上存在，其余 21 个走深路径 import —— **半套约定** | RM1-P6 |
| P-Q8 | `expandPath()` 两份逐字节相同；两份 `tsconfig.json` **零差异** | RM1-P7 |
| P-Q9 | eslint **未覆盖 `libraries/frontend/**`**（共享度最高的 foundation 完全未被 lint）；未装 `eslint-plugin-react-hooks`（= P-X9） | RM1-P5 |

- `createApi` 从 `@reduxjs/toolkit/query/react` 导入带上 hook 生成机制，而全仓**没用过一个生成的 hook**

## 10b. 新增能力：运维后台平台管理员手机验证码登录（Dexter 2026-07-28 裁决）

### P-N1 ｜`INTENTIONAL_DIVERGENCE_FROM_V2` —— v2 与 v4 均无此能力，本轮有意增强

**现状**（`亲验`）：platform 侧 OTP 基础设施为 **零**。

| | workspace-iam | platform-iam |
| --- | --- | --- |
| OTP 服务 | `WorkspaceOtpRateLimitService` | **无** |
| OTP 表 | `workspace_iam.otp_grant` | **无**（platform_iam 8 张表无 otp 相关） |
| 登录 operation | password + OTP | **只有 `platformPasswordLogin`** |

**范围（按倾向 0b 压到最小，逐项说明为何不新建）**：

| 件 | 处置 | 理由 |
| --- | --- | --- |
| 限流 | **复用 `platform_login_rate_limit_bucket`**，只加 purpose 维度 | 它已有 ACCOUNT + SOURCE 双维度 + HMAC 指纹 + advisory lock，**比 workspace 侧完整**；新建 `PlatformOtpRateLimitService` 是重复造轮 |
| OTP 存储 | **新建 `platform_iam.otp_grant`，但去掉 workspace 三列** | workspace 那张的 FK 绑 `group_workspace`，platform 无此维度，无法复用表；只留 `id/purpose/token_hash/subject_ref/status/expires_at/used_at/attempt_count` |
| 手机号列 | 见 P-D0b，补 `mobile_normalized` + 唯一约束 | 无此列则无法用手机号定位账号 |
| 认证服务 | `PlatformAuthenticationService` 加 send/verify | **复用现有 `noRollbackFor` 与 `clearAccountFailures` 语义**，不另起一套 |
| 契约 | 新增 2 个 platform-face operation | `sendPlatformLoginOtp` / `platformOtpLogin` |
| 前端 | `PlatformLoginPage` 加密码/验证码双 tab | 照 v2 workspace 登录页的形状 |

**三条设计约束（从 workspace 侧的已知缺陷反推，不得重犯）**：

1. **账号不存在时必须记账**。workspace 侧 `accountByMobile` 先抛异常导致零记账、可匿名枚举手机号（P-D6）。
   platform 是权限最高的后台，**这条尤其不能重犯**
2. **`testCode` 绝不能进 platform 响应体**。workspace 侧现有 2 个 controller + 3 个 wire record 含它（P-D6，见该条更正），
   platform 侧不得复制该做法
3. **限流必须在手机号校验之前**。workspace 密码重置把 `requireMobile` 放在限流前，
   导致持券方可无限猜手机号（P-D6）

**分母影响**：见 §0 的分母表。

## 11. 单一真相违反清单（按倾向 0 重新归并）

前面各节的问题里，有一大类的病根是同一个：**同一件事在多处判断**。合并成一张表，
因为它们应当被**当作一件事一次修完**，而不是散在各包里各修各的。

> **本表已按第一轮盲审重写。** 原 12 条中 ST-1、ST-5 的事实被证伪（见 §14 更正），
> ST-10 属误用（Gradle 是编译期强制、registry 是对账分母、包名是标签，**三者不是三处判断**），
> ST-12 属分类错误（它是**少一处判断**的安全缺陷，已升为独立条目 P-D0）。**成立的是以下 8 条（其中 ST-7 归 P-0）。**

| # | 事项 | 现在在几处判断 | 应当的单一真相 | 关联条目 |
| --- | --- | --- | --- | --- |
| ST-2 | **用户可读错误文案** | **30+ 处**：20 处 `${errorCode}：${detail}` 拼接 + 10 份局部 `issue()` 副本；且 platform 侧 9 处连 errorCode 都不显示、2 处又显示 | **每 app 一份 feedback 模块**（v2 的**能力形状**，表驱动实现即可） | P-U1 / R-3 |
| ST-3 | **页面标题** | **2 处**：catalog 一份，`WorkspaceAdministrationPage.tsx:71` 硬编码一份，**且冲突** | catalog | P-U3 |
| ST-4 | **菜单顺序** | **2 套**：operations 用 catalog `menuOrder`；platform 用 `pageRegistry` 对象字面量书写顺序 + `Object.values` | catalog。**修法按倾向 0b 取轻解**：`platformPages` 数组本身有序，`pageRegistry` 改为遍历它即可，**不新增 `menuOrder` 字段** | P-U2 |
| ST-6 | **审计字段中文名 `fieldLabels`** | **2 份且已分叉**（交集仅 6 个 key） | 单一来源（foundation 参数注入） | §10 |
| ST-7 | **门与生成器里的硬编码分母** | **5 处**（第二轮盲审重算）：`verify-gates/cli.mjs:218,336,397` 的 `106`；`platform-boundary-gates/cli.mjs:81` 的 `106` + faceCounts `{39,56,11}`；`platform-boundary-gates/cli.mjs:141` 的 `!== 13`（磁盘 18，**第 4 个红门**）；**`scripts/generate/edge-codegen.mjs:130` 的 `codes.length !== 106`——它不是门，Codex 不会去看，但 P-6 一改 operation 数它先失败** | catalog/契约/Flyway locations 派生 | P-C4 |
| ST-8 | **前端目录布局** | **2 份**：仓库实际目录；`affected-l2-registry.json` 的 `paths`（12/30 已脱节） | 从实际目录派生 | P-C3 |
| ST-9 | **写后如何刷新列表** | **3 种做法并存**：直调 `load()` / `reloadVersion` 计数器 / 无 `useCallback` 的空依赖 effect | 一种（R-4 的 tag 失效落地后统一） | §10 / R-4 |
| ST-11 | **写能力归哪个页面** | **2 处冲突**：冻结 `focusedEvidence` 说管理页有 edit/status，实现装在总览页 | 冻结 manifest | P-U3 / R-7 |

**实施含义**：ST-7、ST-8 属"门的分母"，必须与门真实化同包完成且**先于结构重组**——
否则重组会改变全部后端路径，使脱节从 12 条扩大。ST-2/3/4/6/9/11 是前端一致性，可随对应功能包做。

## 11b. 第一轮盲审补入的问题（作者原清单漏掉，均已复核）

| # | 问题 | 位置 | 严重性 |
| --- | --- | --- | --- |
| P-X1 | **command receipt 跨租户回放**：`platform_command_receipt` / `workspace_command_receipt` 以 `idempotency_key` 为**唯一主键、无 workspace 列**，按单键查回放 → 跨集团空间 key 碰撞可回放他租户 readback。**注意：不能照抄 v2** —— v2 是微服务，靠服务/库边界天然隔离；v2s 单库多 schema 无此隔离 | `V20260726_090000_000:101,165`；`WorkspaceIamCommandReceiptService.java:30-41` | **M** |
| P-X2 | **`legacy-test-source` 把 SOURCE 限流维度塌成单桶**：出现在 `PlatformAuthenticationService.java:59` 与 `WorkspaceAuthenticationService.java:40` **两个生产可达的 `login(...)` 重载**里 —— 限流看起来在，那一维实际是废的。另 `:55` 与 `WorkspaceLoginRateLimitService.java:21` 硬编码 HMAC 密钥（`logging` 门当前红的根因，**原清单只修门未修代码**）。**更正**：`:21` 是**包内测试专用构造器**，生产构造器 `:20` 已是 `@Value` + 空值抛错，故修法是删/改测试构造器，而非配置化 | 同左 | **M** |
| P-X3 | platform 侧 `throw problem(error)` 抛**裸对象而非 `Error`**（operations 侧 `ApiFailure extends Error` 是正确写法）；消费者盲 `as` → 真 `Error` 渲染成 `undefined：undefined` | `PlatformTransport.ts:38,73-83`；`PlatformAuditHistoryModal.tsx:34` | S |
| P-X4 | `UUID.fromString(body.parentId())` 无保护，畸形 id → 500（同文件其余 id 都走保护转换） | `OperationsOrganizationHierarchyController.java:68` | S |
| P-X5 | 生产 objectKey 校验**硬编码 dev bucket 前缀** `catering-v2s/dev/...`，非 dev bucket 一律 stage 失败 | `PlatformAssetService.java:132` | S |
| P-X6 | 另外三个伪门：`traceability`/`terminology` 是 `regex.test(docA+docB)`；`retirement` 只 grep `org.apache.kafka|new WebClient(` | `verify-gates/cli.mjs:403-413,426` | S |
| P-X7 | 对 `edge.openapi.yaml` 做 `JSON.parse`，**仅因该 `.yaml` 内容恰为 JSON 才通过** | `platform-boundary-gates/cli.mjs:73` | N |
| P-X8 | `EdgeContextVerifier.verify(...)` **无生产调用者**，却被门当作 edge 安全控制断言签名（"门守着死代码"） | `EdgeContextVerifier.java:15`；`verify-gates/cli.mjs:215` | N |
| P-X9 | 未装 `eslint-plugin-react-hooks`，`exhaustive-deps` 全仓无人把关 —— **P-E4 的无限循环正是它能拦的** | `eslint.config.mjs:17` | S |

## 12. 死代码清单（R-6：必须删除）

> **本表已按第一轮盲审重跑存在性。原 9 项中 5 项目标不存在、1 项是活依赖。**
> 这是"时点漂移"失败模式的直接产物（§14）。

**确认成立、应删（2 项）**：

| 项 | 位置 | 证据 |
| --- | --- | --- |
| `InvitationsPage.tsx` | `platform-admin/src/features/workspace-iam/ui/` | 90 行，全仓零引用；R-5 已裁决删，连带 5 个 operation 退役。**归属 P6 独占，不在 P7 范围内** |
| `proLayoutNavTheme` | `platformAdminTheme.ts:7` | 零消费者 |

**已被证伪、不得作为工作项（6 项）**：

| 原列项 | 实际 |
| --- | --- |
| `src/main.js` ×2 | **不存在**（`find -not -path '*/build/*'` → 0）；`verify-gates/cli.mjs:244` 与 `admin-boundary-checks/cli.mjs:25,41` 是断言它**已 retired**，与"被门反向锁死"方向相反 |
| `static-boundary.test.mjs` 断言死文件 | 该文件**零处**引用 `main.js`/`build-static` |
| `scripts/build-static.mjs` ×2 | **不存在** |
| 仓库根 `components/`、`paths/` 空目录 | **不存在** |
| `src/app/api/client/` 空目录 | **不存在**（`platform-admin/src/app/api/` 下只有 `PlatformApi.ts`、`PlatformTransport.ts`、`generated/`） |
| `platformHttpProtocol` | **是活依赖** —— `observedBaseQuery.ts:3,6-8` 真实消费，删了会断 |

**非源码工作项**：`libraries/backend/workspace-iam/build/tmp/` 的旧 `WorkspaceRoleCatalog` 是 Gradle 编译缓存，
清 `build/` 即可，不属代码删除范围。

## 13. 已知正面事实（避免整改时误伤）

以下是本轮实测**已经做对**的，新 Roadmap 不得回退：

- generated wire 的 `Map<String,Object>` = **0**；feature 层 URL 字面量 = **0**、`fetch` = **0**，
  eslint `no-restricted-syntax` 兜底
- typed client 形状正确：契约生成 `createOperationsAdminClient` + `FaceOperationContracts`，
  通用 `request` 逃生舱已降为内部传输原语
- 状态切换字段名 **9/9 正确**（全部 `targetStatus`）
- 跨 owner 未声明直读 = **0**（6/6 已声明）；`context.externalSubject()` = **0**
- 最后管理员守卫已加 advisory lock + 行锁 + count
- `items_json` JSONB 已迁移，旧表已 DROP，DROP 前有 typed precondition
- 8 张 legacy `*_audit` 表已 DROP，前置 typed precondition 齐备
- 25 pageDesignKey 两份 `pageRegistry` 均 `satisfies Record<...>` **编译期穷举**
- admin catalog 生成链已建：`contracts/catalog/admin-catalog.json` → 前端 `generatedAdminCatalog.ts`
  + 后端 `WorkspaceAuthorizationCatalog.java`，**同源同标注**，无第二份手写目录
- 手机号 wire 层只有 `maskedMobile`；审计宿主授权已含 assignment/data-node/page 三要素
- CR03/CR04 的 evidence 措辞诚实：closure 文件 `method` 明写「does not claim browser L2, DEV,
  seed, route-runtime」，status 是 `PASS_STATIC_ONLY_DYNAMIC_L2_DEFERRED_TO_CR08` 而非裸 PASS

## 14. 作者错误披露

本轮作者四次错误，三次被对方或子 agent 纠正，**全部属分母/集合完备性**：

1. 「27 个 feature 文件仍手写 `/api/`」**误报** —— grep 匹配到的是 import 路径；实测 URL 字面量 0
2. `approvedAssertions` 报 27，**实为 26**
3. project-memory assertion 报 62，**实为 71 occurrences / 69 unique**
4. 上一份诊断的「四项完全缺失」**现已闭合**（时点问题，非误报，但须如实记功）

另有一次**方案方向错误**：建议抄 v4 的"后端按 pageKey 返回 selectorPolicy"，
被 Dexter 指出后核实 v2 做法更优（后端只答授权、前端 catalog 答 UI），已撤回并改写为 R-13。

**结论**：作者对"这条断言对不对"可靠，对"这个集合是不是全的"与"这个方案方向对不对"需要对方复核。
本清单所有分母建议 Codex 独立复算。

### 14b. 第二轮盲审补记的失败模式与更正

**第六次分母/存在性错误，且是同型第二次**：作者按**字段名 grep** 判定
`contracts/catalog/admin-catalog.json` 里 `workspaceRequirement` "出现 0 次、语义源缺字段"。
实际它是**位置元组**的第 4 元素，8 页中 6 个 `REQUIRED`，且生成物与 `pageRegistry.tsx:31-32`
都已消费。**这与 §14 已记的"按字段名 grep 判分母"是同一失败模式的第二次发作。**
最小解：凡对结构化文件判"某字段不存在"，必须先 parse 再判，不得用文本 grep。

**ST-1 / ST-5 的证伪记录**（此前只在 §11 表头一句带过，未入错误披露）：
- **ST-5** 事实错误，成因同上
- **ST-1**（数据范围三处判断）事实错误：`dataNodeCandidates` 已端到端存在
  （`WorkspaceSessionEntryReadback.java:17` → wire → `ContextSelector.tsx:13`），
  `ContextSelector` **无 `/hierarchy` 调用、无 `status==='ENABLED'` 过滤**；
  真实缺口只是前端形态（切换器位置、深度裁剪、dirtyGuard）
- 两条都属**时点漂移**：描述的是 CR05/CR06 实施**之前**的快照

**方案方向错误第二次**：作者曾建议「复用 `WorkspaceAuthorizationCatalog:135` 的 `...ForTarget`」
覆盖 20 个业务写端点。实测该绑定只有 10 条、枚举只有 `{INVITE, ROLE_REVOKE}`，覆盖不了。
已由 R-19 改为契约 `x-required-capability`。

**结论更新**：作者六次错误全部集中在**"这个集合/字段是不是存在、全不全"**，
零次出现在"这条断言对不对"。本清单所有分母**必须**由 Codex 用机械枚举独立复算。


---

## 15. 第三轮盲审后仍未收口的项（交付 Codex 前必须处置）

第三轮 5 个独立盲审 agent 的结论已逐条并入上文。以下是**尚未处置**的，按是否阻塞开工分类。

### 15.1 阻塞：清单与 Roadmap 的记账不一致（作者错误，非仓库事实错误）

盲审独立复算确认**外部事实基本正确**（106 错误码、12 条 include、10 module、registry 9 modules、
23 条边 14/6/2/1、12 缺失 path、18 缺失 spec、`platform-foundation` 未登记 —— 全部命中）。
**错的全在作者自己的记账**：

| # | 问题 | 正确值 |
| --- | --- | --- |
| 1 | project-memory assertion 数写 71/69 | **工作树实测 78 occurrence / 76 unique**（HEAD 为 41/41）。71/69 既非磁盘态亦非 git 态。Roadmap P0 让这个数**承重**（"新增后分母会变"），拿错数必错 |
| 2 | 矩阵 phase 分布写 R2:18，合计 151 | **R2 是 17，合计 150**（清单他处已引 `RULES=150`，自相矛盾） |
| 3 | **58 条问题中 26 条（45%）在 Roadmap 里无任何包引用** | 违反 Roadmap 自定的"每条必须有归属包或显式 `NOT_APPLICABLE`"。孤儿：`P-A1 P-A2 P-C3 P-C4 P-C5 P-Q1..P-Q9 P-R1..P-R8 P-U1 P-U2 P-X7 P-X8`。**§8/§10 补条目号正是为了让这条可机械核，号补了、Roadmap 没消费** |
| 4 | 完全无归属的具体条目 | `P-C5`（自称"教科书级假绿"，修法在 P0–P8 零出现）、`P-X7`、`P-X8`、`P-R6`、`P-R7`（清单派给 P3 但 P3 范围不含）、`P-Q1/Q5/Q7/Q8`、`P-C4` 的 3 个子项（Roadmap 只"承认为事实"，无任何包产出缺失 receipt——**承认不等于整改**） |
| 5 | `P-Q9` 与 `P-X9` 是同一个问题（`eslint-plugin-react-hooks` 缺失） | 唯一输入分母自身重复计数，58 vs 57 |
| 6 | Roadmap 指"§1 的 R-1…R-17 裁决表" | 实际是 **R-1…R-23**，且被漏掉的 R-18/R-20/R-22/R-23 恰是 P3-A、P2-3b 依赖最重的几条 |

### 15.2 ~~阻塞：需要 Dexter 一句话~~ —— **A/B/C 三项已于 2026-07-28 全部裁决完毕**

| # | 待裁决 | 影响 |
| --- | --- | --- |
| ~~A~~ | ~~DB 级 FK 做不做~~ | **已由 R-24 消解**（2026-07-28）：授权改单项增删后，FK 零改造代价，直接加。不再需要 Dexter 裁决 |
| ~~B~~ | ~~RM1-P8 与 R6 的语义重叠~~ | **已裁决（2026-07-28）**：RM 是**系列**（RM1 不符合预期则有 RM2、RM3）。故 P8 = **本轮变更面**整体复核（分母 = 57 条对账表 + P0–P7 changed-path 并集），**不复核历史成果、不替代 R6 的移交部分**；欠账结转 RM2 须机械对账。详见 Roadmap RM1-P8 |
| ~~C~~ | ~~`affected-l2` 的 18 个缺失 spec~~ | **已裁决（2026-07-28）：标 `DEFERRED`**，`deferredUntilPhase: "RM2"`，到期未补自动转红。不删 surface、保留下界（分母锚到门外）、修 `prepareSelfTestClean` 的空壳自造绿。详见 Roadmap RM1-P0 |

### 15.3 不阻塞但必须登记

- **`WorkspaceMembershipService.member()` 与 `WorkspaceAccountService.require()` 重复读同一张表**，
  且 platform 面吐 `WorkspaceAccount*` wire、operations 面吐 `WorkspaceMember*` wire ——
  **一个领域读、两套 wire 词表**。独立的单一真相违反，归 P1，不因改名自动消失。
- **4 个 `WORKSPACE_IAM_MEMBERSHIP_*` 错误码是死码且挂在错误的面**（platform 而非 operations）。
- `authorized()`（`BusinessEntityService:341`）**无 workspace 过滤**，今天靠同条件里的
  `enabled(..., workspaceUuid, ...)` 兜着。
- ~~`replaceHeadCompanyBrandAuthorizations` 的 delete-all-reinsert 重置时间戳~~ —— **已由 R-24 消解**（改单项增删后不再全删全插，时间戳第一次为真并上界面）。
- **候选列表与写入不变量不是同一条规则**（heads 不 join 授权表）——今天就存在的 UI 缺陷。

### 15.5 Codex 第一轮反馈的处置（2026-07-28）

Codex 通读后提出「RM1 当前不宜直接进入详设」。**Claude 复核后全部采纳**，逐条处置如下。

**已复算并确认 Codex 正确的事实（作者错误，已改）**：

| 项 | 作者原写 | 实测（Claude 独立复算） |
| --- | --- | --- |
| 矩阵引用的门数 | 15 | **17 个独立 `enforcement.ref`** |
| `testCode` 出现面 | 3 个 controller | **2 个 controller + 3 个 generated wire record** |
| Gradle 冒号坐标 | — | **46 处 / 9 文件**（与 Codex 一致） |
| 改动面 | 清单 60 处、`verify.mjs ×2` | **61 处 / 15 文件**；`verify.mjs` **实为 0 命中** |
| R-23 改名分母 | 清单 55/383、Roadmap 292/36 | **两处不一致且均不可复现 → 改为"先冻结再动手"** |
| P4-A | 仍挂已作废的红线 E-0 | Claude 只改了清单侧、Roadmap 漏改 → 已同步为 E-0' |

后四条同属一个毛病：**改了一处、漏了另一处**——即本清单反复批评的"两套真相"。

**已采纳的结构性批评（形成 R-27…R-30 与若干规则）**：

1. §3b 是包名映射不是可验收映射 → **R-27**，升级为七列，后三列由 Codex 详设填写。
2. P1 无法真实 exit（要求"出现次数=1"却把实作留给 P5/P6）→ **R-29**，降为跨包 ledger。
3. "出现次数=1"不该做成泛化机器门 → 并入 R-29，改为 authority source + 可追溯消费者。
4. 安全不应被目录搬迁阻塞 → **R-30**，P3 后端切片提前。
5. P3/P6 契约收口时序冲突 → Roadmap §3 新增规则：不并入 P3，改由 **P6 exit 强制重跑 P3 契约不变量**；
   P3 的 exit 措辞改为「截至 P3 时点的全量操作面已闭合」。
6. R-26 边界未写清 → 补：可 defer 的只有既有 legacy L2，本轮新行为必须在当包配测试契约。
7. P-C4 历史证据债不能由 P8"补齐" → **R-28**，标 `HISTORICAL_EVIDENCE_DEBT`。
8. `roadmap-program-registry` 依赖方向倒置 → RM 系列注册移入 P0（Roadmap §3c）。
9. 红变异不应每次日常 verify 全跑 → 分两档（控制变化时全跑 / 日常只验引用与输出有效）。
10. 状态 owner 仍显示 R5 在实施 → Roadmap §3c 列为 P0 前置，**措辞由 Dexter 定，Claude 不代写**。

**Codex 诊断合并时被 Claude 漏掉的 8 项**已补入 Roadmap §3b.4 并给归属
（商业集团初始化 replay 重复审计 → P3-B；seed executor 固定失败 → P7；
seed 依赖 `PROPOSED_REVIEW_ONLY` fixture → P7；审计 UI `actionSummary` 展示技术动作 → P6；
foundation overlay lock / `onDiagnosticEvent` 接线 → P5；dev/test runner 日志脱敏 → P0；
状态 owner 不一致 → P0 前置；旧证据分母适用范围登记 → P8 只登记不重写）。
**Codex 主动退役**「资产写侧拒绝视频」（`PlatformAssetService` 已允许 `video/mp4`）——态度正确，采纳。

**尚待 Codex 在详设中自行重算、Claude 未采信任何一方的数字**：
`approvedAssertions`（Codex 称递归复算为 33，清单历史更正写 26）、
P-D2 的未映射异常数（Codex 称按声明异常与 Advice 对比是 81/52/29，清单写 24；**须先定义排除规则再写数字**）、
P-C5 的"零引用"口径（生产消费者为零成立，但文档/证据仍有 14 处引用，表述须收窄为"生产零消费者"）。

### 15.6 Codex 第二轮反馈的处置（2026-07-28，判定 NO-GO，全部采纳）

Codex 二轮判定「仍不宜进入 RM1 详设」，列出 8 项最小修复集。**Claude 逐条复核后全部采纳并已修订。**
它认可 R-30 的顺序（`P0 → P3-A/B/C → P1 → P2 → P4 → P5 → P6 → P3-D → P7 → P8`），
问题不在顺序本身，而在几个包尚未被切成可闭合的串行单元。

| # | Codex 指出 | 复核 | 处置 |
| --- | --- | --- | --- |
| 1 | **R-29 被旧文本反向覆盖三次**（Roadmap §0b.2、P1 完成判据、§4 完成定义仍写"出现次数=1"） | **属实**，实测三处均在 | 当时的目标是三处都改为“唯一 authority source + 可机械追溯的消费者”；后续 doc-only 复核发现 §4 仍误把 ST-7 写入 P1 ledger，现以 §15.9 的 7+1 合并对账修订为准。 |
| 2 | **P3-D 被同时排在 P3-B 与 P6 之后**（正文仍写"三层一起改"），导致 P3-B 的 FK 前提无法成立 | **属实**，是 Claude 改顺序时漏改正文 | 明确切开：**P3-B = 契约/owner command/FK/migration/后端测试；P3-D = 仅前端 Drawer→列表与 UI/L2**。FK 前提由 P3-B 自达成。另补过渡态：P3-B 后前端先做最小适配调 POST/DELETE，避免功能中断，须进 receipt |
| 3 | **"重跑契约不变量"无确定分母** | **属实**，"全部仍绿"不可判 | 定义单一入口 checker：从 `x-consumer-faces` 派生 operations 写面，5 条断言（每写 operation 恰一个 `x-required-capability`／server catalog 与前端常量同源一致／5 个退役 invitation op 计数 0／2 个 OTP op 与 R-24 的 POST+DELETE 已纳入／退役的 replace 计数 0）+ 红变异。由 P3-A 建立，P6 与 P3-D exit 各重跑 |
| 4 | **R-23 冻结分母已纠正但 exit 仍只查 `membership`** | **属实**，与本节自己要求纳入 `Member` 自相矛盾 | 判据重写为 8 类形态的 set-equality（含 `Member`/`WorkspaceMember*`、`.member()`、URL、generated names、活跃 carry-over manifest、route/L2/architecture 引用、错误码生成权威）；并把"历史材料不改"与"grep=0"统一到**同一个排除集合 `E`**，`E` 逐条给理由，`doc/plans` 的错误码 catalog 与 `contracts/policy` 的 manifest **不得排除** |
| 5 | **`InvitationsPage.tsx` 被 P6 与 P7 双重归属** | **属实** | **P6 独占**；P7 范围从 2 项降为 1 项（只留 `proLayoutNavTheme`）。P7 无法对已删除文件形成诚实 exit |
| 6 | **`testCode` 只更正了数字、没给删除动作与红断言** | **属实** | 补入 P3 的 concrete action：从 2 controller + 3 wire record 移除；wire 侧改契约再 regenerate、不得手改生成物；testContract 断言全部 OTP 响应 schema 无该属性；红变异加回必须红。DEV 可测性改由 P7 的 DEV issuer 承担 |
| 7 | **P8 尚不能机械证明"已结转 RM2"** | **属实**，且不应现在创建 RM2 | 改为 P8 产出**三行可机读 transfer manifest**（`debtId / 事实 / 为何 RM1 不修 / 承接方=RM2`）；约束写进 R-25：任何 RM(n+1) 的输入分母校验必须要求该 manifest 为强制子集。P8 以三个 canonical debtId 做 exact-set，并以缺项/重复或未知/承接方不为 RM2/字段失真四类红变异验证；只能声明 artifact 已准备。 |
| 8 | **§3b.1 仍是三列，不得宣称 R-27 已闭环** | **属实** | 在 §3b 显式标注 R-27 未闭环，并写明闭环判据 = 详设首项产出 57 条逐行七列，且 §3b.4 新补 8 项进入各 owning package 的 scope 与 exit，不停在归属表 |

**格式上的一条提醒**（不影响结论）：Codex 二轮引用使用了本机绝对路径
（`/Users/.../catering-v2s/...`）。按仓内约定，交付物中的路径应为**从 `catering-v2s` 仓库根可打开的相对路径**。

### 15.7 Codex 第三轮反馈的处置（2026-07-28，NO-GO M=6/S=1，全部采纳）

Codex 确认已闭合：R-29 三处旧文本、P6/P7 的 `InvitationsPage` 归属、R-23 八类冻结口径、
`testCode` 已进 P3、R-27 诚实标注未闭环。仍需修的 6 项 + 过渡态否决，**逐条复核后全部采纳**。

| # | Codex 指出 | 复核 | 处置 |
| --- | --- | --- | --- |
| 1 | **P3 的契约 checker 在 P3 exit 永远变不绿**——断言里含"5 个 invitation 已退役、2 个 OTP 已存在"，而这两件事在 P6 才发生 | **属实**，与"截至 P3 时点"自相矛盾 | 断言拆成 A1–A5 **按包分层**：A1/A2 归 P3-A，A3（旧 PUT=0、POST/DELETE 精确绑定 `BC-ORG-HEAD-COMPANY-BRAND`）归 P3-B，A4/A5 归 P6，P3-D 只重跑不改契约。P3 exit 措辞固定为「截至 P3 时点的 operations 写面已闭合（A1+A2+A3）」 |
| 2 | **最终 operation 分母是 104 不是 103** | **属实**，已实测：`edge-route-face-registry.json` 的 `faceCounts` = platform 39 / operations 56 / public 11 = 106；变更后 (39−5+2)+(56−1+2)+11 = 36+57+11 = **104**。作者漏算 R-24 使 operations 面净 +1 | 两份文档的分母全改 104 并写明推算过程 |
| 3 | **`testCode` 漏了第三个调用点** | **属实**，实测 `PublicInvitationController.java:33` 以三参数构造 `new PublicInvitationOtpSendResponse(verificationId, expiresAt, null)`，契约删字段 + codegen 后**直接编译失败** | 改为 3 个 controller + 3 个 wire record，并按 Codex 要求配**三重闭合**：OpenAPI negative contract + codegen drift 为零 + 后端编译/测试（第三条正是能抓住此漏改的那道） |
| 4 | **P8 transfer manifest "三行 + schema 有效"不足以防假记录** | **属实** | 改为 **exact set equality**：期望集合从 P-C4 的三个具名 `debtId` 派生；四类红变异（缺项 / 重复或未知 debtId / 承接方非 RM2 / 字段失真）各须红并指名。措辞约束：**只能声明「transfer artifact 已准备」，不得宣称「RM2 已接收」** |
| 5 | **P2-4 的"不改任何方法签名"与 R-23 的 `.member()→.user()` 冲突** | **属实**，是作者制造的两条同级要求 | 在 P2-4 显式写出**限定例外**：R-23 的重命名族是该禁令的例外，理由是纯重命名无行为改变且已由 P2-3b 的冻结分母约束 |
| 6 | **P1/P5/P6 的 ledger 闭合文本不完整；ST-7 归属不明** | **属实** | 目标规则为 **P1 ledger 只覆盖 7 项，ST-7 由 P0 receipt 独立关闭**；P5 正文补 ST-9 的 exit、P6 正文补 ST-2/ST-6/ST-11 的 exit，均要求写明 authority source 与消费者追溯路径、禁用“出现次数=1”；§15.9 已同步 §4 与 P8 的 7+1 合并对账。 |

**过渡态：作者原方案被否决，已改为 Codex 的「逐次动作 adapter」。**
原写"最小适配、逐项提交"没有排除"保留多选 Drawer、点保存后循环 POST/DELETE"，
而后者在 UI 层复刻整集合替换语义，并引入三类硬问题（同一幂等键下第二条 request hash 冲突；
部分成功/失败停止/重试/owner readback 全未定义；"仍被具体门店使用"的错误在 P6 前会被 transport
丢成固定泛化文案）。**改为**：无"保存整个集合"动作；每次选择/取消各自独立 `POST`/`DELETE`、
独立幂等键、以 owner readback 收敛；失败只回滚该次本地动作；P3-B 前置一个**窄的 typed error 展示桥**
安全展示被阻断的门店标识而不透传 raw detail；P3-B 同步更新旧 `PUT` 的静态测试并配 focused testContract；
P3-D 只做最终 UI 不再改行为。receipt 中登记为 `TRANSITIONAL_UNTIL_P3D`。

### 15.8 Codex 第四轮反馈的处置（2026-07-28，NO-GO 5M/2S/1N，全部采纳）

Codex 确认已闭合：A1–A5 时序拆分、`104 = 36+57+11`、R-23 重命名例外、
3 controller + 3 wire 的 `testCode` 删除闭合。5 个 M 逐条复核后**全部属实**。

| # | Codex 指出 | 复核 | 处置 |
| --- | --- | --- | --- |
| M1 | **P1 ledger 分母自相矛盾**：正确 7 项是 `ST-2/3/4/6/8/9/11`，归属表与 §3b.2 却写回**已证伪的 ST-1 / ST-5** | **属实**，实测 §11 成立集合为 `ST-2/3/4/6/7/8/9/11` 共 8 条，`ST-1`/`ST-5` **根本不存在**——作者凭空写的编号，会直接造成 P1 假绿 | 固定 7-ID 集合 `ST-2/3/4/6/8/9/11`，并明确 P1 直接关 ST-3/4/8、P5 关 ST-9、P6 关 ST-2/6/11、ST-7 归 P0。**P1/P5/P6/P8 四处引用同一集合** |
| M2 | **P8 的 exact-set 不可机械实现**：P-C4 没有稳定 debtId；且 P-C4 是否在 57 条内前后矛盾 | **属实** | 在清单定义三个 **canonical debtId**（`HED-1-CR05-CR06-COMPILE-TEST-RECEIPT` / `HED-2-ACTIVE-RED-VERIFIED-NO-MUTATION-ARTIFACT` / `HED-3-SURFACE-21-OF-22-ZERO-L2`，权威拼写不得改写）；**裁决 P-C4 留在 57 条内**，其 `concrete action` = 产出 transfer manifest、`exit assertion` = 三 ID 的 exact set equality。57 不变，不另立并列分母 |
| M3 | **adapter 的"失败即本地回滚"遗漏未知结果** | **属实**，网络断开时服务端可能已提交，本地回滚会造成状态分叉 | 失败处置分两类：**确定失败**才回滚该次动作；**结果未知**禁止直接回滚，必须先 **owner readback**，再三选一——按事实完成 / 用原幂等键重放 / 明确呈现"结果未知"并停止后续动作 |
| M4 | **“安全展示阻断门店标识”没有可实现的 typed wire**：Problem 禁止额外字段，后端又只产生泛化校验错误——不能同时禁止读 raw detail 又要求展示门店标识 | **属实**，作者原写法两头堵 | 当前规则见 §15.9：P3-B 定义 closed optional `brandAuthorizationBlockers`，仅返回 actor-visible `id/code/name`；不可见门店不返回标识、数量或可反推数量。字段在 `application/problem+json`、codegen 与 transport 中完整保留，bridge 不解析 `detail`。 |
| M5 | **P3-B / P3-D 职责重叠；且 `HeadCompanyAuthorizedBrandsItem` 无授权时间与使用情况字段，P3-D 在“不改契约”前提下无法完成** | **属实**，实测该 wire record 只有 `(id, code, name, status)` | 当前规则见 §15.9：**P3-B 独占**非视觉 adapter、命令/key/recovery/Problem 和 focused tests；P3-B 冻结 `authorizedAtEpochMillis` + `referencingStoreCount`，前端派生 `canRevoke`。P3-D 只复用 adapter、替换视觉结构并补 L2。 |

**S / N 项**：P3-D 的 exit 补齐四条断言（零 `PUT`／无"保存整个集合"提交路径／每次动作恰一**逻辑命令身份**，
未知结果只可同 key 重放／fresh owner readback 后更新）；P6 exit **继承重跑**「所有 OTP response 无 `testCode`」（因 P6 新增 2 个 OTP operation）；
P0 增加"删除已裁决 `DEFERRED` 后仍残留的候选分支"（两套处置并存本身是假绿温床）；
子包顺序写死 **`P3-A exit → P3-B exit → P3-C exit`**。

### 15.9 Codex doc-only 修订（2026-07-28，Dexter 已授权；尚未构成 implementation review）

本节只收敛候选材料的当前规范性文本；不改写前轮发现历史，也不授权 implementation。

| 修订主题 | 当前唯一规则 |
| --- | --- |
| P0 `affected-l2` | 保留 386–422 的五项机制：不删 surface、18 条 `DEFERRED` 到期红、门外下界、禁止空壳、删除旧旁路。重复旧段与“registry 只留有 spec 的 surface”一并删除。 |
| P8 / R-28 / ST ledger | P8 只准备三个 canonical debtId 的 transfer artifact；未来 RM(n+1) 才接收。P8 对 `P0(ST-7) ∪ P1({ST-2,3,4,6,8,9,11})` 做 exact-set，无缺无重。 |
| P3-B / P3-D | P3-B 独占非视觉 adapter、命令语义、同 key recovery、Problem/contract 与 focused tests；P3-D 只做视觉绑定和 L2。 |
| unknown result 与 replay | 正常路径一次 HTTP request；未知结果只以原 method/path/body/key 重放。`*_RESULT_UNKNOWN` 不是确定失败。成功/重放均为不可变 `204` acknowledgement，随后独立 owner GET 收敛 UI。 |
| blocker disclosure | 全部引用门店仍阻断撤销；只返回执行 actor 当前范围可见的 `id/code/name`，`visibleStores` 固定最多 20 条（`maxItems: 20`）；`hasAdditionalVisibleStores` 只表示该 actor 可见结果超出 20 条，绝不反映不可见门店的标识、数量或可反推数量。 |
| typed Problem 与列表 readback | closed optional `brandAuthorizationBlockers` 经 OpenAPI codegen 和 transport 保留，统一 `application/problem+json`；列表冻结 `authorizedAtEpochMillis` + `referencingStoreCount`，UI 派生 `canRevoke`。 |

### 15.4 作者错误累计（含 Codex 四轮）

本轮同型错误（**断言某物"不存在/是全部"而未穷举**）累计 **8 次**：
`/api/` 路径、`approvedAssertions 27`、project-memory 62、`workspaceRequirement`、
286 个错误码、60 处 Gradle 引用、"写入端无第三层校验"、"`P-S3` 已被占用"。
第三轮新增的其他类别错误：N+1 只找到 6/24、红线 E-0 抓不到自己的 6 个发现、
FK 会打断现有写路径、`affected-l2` 建议制造 `x < x` 恒假、
`BackendModuleBoundariesTest:91-92` 的失败方向说反、
v4 `requireStoreCreateVisibility` 复用同一次 buildContext（实为独立调用、独立事务）、
v4 `6 条 LIMIT 10_000`（实为最多 4 条、2/5 分支为 0）、
"一条 SQL 跨三个 owner schema"（实为最多 2 个）。

**结论**：本清单的**仓库事实部分**经三轮独立复核后可信度较高；
**作者的归纳、计数与方案建议部分**在第三轮仍被大量否证。
Codex 使用时，凡涉及"数量""是全部""建议这样修"的表述，**必须自行重算**，不得直接采信。
