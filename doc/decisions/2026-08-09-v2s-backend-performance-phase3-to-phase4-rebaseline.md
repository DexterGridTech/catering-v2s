---
title: backend performance phase three to phase four read-side rebaseline
status: ACTIVE
createdAt: 2026-08-09
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# 后端性能重构：第三阶段到第四阶段的读侧重划

## 1. 触发与边界

Dexter 已批准将第三阶段未完成的读侧工作按正确 owner 边界转入下一阶段。该批准不把
未测的 SQL 优化伪装为完成，也不授权 BP-U06、reset、seed、DEV、L2、UAT 或仓库控制动作。

本决定只修正技术分母与 delivery ownership；不改变任何 HTTP contract、用户任务、owner
主权、事务边界或已关闭的 BP-U07 owner-local M1 command、M3、M4、M5、M6 证据。

## 2. 已证实的根因与反例

原 BP-U07 把 `operations-admin` 非 protocol 的面按 consumer face 泛化为 128，并将 M2
structural scope 一并标为适用。这与两项源事实冲突：

- `getOperationsWorkspaceLoginEntry` 是 pre-login 协议读取，是 B 的五个
  `PROTOCOL_READ_EXEMPT` 之一；它没有既有 workspace session，不能装载
  `WorkspaceReadAuthorizationFacts` 或 `VisibleOrganizationFacts`。
- `VisibleOrganizationFacts` 的可复用 command 证据仅在 C5 的
  `selectOperationsWorkspaceSessionContext` 与
  `selectOperationsWorkspaceSessionDataNode`。其余 command 不得仅因 consumer face
  相同而被推定为 M2 适用；BP-U05 也不得让 task reader 进入写事务来承接它们。

因此“把 126 个 M2 structural operation 全部移入 BP-U05”会同时犯分母泛化和读写边界
混淆两个错误，禁止采用。

## 3. 冻结后的分母与 ownership

| 事实 | 冻结分母 | owner | 状态 |
| --- | ---: | --- | --- |
| GET 路由 | 83 | read policy | 78 TASK_READ + 5 PROTOCOL_READ_EXEMPT |
| operations-admin | 134 | binding | 68 OWNER_COMMAND + 7 PROTOCOL command + 58 TASK_READ + 1 protocol GET |
| SQL-M1 command | 68 | BP-U07 | 已有 owner-local command fact；保持既有证据语义 |
| SQL-M1 read | 58 | BP-U05 | 新建 request-local read fact；不含 pre-login protocol GET |
| SQL-M2 command | 2 | BP-U07 residual | 仅 C5 的两个 session-selection command；必须按 command invocation 保持读写边界 |
| SQL-M2 read | 58 | BP-U05 | session-entry + 57 个 task-read structural scope；只能以 ReadContext/owner reader 实现 |
| SQL-M2 其余 command | 66 | 非适用 | 没有 same-invocation 重复组织事实的 owning-source 证明；不得以 face 推定 |

SQL-M1 的完整有效分母为 126（68 command + 58 task read）。SQL-M2 的有效适用面为 60
（2 C5 command + 58 task read），不是历史 128。所有未完成 read-side 项继续为
`UNMEASURED_BLOCKS_OPTIMIZATION`；在 BP-U05 的 source-bound loader、budget component 和
受控 workload 通过前，不得作 SQL-M1/M2 成功或性能数值声明。

## 4. 实施次序

1. 以本决定更新详设、rebaseline design manifest 与 SQL applicability control；旧 BP-U07
   package exit 改为 `PARTIAL_CLOSED_BY_DEXTER_REBASELINE`，并保留其历史证据。
2. 先对 expanded BP-U05 做 fresh independent `REVIEW_TARGET=DESIGN`；该 review 是新 cycle，
   不能复用已经两轮 hard-stop 的 BP-U07 implementation review。
3. 只有新的设计 review 与 Claude recheck 接受后，才创建 implementation package：它可实现
   M1 read 58、M2 read 58、78 行 read budget、platform audit 的 branch-level fact policy，及
   BP-U07 residual 的两个 C5 command reconciliation。
4. BP-U06 仍保持不在本次授权范围；不得借 read-side implementation 提前删除 dispatcher、旧
   signature 或 controller/owner legacy path。

## 5. 防再犯

效率适用面必须由 `operationId + mode + context kind + owning source invocation` 的交集导出，
不能从 consumer face、HTTP method 或“看上去类似”的服务名推定。任何把 command 事实迁入
task reader、把 protocol read 放入 session read fact、或把未证实 operation 写进 optimization
分母的改动，都必须由 policy/generator 的 exact-set red mutation 拒绝。

平台审计的 selected-workspace 行为也必须按实际分支冻结：`GROUP_WORKSPACE` 与
`WORKSPACE_ROLE|WORKSPACE_ACCOUNT|WORKSPACE_INVITATION|EXTENSION_DEFINITION|STORE_CONTRACT`
各自保留既有 `requireEnabled` 与 typed failure；`PLATFORM_ADMIN` 不装载该事实。该分支规则
不是 operation-wide context kind，必须进入 policy、source anchor 与 red mutation。
