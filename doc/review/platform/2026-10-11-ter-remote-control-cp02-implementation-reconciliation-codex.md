# TER 远程控制 CP-02 阶段对账

## 结论

`CP_RECONCILIATION=MATCHED`。本记录覆盖远控专项 CP-02（CBS owner、在线状态、权限、审计与 acceptance），不覆盖 2026-09 终端激活专项中同名 CP-02。

## 三维核验

| 维度 | 核验结果 |
| --- | --- |
| 正式需求 | `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md` 的 session 生命周期、授权、在线状态及审计判据均有对应 owner 或真实 HTTP acceptance。 |
| 详设/计划 | 详设 §6、§8.0～§8.1 与计划 §4 的表、事务边界、六个 HTTP operation、connection projection、审计读和异常反例均有当前源码落点。 |
| 项目记忆/规范 | 使用现有 terminal-control owner、advisory lock、TDP 在线 command、标准 AuditEventWriter、generated contract 和 managed backend-acceptance；无第二业务目录、MQ、outbox 或写型 GET。 |

## 源码与行为证据

- `apps/backend/catering-business-server/src/main/resources/db/migration/V20261016_000000_000__terminal_remote_control.sql` 建立 session/audit 持久事实和幂等/活跃约束。
- `TerminalRemoteControlOwnerService` 实现当前 binding/在线身份复核、幂等与授权重放顺序、start/register/report/end 及到期处置。
- terminal 与 operations-admin 两侧 controller/OpenAPI/generated consumer 覆盖六个 operation；GET 使用只读项目 session scope。
- 版本 page/detail 以 binding 和 `terminal_connection.latest_state` 投影 `NOT_ACTIVATED`、`OFFLINE`、`ONLINE` 及 `observedAt`/`evaluatedAt`；审计通过现有 audit-read owner 查询。
- `RemoteControlAcceptanceScenarios.sessionLifecycleUsesLiveTdsAndRealHttpOwners` 对真实受管 TDS 与 HTTP 覆盖离线拒绝、并发/幂等 start、撤权、身份冲突、绑定/PG 变化、expired、重复 end、scope、51 终端分页、审计及 fixture cleanup。

## 当前字节运行

- Run：`r5-tc-1791717455820-31441`。
- 时间：`2026-10-11T11:17:35.821Z`–`2026-10-11T11:19:43.184Z`。
- 入口：`scripts/test/backend-acceptance --operation terminalRemoteControlHttpLifecycle`，受管远端 Testcontainers 与真实 TDS。
- 业务：`PASS`；场景 `terminal.remote-control.session-http-lifecycle` 的 `CONTRACT=PASS`、`BUSINESS=PASS`、`DB_OPERATIONS=18`。
- 清理：`PASS`；受管 TDS、Testcontainers、容器/卷、runner workspace 均按 manifest 收尾。
- manifest：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1791717455820-31441/run-manifest.json`。

## 范围边界

独立只读 reviewer `/root/cp02_remote_reconcile_r1` 对当前远控 CP-02 给出 MATCHED，未要求重跑。本结论不证明 LiveKit RoomService 实际清理、CP-03 TER owner/adapter、媒体/触摸、operations-admin UI L2、DEV 或设备行为；这些留在后续 CP。曾有一份审查误读 2026-09 终端激活专项同名 CP-02，其结论不适用于本任务，未作为本次对账依据。
