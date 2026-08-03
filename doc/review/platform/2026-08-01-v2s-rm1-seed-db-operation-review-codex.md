---
title: RM1 r5-full Seed 高数据库操作请求复盘（Codex）
date: 2026-08-01
reviewTarget: ANALYSIS
reviewerKind: CODEX_WITH_THREE_INDEPENDENT_READ_ONLY_CROSSCHECKS
scope: "r5-full Seed report 中 databaseOperationCount.max > 3 的全部 endpoint 分组"
sourceReport: ".runtime/r5/dev-rm1-20260801-r2/results/seed-report.json"
sourceReportSha256: e0b41d7c4ac47ccb87d940bd340f250d9f01c89cd599c8fde8d4b2d087512210
authority: "分析与评审材料；不授权优化实现、Roadmap 状态、DEV/seed/reset 或业务验收结论"
independentReview: "round 1: NO-GO M=1 (completion final-readback); round 2: GO M=0/S=0/N=0 after source-backed correction"
---

# RM1 r5-full Seed 高数据库操作请求复盘（Codex）

## 结论先行

本次 Seed 的 63 个 API 调用全部成功，其中 23 个 endpoint 分组（60 次调用）出现了单次
`databaseOperationCount.max > 3`。这不是 23 个缺陷，更不能据此把“每个请求不超过 3 次”当成
command 的质量门：ADR 的 `<=3` 是**任务型读取**的默认预算，写命令还须支付授权、幂等、owner
不变量、同事务审计和最终 owner readback 的成本。

复盘确认的方向是：保留这些必要成本；优先消除同一可信事实在一次用例内的重复读取，以及将
“先插入、再读、再合并、再更新”的 extension 形状收敛为 owner 内的一次 typed
validation/normalization + 初始写入。最佳方案不是把多条判断拼成跨 owner 的大 SQL，也不是为
降低计数删除重验、审计、CAS、幂等或最终 readback。

| 结论 | 分组 | 处理建议 |
| --- | ---: | --- |
| 可直接列入下一性能/一致性改进包（P0） | 4 个方案包 | invitation token 重读、operations session entry 重组、extension 初始写入、hierarchy 的类型无关 phase 操作 |
| 可作为同一问题族随包闭合（P1） | 5 个端点 | controller 内 immutable session/actor 复用、workspace 细节重复读、head-company 新建读回、store 的 extension 部分 |
| 合理保留（P2） | 5 个端点 | 登录防护、asset staging、账户页批量读取、授权、失效合同 |
| 需要先补负载事实，不应仅凭这次 Seed 改动（P3） | 2 个候选方案 | store relation 合并 judgment、invitation 多意图批量 judgment |

本报告提出的是**已定位的冗余路径与设计方案**，不是性能 PASS/FAIL，也没有把单次顺序 Seed
的平均值冒充 p95、并发吞吐或执行计划结论。

## 1. 审查输入、统计口径与不可越过的边界

### 1.1 输入与分母

- 机器真相：`.runtime/r5/dev-rm1-20260801-r2/results/seed-report.json`，SHA-256 如 front
  matter；其人读投影是同目录 `seed-report.md`。
- 分母：报告中的 26 个 endpoint 分组；本报告逐项覆盖其中最大 DB 操作数大于 3 的 **23/23**
  分组，不合并遗漏分母。
- 已重开：Seed 统计详设、`CountingDataSource`、`DatabaseOperationTracker`、
  `SeedRequestMetricsInterceptor`、single-deployable/owner ADR，以及各 owner 的当前生产源码。
- 三份独立只读交叉核查覆盖：workspace-IAM/invitation/session、organization/extension，以及
  contract/cross-cutting；其输出只作为待验证输入，以下结论均按源码与设计边界重新裁定。

### 1.2 “DB 操作数”实际代表什么

`CountingDataSource` 在 JDBC `execute*`、`executeQuery`、`executeUpdate` 或 batch 调用返回/抛出
时记录一笔；`DatabaseOperationTracker` 将 request-local 执行次数与 statement wall time 相加；
`SeedRequestMetricsInterceptor` 按实际 handler route/operation/owner 将结果写为 completion event。
因此该数字：

