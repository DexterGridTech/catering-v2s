# BP-U05 跨 owner task-read 预算重基线

## 裁决

Dexter 已明确将本次 BP-U05 的方案与实施判断全权委托给 Codex。本记录据此将下列
五个 `platform-admin` task read 的 `primaryQueryCap` 由不成立的单语句假设重基线为
**最多两段 owner-local primary projection**：

- `getWorkspaceAccounts`
- `getWorkspaceAccount`
- `getWorkspaceInvitations`
- `getWorkspaceInvitation`
- `getWorkspaceInvitationCandidates`

这里的“2”是同一 request 内、每个具名 owner projection 各一次的上限，不是允许任意
两条 SQL，也不是跨 schema join、edge 聚合或 N+1 的豁免。`optionalCountCap` 和
`declaredExtrasCap` 继续为零；列表 total 必须内联到 workspace-iam 的 primary projection。

## 根因与有限分母

这五条的现有 HTTP readback 都同时需要：

1. workspace-iam owner 的账户、任职、角色、邀请/意图/签发者或候选事实；以及
2. organization owner 的已持久 task path、target enablement 或组织候选事实。

将二者压为一个 SQL 需要 task-reader 直接跨 owner schema join，违反 owner sovereignty；
在 controller 逐条补 path 或范围又会形成 N+1。现有链已经证明它们不是可被普通 wrapper
安全压缩为一条 statement 的 counterexample。

有限分母仅为上述五 operationId。其余 14 个尚未接线 operation 仍保留其原 budget，
不得因为本裁决被批量放宽。

## 合规实施形态

每条 operation 必须使用静态、typed 的两段投影：

1. workspace-iam 的 named task reader：一条 bounded CTE/window/JSON aggregate 主查询，
   返回只包含已去重 `TaskPathRef` 或 candidate refs 的 immutable projection；
2. organization 的 named batch task projection：按引用集合一次读取 display path 或合法候选，
   不接受任意表/字段，不写入，不持有跨请求 cache。

edge 只能映射 typed result，不能选择 operationId、重建范围判断或直接 JDBC。组织为
`ORGANIZATION` invitation target 时可只使用 organization projection；`ROLE` target 的
最坏路径为两段，policy 记录上限而不是虚报每个 branch 都是两段。

## 保留与反例

- `getWorkspaceRoles` 已有同 owner window-count 单查询，仍为 `primaryQueryCap=1`。
- command、C5 command reconciliation、protocol/content read 和 BP-U06 全部不在本裁决内。
- 账号/邀请的正常 page、detail、搜索、空页 total、typed 403/404 与 target validation
  必须维持现有 HTTP contract。
- `UNCLASSIFIED`、任一 primary component 超过其 operation cap、或用第三个 owner read
  补齐结果，均继续使运行 evidence 为 `UNMEASURED_BLOCKS_OPTIMIZATION`。

## 验证与防再犯

`task-read-surface-policy` 必须逐 operation 记录两段 owner boundary、cap=2 的原因与
normal fixture；生成器必须拒绝将任何其他 row 扩展为 2、拒绝缺任一 projection、拒绝
edge direct JDBC/operation dispatcher，并以 production-source mutation 验红。动态证据仍
只由受管 workload 的 immutable snapshot 导入，不得以编译或历史 seed 冒充测量成功。

## 后续有限例外（同一授权内的读取重构）

在完成上述五项并重开剩余 14 条实际 owner 查询链后，以下六条被确认不能在不改变
HTTP 输出、跨 owner 直接 join 或以 edge wrapper 隐藏查询的前提下维持原先的单段预算。
Dexter 的全权委托覆盖本项有限重基线；它只改变每条 task-read 的可审计 projection
上限，不授权 SQL 数值优化、BP-U06 或动态环境执行。

| operationId | 最大 owner-local projection 段数 | 已验证的最小原因 |
| --- | ---: | --- |
| `getPlatformContractOverviewDetail` | 2 | store-contract 视图与 extension 字段标签分别属于不同 owner。 |
| `getPlatformOrganizationOverviewDetail` | 2 | organization 明细与 extension definition 保持两个 owner projection。 |
| `getPlatformEntityAuditHistory` | 2 | `GROUP_WORKSPACE` 分支须保留 selected-workspace / organization 判断后再读所属 audit；其余分支不得借此增加段数。 |
| `getOperationsEntityAuditHistory` | 2 | host authorization projection 与 audit page projection 必须保持 owner 分离。 |
| `listPlatformGroupWorkspaces` | 3 | workspace page、organization initialization/path 与 asset public-reference 投影均为已有 HTTP 输出的 owner 事实。 |
| `getPlatformGroupWorkspaceDetail` | 4 | workspace detail、organization initialization、asset 与 workspace-iam account/role summary 都是输出所需的独立 owner 事实。 |

每一段仍必须是一个静态、typed、bounded owner projection，并单独受
`logicalStatementCap=1` 约束；总 cap 不是同 owner 任意多语句的许可。`optionalCountCap`
仍按原 row 记录（仅列表固有 total 允许），`declaredExtrasCap` 仍为零。其余八条未完成
row 保持 `primaryQueryCap=1`，优先通过同 owner CTE/window/JSON task reader 收敛，不能
因本表批量放宽。

控制面必须把这六条列为闭集 exception、记录每个 named owner boundary 与 branch 条件，并
以 source mutation 拒绝第三段、错误 owner、错误 branch 或 cap 漂移。任何动态 run 在所有
component 真实归因、cap 校验及 immutable snapshot join 前仍是
`UNMEASURED_BLOCKS_OPTIMIZATION`，不得把本裁决报告为性能优化成功。
