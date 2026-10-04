# TDP CP-04 三维阶段对账

```text
TASK=TDP data-change and remote-operations
CP=CP-04
VERDICT=MATCHED
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
SCOPE=CP-04 only; no whole-batch verdict
```

## 独立结论

Fresh reviewer `/root/cp04_reconcile` 对 CP-04 完整范围进行只读三维对账，结论 `MATCHED`，无 OPEN。reviewer 未复跑命令；命令 PASS 证据引用主 agent 当前字节 focused proof。此结论不覆盖 CP-05/06、全批 6b、整体验收、backend-acceptance/DEV、Expo Web 或最终实施 review。

## 三维对账依据

- 正式需求 R-07～R-10 对应 topic 初始/接受时间、多个 feature 独立订阅、具体通知身份及仅 MASTER 连接/订阅：`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:168,183,191,199,204,212,229`。
- 详设 CP-04 要求 TDC 独占协议状态、registered subscribe/unsubscribe/accept commands、SESSION_READY 后发送及接受时间selector；CP-05 承接具名 `store-basic` fanout consumer：`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:54-55,99,228,332-356`。
- 计划阶段边界已明确：CP-04 的三类命令由 TDC actor 消费；`topic-changed` 是允许零消费者的 fanout command，具名 `store-basic` consumer 在 CP-05 建立并验证；CP-05 出口检查 consumer 已接线：`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:62-73`。
- Command 注册与公开导出、accepted time 持久化/active intent 重建、protocol key generation、MASTER 检查、ready/reconnect 发订阅、具体通知匹配与旧通知拒绝，分别由当前代码与测试覆盖；精确路径及判据见 `doc/review/platform/2026-10-04-v2s-tdp-cp-04-focused-proof-codex.md`。
- 当前 focused proof 记录 package typecheck、40 tests、lint、protocol generator `--check` 与 `--self-test` 的真实退出结果，并保留第一次失败及 `req_…` 不符合 UUID wire schema 的根因修复。

## 边界与未验证项

CP-04 不证明 store-basic 实际 consumer、CBS→TDS→TDC→feature 全链、Expo Web、adapter、DEV/backend-acceptance、远程操作或全批 6b。以上未声称 PASS，留在后续 CP 和批次级验收。