- 是 statement execution 的**逻辑次数**，包含 advisory lock、零行 CAS、审计和幂等查询；
- 不保留 SQL、bind 或 payload，故不能由此反推每一条 SQL 的文本或计划；
- 不是事务数、网络往返数、锁等待、数据库 CPU/IO、连接池等待或端到端业务延迟；
- 这次是串行 Seed 样本（多次请求仅 4/5/6 次），没有 p95/p99、并发或热/冷缓存控制组。

故本报告以“链路是否重复读取可信事实、是否可在同 owner transaction 内收敛”为判据；任何
实施前的性能收益必须再用 statement 预算、真实 SQL 的 `EXPLAIN (ANALYZE, BUFFERS)`、受控并发和
p50/p95/p99 验证。

### 1.3 必须保留的架构约束

最佳方案必须同时遵守以下不变量：

1. 一 deployable、一 PostgreSQL、多 owner schema、单 Flyway history。
2. 写由事实 owner 持有；跨模块写只走公开 typed command 并加入同一 `REQUIRED` transaction；
   不允许 coordinator/edge 跨 schema DML。
3. 写事务中的跨 owner 前置判断只走 typed judgment API；页面 task read 才可显式跨 schema SELECT。
4. 顶层 command 建立 immutable trusted `ExecutionContext`，target owner 对对象范围、状态、
   revision 与不变量复查；不能为减查询把授权变为裸 boolean 或 page-side 猜测。
5. 幂等 receipt、CAS、审计和成功写后的 owner readback 是业务一致性机制，不得以“计数高”删除。

## 2. 用户任务、Dexter 的成本意图与方案选择

Seed 的用户任务是建立可复现的 r5-full 业务初始状态；Seed 报告的任务是让 Dexter 能看见每个
真实 API 调用的 HTTP/DB 汇总。Dexter 要解决的不是报表好看，而是从异常 DB 操作密度中找出
真实设计浪费，同时不伤及后台 owner 主权与一致性。

三个可行方向如下：

| 方向 | 取舍 | 裁定 |
| --- | --- | --- |
| 机械限制所有 endpoint `<=3` | 看似简单，但会误删命令所需的授权、幂等、审计和 readback | 拒绝 |
| 把判断压成跨 schema 大 join/edge SQL | 可能少 statement，却侵蚀 owner 公开 API、事务与 failure 语义 | 拒绝 |
| 在 owner 内去重同一事实；把 repeat load/merge/update 收敛为 typed 一次判断与初始写入 | 既减少 statement，也减少 TOCTOU，保留所有 owner 和审计语义 | 推荐 |

## 3. 分组总表（23/23）

表中的次数、DB ms 均为 Seed 报告的平均值；“优先级”是改造优先级，不是当前业务故障等级。

