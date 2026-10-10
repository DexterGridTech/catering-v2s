SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# Stage B TDS topic acceptance 首败与修复记录

## 失败记录

- run id：`r5-tc-1791581311976-12865`
- 开始/结束：`2026-10-09T21:28:31.977Z` / `2026-10-09T21:31:54.258Z`
- 命令：`scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.topic.terminal-update-rules`
- 当前字节结果：FAIL；业务：`NOT_RUN`；Testcontainers/远端进程/工作区 cleanup：`PASS`；原 DEV 已 stop，因测试失败未自动恢复。
- first failure：`TEST_ASSERTION_ERROR_ASSERTIONERROR_CONTRACT_EXPECTED_N_UNEXPECTED_HTTP_STATUS_N_REQUESTMETHOD_POST_REQUESTPATH_API_O`
- 失败位置：测试场景创建 FULL-only 规则时，HTTP POST 返回 422 `PLATFORM_COMMON_VALIDATION_FAILED`（“终端更新规则不满足 owner 约束”），发生在 TDS topic 断言前。

## 根因核验

- 正式需求 R-06 与阶段 B 详设 §8.2 允许 FULL-only 规则；FULL-only 不携带 HOT 策略或 M。
- `TerminalUpdateRuleOwnerService.validateRule` 在 `hotArtifactRef == null` 时要求 `hotStrategy == null` 且 `mSeconds == null`。生产 owner 的拒绝符合契约，未发现生产实现缺陷。
- `TerminalUpdateAcceptanceScenarios.createRuleCoverageOnly` 与 `createRule` 均只接收 FULL 工件引用、没有 HOT 工件参数，却在请求中固定发送 `hotStrategy=IMMEDIATE`，因此构造了无效 FULL-only 请求。
- 有限同根范围：本文件内 `createRule` 有 3 个调用点，`createRuleCoverageOnly` 有 4 个调用点；两个 helper 都只构造 FULL-only 规则。修复在两个共享 helper 完成，没有更改规则 owner、业务契约或其他阶段。

## 最小修正及证明

- 两个 FULL-only 请求构造器均移除 `hotStrategy`；`mSeconds` 原本未发送，保持省略。
- 两个 helper 增加业务断言，确认 HTTP 持久化读回明确包含 `hotArtifactRef: null`。
- 验收证明：同一命令复跑成功，run id `r5-tc-1791581711945-13865`，开始/结束 `2026-10-09T21:35:11.945Z` / `2026-10-09T21:38:44.063Z`。真实输出：`BACKEND_ACCEPTANCE_RESULT SCENARIO=storeTerminalActivationBusinessPrecedence MODULE=TERMINAL_BINDING CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=7`、`BACKEND_ACCEPTANCE_TDS_CONTRACT_SUMMARY DISCOVERED=3 PASS=3 FAIL=0`、`R5_REMOTE_TESTCONTAINERS=PASS ... BUSINESS=PASS ... RESOURCE_CLEANUP=PASS`。当前 manifest `status=PASS`、`firstFailure=null`；容器、卷、远端进程和工作区 cleanup 均 PASS；该 run 开始时 DEV 已停止，故 `restore=NOT_APPLICABLE`。
- 不新增场景：本批已有规则分页与 TDS topic 验收直接创建并读回 FULL-only 规则，覆盖该合法边界；本次问题是共享 acceptance fixture 不符合已接受 owner 契约，不是生产 HTTP 回归。

## 通用失败模式与边界

在 acceptance helper 只构造一种业务分支时，不得附带另一分支的可选字段；字段集合应由 helper 输入能表达的事实决定。对于仅构造 FULL 的 helper，HOT 工件为空时不得发送 HOT 策略。该结论不限制真实 FULL+HOT helper，也不更改生产端对非法组合的拒绝行为。

## 最终 DEV 启动边界

- 默认 calibrated start 首败：run id `r5-dev-1791581940180-14259-7aebbff7-de20-4727-ac65-9743b96e737b`，`firstFailure=R5_DEV_RUNNERREFUSED REASON=REMOTE_BUSINESS_SERVER_STARTUP_FAILED:APPLICATION_STARTUP_FAILED`，`lastKnownGood=REMOTE_JAVA_CONTROL_READY`，`brokenBoundary=REMOTE_BUSINESS_READINESS_BEFORE_TDS`；CBS build log 的首因是 `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact`。该 run 的远端 Java stop、Doris retain、远端 root、SSH tunnel 与本地进程 cleanup 均 PASS。
- 根因事实：`contracts/policy/backend-performance-cp05-calibration-report.json` 生成于 `2026-10-05`，304 项中没有 `stagePlatformTerminalUpdateArtifact`；当前生产 operation roster 包含该操作。不得以默认 calibrated 通过、预算已校准或修改/伪造测量掩盖该字节差异。
- 恢复方式：现有受管 runner 明确允许 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`。使用 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/dev/start` 启动，run id `r5-dev-1791582207969-15314-4ad905ab-fc3f-45df-b309-b48cf768e7b8`，runner 输出 `R5_DEV_START=PASS`；三台 TDS readiness、DB listener、RSS 门、HAProxy 双入口及两后台 Vite 均完成。当前保留 DEV 使用 identity-only；这证明本批 DEV runtime readiness，不证明 CP-05 calibrated budget。未执行全304 operation 三次标定；Stage B 动态链不依赖该标定，预算报告差异留作显式残项。
