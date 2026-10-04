# TDP · CP-02 独立三维对账

```text
TASK=Terminal Data Platform data-change and remote-operations
CP=CP-02
RECONCILIATION=MATCHED
REVIEWER=/root/cp02_final_fresh_review2
REVIEW_MODE=FRESH_INDEPENDENT_READ_ONLY
```

## 对账结论

CP-02 当前阶段的需求、详设/计划和项目记忆约束逐项对照为 `MATCHED`。本记录仅解锁下一 CP；不表示 CP-03～CP-06、整批 6b、整体验收、DEV/Expo Web、逐代码对账或最终实施 review 已完成。

## 核验范围与证据

- **需求维度：** 正式需求 §4.1a、§4.1b 定义精确 topic、集合 topic 及 STORE/STORE_OPERATING_RULE、CONTRACT、AREA、POINT mutation 分母：`doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:342,354,384,386,399,405`。
- **详设/计划维度：** CP-02 owner 写入、同事务集合快照、锁顺序、raw-time query、迁移及验收判据见 `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:96-99` 与 `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:42-49`。
- **项目记忆维度：** reviewer 重新读取实施任务、数据 owner、事务/通知、主 agent 写入边界与三维 CP 规则；实现复用 owner transaction、PostgreSQL advisory lock/NOTIFY 与现有 typed/legacy mutation cores，没有引入旁路 owner 或额外消息机制。
- **Owner 实现核验：** STORE 三条变更路径均发布 `STORE` 与 `STORE_OPERATING_RULE`：`StoreService.java:519-520,610-611,644-645`；持久层将两个 topic 映射为不同键：`StorePersistence.java:26,34`。旧 store-contract create/update 与 typed create/update/invalidate 均接入所需 hook，见 CP-02 focused proof 中的精确源码引用。
- **动态证明：** `doc/review/platform/2026-10-04-v2s-tdp-cp-02-focused-proof-codex.md` 记录并绑定范围内的迁移、organization owner、service-point/area/contract acceptance、legacy contract 与 STORE transition focused runs。最新针对 transition 的 `r5-tc-1791107578290-60643` manifest 为 PASS，选定 Gradle test task 成功，远端 Testcontainers 与 runner cleanup 均 PASS；旧失败 `r5-tc-1791107488619-58825` 保留并定位为测试参数顺序错误，随后同一 focused test 通过。

## 曾发现并关闭的 OPEN

1. Fresh CP-02 reviewer `/root/cp02_final_fresh_review` 指出旧 store-contract 参数 create/update core 未接 TDP hook。主 agent 独立回源后确认并在既有 core 补最小 hook；实际 PostgreSQL LISTEN 测试由 `r5-tc-1791107032027-49102` 通过，清理 PASS。
2. Fresh reviewer `/root/cp02_after_legacy_hooks` 随后发现 `transitionStoreStatus` 少发 `STORE_OPERATING_RULE`。主 agent回到正式需求和 `StoreService.transitionNow` 核实后补齐第二个既有通知调用；新增确定性 PostgreSQL notification 测试由 `r5-tc-1791107578290-60643` 通过，清理 PASS。
3. 修正后的完整 CP-02 由 fresh reviewer `/root/cp02_final_fresh_review2` 再次检查并给出 `MATCHED`，无残余 OPEN。该 reviewer 逐项核验了 owner paths、快照/锁/迁移、计划退出条件与对应运行证据。

## 证据边界

旧失败 `r5-tc-1791107488619-58825` 的 business test 未通过，cleanup PASS；这是已定位、已修正的测试编译调用错误，不隐藏也不把它记作通过。当前最后一次 CP-02 focused run `r5-tc-1791107578290-60643` 为 PASS，cleanup PASS。全批动态回归及后续阶段证据尚未运行；不以本 CP 的 MATCHED 推断它们通过。
