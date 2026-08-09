# BP-U05 owner-projection 预算上限重基线

## 1. 触发、用户任务与裁决

BP-U05 实施逐点重开 78 条 task-read 的 owner 查询链时，确认既有五项账户/邀请
双 owner 例外之外，另有五条 HTTP 输出要求彼此独立的 owner 事实。原详设的
`primaryQueryCap > 1` 全局上限为 8；沿用旧上限会迫使以下三种伪修复之一：

1. task reader 直接跨 owner schema join；
2. edge 隐藏多段查询并把它们计为单条 primary；
3. 删除合同 extension、商业组初始化、资产 URL、账号/角色汇总或 audit host 判断等既有输出。

三者均违反模块 owner 主权、预算真实性或既有 HTTP 用户任务。Dexter 已将本阶段的
方案与实施判断全权委托 Codex，因此本决策把 `cap > 1` 的**全局闭集上限由 8 重基线为
10 个 operation**；不授权 SQL 数值优化成功、BP-U06、DEV、reset/seed、L2/UAT、部署或
仓库控制。

该上限是 78 条 task read 中的有限分母，不是按 consumer face 批量放宽。所有新增段都必须
是 named、typed、bounded 的 owner-local projection，且每一段 `logicalStatementCap=1`。
任意未登记第三段、N+1、edge JDBC、operationId dispatcher 或跨请求 cache 都保持
`UNMEASURED_BLOCKS_OPTIMIZATION`。

## 2. 问题族、全量分母与反例

问题族不是“某个 endpoint 查询多”，而是**一个已冻结 HTTP readback 同时需要多个 owner
持有的不可删事实**。全量同根扫描以 78 条 policy rows 为分母，结果为：

| 分类 | operationIds | 最大 projection 段数 | 反例边界 |
| --- | --- | ---: | --- |
| 已完成的双 owner display/candidate | `getWorkspaceAccounts`、`getWorkspaceAccount`、`getWorkspaceInvitations`、`getWorkspaceInvitation`、`getWorkspaceInvitationCandidates` | 2 | 不得以跨 schema join 或逐行 task path 解析代替。 |
| contract / extension detail | `getPlatformContractOverviewDetail` | 2 | store-contract view 与 extension 字段标签属于不同 owner。 |
| organization / extension detail | `getPlatformOrganizationOverviewDetail` | 2 | 三种 host detail 的 extension definition 不得被删去或跨 schema 合并。 |
| branched platform audit | `getPlatformEntityAuditHistory` | 2 | 只有 `GROUP_WORKSPACE` 需要 platform-workspace 与 organization 初始化 history 两段；`PLATFORM_ADMIN` 仍为无 selected-workspace 的单 owner 分支。 |
| platform workspace page | `listPlatformGroupWorkspaces` | 3 | workspace page、organization initialization/path、asset public reference 都是列表输出事实。 |
| platform workspace detail | `getPlatformGroupWorkspaceDetail` | 4 | workspace detail、organization initialization、asset 与 workspace-iam account/role summary 都是详情输出事实。 |

`getOperationsEntityAuditHistory` 不是例外：八个 entity-type branch 必须改为
`AuditTargetAuthorizationProjection`，使用已加载的 read-context facts 在目标 owner 内同时完成
target-type / absent / host-scope 判断，再进入同 owner 的 window-count audit page projection；
不得保留 edge `detail/view` 或 `WorkspaceAuditAuthorizationService` 的逐 target lookup。其结果是
一个 cap=1 的 typed operations audit reader，而不是把现有三段链压成字符串声明。

经对 `OperationsAuditHistoryController#history` 的实际 switch 复读，以上“八个”是早期分组摘要而不是可执行分母：当前 HTTP 接受的有限集合是九个 type：`WORKSPACE_ACCOUNT`、`WORKSPACE_INVITATION`、`COMMERCIAL_GROUP`、`ORGANIZATION_NODE`、`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`STORE_CONTRACT`。cap-one 设计固定为 `app/application/audit/OperationsAuditTaskReadService#read(OperationsAuditReadQuery)`：edge 只解析 UUID/page 与已加载的 `WorkspaceReadAuthorizationFacts + VisibleOrganizationFacts`，将 typed query 交给此静态九分支 reader；每一分支只能调用其事实 owner 的一个 named projection。每个 projection 把目标 type、存在/类型不匹配、从 read facts 得出的 host scope、window-count 与 page 放进同一 logical statement。它返回 `AuditHistoryPage` 或原有 typed failure；不得再调用 edge `requireHostAuthorization`、`OrganizationOverviewTaskReadService#detail`、`ContractTaskReadService#view` 或 `WorkspaceAuditAuthorizationService` 的额外 lookup。

