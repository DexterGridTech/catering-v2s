# 批次三 CP-02 对账记录

CP-02：Doris operational schema 与 TDS 异步 writer

结论：`CP_RECONCILIATION=MATCHED`

本记录只关闭 CP-02 阶段级三维对账，不代表批次级 6b、整体验收或整批 IMPLEMENTATION verdict。

## 三维对账

### 需求

R-2.3、R-6.5～R-6.7 要求绑定与审计事实留在 PostgreSQL，TDS 将连接、断开和心跳往返延时历史写入 Doris；Doris 失败不阻塞或拖慢主流程；遥测不得携带凭证秘密、激活码、deviceId 或业务绑定事实。当前事件类型闭集为 `CONNECTED`、`DISCONNECTED`、`HEARTBEAT_RTT`，事件载荷与本地 DDL/Stream Load 列保持一致。

### 详设与计划

CP-02 实现了有界序列化事件队列、单独 writer、固定批次与有限重试；Doris Stream Load 使用相同 payload 与 label 重试，队列满时非阻塞丢弃并计数。详设 §10 已同步为实际 canonical DDL：`event_time_epoch_millis BIGINT`、`event_type VARCHAR(24)`、`close_reason VARCHAR(48)`；`Instant.toEpochMilli()` 将事件时间以 epoch 毫秒保存，避免时区转换。该文档修正对应 CP02-OPEN-1，生产 DDL、事件编码、Stream Load 与验收 SQL 原本相互一致，无需改动生产 schema。

### 项目记忆与规范

TDS 是辅助传输进程，Doris 仅为遥测存储，不成为业务数据库或 owner；不引入 MQ、通用 outbox、持久队列或常态轮询。受管 acceptance 中业务结果、TDS CONTRACT 与资源 cleanup 分别记录；CP 是独立对账单位，CP02 结果不扩展至后续阶段。

## 实际证据

- managed backend-acceptance run：`r5-tc-1790881723798-40772`，启动 `2026-10-01T19:08:43.798Z`、结束 `2026-10-01T19:11:29.943Z` UTC。manifest 记录所选业务 operation PASS、TDS topology preflight 与 `terminal.connection.history-records` CONTRACT PASS，业务及 runner cleanup 均 PASS；远端 TDS 以受控方式停止，Testcontainers 容器和卷清理后为空。
- Doris readback：`connectedRows=1`、`heartbeatRttRows=2`、`disconnectedCancelledRows=1`；测量 RTT `50.669413ms` 被精确写入并读回；设备取消激活的关闭原因是 `ACTIVATION_CANCELLED`。
- TDS writer 日志：批次加载完成，退出时 `pendingEvents=0`、`dropped=0`、`loaded=12`、`failed=0`、`retries=0`。
- focused Java tests：`./gradlew --no-daemon :apps:backend:terminal-data-server:test --tests com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryWriterTest --tests com.catering.v2s.terminaldataserver.history.TdsDorisStreamLoadClientTest`，退出码 0，`BUILD SUCCESSFUL in 6s`。两份 JUnit XML 各 3 tests、0 failures/errors/skipped：
  - `apps/backend/terminal-data-server/build/test-results/test/TEST-com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryWriterTest.xml`，SHA-256 `ceff976df83d0f7539512028690ac43b7133303a3dd432e7275817eba2110a74`。
  - `apps/backend/terminal-data-server/build/test-results/test/TEST-com.catering.v2s.terminaldataserver.history.TdsDorisStreamLoadClientTest.xml`，SHA-256 `fc3e779267b0ea7383bce92aa8a3ce749760bcb183a3733aca87b2352258b99b`。
- Node wire-client focused test 1/1 PASS；完整 `node --test scripts/test/terminal-ws-wire-client.test.mjs` 27/27 PASS，覆盖 measured RTT 最多 6 位小数的控制命令解析。
- 最新 managed run 之前曾发现测量 RTT 被三位小数正则拒绝；保持首败并修正 Java 测试 harness 与 Node session probe parser 后，以同一 focused acceptance 命令复验通过。另一个 CP02-OPEN 是详设 DDL 列定义陈旧，已按真实 canonical schema 修正文档，不改运行时字节。

## 未覆盖范围

本结论不覆盖 CP-03 跨节点 session replacement/recovery、CP-04 DEV/reset/acceptance 生命周期、CP-05/06 focused work，不构成全批 6b、完整验收、13c 或整批实施审查。不得将本次单场景 acceptance 或历史 feasibility 证据写成整批 PASS。

Fresh 独立 reviewer `batch3_cp02_recheck` 在重开两份 JUnit XML、核对哈希并纳入主会话记录的 Gradle 原始结果后，结论为 `CP_RECONCILIATION=MATCHED`；reviewer 未重跑测试或动态环境。