| # | owner / operation | 次数 | DB 次数 | 业务判断 | 最佳处理 |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | platform-iam / platformPasswordLogin | 1 | 8 | 安全链合理 | P2：只评估无状态 reset 的条件更新 |
| 2 | platform-asset / stagePlatformAsset | 1 | 5 | 合理 | P2：保留 |
| 3 | platform-workspace / createPlatformGroupWorkspace | 1 | 11 | 有 actor 重读 | P1：controller session snapshot 复用 |
| 4 | organization / initializeCommercialGroup | 1 | 9 | workspace ref 重读 | P1：detail projection 带 UUID；owner 初始 readback 收敛 |
| 5 | extension / replaceExtensionDefinition | 1 | 9 | definition/revision 重读 | P0：一次 extension owner snapshot |
| 6 | workspace-iam / createWorkspaceRole | 5 | 11 | session/actor 重读 | P1：同一可信 actor 复用 |
| 7 | workspace-iam / acceptPublicInvitation | 6 | 4 | token 重读 | P0：一次 token load |
| 8 | workspace-iam / sendPublicInvitationOtp | 6 | 10 | token 与 OTP 前置重读 | P0：一次 token load + private OTP helper |
| 9 | workspace-iam / verifyPublicInvitationOtp | 6 | 11 | token 重读 | P0：一次 token load |
| 10 | workspace-iam / savePublicInvitationCredentials | 6 | 7 | token 重读 | P0：一次 token load |
| 11 | workspace-iam / completePublicInvitation | 6 | 16.33 | token + success completion 重读 | P0：一次 token load，首成完成结果直接构造 |
| 12 | workspace-iam / operationsWorkspacePasswordLogin | 1 | 27 | 登录后重复 session entry composition | P0：一次 owner session-entry 组装 |
| 13 | workspace-iam / getOperationsWorkspaceSessionEntry | 1 | 15 | resolver 后重复 session composition | P0：一次 owner session-entry 组装 |
| 14 | organization / createOperationsOrganizationRegion | 1 | 14 | Region 无需 phase 操作 | P0：按 node type 分支 phase 查询/DML |
| 15 | organization / createOperationsOrganizationProject | 1 | 15 | parent phase 无用读取 | P0：按 node type 读取；批量 phase 写 |
| 16 | organization / createOperationsOrganizationBrand | 1 | 15 | extension 二次写 | P0：typed extension 初始写入 |
| 17 | organization / createOperationsOrganizationTenant | 1 | 15 | extension 二次写 | P0：typed extension 初始写入 |
| 18 | organization / createOperationsOrganizationHeadCompany | 1 | 17 | extension 二次写 + 新对象空授权读 | P1：同一 extension 方案 + specialized readback |
| 19 | organization / addOperationsOrganizationHeadCompanyBrandAuthorization | 1 | 9 | 完整性/幂等/audit 成本 | P2：保留 |
| 20 | organization / createOperationsOrganizationStore | 1 | 28 | scope 与多关系判断，多数合理；extension 可收敛 | P1：extension first；relation judgment 先压测 |
| 21 | workspace-iam / getWorkspaceAccounts | 6 | 11.5 | 批量任务读，无 N+1 | P2：保留，补多样本预算 |
| 22 | contract / createOperationsContract | 4 | 21 | extension 二次写 | P0：typed extension 初始写入 |
| 23 | contract / invalidateOperationsContract | 1 | 17 | precheck/CAS/audit/readback 合理 | P2：保留 |

## 4. 逐请求复盘

### 4.1 platform 与 workspace administration

#### 1. `platformPasswordLogin` — 8 次，338 ms

**链路与业务含义。** `PlatformAuthenticationController` 进入
`PlatformAuthenticationService.login`；服务先用两个 account bucket 的 advisory lock + 读取实现
防爆破，再读 credential/状态，成功后删除 bucket、按需更新 credential reset 状态，并创建平台
session。它保护的是密码登录的限流、账号状态与 session 创建，而不是普通列表读取。

**合理性。** 锁、bucket read、credential read、成功清理与 session write 都是安全与业务事实；
不能合并成 edge 查询，也不可移除 lock。**可选微优化。** 仅当 credential reset 状态本已 clean 时
不执行 reset UPDATE，可少一条写；此收益很小且必须确认审计、last-success 语义不依赖该更新。
结论：P2，先保留。

#### 2. `stagePlatformAsset` — 5 次，203 ms

**链路与业务含义。** controller 校验文件/摘要；对象先写入 object storage，随后 owner 同事务写
`staged_asset`、bind grant 与 idempotency receipt。它使后续 workspace/brand 等命令可以安全 claim
该 staged asset。

**合理性与最佳方案。** 三个不同 owner-local 事实（暂存资产、授权绑定、幂等）不是重复读。把它们
硬塞进 CTE 既不降低跨系统 object-store 成本，也会降低 failure 语义可读性。保留 P2。

#### 3. `createPlatformGroupWorkspace` — 11 次，524 ms

**链路与业务含义。** edge 先解析 platform session 与 actor，workspace owner 再做幂等 receipt
advisory/lookup、workspace insert、资产 claim、owner readback、legacy-id/audit。

**冗余与方案。** controller 同时 `sessions.require(...)`、`sessions.requireActor(...)`，两者各自读
同一 platform session。最佳改法是在 controller 仅装载一次 immutable `PlatformSessionReadback`，
由其导出 actor；workspace owner 仍在 transaction 内根据 trusted context 做自己的判断。预期 -1，
不改变 asset claim/audit/readback。此问题族还应扫描 platform 的 role/account/admin mutation
controller；`PlatformExtensionDefinitionController` 的单 actor 装载是反例。

