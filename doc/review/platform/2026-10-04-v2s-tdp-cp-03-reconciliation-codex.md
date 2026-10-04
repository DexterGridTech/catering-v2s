# TDP · CP-03 三维阶段对账

```text
TASK=Terminal Data Platform data-change and remote-operations
CP=CP-03
VERDICT=MATCHED
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
SCOPE=CP-03 only; no whole-batch verdict
```

## 独立结论

CP-03 在本阶段范围内 `MATCHED`。reviewer 独立核对正式需求、详设与实施计划、项目记忆约束、当前 owning source 及本阶段 focused proof；未发现 OPEN。此结论不表示 CP-04～06、全批 6b、整体动态验收、DEV、Expo Web 或最终实施 review 已通过。

## 对账依据

- 正式需求 R-04～R-06 要求 owner raw topic time、范围集合 snapshot/hash、同事务 cache、提交后通知及 listener 重建后重读权威状态：`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:101-164`。
- CP-03 计划明确权限范围、三个集合 snapshot 与八个精确 topic、listener rebuild、12+订阅身份、bounded outbound slot，以及 terminal-control 权限测试延后至 CP-06：`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:51-60`。
- TDS 路由八个精确 topic 到 owner raw-time 函数、三个集合 topic 到 owner snapshot：`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsTerminalTopicRepository.java:28-53`；owner SQL 函数按完整 workspace/group/bound-store/topic/owner identity 限定读取：`apps/backend/catering-business-server/src/main/resources/db/migration/V20261004_000000_000__terminal_topic_snapshots.sql:72-157`。
- Actor 管理当前订阅身份、scope 校验、ACK 后读取和重建对账；outbound 满槽拒绝新帧并释放 buffer：`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java:540-708`、`apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsWebSocketConnectionTest.java:77-113`。
- `TdsTerminalTopicRepositoryTest` 的 2/2、Actor 24/24、listener/scope focused tests、outbound slot test 分别记录在 `2026-10-04-v2s-tdp-cp-03-focused-proof-codex.md` 对应 run rows；focused proof 保留首败和根因修正。
- 受管双会话真实验收 `r5-tc-1791112758404-44392`：manifest 的业务结果、TDS contract 与 runner/Testcontainers cleanup 均 PASS。`tds-contract-result.jsonl.gz` 记录两个独立 WS client、同一 STORE topic，listener backend PID `78 -> 79`，两 session 接收并 ACK 同一个更新后的 owner time `1791112906239`，并记录 fixture 已取消。完整证据位于 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791112758404-44392/`。
- CP-02 的事务回滚/no-NOTIFY 证据仅作为 owner 边界复用，未被冒称为 CP-03 的 TDS consumer 证据；完整 HTTP collection body 归属 CP-02/CP-05，CP-03 只验证 TDS 读取 snapshot/raw-time 标量。
- 项目规范要求完整 CP 后进行独立三维对账、MATCHED 才进入下个 CP；本记录遵循该阶段边界，不替代全批 6b。

## 边界与未验证项

CP-03 未验证完整 HTTP 集合消费、CP-04 TDC、CP-05 feature、CP-06 远程命令、全批 verify/6b、DEV 或 Expo Web；这些留在各自阶段。对一个已停止消费 outbound slot 的 socket，不承诺仍可成功发送 PONG；当前判据是容量有界、第二帧 typed 拒绝且资源释放。