这不是跨-owner SQL 或通用 query bus：reader 是 compile-time closed nine-branch coordinator，不拥有表、不接受 operationId/表名/字段名，所有 SQL 仍位于各 owner named projection。其 source control 在 reader 落地时必须逐项拒绝：旧 edge detail/view/authorization 调用、九项任一 branch 遗漏、非 window-count total、或单分支第二 owner lookup。

以上 10 个 operation 互不重复。其余 68 个 task read 继续为 `primaryQueryCap=1`；列表 total
仍优先 window-count 内联，`optionalCountCap` 只保留原先两条固有列表 row 的预算，
`declaredExtrasCap=0` 不变。

## 3. 更小替代与拒绝理由

保留 8 条上限并把超出部分标为永久 `NOT_YET_TASK_READER` 的成本是 BP-U05 无法完成整个
78 条 B read 分母，且会把真实用户界面当作未处理例外；这不比有限、可审计的 10 条更安全。
将所有事实塞入 platform/workspace reader 的跨 schema SQL 会破坏 owner 主权；把 asset 或
summary 挪到前端会改变同一 HTTP response 的完成语义；全局 read cache 则会绕开 request
相关性与事实新鲜度。故采用逐 operation 的 owner projection 表是最小可复核方案。

## 4. detail / audit 语义与 source-bound 形态

`getPlatformContractOverviewDetail` 的 extension boundary 固定为
`ExtensionDefinitionService#platformContractManagementDefinition`，它对未配置 host 返回 revision
zero / empty fields，不得替换为 strict `requireDefinition`。`getPlatformOrganizationOverviewDetail`
必须将现有 organization detail 拆为不读取 definition 的 owner-local base projection（实体、路径、
raw extension values），再调用 `ExtensionDefinitionService#platformManagementDefinition(workspaceUuid,
key, hostType)`；后者同样保持未配置 host 的空 fields。六种 host type、absent target 与有/无
extension values 都是同一 HTTP contract 的夹具分母。

`getPlatformEntityAuditHistory` 的 `GROUP_WORKSPACE` 仍是唯一两段 branch：
platform-workspace audit projection 与 organization initialization audit projection 各一条 logical
statement；`PLATFORM_ADMIN` 只走 platform-iam audit projection，绝不加载 selected-workspace。
其它 platform audit target 各在所属 owner 以 target validation + window-count audit page 的单个
projection完成。

当前仓没有 `modules/audit` implementation module；因此 platform audit 的未来 reader 不得声明不存在的模块路径。它固定为 `app/application/audit/PlatformAuditHistoryTaskReadService#read(PlatformAuditHistoryQuery)`，以闭集 `PLATFORM_ADMIN|GROUP_WORKSPACE|WORKSPACE_ROLE|WORKSPACE_ACCOUNT|WORKSPACE_INVITATION|EXTENSION_DEFINITION|STORE_CONTRACT` 分支调用相应 owner projection；另 `modules/workspace/.../PlatformWorkspaceAdministrationTaskReadService#page/#detail` 是平台 group-workspace 三/四 owner 投影的唯一协调入口。两者及其 focused tests 必须先进入 package/manifest exact surface，再可从 `SOURCE_NOT_IMPLEMENTED_BLOCKED` 转为 `TASK_READER`。

## 5. 防再犯与验收

`task-read-surface-policy`、generator 与 read-budget checker 必须把全部 10 条写成唯一的
exception exact set；每行列出 owner boundary、`logicalStatementCap=1`、branch 条件与 fixture。
真实 red mutation 至少覆盖：非闭集 row 提升 cap、缺/多/错 boundary、cap 漂移、
`PLATFORM_ADMIN` 错带 selected-workspace、audit/group-workspace branch 遗漏，以及 edge 绕过
typed reader。`primaryReaderSchema` 必须为新行列出 source path、method、typed input/output 与
exact edge call；每条至少有一条 production-source mutation，拒绝额外 owner 段、错误 branch、
错误 definition API 或绕过 typed reader。所有 78 条只在受管 workload 的 immutable snapshot 同时证明 component 精确相加、
无 `UNCLASSIFIED`、各段均不超 cap 后，才能从 `UNMEASURED_BLOCKS_OPTIMIZATION` 转换状态。

本文件是 design-rebaseline 输入；在 fresh 独立 DESIGN review 通过前，新增第 9 至第 10
例外不得被报告为已完成或测量成功。
