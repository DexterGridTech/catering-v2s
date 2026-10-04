# TDP CP-05 阶段三维对账

```text
REVIEW_TARGET=CP_RECONCILIATION
CP=CP-05
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=MATCHED
SCOPE=CP-05 principal bootstrap 与分阶段权限边界
```

本记录是当前 CP-05 阶段级独立对账，不是全批 6b、动态验收或整批实施 verdict。第一次复核发现 bootstrap 对 CP-06 尚未创建的 `terminal_control` 对象有无条件 grant/probe，主 agent 修复后，由 fresh 独立 reviewer `/root/cp05_reconcile_after_principal_fix` 复查同一个完整 CP-05，结论 `MATCHED`。

## 三维结论

| 维度 | 核对范围 | 当前字节证据 | 结论 |
| --- | --- | --- | --- |
| 需求 | R-12 对 TDS 独立 principal、只读 owner 事实、最小权限的要求 | `doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:305-334` | MATCHED |
| 详设/计划 | CP-03 验证已存在对象；CP-06 对 terminal-control 对象建立后再授权和验证 | `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md:154-169`；`doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md:69-75,94` | MATCHED |
| 项目记忆规范 | 阶段级对账、权限边界、使用当前字节并区分静态/运行证据 | `project-memory/operations/test-closed-loop.md:16`；`project-memory/operations/phase-retrospective-and-systemic-repair.md:132` | MATCHED |

## 核验的实现落点

- DEV bootstrap 的基础 grants 不含 `terminal_control`；只有 schema、在线操作表及两个函数完整存在时才 grant schema `USAGE` 与函数 `EXECUTE`。对象全缺时记录 deferred；部分存在时明确失败。`scripts/dev/r5-dev-runner.mjs:935-973`。
- 权限探测遵循同一闭包：对象全缺时记录 not applicable；完整对象集存在时才验证函数调用与直接表 DML 拒绝。`scripts/dev/r5-dev-runner.mjs:982`。
- runner 明确先等业务 readiness/Flyway，再配置独立 TDS principal，最后登记并启动受管 TDS。`scripts/dev/r5-dev-runner.mjs:2327-2357`。
- backend-acceptance 的 `TdsDatabasePrincipal` 亦区分不存在、完整与部分对象集；基础权限不含 terminal-control，完整时才 grant/probe。`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TdsDatabasePrincipal.java:85-169`。
- runner 源码测试断言阶段顺序及对象集闭包。`scripts/dev/r5-dev-command-wrapper.test.mjs:380-421`。

CP-05 的实现与 focused proof 已与本 CP 需求、详设、项目记忆三维一致。该结果不代表 CP-06 已完成，也不证明 TDS principal 在 DEV/acceptance 数据库中的真实权限运行结果。

## 证据边界

- 本次针对 CP-05 的 source/plan 修订后，runner Node 测试为 21/21；`catering-business-server:compileTestJava` 成功。两项是 focused 静态/编译证据，不是 DEV 或 backend-acceptance 运行。
- 既有 CP-05 proof 中的业务 acceptance、DEV 与 Expo Web 状态继续是 `NOT_RUN`；本记录不升级历史结果。
- 后续 CP-06 修改如触及此处的 principal/provision 路径，只差量复核受影响部分；不重复无关 CP-05 工作。
