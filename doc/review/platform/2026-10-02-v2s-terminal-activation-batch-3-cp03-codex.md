# 批次三 CP-03 对账记录

CP-03：跨节点 session 取代、监听恢复与会话历史基础事件。

结论：`CP_RECONCILIATION=MATCHED`（fresh 独立三维对账）。本记录只关闭完整 CP-03，不代表全批 6b、CP-04～CP-06、整体验收、13c 或整批 IMPLEMENTATION verdict。

## 三维对账

### 需求

- R-7.2/R-7.3 要求通知用于唤醒、PG 为跨节点会话事实权威，listener 重建后重新核验，并在规定窗口内取代失效会话；R-14 要求真实 HTTP、真实 WebSocket 与真实 PG 验证，不得手工写状态或伪造通知。
- 当前实现保持这些边界：PG 同事务写最新 session 与 `SESSION_OPEN` 通知；接收端在登记前重读 PG；单调 sequence watermark 阻止旧候选回退；旧断开以 session identity 限定。

### 详设与计划

- 详设 CP-03 明确要求两种接管顺序、listener 恢复后读 PG、登记前候选仍为 pending，并特别要求确定性覆盖“PG open 已提交、本地登记前被新会话取代”窗口：`doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md` §4 CP-03。
- 计划 CP-03 要求 PostgreSQL 事务集成测试、registration gate broker 测试及双 TDS 真实 acceptance 场景：`doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md` §CP-03。
- 该窗口由 acceptance-only `PG_OPEN_COMMITTED_BEFORE_LOCAL_REGISTER` 闸门稳定暂停。生产默认无测试控制 socket 时闸门立即放行；接受测试通过既有受管控制通道释放，不修改绑定状态或手工发送 NOTIFY。

### 项目记忆与治理

- `project-memory/operations/implementation-source-reread-discipline.md` 要求完整 CP 为阶段对账单位，变更点仍须主 agent 前后双读和 focused proof；本阶段按完整 CP 复核。
- `project-memory/kernel/02-service-shape-and-owner.md` 规定 TDS 为辅助进程、Doris 仅承载连接遥测，不引入 MQ/outbox/持久队列/轮询，也不改变业务 owner 与 Flyway 边界。
- `project-memory/kernel/05-evidence-runtime-and-git.md` 要求使用 run-scoped manifest/日志，区分业务结果与 cleanup；本 CP 的 CONTRACT、BUSINESS 与 cleanup 分开记录。

## 实现与 focused proof

实现落点：

- `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/SessionRegistrationGate.java` 增加 PG commit 后、本地登记前的 acceptance gate 阶段。
- `TdsTerminalSessionActors.java` 在 PG open 提交后等待受管 gate，再重读权威 latest 并决定登记；非 latest candidate 不发送 `SESSION_READY`，以 `SESSION_REPLACED` 关闭。
- `scripts/test/TdsRegistrationGateBroker.java` 及其测试可精确 arm/release 该阶段；`TerminalConnectionContractScenarios.java` 的 V-S13 以真实双 TDS、PG、HTTP/WebSocket 覆盖竞态两种顺序和 listener 恢复。

当前字节 focused 证据：

| 运行 | 结果 | 范围与 cleanup |
|---|---|---|
| `r5-tc-1790887855128-68443` | PASS | 远端 `:apps:backend:terminal-data-server:test`；`TdsTerminalSessionActorsTest` 21项、`SessionRegistrationGateTest`、`TdsConnectionStateRepositoryPostgresIntegrationTest` 2项均通过；runner cleanup PASS。 |
| `r5-tc-1790887974691-70816` | PASS | 远端 `TdsRegistrationGateBrokerTest` 8项通过；runner cleanup PASS。 |
| `r5-tc-1790888076113-72812` | PASS | 受管 `storeTerminalActivationBusinessPrecedence`：`BUSINESS=PASS`；V-S13 `CONTRACT=PASS`；TDS 合约场景 3/3；TDS、Testcontainers 容器/卷及远端 runner cleanup 均 PASS。 |
| Node focused | PASS | `terminal-ws-wire-client.test.mjs` 指定测试2/2；V-S13 acceptance 结构测试1/1；相关脚本 `node --check` PASS。 |

V-S13 的 current-byte 结果记录 candidate sequence=2、winner sequence=3、candidate close=`SESSION_REPLACED`，candidate 未获得 `SESSION_READY`；日志先显示新 sequence=3 已由 listener reconcile，再显示旧候选被拒绝。反向顺序也通过：先登记的 A 被较新的 B 取代；listener 恢复后再按 PG 最新状态关闭旧会话；失败认证不影响 B；真实 HTTP 取消激活关闭对应会话；控制会话继续成功 PONG。运行时间为 `2026-10-01T20:54:36.113Z` 至 `20:58:09.085Z` UTC。

首个 remote runner 调用因一次传入多个 Gradle task、违反入口单 task 参数约束而在启动前拒绝（`FOCUSED_TEST_SELECTOR_REQUIRED`）；没有创建远端运行或资源。随后按入口契约拆为两个受管 focused run，均通过。该调用错误未被计为业务测试失败，也未用其结果替代有效证据。

## Fresh 独立复核与边界

fresh reviewer `/root/batch3_cp03_postfix_reconcile` 对当前 CP-03 需求、详设/计划、记忆规范、源码、JUnit artifacts、受管 manifest 与日志逐项复核，结论 `CP03_RECONCILIATION=MATCHED`，无 OPEN。之前 reviewer 曾因真实 V-S13 缺少 PG-commit-before-register 屏障及指定 focused test 当前运行凭证而报 OPEN；本记录列出的屏障实现、测试与新受管 run 已补齐该缺口，后续 fresh 复核关闭。

本 CP 结论不覆盖 Doris Stream Load/最小权限、CP-04 DEV/reset 生命周期、CP-05/06、全批 6b、默认 `scripts/verify`、完整 §11a、最终 reset/DEV/seed 或 13c。后续若修改 TDS actor/listener/repository、registration gate/broker 或 V-S13 场景，须重开受影响的 CP-03 证据。
