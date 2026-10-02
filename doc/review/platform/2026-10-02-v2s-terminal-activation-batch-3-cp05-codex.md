# 批次三 CP-05 实施与对账记录

CP-05：场景与业务 Oracle focused proof。

当前状态：`CP_RECONCILIATION=MATCHED`。Fresh 只读 reviewer `/root/batch3_cp05_reconcile_r3` 已按需求、详设/计划与项目记忆，对当前 CP-05 字节及结果映射完成三维复核。此结论只覆盖 CP-05；不代表 CP-06、全批 6b、批次级完整 §11a、13c 或整批 IMPLEMENTATION verdict。

## Finding intake 与修正

- S-1（场景 ID 与结果映射）：`CONFIRMED`，为详设/计划对实际验收入口的描述漂移，不是生产行为缺陷。实际动态测试 selector 是 `terminal.connection.vs13.cross-node-recovery`；它写一条 aggregate TDS 结果行，其中分别断言 `online-takeover` 与 `commit-before-local-registration`，并提供 registration candidate/winner sequence、关闭原因及 takeover session 字段。节点强制终止并改连的 V-S6 另写 `terminal.connection.latest-state-stale-write` 结果行。详设 §11/§11a 和计划 CP-05 已改为这些实际 selector/result IDs；移除不存在的“两节点在 PG open 前同步释放”描述，不伪造独立场景 ID。
- V-S4 的慢节点时钟：本 CP 没有注入 OS/JVM 时钟偏差。实现的排序不读取节点时钟：`TdsConnectionStateRepository.OPEN_SESSION` 通过 PostgreSQL `nextval('terminal_connection.session_sequence')` 生成顺序，upsert 只接受更高 sequence；`TdsTerminalSessionActors` 按该 sequence 比较候选与已观察水位。双 TDS 动态验收验证新节点 sequence 更高且旧会话被取代。因此文档把这项表示为源码不变量加动态 sequence 读回，没有把运行说成时钟偏移样本。Fresh reviewer 接受此证据形态；若以后要求实际更改节点系统时钟，需另行评估，不在本 CP 声称已运行。

## CP-05 focused 动态证据

| Run ID | 时间（UTC） | 选择与结果 | Business | Cleanup |
|---|---|---|---|---|
| `r5-tc-1790896315855-42187` | 2026-10-01 23:11:55–23:14:43 | `terminal.connection.vs13.cross-node-recovery` PASS；独立结果 `terminal.connection.latest-state-stale-write` PASS；TDS 4/4，拓扑预检 PASS | PASS | PASS：受管 TDS/runner、Testcontainers 容器/卷及查询均 PASS |
| `r5-tc-1790896507038-45889` | 2026-10-01 23:15:07–23:17:37 | `terminal.connection.history-outage-bounded` 首次失败，HTTP audit-history 读回 404；first failure 保留，未记成 PASS | NOT_RUN（run manifest）；JUnit 保留断言失败 | PASS |
| `r5-tc-1790897077843-56712` | 2026-10-01 23:24:37–23:27:07 | 修复后 `terminal.connection.history-outage-bounded` PASS；TDS 1/1 | PASS，DB_OPERATIONS=7 | PASS：受管 TDS/runner、Testcontainers 容器/卷及查询均 PASS |

首败根因：audit history 辅助 fixture 新建了 store/session，但读回仍使用旧 `StoreContext`，因此查询指向的门店上下文不匹配。修正为使用辅助 fixture 对应的 `StoreContext` 后，同一 focused 场景通过。无重复 failureCategory；未延长 timeout 或换场景规避。

关键结果：

- Cross-node run：registration candidate sequence `2` 被 winner sequence `3` 取代，candidate 关闭原因 `SESSION_REPLACED`；online takeover 旧会话同样由新节点取代；listener backend 断线后恢复，node B 保持 latest；设备真实 HTTP 取消返回后关闭目标会话为 `ACTIVATION_CANCELLED`；control session PONG=2。
- Forced node termination：旧 node A PID/start ticks 由受管身份记录；终止后没有伪写 disconnect，terminal 在 node B 以更高 sequence 重连；PONG 后 latest 仍为新 node B session。
- Doris outage：队列上限 4096；挂起写入超时 10,000 ms；业务激活/取消各 20 次；观测到队满 drop 与重试后 drop；PG audit rows=40；最大激活响应 55 ms、最大业务取消响应 31 ms；TDS 日志与 SQL readback 被验收读取。

## 当前 CP-05 focused 范围与后置项

- CP-05 focused 运行只证明本 CP 选择的 cross-node、latest-state stale-write 与 Doris outage 场景及其业务结果、cleanup。
- 未在上述 focused runs 中选择的 `terminal.connection.history-records`、`terminal.connection.vs11.secret-search`、DEV V-E1、reset V-E3 等，仍为 `NOT_RUN`；不从本记录推成 PASS。完整 §11a 逐项结果按计划留给全部 CP MATCHED、全批 6b MATCHED 后的批次级整体验收。
- 不覆盖默认 `scripts/verify`、全批 6b、DEV start/reset/seed、完整 §11a、13c 或最终实施审查。

## Fresh 独立三维对账

- 需求维度：`MATCHED`。V-S4、V-S6、V-S13 与 V-B9 的判据仍由实际动态测试/结果和当前验收层承载；未把逻辑子路径误写成独立选择器，也未把受管清理或完整 §11a 提前声称通过。
- 详设/计划与实现维度：`MATCHED`。selector、两个结果行、子断言字段、执行档位、CP-05 focused 边界与实际源码一致；时钟独立性表述基于 PostgreSQL sequence 源码不变量和实际 sequence 动态证据，不宣称系统时钟注入。
- 项目记忆维度：`MATCHED`。按完整 CP 阶段对账；业务/CONTRACT/cleanup 分开；当前 focused 运行与后置 NOT_RUN 项未混报。
- Reviewer 未提出 OPEN finding。

## 当前字节上的运行状态

- 当前字节上的最新运行：`r5-tc-1790897077843-56712`，2026-10-01 23:24:37–23:27:07 UTC，PASS；business PASS，cleanup PASS。
- 最后一次通过：同一 run `r5-tc-1790897077843-56712`；其生产与测试源码与当前字节一致。此后只修改详设/计划和本记录，未改受测代码；文档映射由 fresh CP-05 reviewer 在当前字节重新核验。
