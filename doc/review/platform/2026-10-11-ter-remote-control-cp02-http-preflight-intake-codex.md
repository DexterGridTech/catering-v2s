# TER 远程控制 CP-02 HTTP 动态前静态核验与处置

日期：2026-10-11  
范围：CP-02 CBS owner / online / permission / audit 的 backend-acceptance HTTP 链。  
依据：远控正式需求、CP-02 详设与计划、Claude 转交的 R1 finding、当前 owning source；本记录是主 agent finding intake，不替代独立 review。

## Findings disposition

| Finding | 分类 | 核验、最小处置与当前证据 |
| --- | --- | --- |
| `SESSION_ENDED` 返回 409 而非 410 | `CONFIRMED`，已修复 | 附录要求结束会话投影为 HTTP 410。`TerminalRemoteControlWire.problem` 现将 `SESSION_ENDED` 单独映射为 `HttpStatus.GONE`（`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminalcontrol/TerminalRemoteControlWire.java:78-88`）。过期 grant 与 status-report acceptance 请求均限定 410，并断言 `TERMINAL_CONTROL_REMOTE_SESSION_ENDED`（`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/RemoteControlAcceptanceScenarios.java:508-528`）。 | 
| ACTIVE 过期时间误写 `deadline_at` | `CONFIRMED`，已修复 | `endExpired` 现在按当前状态写结束事实：STARTING 使用 `deadline_at`，ACTIVE 使用 `lease_expires_at`（`apps/backend/catering-business-server/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/persistence/TerminalRemoteControlPersistence.java:147-155`）。定向 SQL-shape 测试覆盖两个分支；真实 HTTP acceptance 将 ACTIVE lease 置为过期，拒绝 grant/report 后重放原 start，并读回 `ENDED/LEASE_EXPIRED` 且 `ended_at=lease_expires_at`、无第二个 TDS operation（`.../RemoteControlAcceptanceScenarios.java:508-547`）。 | 
| capability 撤销后 replay / grant 仍可继续 | `CONFIRMED`，已补真实 HTTP 场景 | 场景通过现有 `WorkspaceRoleService` owner API 将本 fixture 的项目写 capability 移除并读回，不直接写角色数据库；已有 read scope 仍可读 ACTIVE 会话，但同 request start replay 和 controller grant 均返回 403，且不新增 session/online operation、不返回 token。之后恢复同一 fixture 的 capability，保持其余生命周期断言独立（`.../RemoteControlAcceptanceScenarios.java:349-382`；fixture owner 更新在 `.../BackendAcceptanceTest.java:1840-1868`）。 | 
| LiveKit RoomService 的真实结束/资源清理未由 HTTP acceptance 证明 | `UNVERIFIED_REQUIRES_EVIDENCE`，保留范围边界 | 该 acceptance 证明 CBS session、TDS online operation、审计与受管 runner/Testcontainers cleanup；它不代表真实 LiveKit RoomService 已关闭。Room API 可用时的实际 LiveKit 清理仍须由 CP-03/真实 LiveKit 链路证明。本次不在 CP-02 HTTP fixture 中新增第二种 RoomService 假实现或外部服务；后续报告将其单列 `NOT_COVERED`，不得把它写成此 acceptance 的 cleanup PASS。 |

## 核验中发现的测试夹具错误

首次定向单测曾失败：`controllerGrantCannotCrossAccountScope` 预期 `NOT_FOUND`、实得 `AUTHORIZATION_DENIED`。核对 owning service 后确认失败先发生于 `requireGrant`：controller grant 需要 `REQ_ISSUE_OPERATIONS_REMOTE_CONTROL_GRANT`，测试却复用了 start requirement 的 grant fixture；不是 owner 越权或产品语义缺陷。只调整测试夹具为与 controller-grant 操作匹配的 requirement，保持生产校验不变（`.../TerminalRemoteControlOwnerServiceBoundaryTest.java:199-215, 258-270`）。之后精确测试通过；三个受影响的 terminal-control 测试类均通过。

## 当前局部验证

1. 首次定向命令：`compileTestJava` 成功，单测任务 14 项中该旧 fixture 断言 1 项失败；首败如实保留。
2. 修复夹具后，单测方法 `controllerGrantCannotCrossAccountScope` 定向复验成功。
3. 随后同一受影响范围运行 `compileTestJava` 与三个测试类：`TerminalRemoteControlPersistenceTest`、`TerminalRemoteControlOwnerServiceBoundaryTest`、`LiveKitServerSdkContractTest`。Gradle `BUILD SUCCESSFUL`；JUnit XML 读回 14 tests、0 skipped、0 failures、0 errors（各类为 1、10、3 项）。本地时间戳见 XML：`2026-10-11T10:43:05Z`。
4. Fresh R1 静态 preflight：FAIL `M/S/N=0/3/1`，用于定位上表前三项；修复后 fresh R2 静态 preflight：GO `M/S/N=0/0/0`。R2 未运行测试、build、verify、DEV、acceptance 或读取 `.runtime/`。其结论仅允许进入 CP-02 acceptance，不等于动态通过。

## 未证明范围

- `scripts/test/backend-acceptance --operation terminalRemoteControlHttpLifecycle` 当前字节结果：`NOT_RUN`；受管 runner、远端资源、Business 和 cleanup 结果尚未建立。
- LiveKit RoomService / RTC UDP、Expo Web、operations-admin L2、Android、CP-03 adapter/媒体链：`NOT_RUN` 或 `NOT_COVERED`，不得由本次单测或 HTTP 静态准入升级为 PASS。
- 本次未执行默认 `scripts/verify`、seed/reset、UAT 或部署。