#### 4. `initializeCommercialGroup` — 9 次，414 ms

**链路与业务含义。** platform workspace service 读取 workspace detail、再独立读取 workspace UUID，
随后调用 organization 的公开 `REQUIRED` command 创建 commercial group；organization 完成
face/idempotency、insert/update、audit 与 readback。

**冗余与方案。** workspace detail 已足以成为 workspace UUID 的 owner projection；将 UUID 纳入该
detail，删除第二次 owner-local lookup。organization 首次创建若可由 `INSERT ... RETURNING` 取得
readback，可避免“insert 后专为成功态再读”；replay 仍必须读已有结果。不能让 workspace service
直接写 organization schema，亦不能消除 organization 的幂等与 audit。

#### 5. `replaceExtensionDefinition` — 9 次，433 ms

**链路与业务含义。** 此操作替换某实体类型的 extension definition/revision。它需要 platform
authorization、receipt、当前 revision 做 conflict control、definition insert/audit/readback 和 receipt
终态；这些是版本化配置而非简单 CRUD。

**冗余与方案。** 当前更新路径为 conflict/audit/type compatibility 分别装载 definition/revision，
造成相同 owner fact 多次 SELECT。最佳方案是 extension owner 在同一 `REQUIRED` 事务提供一个私有
typed snapshot `{revision, definitions}`，所有 conflict、类型兼容、audit before-value 和写入共用；
写采用 `UPDATE/INSERT ... RETURNING`。保留 platform authorization 和 final readback。此为 P0，
并是 contract/entity extension 问题族的上游共性。

#### 6. `createWorkspaceRole` — 11 次均值，531 ms

**链路与业务含义。** 平台管理员在某 workspace 创建可授予角色；edge 解析 session+actor，
workspace-IAM 在 owner 内复查 workspace/role 条件，执行 idempotency、insert、审计和 owner
readback。

**冗余与方案。** 与 #3 同源：controller 重复 session/actor load。一次 immutable snapshot 传给
edge-to-owner command context 即可，目标 owner 的对对象/状态的 recheck 不变。P1，和 #3 在同一
有限分母（所有 platform mutation controller）修复，不能只改此 endpoint。

### 4.2 public invitation（同一 token 事实的统一问题族）

`WorkspaceInvitationService.requireGroupInvitation` 先按 token 读取以校验 group key，再按 token
读取 invitation 本体；五条 public flow 因而都有一条重复读取。最佳基础改动是在 service 内一次
load 得到 invitation 后校验 group key，向后续 private method 传递该 typed aggregate/read model，
不是把 token 交由 edge 解释。以下各操作仍保留自己的 rate limit、CAS、审计与账户判断。

| operation | 当前业务链路与计数 | 合理成本 | 可消除部分与最佳实现 |
| --- | --- | --- | --- |
| `acceptPublicInvitation`（4） | token 双读；PENDING→ACCEPT CAS；audit | 状态 CAS/audit 必须保留 | 一次 token load，目标降至约 3 |
| `sendPublicInvitationOtp`（10） | token 双读；OTP rate lock/read/upsert；`issueMobileVerificationOtp` 又读 group/token、OTP id、supersede + insert | 速率限制、旧 OTP 失效和新 OTP 写必须保留 | 从已验证 invitation 调 private helper，避免二次 group/token load，约 -3 |
| `verifyPublicInvitationOtp`（11） | token 双读；OTP rate lock/read/upsert、consume CAS、bucket clear、invitation CAS、progress upsert、audit、accountExists | 消费 CAS、防爆破、进度/audit 都是安全/业务事实 | token 一次 load，约 -1 |
| `savePublicInvitationCredentials`（7） | token 双读；grant 读、progress 更新、invitation CAS、audit、accountExists | credential gate、CAS、audit 不可省 | token 一次 load，约 -1 |
| `completePublicInvitation`（16–17） | token 双读、progress；每项 role/enterable 判断、account/credential/assignment 写、completion CAS、最终 `completion(token)` read | 多 intent 的角色/可进入性判断、各事实 owner 写、CAS/audit 与最终 owner completion readback 均必须保留 | 一次 token load 仅消除重复读取（约 -1）；最终 readback 保留。若将来用 `UPDATE ... RETURNING` 收敛，也必须是 owner 确认的等价结果并有并发证明 |

