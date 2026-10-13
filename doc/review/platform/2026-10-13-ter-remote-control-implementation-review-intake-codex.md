# TER 应用内远程控制实施静态 review intake

本记录是主 agent 对 `doc/review/platform/2026-10-13-ter-remote-control-implementation-review-claude.md` §9 的逐项 intake 与修复说明，不是独立 verdict。仅做当前源码静态核验和受影响调用链回读；未运行测试、构建、verify、DEV、设备或其他动态验证。

## S-1｜续约未复核发起人当前权限

**Disposition：CONFIRMED。** R-03、R-17 要求 CBS 在会话续约时重查当前权限。原 `TerminalRemoteControlOwnerService.report` 校验凭证、binding 和在线 TDS target 后，即可将 ACTIVE 状态写回并延长租约；没有核验发起人的当前 IAM session、capability 与 PROJECT scope。权限撤销后，后续 ACTIVE report 因此仍可能续约。

**最小修正：** terminal-control 在每次 ACTIVE report 更新前调用 workspace-iam 的 `WorkspaceCurrentAuthorizationLookup`。该 lookup 按已记录的 actor session ID 读取当前有效 session/assignment/role，再调用既有 `WorkspaceCapabilityScopeResolver` 核验 `REQ_START_OPERATIONS_TERMINAL_REMOTE_CONTROL` 对当前 PROJECT 的授权。查无有效授权时返回现有 `AUTHORIZATION_DENIED`，不执行 lease 更新。没有增加撤权推送、缓存或权限副本；ENDED report 不受新增检查阻挡。

**范围复核：** `workspace-iam` 仍独占账号、会话和 capability 事实；terminal-control 不直接读取 IAM 表。terminal-control 新增对 workspace-iam 的实现依赖，不形成反向依赖。

## S-2｜本地触摸冲突事件缺 streamId

**Disposition：CONFIRMED。** Android native 的 `local-input-conflict` 事件只携带 `surfaceKey`、`windowIdentity`、`generation` 和 `reason`；adapter 原先却要求 `streamId` 查找 track，导致事件被提前丢弃，owner 收不到本地触摸冲突通知。

**最小修正：** adapter 将事件 `streamId` 标为可选；本地冲突事件按现有 screen 身份三元组匹配当前未释放 track，再走原有 `local-input-conflict` port 事件。首帧与 capture-failed 仍严格按 streamId 关联；全部事件仍先验证当前 session、surface、window identity 和 generation，旧窗口事件继续丢弃。

## S-3｜成员注册回执早于权威投影

**Disposition：CONFIRMED。** branch 注册命令成功回执先到而 `selectMembers` 尚不可见时，原 actor 会先移除 branch pending 并发送确认；desk actor 因成员不存在而不导航。之后现有 reconciliation 也因 pending 已消失无法重试该次确认。

**最小修正：** peer 注册回执完成后，actor 先按 operationId 查询权威成员投影。尚未可见时保留 pending 并返回；已有的 state subscription/reconciliation 在投影到达后重新派发同一 confirm command，再由现有 projection-first 路径移除 pending 并发送确认。投影先到的原有去重路径保持不变。

## 非阻断与未处理项

- N-1 到期结束写入后遇事务异常回滚：按 review 范围保留为非阻断一致性注记，仅在其精确分支处置；本轮未扩建清理机制。
- 原 reset finding 已撤回，本轮不修。
- 测试源码只因 owner 构造器注入调整而同步现有 fixture；未新增测试用例或执行测试。

## 可复用的复发检查

1. 对持续会话/租约的续期，在写入延长期限前重读 owner 所有的操作者身份、有效 session、当前 capability 和目标 scope；不要把初次 grant 当成后续仍有效的证明。
2. 适配层消费 native 事件时，以 native 实际提供的稳定身份字段关联当前资源；仍要检查会话与代次，不能假定 payload 有未发送的 ID。
3. 命令回执表示远端命令完成，不等于本地权威 projection 已到；移除 pending 或发布 UI 完成事件前，先确认本地可查询到对应 operation 的权威事实，并复用已有 state reconciliation 收敛。

这些检查只约束本批三个已确认问题及同形路径，不扩大远控需求或验收场景。
