# TDP CP-01 独立三维对账

```text
REVIEW_TARGET=CP_RECONCILIATION
CP=CP-01
RECONCILIATION=MATCHED
REVIEWER=/root/tdp_cp01_reconcile_after_fix
REVIEW_MODE=FRESH_INDEPENDENT_READ_ONLY
```

## 对账结论

CP-01 当前阶段的需求、详设/计划、项目记忆规范与实现证据逐项对照为 `MATCHED`。此结论只解锁下一阶段，不代表全批 6b、整体验收、DEV、Expo Web、逐代码对账或最终实施 review 已完成。

## 核验范围

- **需求：** 正式需求 V-07 对八项 terminal HTTP 读取、完整资料、同快照与依赖拒绝的要求。
- **详设/计划：** 8 个 terminal GET 的 credential context、canonical → materialize → edge-codegen → TDC generated 链，以及 `PLATFORM_DEPENDENCY_UNAVAILABLE/503` 的实现和判据。
- **实现：** `TerminalDataReadController` 将 `DataAccessResourceFailureException` 与 `TransientDataAccessException` 映射到 503；focused MockMvc test 触发前者并断言 503 与错误码。reviewer 特别确认后者只有源码映射证明，没有单独动态用例，不夸大测试覆盖。
- **真实路由：** 8 个正常 GET、缺失合同 404、错误凭证 403 与业务读回仍由真实 HTTP acceptance 覆盖。
- **治理：** 记忆要求以行为证据核验而非采信声明；新增映射没有触及 CP-01 的 owner、授权或契约边界。

## 当前字节证据

- `r5-tc-1791136001954-63418`：`TerminalDataReadControllerTest.mapsOwnerDatabaseFailureToTerminalDependencyUnavailable`，测试 1/1；业务结果 `NOT_APPLICABLE`；受管 runner/process/workspace/container/volume cleanup `PASS`。
- `r5-tc-1791136156911-66469`：`terminalDataReadOwnerRoutes`，selected 1/1，`CONTRACT=PASS`、`BUSINESS=PASS`、TDS contract `PASS`、cleanup `PASS`。8 个正常 GET 的实测 SELECT 数为 6/7/2/2/4/4/8/5，均无写入；另验证 404 和 403。
- 独立 reviewer 检查当前源码、focused test、JUnit XML、run manifest、HTTP/DB events、生成链和 CP-01 原分母；结论无 `OPEN`。

## 证据边界

本记录不升级 `scripts/verify`、全目录 backend-acceptance/calibration、DEV 数据链、Expo Web、最终 13c 或整批 implementation review 的状态。未覆盖执行面继续按计划标 `NOT_RUN` / `NOT_COVERED`。