`complete` 的未来上界风险不同于当前重复读：若 invitation 带许多 intent，逐 intent 的
`roles.require`/enterable judgment 可能形成线性增长。正确的后续方案是 role owner 提供
`requireAll`，并复用 organization 已有的批量 `availableTaskTargets` typed judgment，增加多 intent 红测；
不能直接 join organization schema，也不能为降计数跳过每项 failure 语义。此项 P3，先补样本和
失败语义再实现。

### 4.3 operations 登录、session entry 与账号读

#### 12. `operationsWorkspacePasswordLogin` — 27 次，979 ms

**链路与业务含义。** operations login 先执行 password security chain（bucket locks/reads、credential
判断、成功清理、session 创建），随后 controller 忽略 `LoginResult.session`，再次调用
`sessions.sessionEntry(raw)`；后者重做 session、assignment/roles、organization target 与 visible-node
composition。安全链本身合理，问题在于成功后重复构造同一个登录入口。

**最佳方案。** 让 session owner 的 login 直接返回可用于 response 的 canonical entry，或提供一次
owner-local `sessionEntry(raw, workspaceKey)` 作为唯一 composition API；controller 不再先 login 再
无条件重组。必须保持 `contextVersion`、assignment/role/target 的 owner recheck，禁止跨请求缓存
授权。预计消除约 3 条或更多 statement，但以实测为准。P0。

#### 13. `getOperationsWorkspaceSessionEntry` — 15 次，621 ms

**链路与业务含义。** route resolver 先 `requireWorkspace`，之后 `sessionEntry` 再读取同一 session
composition。**方案。** 同 #12，把 workspace key 作为 session owner API 的输入，一次完成 session
验证与 entry 构建；resolver 不保存或推断授权事实。预计约 -3；和 #12 一包同改同测，P0。

#### 21. `getWorkspaceAccounts` — 11–12 次，489 ms

**链路与业务含义。** 这是 platform 的分页 task read：session/workspace enabled 以后，查询 count、
page IDs，并对账号、assignment、role/task path、history、pending credential 进行 IN-batch 装载。
**判断。** 没有每行 N+1；总数随丰富的账户管理视图而来，且该读取不应被写命令的 `<=3` 默认预算
错误约束。保留 P2；后续只需增加多账号/多角色族样本下的 query budget，防止退化为 N+1。

### 4.4 organization hierarchy、business entity 与 store

#### 14. `createOperationsOrganizationRegion` — 14 次，551 ms；15. `createOperationsOrganizationProject` — 15 次，580 ms

**链路与业务含义。** operations session cache 后，hierarchy command 做 receipt、commercial-group
前置判断、父节点/状态验证、node insert、phase replace/readback 与 audit。Project 有 phase 定义；
Region 没有 phase。

**已确认冗余与方案。** generic hierarchy path 对 Region 仍无条件 DELETE project phase name，
`requireNode` 对 Region 仍物化 phase rows；Project 的 parent Region 也读了无用 phase。按 node type
将 phase query/DML 限制为 Project；多 phase insert 以 batch 写入，最终 project phases readback 保留。
同一 transaction 内 `requireCommercialGroupRef` 后，private validated create path 可避免第二次
workspace-enabled 查询。预计 Region 约 -3，Project 至少 -1；P0。

#### 16. `createOperationsOrganizationBrand` — 15 次，610 ms；17. `createOperationsOrganizationTenant` — 15 次，565 ms；18. `createOperationsOrganizationHeadCompany` — 17 次，653 ms

**链路与业务含义。** 三者都要 session/context、receipt、workspace enabled、code/name uniqueness、
extension definition validation、entity insert、extension values replace、readback/audit；HeadCompany
随后还读取 authorized brands。

