# 批次三全批 6b 三维对账

`BATCH_6B=MATCHED`

独立 reviewer：fresh 子 agent `/root/batch3_6b`；只读；先按需求、详设/计划、项目记忆与当前源码形成独立判断，再核对 CP 证据。未运行命令、生成、构建、测试、verify 或动态环境。结论仅为全批 6b 准入，不是整批实施 GO。

## 三维结果

### 需求与已接受裁决

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:59,253-274,493-506` 要求批次三增加 Doris 连接历史、跨节点会话接管/恢复、DEV/reset 与 R-14；不将 Doris 变成业务数据 owner。
- `doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md:30-37` 将 Doris 限定为 TDS 遥测存储，保留 PG 业务事实，不引入 MQ/outbox/持久队列/常态轮询。
- 当前 `TdsConnectionHistoryEvent.java:10-21,49-59,96-100` 的事件闭集为 `CONNECTED`、`DISCONNECTED`、`HEARTBEAT_RTT`，不含秘密、激活码或 deviceId。

### 详设、计划与源码/证据

- Doris writer 的有界队列、非阻塞丢弃、批次与重试与详设 §10 对齐：`TdsConnectionHistoryWriter.java:25-35,77-91,185-249`；Stream Load timeout、响应体上限和状态映射见 `TdsDorisStreamLoadClient.java:28-33,71-97,108-123,129-188`；运维 DDL 位于 `scripts/dev/doris/connection-history.sql:1-19`，未进入 Flyway。
- 跨节点权威顺序与恢复落点一致：PG `latest_state`/`pg_notify` 同事务写入见 `TdsConnectionStateRepository.java:24-57`；actor 复核 latest、sequence 水位及拒绝陈旧候选见 `TdsTerminalSessionActors.java:315-450,591-614`；监听恢复后提交 LISTEN 并重读、通知触发 PG 复核见 `TdsBindingRevocationListener.java:125-181,243-271`。
- resident Doris、reset 顺序及 acceptance per-run 容器均按计划实现：`scripts/dev/r5-doris-resident.mjs:6-35,71-80`；`scripts/dev/r5-reset.mjs:35-40,72-80,230-245`；`BackendAcceptanceTest.java:727-758`；TDS 收到配置注入见 `TdsAcceptanceProcess.java:207-222`。
- 运行时配置闭集包含 28 个键，Doris 五键已同步：`contracts/policy/runtime-environment-keys.json:23-27`、`RuntimeEnvironmentKeys.java:30-34,60-96`。CP-06 当前 validate-only 为 `46/46` PASS，默认 verify 运行段仍明确为后置 `NOT_RUN`：`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp06-codex.md:11-20,60-64`。
- CP-01～06 均有各自的 fresh 阶段级三维记录，见同目录 `2026-10-02-v2s-terminal-activation-batch-3-cp01-codex.md` 至 `...-cp06-codex.md`。其中 CP-04/05 正确将 acceptance、DEV、reset 与完整 §11a 留给全批 6b 之后。

### 项目记忆与治理

- TDS/Doris owner 边界、无 MQ/outbox/轮询符合 `project-memory/kernel/02-service-shape-and-owner.md`。
- 完整 CP 为对账单位；业务、CONTRACT 与 cleanup 独立陈述，符合 `project-memory/operations/implementation-source-reread-discipline.md` 与 `project-memory/kernel/05-evidence-runtime-and-git.md`。
- 跨层运行时键闭集与每个精确集合消费者同步，符合 `project-memory/operations/test-closed-loop.md` 的 `CLOSED_CROSS_LAYER_SET_TEST_MUST_TRACK_POLICY`。

## Findings

无 OPEN finding。CP-01～06 各自 `MATCHED` 不替代本次独立全批 6b；本记录是独立全批复核的当前结论。

## 明确留给批次级动态验收的项目

以下均为 `NOT_RUN`，不是 6b 阻断项：默认 `scripts/verify` 运行段；批次级 backend-acceptance/DEV 完整适用验收；最终 Doris 清表与 PG reset、独立 DEV start/readiness、完整 `r5-full` seed/readback；13c 逐代码对账；整批 `REVIEW_TARGET=IMPLEMENTATION`。L2 对本批无适用 UI 控件，按计划 §3a N/A；不做 UAT 或生产部署。

本次可复用的历史 focused 证据只在其 run/source/拓扑边界未变时有效：CP-02 `r5-tc-1790881723798-40772`；CP-03 `r5-tc-1790888076113-72812`；CP-05 `r5-tc-1790896315855-42187` 与 `r5-tc-1790897077843-56712`。本记录不重新运行这些场景，也不将它们提升为整批验收。
