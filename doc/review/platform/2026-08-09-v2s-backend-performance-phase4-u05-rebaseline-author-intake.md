# BP-U05 rebaseline DESIGN 作者处置

Review cycle: `OVERALL_PHASE_4_U05_REBASELINE_DESIGN_20260809`  
Review target: `DESIGN`  
Round: `1/2`  
Independent input: `design-review-round1.md@094f55047a46bb8df788c949684f89ea51403b6443b45cb3def88c76e328ef48`

本处置在独立 verdict 之后，逐项重新读取 owning source、详设与控制面；不把 review finding
自动视为事实，也不改变 BP-U06、runtime、reset/seed/DEV/L2/UAT 边界。

## 逐项 disposition

| finding | disposition | owning-source 复核与最小修复 |
| --- | --- | --- |
| `BP-U05-RB-M-01` | `CONFIRMED` | `PlatformAuditHistoryController#history` 证实 `GROUP_WORKSPACE` 和五类 workspace host 都调用 `scope`/`scopeForWorkspaceTarget`，因此既有文档的“五类”是遗漏而非可删除行为。修复为：policy 引入 `PLATFORM_AUDIT_BRANCHED`，冻结六个 enabled branch 与 `PLATFORM_ADMIN` ungated 分支；U07 applicability 新增 source-bound `EnabledSelectedWorkspaceFact` control、method-body branch scan 与 red mutation。较小的“全局/固定 workspace kind”会分别遗漏既有 403 或无谓扩大 gate，拒绝。 |
| `BP-U05-RB-M-02` | `CONFIRMED` | `WorkspaceAuthenticationService#selectContext/#selectDataNode` 均 mutation 后调用 `sessionEntry`；`session` 只经 request-scoped `WorkspaceSessionRequestCache` 提供旧 session projection。修复为：详设冻结两条独立链——fresh-query `WorkspaceReadAuthorizationFacts` 明确不得调用 cache，C5 command-local reconciliation 只能在上述 owner method 的 mutation/readback invocation 内，edge 仅传 typed input；manifest 补齐 owner、cache 与 edge source。将 C5 调用 task reader 会跨越 command/read 边界，拒绝。 |
| `BP-U05-RB-S-01` | `CONFIRMED` | 旧设计只列 83/78/5 分母而未把每行语义落盘。新增 `task-read-surface-policy.json` 为 design-time semantic truth：83 行显式 disposition，78 行冻结 kind、fact set、cap、controller anchor、NORMAL fixture，5 行闭集 reason；`getPlatformEntityAuditHistory` 固化分支 facts/caps。生成器只能验证该输入，不能反向推导语义。 |

## 回读结果

- 83 行完整：78 `TASK_READ` + 5 `PROTOCOL_READ_EXEMPT`；任务行分布为 58 `OPERATIONS_SCOPED`、15 `PLATFORM_WORKSPACE`、4 `PLATFORM_GLOBAL` 与 1 `PLATFORM_AUDIT_BRANCHED`。
- M1 为 68 command + 58 task reads = 126；M2 为 C5 command 2 + task reads 58 = 60；pre-login `getOperationsWorkspaceLoginEntry` 只在五项协议/内容闭集中。
- U07 applicability control 仍只报告 immutable-snapshot coverage 的 `BLOCKED_UNMEASURED`，没有把 BP-U05 defer 伪报为 SQL 成功。

## Round 2 请求

请对上述三项的 source-bound 闭合做定向独立核验：审计六分支/平台管理员反例、C5 与 request cache 隔离、83 行 policy 的 exact-set 和最小 kind/cap/fixture；同时确认 BP-U06 仍零进入。该 review 是同一 cycle 的 Round 2/2。

## Round 2 最终 finding 的作者处置

Review cycle: `OVERALL_PHASE_4_U05_REBASELINE_DESIGN_20260809`  
Review target: `DESIGN`  
Round: `2/2`（已硬停止，不新增 Codex 对抗审查轮次）  
Independent input: `design-review-round2.md@0e9f328d809addcedda6d2f79006a0fa3b176f95bb0dd94740cd4e49ee007b84`

| finding | disposition | 根因、有限分母与最小预防措施 |
| --- | --- | --- |
| `BP-U05-RB2-M-01` | `CONFIRMED` | 根因是 audit policy 只声明分支集合，却让扫描器以 method-wide `scope` 出现与 case 名存在作为证据，不能保证每个受保护分支仍实际绑定 enabled-workspace gate。有限分母是 `PlatformAuditHistoryController#history` 的 6 个 enabled branch（`GROUP_WORKSPACE`、`WORKSPACE_ROLE`、`WORKSPACE_ACCOUNT`、`WORKSPACE_INVITATION`、`EXTENSION_DEFINITION`、`STORE_CONTRACT`）及 1 个反例 `PLATFORM_ADMIN`。最小修复是控制面逐 switch-expression 检验：前六者分别含 `scope(entityId)` 或 `scopeForWorkspaceTarget(groupWorkspaceKey)`，`PLATFORM_ADMIN` 精确为无 scope 的 owner call；新增 source-text red mutation 把 workspace-IAM branch 改为 `target`，必须报 `BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING`。不引入全局 platform reader，也不改 controller 行为。 |
| `BP-U05-RB2-S-01` | `CONFIRMED` | 根因是 policy 的 59 个 row 用通配/`#route` 占位，无法成为逐点双读的 owning-source。有限分母是 78 条 `TASK_READ` policy rows。最小修复为每行写入唯一、仓根相对的 `sourcePath#method`，并以 78/78 文件存在、方法声明存在、禁止 `{`/`}`/`*`/`#route` 的只读校验复算；结果为 `TASK_READ_ANCHORS=78`、`TASK_READ_ANCHORS=PASS`。这只是 source 回读锚点，不为端点生成一条 SQL。 |

## POST_REMEDIATION_V1 声明

上述修复发生在同一 cycle 的最终独立 Round 2 之后；当前字节**未**由该独立 reviewer 审阅，且本 cycle 不得启动第三轮。`implementation-design-granularity` 以 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` 记录这一事实，必须由 Claude 对当前字节进行 recheck 后才能设计准入。该声明不授予 BP-U05 implementation、BP-U06、runtime、reset/seed/DEV/L2/UAT 或 SQL 数值优化权限。