**问题族与最佳方案。** `validateValues` 读 definition，insert 后 `replaceValues` 又读新行 JSON/再读
definition/UPDATE。这是同一 extension truth 在第一次创建事务内重复读取，并把初始实体变成两阶段
半成品。extension owner 应提供窄 typed `validateAndNormalize` judgment，返回 canonical extension
values + applied revision；entity/contract owner 在**初始 INSERT**写入该结果。这样可省 post-insert
SELECT、重复 definition SELECT、UPDATE（约 -3），并减少 definition n 与 n+1 间的 TOCTOU。组织
owner 仍只持有 typed result，不能读取 extension 原始 repository/row。

HeadCompany 的追加优化：新建后不可能已有 brand authorization（FK 且不存在同事务写授权 command），
readback 可由 owner 断言空集合，省两条授权读取；只适用于 create 成功，不可推广到 detail/list/update。
Brand/Tenant 为 P0，HeadCompany 的空集合为 P1。

#### 19. `addOperationsOrganizationHeadCompanyBrandAuthorization` — 9 次，375 ms

链路为 cached session、receipt claim/final、head-company context、brand enabled judgment、
`INSERT ... ON CONFLICT` 和首次授权 audit。IA 的业务语义是逐品牌即时增删与幂等 204；这些操作正是
“某总公司能否使用某品牌”的完整性链。没有证据表明存在重复读或 N+1；不应为了少 statement 改为
批量草稿或删除 audit。P2 保留。

#### 20. `createOperationsOrganizationStore` — 28 次，1,130 ms

这是分母中最高的 organization 写命令。链路包含 operations session、`WorkspaceUserService`
task scope（assignment/task path/scope）、receipt、workspace enabled、project phase、tenant/brand/
head-company judgments、head-company-brand authorization、extension validation/merge、store insert/
readback/audit。

**裁定。** scope、项目 phase、各关系 enabled/authorization 判断是 G03/G04/G06 风险的防线；它们
不能被一条 edge join 取代，也不能因计数高删掉。当前可与 #16–18 共用的 P1 是 extension typed
initial write（约 -3）。之后才可设计 organization owner 内的 `StoreRelationValidation` typed
judgment，将 tenant/brand/head-company status + authorization 以一个 owner-local query 返回，但必须
保持每一种 typed failure 的准确性、引用状态与 scope 边界，并有关系失效/越权的真实红测。该更大
合并是 P3，先压测和验证 failure taxonomy，不以这次 Seed 直接实施。

### 4.5 contract

#### 22. `createOperationsContract` — 21 次均值，825 ms

**链路与业务含义。** 运营人员为选定 project/stores 创建合同，包含 tenant、effective date、phase
和 items；edge 获取 session/actor/project scope，contract owner 执行 receipt、store context、
extension validation、合同 insert/audit/receipt/readback。四次样本稳定为 21，不是偶然一次抖动。

**确认优化。** extension 子链目前是 definition read、insert 后 JSON read、再次 definition read、
UPDATE（约 4 条）。与 #16–18 同一根因，最佳方案同为一次 typed definition snapshot 校验/归一化
并随初始 contract INSERT 写 extension values/revision，约减至 1 条。该方案同时缩小 definition
版本变化的 TOCTOU 面。P0；focused proof 必须覆盖 absent/required/disabled/revision、并发 definition
变更与 idempotency conflict。

#### 23. `invalidateOperationsContract` — 17 次，738 ms

此操作先做 session snapshot、合同任务 view + project scope，再做 receipt，owner 读取当前合同、
CAS invalidation、after read、audit，最后 receipt/task read。precheck、CAS 与最终 owner readback
分别保障可见性、并发正确性与响应真相；强行合并 after read 可能使实际提交态不再可验证。没有足够
证据支持优化，P2 保留。

## 5. 最佳实施包：顺序、范围与禁止做法

### P0-A：Invitation 一次 token load

- **owner/事务**：仅 `workspace-iam` service 私有 helper；public API/edge route 不变；所有 CAS、
  rate lock、OTP 消费、audit 仍在同一 `REQUIRED` transaction。
- **有限分母**：`accept/send/verify/save/completePublicInvitation` 五条由
  `requireGroupInvitation` 进入的 invitation flow；必须全量扫描反例（non-token internal path）。
- **proof**：每条 happy/replay/rejected 结果不变；group mismatch、expired/revoked、rate limit、OTP
  consume、重复 complete 的红测；`complete` 首次成功与重放都保留 owner final completion readback。DB
  budget 只断言重复 token read 被消除，不规定总数小于 3。
- **禁止**：在 edge 缓存 invitation、把 token 作为已授权断言、跳过 rate limiting/CAS。

### P0-B：operations canonical session entry

- **owner/事务**：仅 `workspace-iam` session owner 组成 entry；login controller 与 resolver 都调用
  同一 typed owner API。
- **有限分母**：`operationsWorkspacePasswordLogin`、`verifyOperationsWorkspaceOtp` 与
  `getOperationsWorkspaceSessionEntry`，并扫描所有 `sessionEntry` consumer。
- **proof**：登录成功、已撤 assignment、role 变动、target 不可进入、contextVersion 变化；确认同一
  response 的 user/visible nodes/contextVersion 不变，并有 query-count regression。
- **禁止**：跨请求缓存 `ExecutionContext`、在 controller 导出/拼装授权事实。

### P0-C：typed extension snapshot + initial write

- **owner/事务**：extension owner 在其声明的 `com.catering.v2s.extension.api` package 暴露窄
  judgment，返回 canonical values/revision，并在该 API package 公开对应 typed failure；organization
  与 contract owner 只接收结果并在初始 INSERT 写入。跨 owner 通过公开 typed API 同入 `REQUIRED`。
- **有限分母**：definition replace、Brand/Tenant/HeadCompany/Store 创建、Contract 创建；更新路径
  不是自动同分母，须逐条证明。
- **proof**：required/disabled/type/revision/conflict、idempotency replay、definition 并发改变、audit
  before/after、rollback；statement count 前后；不要把少一次 UPDATE 误写成跨 schema 写主权。
- **禁止**：organization/contract import extension repository、application package 的失败类型，或存
  raw extension entity。当前五个 production consumer（organization 两处、contract 两处和 edge
  `ContractProblemAdvice`）对 `ExtensionDefinitionService.DefinitionNotFoundException` 的 application
  import 是已确认的既有边界缺口；在 P0-C package 中把该 typed failure 迁移/重新发布到
  `extension.api` 后，全量迁移这五处及其 focused tests，不能在此之前借本报告声称已经闭合。

### P0-D：hierarchy node-type phase handling

- **owner/事务**：仅 organization hierarchy owner；Region 不装载/删除 phase，Project 仍完整校验与
  final readback。
- **有限分母**：Region create、Project create、node update/delete 与任何 `requireNode` caller；必须
  以 node type 检索而非只改两个 controller。
- **proof**：Region 永远无 phase；Project phase 写/读、parent status、同名/版本冲突、审计与 replay
  全部不变；statement budget 在 Region/Project 各自记录。
- **禁止**：把 hierarchy 管理移到 edge 或删除 Project phase 事实。

### P1/P3 的实施节奏

P1（platform immutable session actor、workspace UUID projection、new head-company 空授权 readback、
store 的 extension 部分）可依附以上 owner 包做。P3（多 intent batch judgment、StoreRelationValidation）
先建立真实多对象 workload 与 failure matrix；若收益不足，不做抽象。所有包完成后须把代码当陌生
人的代码重读，至少逐项确认“owner 方法真的接收该参数、符号真实存在、调用后仍获得 owner readback”。

## 6. 验证与性能证明计划

1. 每一 P0 单元先重开该业务 IA/详设、相关 project memory 与 owning source，再做同根调用方扫描。
2. 为每个被改 owner 写 sibling focused tests：成功、拒绝、重放、并发/版本冲突和跨 workspace
   反例。保留现有 typecheck、contract、capability、codegen、security-boundary 门。
3. 以 Seed 的 per-operation count 作回归预算（只对去重点设相对降低/不回升）；不把静态或
   focused proof 称为业务 PASS。
4. 在隔离 non-production DB 进行 warm-up 后的固定样本与并发阶梯，记录 p50/p95/p99、吞吐、错误率、
   pool wait、lock wait、DB CPU/IO；对高耗 SQL 做 `EXPLAIN (ANALYZE, BUFFERS)`。
5. 动态运行按受管 run manifest 读取应用/runner 日志，分别报告 business 与 cleanup；cleanup 非 PASS
   不宣称完成。DEV start/restart 不隐式 seed，seed/reset 仍显式且破坏性隔离。

## 7. 发现状态、反例与待核实事项

| 项目 | 状态 | 依据/边界 |
| --- | --- | --- |
| 23/23 分母与报告数值 | CONFIRMED | 直接由 JSON/Markdown Seed report 复算 |
| invitation 重复 token load | CONFIRMED | 同一 service path 先 group-check read 后本体 read；五条 flow 为有限分母 |
| operations 登录/entry 重复 composition | CONFIRMED | login 后 controller 再调 entry；不质疑安全 login 子链 |
| extension “validate → insert → reread/merge/update” | CONFIRMED | entity 与 contract 同源；方案需保持 typed owner API |
| extension typed failure 从 application package 泄露给 consumer | CONFIRMED_UNCLOSED | 5 个 production consumer catch/handle `ExtensionDefinitionService.DefinitionNotFoundException`；P0-C 必须在 owner 声明的 `extension.api` 重新发布 failure 并全量迁移 |
| hierarchy 对 Region phase DML/read | CONFIRMED | node type 与 phase 事实不匹配；Project 是反例，不能一概删除 |
| `completePublicInvitation` 直接以内存 accountId 构造响应 | REJECTED_WITH_EVIDENCE | 独立对抗审查指出源码在 CAS/progress/audit 后仍以 owner `completion(read(token))` 确认；已修正为保留最终 readback |
| 所有高计数均应优化 | REJECTED_WITH_EVIDENCE | asset、登录、authorization、account task read、invalidate 都有不同必要事实 |
| `OrganizationCommandService` 是否还缺 owner workspace recheck | UNVERIFIED_REQUIRES_EVIDENCE | 当前 coordinator 已校验；需重开 P6 owner design 后判断，不能借性能复盘越级改动 |
| 最大 statement 数是否等于最慢/最贵 SQL | REJECTED_WITH_EVIDENCE | 当前计量不含 execution plan、lock/pool/IO 或 percentile |

另有治理事实：`scripts/check/standards-coverage --phase RM1-P6-3` 当前返回
`UNKNOWN_PHASE:RM1-P6-3`。这是 standards-coverage phase 映射/调用口径问题，不是本报告的
backend 性能结论，更不能被表述为 standards PASS。

## 8. 交给 Dexter 与 Claude 的审阅问题

请以 `GO / NO-GO — M=x / S=y / N=z` 评价本**分析设计**，并重点核验：

1. P0-A 至 P0-D 是否完整保留 owner 主权、typed judgment、`REQUIRED` transaction、CAS/receipt/audit
   与 final owner readback；是否存在更小的安全实现。
2. 23 个 endpoint 分母是否有遗漏，或是否把 “JDBC statement count” 误读成 SQL 性能结论。
3. extension 初始写入的结果对象与 typed failure 是否都位于 owner 声明的 `extension.api`，并避免 repository/entity/application package 泄露与跨 owner DML。
4. StoreRelationValidation 与 invitation multi-intent batch 是否应维持 P3，避免为降低数字提前抽象。
5. 任何实现授权均须另开 package；本报告不授权实现、DEV/seed/reset、动态 L2、业务 PASS 或 cleanup PASS。

## 9. 独立对抗复核留痕

独立 reviewer 第一轮以证伪立场发现：本报告曾建议 `completePublicInvitation` 首次成功直接用
内存 `accountId` 构造 completion，这会删除源码已有的 owner final readback。作者已重开
`WorkspaceInvitationService.completePublic`，确认 CAS、progress 写、audit 后仍须以
`completion(read(rawInvitationToken))` 确认完成态/accountId，遂将建议更正为“只去除重复 token
read；保留 final readback；只有等价的 owner `RETURNING` 结果并经并发 proof 后才可减少 statement”。
第二轮定向核查为 `GO — M=0 / S=0 / N=0`。这只证明本报告的分析边界已一致，不构成任何优化代码
或动态业务结论。
